from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from database import get_db
from schemas.document import DocumentResponse, DocumentUploadResponse
from services.document_service import document_service
from typing import List

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.get("/", response_model=List[DocumentResponse])
async def get_documents(db: Session = Depends(get_db)):
    """Get all documents"""
    return document_service.get_all_documents(db)


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload and process a document"""

    # Validate file type
    allowed_types = ["pdf", "txt", "md", "docx"]
    file_ext = file.filename.lower().split(".")[-1]
    if file_ext not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"File type not supported. Allowed: {', '.join(allowed_types)}",
        )

    # Process document
    try:
        document = await document_service.process_document(
            db=db, file=file.file, filename=file.filename, file_size=file.size or 0
        )

        return DocumentUploadResponse(
            id=document.id,
            name=document.name,
            message="Document uploaded and processed successfully",
            chunk_count=document.chunk_count,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{document_id}")
async def delete_document(document_id: str, db: Session = Depends(get_db)):
    """Delete a document"""
    success = document_service.delete_document(db, document_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document deleted"}
