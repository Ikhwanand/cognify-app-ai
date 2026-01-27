from sqlmodel import SQLModel
from typing import Optional, List
from datetime import datetime


# File attachment schema for multimodal support
class FileAttachment(SQLModel):
    name: str
    type: str  # MIME type (e.g., 'image/png', 'application/pdf')
    size: int
    data: str  # Base64 encoded file content


# Request schemas
class MessageCreate(SQLModel):
    content: str
    session_id: Optional[str] = None
    files: Optional[List[FileAttachment]] = None  # Multimodal file attachments


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
