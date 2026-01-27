from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
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
import json


router = APIRouter(prefix="/api/chat", tags=["chat"])

# Store for active streams (for cancellation)
active_streams = {}


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
        files=message.files,
    )

    # Save assistant message
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


@router.post("/message/stream")
async def send_message_stream(
    message: MessageCreate,
    request: Request,
    top_k: int = 5,
    include_sources: bool = True,
    db: Session = Depends(get_db),
):
    """Stream AI response using Server-Sent Events"""
    import uuid

    stream_id = str(uuid.uuid4())

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

    async def generate():
        full_content = ""
        cancelled = False

        # Mark stream as active
        active_streams[stream_id] = True

        # Send stream_id first so client can cancel
        yield f"data: {json.dumps({'type': 'start', 'stream_id': stream_id, 'session_id': session_id})}\n\n"

        try:
            async for chunk in agent_service.chat_stream(
                message=message.content,
                session_id=session_id,
                context=contexts if contexts else None,
                user_settings=_user_settings.model_dump(),
                files=message.files,
            ):
                # Check if cancelled
                if not active_streams.get(stream_id, False):
                    cancelled = True
                    break

                # Check if client disconnected
                if await request.is_disconnected():
                    cancelled = True
                    break

                full_content += chunk
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"

        except Exception as e:
            error_msg = str(e)
            # Check for common multimodal errors (provider rejects complex content)
            if (
                "content must be a string" in error_msg
                or "content" in error_msg
                and "string" in error_msg
            ):
                friendly_error = "⚠️ Model Error: Model yang dipilih tidak mendukung gambar (Multimodal). Silakan ganti ke model Vision (contoh: Llama-3.2 Vision, GPT-4o, Qwen-VL) di Settings."
                yield f"data: {json.dumps({'type': 'error', 'error': friendly_error})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'error', 'error': error_msg})}\n\n"
            return
        finally:
            # Remove from active streams
            active_streams.pop(stream_id, None)

        # Save assistant message (even if cancelled, save what we have)
        if full_content:
            assistant_message = ChatMessage(
                session_id=session_id,
                role="assistant",
                content=full_content + (" [cancelled]" if cancelled else ""),
                sources_json=json.dumps(sources)
                if include_sources and sources
                else None,
            )
            db.add(assistant_message)
            db.commit()
            db.refresh(assistant_message)

            yield f"data: {json.dumps({'type': 'done', 'message_id': assistant_message.id, 'cancelled': cancelled})}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'done', 'cancelled': cancelled})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/message/cancel/{stream_id}")
async def cancel_stream(stream_id: str):
    """Cancel an active stream"""
    if stream_id in active_streams:
        active_streams[stream_id] = False
        return {"message": "Stream cancelled", "stream_id": stream_id}
    return {"message": "Stream not found or already completed", "stream_id": stream_id}
