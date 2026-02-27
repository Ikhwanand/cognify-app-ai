"""
Voice/Live Talk Router
WebSocket endpoint untuk real-time voice conversation
Flow: User Speech (text from browser STT) -> LLM -> TTS -> Audio playback
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlmodel import Session
from database import engine
from services.agent_service import agent_service
from services.tts_service import tts_service
from services.rag_service import rag_service
from models.chat import ChatSession, ChatMessage
import json
import base64


router = APIRouter(prefix="/api/voice", tags=["voice"])


@router.get("/voices")
async def get_available_voices():
    """Get available TTS voices"""
    voices = tts_service.get_available_voices()
    return {
        "voices": [{"id": vid, **vinfo} for vid, vinfo in voices.items()],
        "default": tts_service.DEFAULT_VOICE,
    }


@router.websocket("/ws/talk")
async def voice_talk(websocket: WebSocket):
    """
    WebSocket endpoint untuk live voice talk
    Client mengirim JSON messages:
    {
        "type": "user_speech",
        "text": "Hello, how are you?",
        "session_id": "optional-session-id",
        "voice": "en-US-GuyNeural",
        "mode": "chat"
    }
    Server merespon dengan:
    1. {"type": "status", "status": "thinking"} - AI sedang proses
    2. {"type": "transcript", "text": "..."} - AI response text
    3. {"type": "audio_chunk", "data": "base64..."} - Audio chunk
    4. {"type": "audio_end"} - Audio selesai
    5. {"type": "error", "message": "..."} - Error occurred
    """
    await websocket.accept()
    print("🎙️ Voice WebSocket connected")

    session_id = None

    try:
        while True:
            # Receive message from client
            raw_data = await websocket.receive_text()
            data = json.loads(raw_data)

            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if data.get("type") == "user_speech":
                user_text = data.get("text", "").strip()
                voice = data.get("voice", tts_service.DEFAULT_VOICE)
                mode = data.get("mode", "chat")
                rate = data.get("rate", "+0%")

                if not user_text:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": "Empty speech text",
                        }
                    )
                    continue

                # Handle session
                req_session_id = data.get("session_id")

                with Session(engine) as db:
                    if req_session_id:
                        session_id = req_session_id
                        session = db.get(ChatSession, session_id)
                        if not session:
                            session = ChatSession(
                                id=req_session_id, title=f"🎙️ {user_text[:40]}"
                            )
                            db.add(session)
                            db.commit()
                            db.refresh(session)
                    elif not session_id:
                        session = ChatSession(title=f"🎙️ {user_text[:40]}")
                        db.add(session)
                        db.commit()
                        db.refresh(session)
                        session_id = session.id

                    # Save user message
                    user_msg = ChatMessage(
                        session_id=session_id,
                        role="user",
                        content=user_text,
                    )
                    db.add(user_msg)
                    db.commit()

                # Send session_id to client
                await websocket.send_json(
                    {"type": "session_id", "session_id": session_id}
                )

                # Tell client AI is thinking
                await websocket.send_json({"type": "status", "status": "thinking"})

                try:
                    # Get settings
                    from routers.settings import _user_settings

                    settings_dict = _user_settings.model_dump()

                    # Get RAG context
                    with Session(engine) as db:
                        contexts, sources = rag_service.get_context(
                            db, user_text, top_k=3
                        )

                    # Get AI response (non-streaming for voice)
                    ai_response = await agent_service.chat(
                        message=user_text,
                        session_id=session_id,
                        context=contexts if contexts else None,
                        user_settings=settings_dict,
                        mode=mode,
                    )

                    # Send AI text response
                    await websocket.send_json(
                        {
                            "type": "transcript",
                            "text": ai_response,
                            "role": "assistant",
                        }
                    )

                    # Save assistant message
                    with Session(engine) as db:
                        ai_msg = ChatMessage(
                            session_id=session_id,
                            role="assistant",
                            content=ai_response,
                        )
                        db.add(ai_msg)
                        db.commit()

                    # Tell client TTS is starting
                    await websocket.send_json({"type": "status", "status": "speaking"})

                    # Clean text for TTS (remove markdown formatting)
                    clean_text = _clean_for_tts(ai_response)

                    if clean_text:
                        # Stream TTS audio
                        try:
                            async for audio_chunk in tts_service.synthesize_stream(
                                text=clean_text,
                                voice=voice,
                                rate=rate,
                            ):
                                # Send audio chunk as base64
                                audio_b64 = base64.b64encode(audio_chunk).decode(
                                    "utf-8"
                                )

                                await websocket.send_json(
                                    {"type": "audio_chunk", "data": audio_b64}
                                )
                        except Exception as tts_err:
                            print(f"TTS Error: {tts_err}")
                            await websocket.send_json(
                                {
                                    "type": "error",
                                    "message": f"TTS Error: {str(tts_err)}",
                                }
                            )

                    # Signal audio end — frontend will set idle after playback finishes
                    await websocket.send_json({"type": "audio_end"})

                except Exception as e:
                    print(f"Voice processing error: {e}")
                    await websocket.send_json({"type": "error", "message": str(e)})
                    # On error, explicitly tell frontend to go idle
                    await websocket.send_json({"type": "status", "status": "idle"})

            elif data.get("type") == "end_call":
                await websocket.send_json(
                    {"type": "call_ended", "session_id": session_id}
                )
                break

    except WebSocketDisconnect:
        print(f"🎙️ Voice WebSocket disconnected (session: {session_id})")
    except Exception as e:
        print(f"🎙️ Voice WebSocket error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass


def _clean_for_tts(text: str) -> str:
    """
    Membersihkan text dari markdown formatting
    agar TTS bisa membaca dengan natural
    """
    import re

    # Remove code blocks
    text = re.sub(r"```[\s\S]*?```", " code block omitted ", text)
    # Remove inline code
    text = re.sub(r"`([^`]+)`", r"\1", text)
    # Remove bold/italic markers
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"__([^_]+)__", r"\1", text)
    text = re.sub(r"_([^_]+)_", r"\1", text)
    # Remove headers
    text = re.sub(r"#{1,6}\s+", "", text)
    # Remove bullet points
    text = re.sub(r"^[\s]*[-*+]\s+", "", text, flags=re.MULTILINE)
    # Remove numbered lists prefix
    text = re.sub(r"^[\s]*\d+\.\s+", "", text, flags=re.MULTILINE)
    # Remove links [text](url) -> text
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    # Remove images
    text = re.sub(r"!\[([^\]]*)\]\([^)]+\)", "", text)
    # Remove horizontal rules
    text = re.sub(r"^---+$", "", text, flags=re.MULTILINE)
    # Remove excessive newlines
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Remove emoji (optional, keeps it for now)
    # Trim
    text = text.strip()

    # Limit length for TTS (too long = slow)
    if len(text) > 2000:
        text = text[:2000] + "... I've summarized the rest for brevity."

    return text
