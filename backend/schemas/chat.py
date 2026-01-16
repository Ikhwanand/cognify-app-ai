from sqlmodel import SQLModel
from typing import Optional, List
from datetime import datetime


# Request schemas
class MessageCreate(SQLModel):
    content: str
    session_id: Optional[str] = None


# Response schemas (if use model, but we make seperate for flexibility)
class MessageResponse(SQLModel):
    id: str
    session_id: str
    role: str
    content: str
    sources_json: Optional[str] = None
    created_at: datetime


class ChatSessionResponse(SQLModel):
    id: str
    title: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class ChatSessionWithMessages(ChatSessionResponse):
    messages: List[MessageResponse] = []
