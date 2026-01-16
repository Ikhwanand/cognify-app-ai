from sqlmodel import SQLModel, Field
from typing import Optional, List
from datetime import datetime
import uuid


class Document(SQLModel, table=True):
    __tablename__ = "documents"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str = Field(max_length=255)
    file_type: str = Field(max_length=50)
    file_size: Optional[int] = Field(default=None)
    content: Optional[str] = Field(default=None)  # Raw text content
    chunk_count: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class DocumentChunk(SQLModel, table=True):
    __tablename__ = "document_chunks"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    document_id: str = Field(foreign_key="documents.id")
    content: str
    chunk_index: int
    # embedding: Optional[List[float]] = Field(default=None) # For vector search later
    created_at: datetime = Field(default_factory=datetime.utcnow)
