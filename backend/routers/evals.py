"""
Evaluation API Router
Endpoints for running evaluations and retrieving dashboard data.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import Optional, List
import json

from database import get_db
from models.evaluation import EvalResult, EvalBenchmark
from schemas.evaluation import (
    RunEvalRequest,
    CreateBenchmarkRequest,
    EvalResultResponse,
    EvalBenchmarkResponse,
    EvalStatsResponse,
    DashboardSummary,
    EvalHistoryResponse,
    ToolUsageStats,
)
from services.eval_service import eval_service


router = APIRouter(prefix="/api/evals", tags=["evaluations"])


# ============ Run Evaluations ============


@router.post("/run", response_model=EvalResultResponse)
async def run_evaluation(
    request: RunEvalRequest,
    db: Session = Depends(get_db),
):
    """
    Run a single evaluation.

    - **eval_type**: accuracy, performance, or reliability
    - **eval_name**: Name for this evaluation run
    - **input_text**: The input/question to test
    - **expected_output**: (For accuracy) Expected response
    - **expected_tools**: (For reliability) List of expected tool names
    """
    try:
        result = await eval_service.run_eval(db, request)
        return _convert_result_to_response(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/run-benchmark/{benchmark_id}", response_model=EvalResultResponse)
async def run_benchmark(
    benchmark_id: str,
    db: Session = Depends(get_db),
):
    """Run an evaluation using a predefined benchmark"""
    benchmark = db.get(EvalBenchmark, benchmark_id)
    if not benchmark:
        raise HTTPException(status_code=404, detail="Benchmark not found")

    request = RunEvalRequest(
        eval_type=benchmark.eval_type,
        eval_name=f"Benchmark: {benchmark.name}",
        input_text=benchmark.input_text,
        expected_output=benchmark.expected_output,
        expected_tools=json.loads(benchmark.expected_tools)
        if benchmark.expected_tools
        else None,
        additional_guidelines=benchmark.additional_guidelines,
        num_iterations=benchmark.num_iterations,
    )

    result = await eval_service.run_eval(db, request)
    return _convert_result_to_response(result)


# ============ Get Results ============


@router.get("/results", response_model=List[EvalResultResponse])
async def get_results(
    eval_type: Optional[str] = Query(None, description="Filter by eval type"),
    model_id: Optional[str] = Query(None, description="Filter by model"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Get evaluation results with optional filtering"""
    results = eval_service.get_results(db, eval_type, model_id, limit, offset)
    return [_convert_result_to_response(r) for r in results]


@router.get("/results/{result_id}", response_model=EvalResultResponse)
async def get_result(
    result_id: str,
    db: Session = Depends(get_db),
):
    """Get a specific evaluation result"""
    result = db.get(EvalResult, result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    return _convert_result_to_response(result)


# ============ Dashboard Endpoints ============


@router.get("/dashboard/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    db: Session = Depends(get_db),
):
    """Get summary data for dashboard KPI cards"""
    return eval_service.get_dashboard_summary(db)


@router.get("/dashboard/stats", response_model=EvalStatsResponse)
async def get_stats(
    db: Session = Depends(get_db),
):
    """Get aggregated statistics for ALL evaluations"""
    return eval_service.get_stats(db)


@router.get("/dashboard/history", response_model=List[EvalHistoryResponse])
async def get_history(
    db: Session = Depends(get_db),
):
    """Get daily evaluation history for trend charts - ALL data"""
    return eval_service.get_history(db)


@router.get("/dashboard/tool-usage", response_model=List[ToolUsageStats])
async def get_tool_usage(
    db: Session = Depends(get_db),
):
    """Get tool usage distribution for pie chart - ALL data"""
    return eval_service.get_tool_usage(db)


# ============ Delete All Data ============


@router.delete("/results/all")
async def delete_all_evaluations(
    db: Session = Depends(get_db),
):
    """Delete ALL evaluation results. Use with caution!"""
    from sqlmodel import delete

    # Count before delete
    count = len(db.exec(select(EvalResult)).all())

    # Delete all evaluation results
    db.exec(delete(EvalResult))
    db.commit()

    return {
        "message": f"Successfully deleted {count} evaluation results",
        "deleted_count": count,
    }


# ============ Benchmarks ============


@router.post("/benchmarks", response_model=EvalBenchmarkResponse)
async def create_benchmark(
    request: CreateBenchmarkRequest,
    db: Session = Depends(get_db),
):
    """Create a new benchmark test case"""
    benchmark = EvalBenchmark(
        name=request.name,
        description=request.description,
        eval_type=request.eval_type.value,
        input_text=request.input_text,
        expected_output=request.expected_output,
        expected_tools=json.dumps(request.expected_tools)
        if request.expected_tools
        else None,
        additional_guidelines=request.additional_guidelines,
        num_iterations=request.num_iterations,
        pass_threshold=request.pass_threshold,
    )

    db.add(benchmark)
    db.commit()
    db.refresh(benchmark)

    return _convert_benchmark_to_response(benchmark)


@router.get("/benchmarks", response_model=List[EvalBenchmarkResponse])
async def get_benchmarks(
    eval_type: Optional[str] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    """Get all benchmarks"""
    from sqlmodel import select

    query = select(EvalBenchmark)
    if eval_type:
        query = query.where(EvalBenchmark.eval_type == eval_type)
    if active_only:
        query = query.where(EvalBenchmark.is_active)

    benchmarks = db.exec(query).all()
    return [_convert_benchmark_to_response(b) for b in benchmarks]


@router.delete("/benchmarks/{benchmark_id}")
async def delete_benchmark(
    benchmark_id: str,
    db: Session = Depends(get_db),
):
    """Delete a benchmark (soft delete - sets is_active to False)"""
    benchmark = db.get(EvalBenchmark, benchmark_id)
    if not benchmark:
        raise HTTPException(status_code=404, detail="Benchmark not found")

    benchmark.is_active = False
    db.commit()

    return {"message": "Benchmark deleted"}


# ============ Quick Test Endpoints ============


@router.post("/quick-test/accuracy")
async def quick_accuracy_test(
    input_text: str,
    expected_output: str,
    model_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Quick accuracy test without saving to database"""
    from services.agent_service import agent_service
    import time

    start = time.time()
    response = await agent_service.chat(
        message=input_text,
        user_settings={"model": model_id} if model_id else None,
    )
    latency = (time.time() - start) * 1000

    # Simple scoring
    score = eval_service._calculate_accuracy_score(expected_output, response)

    return {
        "input": input_text,
        "expected": expected_output,
        "actual": response,
        "accuracy_score": score,
        "latency_ms": latency,
        "passed": score >= 7.0,
    }


@router.post("/quick-test/performance")
async def quick_performance_test(
    input_text: str,
    model_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Quick performance test without saving to database"""
    from services.agent_service import agent_service
    import time
    import psutil

    process = psutil.Process()
    memory_before = process.memory_info().rss / 1024 / 1024

    start = time.time()
    response = await agent_service.chat(
        message=input_text,
        user_settings={"model": model_id} if model_id else None,
    )
    latency = (time.time() - start) * 1000

    memory_after = process.memory_info().rss / 1024 / 1024

    return {
        "input": input_text,
        "response_length": len(response),
        "latency_ms": latency,
        "memory_mb": max(0, memory_after - memory_before),
        "passed": latency < 5000,
    }


# ============ Helper Functions ============


def _convert_result_to_response(result: EvalResult) -> EvalResultResponse:
    """Convert database model to response schema"""
    return EvalResultResponse(
        id=result.id,
        eval_type=result.eval_type,
        eval_name=result.eval_name,
        model_id=result.model_id,
        input_text=result.input_text,
        expected_output=result.expected_output,
        actual_output=result.actual_output,
        accuracy_score=result.accuracy_score,
        latency_ms=result.latency_ms,
        memory_mb=result.memory_mb,
        tokens_used=result.tokens_used,
        tool_calls_expected=json.loads(result.tool_calls_expected)
        if result.tool_calls_expected
        else None,
        tool_calls_actual=json.loads(result.tool_calls_actual)
        if result.tool_calls_actual
        else None,
        tool_success_rate=result.tool_success_rate,
        status=result.status,
        passed=result.passed,
        error_message=result.error_message,
        created_at=result.created_at,
    )


def _convert_benchmark_to_response(benchmark: EvalBenchmark) -> EvalBenchmarkResponse:
    """Convert database model to response schema"""
    return EvalBenchmarkResponse(
        id=benchmark.id,
        name=benchmark.name,
        description=benchmark.description,
        eval_type=benchmark.eval_type,
        input_text=benchmark.input_text,
        expected_output=benchmark.expected_output,
        expected_tools=json.loads(benchmark.expected_tools)
        if benchmark.expected_tools
        else None,
        additional_guidelines=benchmark.additional_guidelines,
        num_iterations=benchmark.num_iterations,
        pass_threshold=benchmark.pass_threshold,
        is_active=benchmark.is_active,
        created_at=benchmark.created_at,
    )
