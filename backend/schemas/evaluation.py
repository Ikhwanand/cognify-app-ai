from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class EvalTypeEnum(str, Enum):
    ACCURACY = "accuracy"
    PERFORMANCE = "performance"
    RELIABILITY = "reliability"


# Request schemas
class RunEvalRequest(BaseModel):
    """Request to run an evaluation"""

    eval_type: EvalTypeEnum
    eval_name: str = Field(max_length=255)
    model_id: Optional[str] = None  # Uses default if not specified
    input_text: str
    expected_output: Optional[str] = None
    expected_tools: Optional[List[str]] = None
    additional_guidelines: Optional[str] = None
    num_iterations: int = Field(default=1, ge=1, le=10)


class CreateBenchmarkRequest(BaseModel):
    """Request to create a benchmark test case"""

    name: str = Field(max_length=255)
    description: Optional[str] = None
    eval_type: EvalTypeEnum
    input_text: str
    expected_output: str
    expected_tools: Optional[List[str]] = None
    additional_guidelines: Optional[str] = None
    num_iterations: int = Field(default=1, ge=1, le=10)
    pass_threshold: float = Field(default=7.0, ge=1.0, le=10.0)


# Response schemas
class EvalResultResponse(BaseModel):
    """Single evaluation result"""

    id: str
    eval_type: str
    eval_name: str
    model_id: str
    input_text: str
    expected_output: Optional[str]
    actual_output: Optional[str]
    accuracy_score: Optional[float]
    latency_ms: Optional[float]
    memory_mb: Optional[float]
    tokens_used: Optional[int]
    tool_calls_expected: Optional[List[str]]
    tool_calls_actual: Optional[List[str]]
    tool_success_rate: Optional[float]
    status: str
    passed: bool
    error_message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class EvalBenchmarkResponse(BaseModel):
    """Benchmark test case"""

    id: str
    name: str
    description: Optional[str]
    eval_type: str
    input_text: str
    expected_output: str
    expected_tools: Optional[List[str]]
    additional_guidelines: Optional[str]
    num_iterations: int
    pass_threshold: float
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class EvalStatsResponse(BaseModel):
    """Aggregated evaluation statistics"""

    total_evals: int
    passed_count: int
    failed_count: int
    pass_rate: float

    # Accuracy stats
    avg_accuracy: Optional[float]
    min_accuracy: Optional[float]
    max_accuracy: Optional[float]

    # Performance stats
    avg_latency_ms: Optional[float]
    min_latency_ms: Optional[float]
    max_latency_ms: Optional[float]
    avg_memory_mb: Optional[float]

    # Reliability stats
    avg_tool_success_rate: Optional[float]

    # By model breakdown
    stats_by_model: Dict[str, Dict[str, Any]]

    # By eval type breakdown
    stats_by_type: Dict[str, Dict[str, Any]]


class EvalHistoryResponse(BaseModel):
    """Historical evaluation data for charts"""

    date: str
    accuracy_avg: Optional[float]
    latency_avg: Optional[float]
    eval_count: int
    pass_rate: float


class DashboardSummary(BaseModel):
    """Dashboard summary cards data"""

    avg_accuracy: float
    avg_latency_ms: float
    tool_success_rate: float
    total_evals: int
    pass_rate: float
    recent_trend: str  # "up", "down", "stable"

    # Model with best performance
    best_model: Optional[str]
    best_model_accuracy: Optional[float]


class ToolUsageStats(BaseModel):
    """Tool usage distribution"""

    tool_name: str
    usage_count: int
    success_rate: float
