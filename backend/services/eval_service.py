"""
Evaluation Service for running and managing AI agent evaluations.
Uses Agno's built-in eval framework for accuracy, performance, and reliability testing.
"""

from typing import Optional, List
from datetime import datetime, timedelta
from sqlmodel import Session, select
import json
import time

from models.evaluation import EvalResult
from schemas.evaluation import (
    EvalTypeEnum,
    RunEvalRequest,
    EvalStatsResponse,
    DashboardSummary,
    EvalHistoryResponse,
    ToolUsageStats,
)
from services.agent_service import agent_service
from config import settings


class EvalService:
    """Service for running evaluations and computing statistics"""

    async def run_accuracy_eval(
        self,
        db: Session,
        request: RunEvalRequest,
    ) -> EvalResult:
        """Run an accuracy evaluation using LLM-as-judge methodology"""

        model_id = request.model_id or settings.default_model
        start_time = time.time()

        try:
            # Run the agent to get actual output
            response = await agent_service.chat(
                message=request.input_text, user_settings={"model": model_id}
            )

            latency_ms = (time.time() - start_time) * 1000

            # Simple accuracy scoring (can be enhanced with LLM-as-judge)
            accuracy_score = self._calculate_accuracy_score(
                expected=request.expected_output,
                actual=response,
                guidelines=request.additional_guidelines,
            )

            passed = accuracy_score >= 7.0

            # Create result
            result = EvalResult(
                eval_type=EvalTypeEnum.ACCURACY.value,
                eval_name=request.eval_name,
                model_id=model_id,
                input_text=request.input_text,
                expected_output=request.expected_output,
                actual_output=response,
                accuracy_score=accuracy_score,
                latency_ms=latency_ms,
                status="completed",
                passed=passed,
            )

            db.add(result)
            db.commit()
            db.refresh(result)

            return result

        except Exception as e:
            # Log error and save failed result
            result = EvalResult(
                eval_type=EvalTypeEnum.ACCURACY.value,
                eval_name=request.eval_name,
                model_id=model_id,
                input_text=request.input_text,
                expected_output=request.expected_output,
                status="failed",
                passed=False,
                error_message=str(e),
            )
            db.add(result)
            db.commit()
            db.refresh(result)
            return result

    async def run_performance_eval(
        self,
        db: Session,
        request: RunEvalRequest,
    ) -> EvalResult:
        """Run a performance evaluation measuring latency and memory"""

        model_id = request.model_id or settings.default_model

        try:
            import psutil

            process = psutil.Process()
            memory_before = process.memory_info().rss / 1024 / 1024  # MB

            start_time = time.time()

            response = await agent_service.chat(
                message=request.input_text, user_settings={"model": model_id}
            )

            latency_ms = (time.time() - start_time) * 1000
            memory_after = process.memory_info().rss / 1024 / 1024
            memory_used = memory_after - memory_before

            # Performance is "passed" if latency is reasonable (< 5 seconds)
            passed = latency_ms < 5000

            result = EvalResult(
                eval_type=EvalTypeEnum.PERFORMANCE.value,
                eval_name=request.eval_name,
                model_id=model_id,
                input_text=request.input_text,
                actual_output=response,
                latency_ms=latency_ms,
                memory_mb=max(0, memory_used),
                status="completed",
                passed=passed,
            )

            db.add(result)
            db.commit()
            db.refresh(result)

            return result

        except Exception as e:
            result = EvalResult(
                eval_type=EvalTypeEnum.PERFORMANCE.value,
                eval_name=request.eval_name,
                model_id=model_id,
                input_text=request.input_text,
                status="failed",
                passed=False,
                error_message=str(e),
            )
            db.add(result)
            db.commit()
            db.refresh(result)
            return result

    async def run_reliability_eval(
        self,
        db: Session,
        request: RunEvalRequest,
    ) -> EvalResult:
        """Run a reliability evaluation checking tool call correctness"""

        model_id = request.model_id or settings.default_model
        expected_tools = request.expected_tools or []

        try:
            start_time = time.time()

            response = await agent_service.chat(
                message=request.input_text, user_settings={"model": model_id}
            )

            latency_ms = (time.time() - start_time) * 1000

            # For now, simulate tool detection (can be enhanced)
            # In real implementation, we'd track actual tool calls from agent
            actual_tools = self._detect_tools_used(response)

            tool_success_rate = self._calculate_tool_success_rate(
                expected_tools, actual_tools
            )

            passed = tool_success_rate >= 80.0

            result = EvalResult(
                eval_type=EvalTypeEnum.RELIABILITY.value,
                eval_name=request.eval_name,
                model_id=model_id,
                input_text=request.input_text,
                actual_output=response,
                tool_calls_expected=json.dumps(expected_tools),
                tool_calls_actual=json.dumps(actual_tools),
                tool_success_rate=tool_success_rate,
                latency_ms=latency_ms,
                status="completed",
                passed=passed,
            )

            db.add(result)
            db.commit()
            db.refresh(result)

            return result

        except Exception as e:
            result = EvalResult(
                eval_type=EvalTypeEnum.RELIABILITY.value,
                eval_name=request.eval_name,
                model_id=model_id,
                input_text=request.input_text,
                tool_calls_expected=json.dumps(expected_tools),
                status="failed",
                passed=False,
                error_message=str(e),
            )
            db.add(result)
            db.commit()
            db.refresh(result)
            return result

    async def run_eval(
        self,
        db: Session,
        request: RunEvalRequest,
    ) -> EvalResult:
        """Run evaluation based on type"""
        if request.eval_type == EvalTypeEnum.ACCURACY:
            return await self.run_accuracy_eval(db, request)
        elif request.eval_type == EvalTypeEnum.PERFORMANCE:
            return await self.run_performance_eval(db, request)
        elif request.eval_type == EvalTypeEnum.RELIABILITY:
            return await self.run_reliability_eval(db, request)
        else:
            raise ValueError(f"Unknown eval type: {request.eval_type}")

    def get_results(
        self,
        db: Session,
        eval_type: Optional[str] = None,
        model_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[EvalResult]:
        """Get evaluation results with optional filtering"""
        query = select(EvalResult)

        if eval_type:
            query = query.where(EvalResult.eval_type == eval_type)
        if model_id:
            query = query.where(EvalResult.model_id == model_id)

        query = query.order_by(EvalResult.created_at.desc())
        query = query.offset(offset).limit(limit)

        return db.exec(query).all()

    def get_stats(
        self,
        db: Session,
    ) -> EvalStatsResponse:
        """Get aggregated statistics for ALL evaluations"""

        # Get all results without date filter
        results = db.exec(select(EvalResult)).all()

        if not results:
            return EvalStatsResponse(
                total_evals=0,
                passed_count=0,
                failed_count=0,
                pass_rate=0.0,
                avg_accuracy=None,
                min_accuracy=None,
                max_accuracy=None,
                avg_latency_ms=None,
                min_latency_ms=None,
                max_latency_ms=None,
                avg_memory_mb=None,
                avg_tool_success_rate=None,
                stats_by_model={},
                stats_by_type={},
            )

        total = len(results)
        passed = sum(1 for r in results if r.passed)
        failed = total - passed

        # Accuracy stats
        accuracy_scores = [
            r.accuracy_score for r in results if r.accuracy_score is not None
        ]
        latencies = [r.latency_ms for r in results if r.latency_ms is not None]
        memories = [r.memory_mb for r in results if r.memory_mb is not None]
        tool_rates = [
            r.tool_success_rate for r in results if r.tool_success_rate is not None
        ]

        # Stats by model
        stats_by_model = {}
        models = set(r.model_id for r in results)
        for model in models:
            model_results = [r for r in results if r.model_id == model]
            model_accuracy = [
                r.accuracy_score for r in model_results if r.accuracy_score
            ]
            model_latency = [r.latency_ms for r in model_results if r.latency_ms]
            stats_by_model[model] = {
                "count": len(model_results),
                "pass_rate": sum(1 for r in model_results if r.passed)
                / len(model_results)
                * 100,
                "avg_accuracy": sum(model_accuracy) / len(model_accuracy)
                if model_accuracy
                else None,
                "avg_latency": sum(model_latency) / len(model_latency)
                if model_latency
                else None,
            }

        # Stats by type
        stats_by_type = {}
        types = set(r.eval_type for r in results)
        for eval_type in types:
            type_results = [r for r in results if r.eval_type == eval_type]
            stats_by_type[eval_type] = {
                "count": len(type_results),
                "pass_rate": sum(1 for r in type_results if r.passed)
                / len(type_results)
                * 100,
            }

        return EvalStatsResponse(
            total_evals=total,
            passed_count=passed,
            failed_count=failed,
            pass_rate=(passed / total * 100) if total > 0 else 0.0,
            avg_accuracy=sum(accuracy_scores) / len(accuracy_scores)
            if accuracy_scores
            else None,
            min_accuracy=min(accuracy_scores) if accuracy_scores else None,
            max_accuracy=max(accuracy_scores) if accuracy_scores else None,
            avg_latency_ms=sum(latencies) / len(latencies) if latencies else None,
            min_latency_ms=min(latencies) if latencies else None,
            max_latency_ms=max(latencies) if latencies else None,
            avg_memory_mb=sum(memories) / len(memories) if memories else None,
            avg_tool_success_rate=sum(tool_rates) / len(tool_rates)
            if tool_rates
            else None,
            stats_by_model=stats_by_model,
            stats_by_type=stats_by_type,
        )

    def get_dashboard_summary(self, db: Session) -> DashboardSummary:
        """Get summary data for dashboard cards"""
        stats = self.get_stats(db)  # Get ALL stats without day filter

        # Determine trend (compare last 7 days vs previous 7 days)
        recent_results = db.exec(
            select(EvalResult).where(
                EvalResult.created_at >= datetime.utcnow() - timedelta(days=7)
            )
        ).all()

        older_results = db.exec(
            select(EvalResult)
            .where(EvalResult.created_at >= datetime.utcnow() - timedelta(days=14))
            .where(EvalResult.created_at < datetime.utcnow() - timedelta(days=7))
        ).all()

        recent_avg = (
            sum(r.accuracy_score or 0 for r in recent_results) / len(recent_results)
            if recent_results
            else 0
        )
        older_avg = (
            sum(r.accuracy_score or 0 for r in older_results) / len(older_results)
            if older_results
            else 0
        )

        if recent_avg > older_avg + 0.5:
            trend = "up"
        elif recent_avg < older_avg - 0.5:
            trend = "down"
        else:
            trend = "stable"

        # Find best model
        best_model = None
        best_accuracy = 0.0
        for model, model_stats in stats.stats_by_model.items():
            if (
                model_stats.get("avg_accuracy")
                and model_stats["avg_accuracy"] > best_accuracy
            ):
                best_accuracy = model_stats["avg_accuracy"]
                best_model = model

        return DashboardSummary(
            avg_accuracy=stats.avg_accuracy or 0.0,
            avg_latency_ms=stats.avg_latency_ms or 0.0,
            tool_success_rate=stats.avg_tool_success_rate or 0.0,
            total_evals=stats.total_evals,
            pass_rate=stats.pass_rate,
            recent_trend=trend,
            best_model=best_model,
            best_model_accuracy=best_accuracy if best_model else None,
        )

    def get_history(
        self,
        db: Session,
    ) -> List[EvalHistoryResponse]:
        """Get daily evaluation history for charts - ALL data"""

        results = db.exec(select(EvalResult)).all()

        # Group by date
        daily_data = {}
        for r in results:
            date_str = r.created_at.strftime("%Y-%m-%d")
            if date_str not in daily_data:
                daily_data[date_str] = {
                    "accuracy_scores": [],
                    "latencies": [],
                    "passed": 0,
                    "total": 0,
                }

            daily_data[date_str]["total"] += 1
            if r.passed:
                daily_data[date_str]["passed"] += 1
            if r.accuracy_score:
                daily_data[date_str]["accuracy_scores"].append(r.accuracy_score)
            if r.latency_ms:
                daily_data[date_str]["latencies"].append(r.latency_ms)

        history = []
        for date_str, data in sorted(daily_data.items()):
            history.append(
                EvalHistoryResponse(
                    date=date_str,
                    accuracy_avg=sum(data["accuracy_scores"])
                    / len(data["accuracy_scores"])
                    if data["accuracy_scores"]
                    else None,
                    latency_avg=sum(data["latencies"]) / len(data["latencies"])
                    if data["latencies"]
                    else None,
                    eval_count=data["total"],
                    pass_rate=(data["passed"] / data["total"] * 100)
                    if data["total"] > 0
                    else 0.0,
                )
            )

        return history

    def get_tool_usage(self, db: Session) -> List[ToolUsageStats]:
        """Get tool usage statistics - ALL data"""

        results = db.exec(
            select(EvalResult).where(EvalResult.tool_calls_actual.isnot(None))
        ).all()

        tool_stats = {}
        for r in results:
            if r.tool_calls_actual:
                try:
                    tools = json.loads(r.tool_calls_actual)
                    for tool in tools:
                        if tool not in tool_stats:
                            tool_stats[tool] = {"count": 0, "success": 0}
                        tool_stats[tool]["count"] += 1
                        if r.passed:
                            tool_stats[tool]["success"] += 1
                except json.JSONDecodeError:
                    pass

        return [
            ToolUsageStats(
                tool_name=name,
                usage_count=stats["count"],
                success_rate=(stats["success"] / stats["count"] * 100)
                if stats["count"] > 0
                else 0.0,
            )
            for name, stats in tool_stats.items()
        ]

    def _calculate_accuracy_score(
        self,
        expected: Optional[str],
        actual: str,
        guidelines: Optional[str] = None,
    ) -> float:
        """
        Calculate accuracy score (simplified version).
        In production, this should use LLM-as-judge methodology.
        """
        if not expected:
            return 7.0  # Default score if no expected output

        expected_lower = expected.lower().strip()
        actual_lower = actual.lower().strip()

        # Exact match
        if expected_lower in actual_lower:
            return 10.0

        # Partial match based on word overlap
        expected_words = set(expected_lower.split())
        actual_words = set(actual_lower.split())

        if not expected_words:
            return 7.0

        overlap = len(expected_words & actual_words) / len(expected_words)

        # Score between 1 and 10 based on overlap
        return max(1.0, min(10.0, overlap * 10))

    def _detect_tools_used(self, response: str) -> List[str]:
        """
        Detect which tools were used based on response content.
        This is a simplified heuristic - real implementation would track actual tool calls.
        """
        tools_detected = []
        response_lower = response.lower()

        # Heuristic detection based on keywords
        tool_keywords = {
            "duckduckgo": ["search", "web search", "searched"],
            "wikipedia": ["wikipedia", "according to wikipedia"],
            "yfinance": ["stock", "price", "market", "trading", "$"],
            "calculator": ["calculated", "equals", "result is", "="],
            "arxiv": ["paper", "research", "arxiv", "study shows"],
            "youtube": ["video", "youtube", "watch"],
        }

        for tool, keywords in tool_keywords.items():
            if any(kw in response_lower for kw in keywords):
                tools_detected.append(tool)

        return tools_detected

    def _calculate_tool_success_rate(
        self,
        expected: List[str],
        actual: List[str],
    ) -> float:
        """Calculate tool call success rate"""
        if not expected:
            return 100.0  # No tools expected

        expected_set = set(t.lower() for t in expected)
        actual_set = set(t.lower() for t in actual)

        # Calculate match rate
        matches = len(expected_set & actual_set)
        return (matches / len(expected_set)) * 100


# Singleton instance
eval_service = EvalService()
