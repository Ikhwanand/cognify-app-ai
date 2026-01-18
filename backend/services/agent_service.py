from agno.agent import Agent
from agno.models.groq import Groq
from agno.models.nvidia import Nvidia
from agno.db.postgres import PostgresDb
from agno.vectordb.pgvector import PgVector, SearchType
from agno.knowledge.embedder.sentence_transformer import SentenceTransformerEmbedder
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.tools.yfinance import YFinanceTools
from agno.knowledge import Knowledge
from config import settings
from typing import Optional, List, Dict
import os

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
        system_prompt = system_prompt or "You are a helpful AI assistant."

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
            tools=[DuckDuckGoTools(), YFinanceTools()],
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

        agent = self.create_agent(
            model=model,
            temperature=temperature,
            system_prompt=system_prompt,
            session_id=session_id,
        )

        enhanced_message = self._build_enhanced_message(message, context)

        # Get response
        response = agent.run(enhanced_message)

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

        agent = self.create_agent(
            model=model,
            temperature=temperature,
            system_prompt=system_prompt,
            session_id=session_id,
        )

        enhanced_message = self._build_enhanced_message(message, context)

        # Stream response using Agno's run method with stream=True
        response_stream = agent.run(enhanced_message, stream=True)

        for chunk in response_stream:
            if chunk.content:
                yield chunk.content
            # Small yield to allow cancellation check
            await asyncio.sleep(0)


agent_service = AgentService()
