from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime
import uuid


class ChatSession(SQLModel, table=True):
    __tablename__ = "chat_sessions"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    title: Optional[str] = Field(default=None, max_length=255)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)
    settings_json: Optional[str] = Field(default=None)  # JSON string for settings

    messages: List["ChatMessage"] = Relationship(back_populates="session")


class ChatMessage(SQLModel, table=True):
    __tablename__ = "chat_messages"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    session_id: str = Field(foreign_key="chat_sessions.id")
    role: str = Field(max_length=20)  # "user" or "assistant"
    content: str
    sources_json: Optional[str] = Field(default=None)  # JSON string for sources
    created_at: datetime = Field(default_factory=datetime.utcnow)

    session: Optional[ChatSession] = Relationship(back_populates="messages")
