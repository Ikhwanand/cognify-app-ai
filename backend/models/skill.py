from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime
import uuid


class Skill(SQLModel, table=True):
    __tablename__ = "skills"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str = Field(max_length=100, index=True)
    description: Optional[str] = Field(default=None)
    instructions: str = Field(
        description="The prompt or instructions defining the skill"
    )
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
