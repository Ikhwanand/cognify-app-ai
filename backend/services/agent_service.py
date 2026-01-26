from agno.agent import Agent
from agno.models.groq import Groq
from agno.models.nvidia import Nvidia
from agno.db.postgres import PostgresDb
from agno.vectordb.pgvector import PgVector, SearchType
from agno.knowledge.embedder.sentence_transformer import SentenceTransformerEmbedder
from agno.knowledge import Knowledge
from config import settings
from typing import Optional, List, Dict
import os
import time

# Import tools - No API key required
from agno.tools.websearch import WebSearchTools
from agno.tools.yfinance import YFinanceTools
from agno.tools.wikipedia import WikipediaTools
from agno.tools.arxiv import ArxivTools
from agno.tools.calculator import CalculatorTools
from agno.tools.newspaper4k import Newspaper4kTools
from agno.tools.reasoning import ReasoningTools
from agno.tools.youtube import YouTubeTools

os.environ["GROQ_API_KEY"] = settings.groq_api_key
os.environ["NVIDIA_API_KEY"] = settings.nvidia_api_key


class AgentService:
    def __init__(self):
        self.storage = PostgresDb(
            db_url=settings.database_url, session_table="agent_sessions"
        )
        self.vector_db = PgVector(
            db_url=settings.database_url,
            table_name="agent_vectors",
            embedder=SentenceTransformerEmbedder(),
            search_type=SearchType.hybrid,
        )

        # Initialize all available tools
        self.tools = [
            WebSearchTools(),  # Web search (default)
            YFinanceTools(),  # Stock/Finance data
            WikipediaTools(),  # Wikipedia search
            ArxivTools(),  # Academic papers
            CalculatorTools(),  # Math calculations
            Newspaper4kTools(),  # News article extraction
            ReasoningTools(),  # Logical reasoning
            YouTubeTools(),  # YouTube search
        ]

    def create_agent(
        self,
        model: str = None,
        temperature: float = None,
        system_prompt: str = None,
        session_id: str = None,
    ) -> Agent:
        """Create an Agno agent with specified settings"""

        model = model or settings.default_model
        temperature = (
            temperature if temperature is not None else settings.default_temperature
        )
        system_prompt = (
            system_prompt
            or "You are a helpful AI assistant with access to various tools including web search, Wikipedia, academic papers (Arxiv), finance data, news articles, YouTube, and calculation capabilities. Use these tools when appropriate to provide accurate and helpful responses."
        )

        # Determine model provider
        if model.startswith("nvidia/"):
            actual_model = model.replace("nvidia/", "")
            model_provider = Nvidia(id=actual_model, temperature=temperature)
        else:
            model_provider = Groq(id=model, temperature=temperature)

        agent = Agent(
            model=model_provider,
            session_id=session_id,
            instructions=[system_prompt],
            markdown=True,
            db=self.storage,
            knowledge=Knowledge(
                name="Agent Knowledge",
                vector_db=self.vector_db,
                max_results=5,
            ),
            add_datetime_to_context=True,
            tools=self.tools,
        )

        return agent

    def _build_enhanced_message(
        self, message: str, context: Optional[List[str]] = None
    ) -> str:
        """Build enhanced message with RAG context"""
        if context:
            context_text = "\n\n".join(context)
            return f"""Based on the following context from the knowledge base:

---
{context_text}
---

User question: {message}

Please answer the question based on the context provided. If the context doesn't contain relevant information, say so."""
        return message

    def _track_metrics(
        self,
        model_id: str,
        input_text: str,
        output_text: str,
        latency_ms: float,
        run_metrics: dict = None,
        tools_used: List[str] = None,
    ):
        """Track agent run metrics to the evaluation database"""
        try:
            from database import engine
            from sqlmodel import Session
            from models.evaluation import EvalResult
            import json

            # Extract metrics from run response
            input_tokens = run_metrics.get("input_tokens", 0) if run_metrics else 0
            output_tokens = run_metrics.get("output_tokens", 0) if run_metrics else 0
            total_tokens = (
                run_metrics.get("total_tokens", input_tokens + output_tokens)
                if run_metrics
                else 0
            )
            duration = (
                run_metrics.get("duration", latency_ms / 1000)
                if run_metrics
                else latency_ms / 1000
            )
            time_to_first_token = (
                run_metrics.get("time_to_first_token") if run_metrics else None
            )

            with Session(engine) as db:
                eval_result = EvalResult(
                    eval_type="performance",
                    eval_name="Auto-tracked Chat",
                    model_id=model_id,
                    input_text=input_text[:500],  # Truncate for storage
                    actual_output=output_text[:500] if output_text else None,
                    latency_ms=latency_ms,
                    tokens_used=total_tokens if total_tokens > 0 else None,
                    tool_calls_actual=json.dumps(tools_used) if tools_used else None,
                    tool_success_rate=100.0 if tools_used else None,
                    status="completed",
                    passed=latency_ms < 10000,  # Pass if under 10 seconds
                    extra_data={
                        "input_tokens": input_tokens,
                        "output_tokens": output_tokens,
                        "duration": duration,
                        "time_to_first_token": time_to_first_token,
                    }
                    if run_metrics
                    else None,
                )
                db.add(eval_result)
                db.commit()
        except Exception as e:
            # Don't fail the chat if metrics tracking fails
            print(f"Warning: Failed to track metrics: {e}")

    async def chat(
        self,
        message: str,
        session_id: Optional[str] = None,
        context: Optional[List[str]] = None,
        user_settings: Optional[Dict] = None,
    ) -> str:
        """Send a message and get a response (non-streaming)"""

        # Extract settings
        model = user_settings.get("model") if user_settings else None
        temperature = user_settings.get("temperature") if user_settings else None
        system_prompt = user_settings.get("system_prompt") if user_settings else None

        model_id = model or settings.default_model

        agent = self.create_agent(
            model=model,
            temperature=temperature,
            system_prompt=system_prompt,
            session_id=session_id,
        )

        enhanced_message = self._build_enhanced_message(message, context)

        # Track start time
        start_time = time.time()

        # Get response
        response = agent.run(enhanced_message)

        # Calculate latency
        latency_ms = (time.time() - start_time) * 1000

        # Extract metrics from response
        run_metrics = None
        tools_used = []

        if hasattr(response, "metrics") and response.metrics:
            run_metrics = (
                response.metrics.to_dict()
                if hasattr(response.metrics, "to_dict")
                else {}
            )

        # Detect tools used from messages
        if hasattr(response, "messages") and response.messages:
            for msg in response.messages:
                if hasattr(msg, "tool_calls") and msg.tool_calls:
                    for tool_call in msg.tool_calls:
                        tool_name = (
                            getattr(tool_call, "function", {}).get("name", "")
                            if hasattr(tool_call, "function")
                            else str(tool_call)
                        )
                        if tool_name and tool_name not in tools_used:
                            tools_used.append(tool_name)

        # Track metrics asynchronously
        self._track_metrics(
            model_id=model_id,
            input_text=message,
            output_text=response.content,
            latency_ms=latency_ms,
            run_metrics=run_metrics,
            tools_used=tools_used if tools_used else None,
        )

        return response.content

    async def chat_stream(
        self,
        message: str,
        session_id: Optional[str] = None,
        context: Optional[List[str]] = None,
        user_settings: Optional[Dict] = None,
    ):
        """Send a message and stream the response"""
        import asyncio

        # Extract settings
        model = user_settings.get("model") if user_settings else None
        temperature = user_settings.get("temperature") if user_settings else None
        system_prompt = user_settings.get("system_prompt") if user_settings else None

        model_id = model or settings.default_model

        agent = self.create_agent(
            model=model,
            temperature=temperature,
            system_prompt=system_prompt,
            session_id=session_id,
        )

        enhanced_message = self._build_enhanced_message(message, context)

        # Track start time
        start_time = time.time()
        first_token_time = None
        full_response = ""
        tools_used = []

        # Stream response using Agno's run method with stream=True
        response_stream = agent.run(enhanced_message, stream=True)

        for chunk in response_stream:
            if chunk.content:
                # Track time to first token
                if first_token_time is None:
                    first_token_time = time.time() - start_time

                full_response += chunk.content
                yield chunk.content

            # Check for tool calls in chunk
            if hasattr(chunk, "messages") and chunk.messages:
                for msg in chunk.messages:
                    if hasattr(msg, "tool_calls") and msg.tool_calls:
                        for tool_call in msg.tool_calls:
                            tool_name = (
                                getattr(tool_call, "function", {}).get("name", "")
                                if hasattr(tool_call, "function")
                                else str(tool_call)
                            )
                            if tool_name and tool_name not in tools_used:
                                tools_used.append(tool_name)

            # Small yield to allow cancellation check
            await asyncio.sleep(0)

        # Calculate final latency
        latency_ms = (time.time() - start_time) * 1000

        # Build metrics dict
        run_metrics = {
            "duration": latency_ms / 1000,
            "time_to_first_token": first_token_time,
        }

        # Track metrics after stream completes
        self._track_metrics(
            model_id=model_id,
            input_text=message,
            output_text=full_response,
            latency_ms=latency_ms,
            run_metrics=run_metrics,
            tools_used=tools_used if tools_used else None,
        )


agent_service = AgentService()
