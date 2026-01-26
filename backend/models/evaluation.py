from sqlmodel import SQLModel, Field, Column, JSON
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum
import uuid


class EvalType(str, Enum):
    ACCURACY = "accuracy"
    PERFORMANCE = "performance"
    RELIABILITY = "reliability"


class EvalStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class EvalResult(SQLModel, table=True):
    """Store evaluation results for AI agent performance tracking"""

    __tablename__ = "eval_results"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)

    # Evaluation metadata
    eval_type: str = Field(max_length=50)  # accuracy, performance, reliability
    eval_name: str = Field(max_length=255)
    model_id: str = Field(max_length=100)  # e.g., "llama-3.3-70b-versatile"

    # Input/Output
    input_text: str = Field(default="")
    expected_output: Optional[str] = Field(default=None)
    actual_output: Optional[str] = Field(default=None)

    # Accuracy metrics (1-10 scale)
    accuracy_score: Optional[float] = Field(default=None)

    # Performance metrics
    latency_ms: Optional[float] = Field(default=None)  # Response time in milliseconds
    memory_mb: Optional[float] = Field(default=None)  # Memory usage in MB
    tokens_used: Optional[int] = Field(default=None)  # Total tokens consumed

    # Reliability metrics
    tool_calls_expected: Optional[str] = Field(
        default=None
    )  # JSON string of expected tools
    tool_calls_actual: Optional[str] = Field(
        default=None
    )  # JSON string of actual tools
    tool_success_rate: Optional[float] = Field(default=None)  # 0-100%

    # Status
    status: str = Field(default="completed", max_length=20)
    passed: bool = Field(default=True)
    error_message: Optional[str] = Field(default=None)

    # Additional data as JSON (renamed from 'metadata' which is reserved in SQLAlchemy)
    extra_data: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)


class EvalBenchmark(SQLModel, table=True):
    """Store predefined benchmarks/test cases for evaluations"""

    __tablename__ = "eval_benchmarks"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str = Field(max_length=255)
    description: Optional[str] = Field(default=None)
    eval_type: str = Field(max_length=50)

    # Test case definition
    input_text: str
    expected_output: str
    expected_tools: Optional[str] = Field(default=None)  # JSON string
    additional_guidelines: Optional[str] = Field(default=None)

    # Configuration
    num_iterations: int = Field(default=1)
    pass_threshold: float = Field(default=7.0)  # Minimum score to pass

    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
