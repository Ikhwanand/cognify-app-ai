from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class SkillBase(BaseModel):
    name: str
    description: Optional[str] = None
    instructions: str
    is_active: bool = True


class SkillCreate(SkillBase):
    pass


class SkillUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None
    is_active: Optional[bool] = None


class SkillResponse(SkillBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
