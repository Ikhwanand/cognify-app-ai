from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database import get_db
from schemas.chat import (
    MessageCreate,
    MessageResponse,
    ChatSessionResponse,
    ChatSessionWithMessages,
)
from models.chat import ChatSession, ChatMessage
from services.agent_service import agent_service
from services.rag_service import rag_service
from typing import List


router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.get("/sessions", response_model=List[ChatSessionResponse])
async def get_chat_sessions(db: Session = Depends(get_db)):
    statement = select(ChatSession).order_by(ChatSession.created_at.desc())
    sessions = db.exec(statement).all()
    return sessions


@router.get("/sessions/{session_id}", response_model=ChatSessionWithMessages)
async def get_chat_session(session_id: str, db: Session = Depends(get_db)):
    session = db.get(ChatSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/sessions", response_model=ChatSessionResponse)
async def create_chat_session(db: Session = Depends(get_db)):
    session = ChatSession()
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.delete("/sessions/{session_id}")
async def delete_chat_session(session_id: str, db: Session = Depends(get_db)):
    session = db.get(ChatSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Delete messages first to avoid FK constraint
    from sqlmodel import delete

    db.exec(delete(ChatMessage).where(ChatMessage.session_id == session_id))
    db.commit()

    # Now delete session
    db.delete(session)
    db.commit()
    return {"message": "Session deleted"}


@router.post("/message", response_model=MessageResponse)
async def send_message(
    message: MessageCreate,
    top_k: int = 5,
    include_sources: bool = True,
    db: Session = Depends(get_db),
):
    # Create or get session
    session_id = message.session_id
    if not session_id:
        session = ChatSession(title=message.content[:50])
        db.add(session)
        db.commit()
        db.refresh(session)
        session_id = session.id
    else:
        session = db.get(ChatSession, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

    # Save user message
    user_message = ChatMessage(
        session_id=session_id, role="user", content=message.content
    )
    db.add(user_message)
    db.commit()

    # Get RAG context
    contexts, sources = rag_service.get_context(db, message.content, top_k)

    from routers.settings import _user_settings

    # Get AI response
    response_content = await agent_service.chat(
        message=message.content,
        session_id=session_id,
        context=contexts if contexts else None,
        user_settings=_user_settings.model_dump(),
    )

    # Save assistant message
    import json

    assistant_message = ChatMessage(
        session_id=session_id,
        role="assistant",
        content=response_content,
        sources_json=json.dumps(sources) if include_sources and sources else None,
    )
    db.add(assistant_message)
    db.commit()
    db.refresh(assistant_message)

    return assistant_message
