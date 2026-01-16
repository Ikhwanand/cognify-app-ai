from sqlmodel import SQLModel
from typing import Optional
from datetime import datetime


class DocumentResponse(SQLModel):
    id: str
    name: str
    file_type: str
    file_size: Optional[int] = None
    chunk_count: int
    created_at: datetime


class DocumentUploadResponse(SQLModel):
    id: str
    name: str
    message: str
    chunk_count: int
