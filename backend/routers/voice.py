"""
Voice/Live Talk Router
WebSocket endpoint untuk real-time voice conversation
Supports: Edge-TTS + LuxTTS Voice Cloning + Vision Model Validation
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlmodel import Session
from database import engine
from services.agent_service import agent_service
from services.tts_service import tts_service
from services.rag_service import rag_service
from models.chat import ChatSession, ChatMessage
import json
import base64

router = APIRouter(prefix="/api/voice", tags=["voice"])


# ============ Voice List Endpoints ============


@router.get("/voices")
async def get_available_voices():
    """Get available TTS voices (Edge-TTS)"""
    voices = tts_service.get_available_voices()
    return {
        "voices": [{**{"id": vid}, **vinfo} for vid, vinfo in voices.items()],
        "default": tts_service.DEFAULT_VOICE,
    }


# ============ Custom Voice Endpoints (LuxTTS) ============


@router.get("/custom-voices")
async def get_custom_voices():
    """Get list of saved custom voices"""
    voices = tts_service.get_custom_voices()
    return {"voices": voices, "luxtts_available": tts_service.is_luxtts_available()}


@router.post("/custom-voice/upload")
async def upload_custom_voice(
    file: UploadFile = File(...),
    name: str = Form(None),
):
    """Upload audio file (WAV/MP3) for voice cloning"""
    # Validate file type
    allowed_types = [
        "audio/wav",
        "audio/x-wav",
        "audio/mpeg",
        "audio/mp3",
        "audio/ogg",
        "audio/webm",
    ]
    if file.content_type and file.content_type not in allowed_types:
        return JSONResponse(
            status_code=400,
            content={
                "detail": f"Unsupported file type: {file.content_type}. Use WAV or MP3."
            },
        )

    # Read file
    audio_data = await file.read()

    # Validate size (max 10MB)
    if len(audio_data) > 10 * 1024 * 1024:
        return JSONResponse(
            status_code=400,
            content={"detail": "File too large. Max 10MB."},
        )

    display_name = name or file.filename
    voice_meta = tts_service.save_custom_voice(audio_data, file.filename, display_name)

    return {
        "success": True,
        "voice": voice_meta,
        "message": f"Voice '{display_name}' uploaded and encoded successfully!",
    }


@router.post("/custom-voice/record")
async def record_custom_voice(
    name: str = Form("Recorded Voice"),
    audio_data: str = Form(...),  # base64 encoded audio
):
    """Accept recorded audio from browser for voice cloning"""
    try:
        # Decode base64 audio
        audio_bytes = base64.b64decode(audio_data)

        voice_meta = tts_service.save_custom_voice(
            audio_bytes, f"{name}.wav", display_name=name
        )

        return {
            "success": True,
            "voice": voice_meta,
            "message": f"Voice '{name}' recorded and encoded successfully!",
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"detail": f"Failed to process recorded audio: {str(e)}"},
        )


@router.delete("/custom-voice/{voice_id}")
async def delete_custom_voice(voice_id: str):
    """Delete a custom voice"""
    success = tts_service.delete_custom_voice(voice_id)
    if not success:
        return JSONResponse(
            status_code=404,
            content={"detail": "Custom voice not found"},
        )
    return {"success": True, "message": "Voice deleted"}




# ============ WebSocket Voice Talk ============


@router.websocket("/ws/talk")
async def voice_talk(websocket: WebSocket):
    """
    WebSocket endpoint for live voice talk
    Supports both Edge-TTS and LuxTTS engines

    Client sends JSON messages:
    {
        "type": "user_speech",
        "text": "Hello, how are you?",
        "session_id": "optional-session-id",
        "voice": "en-US-GuyNeural",
        "mode": "chat",
        "tts_engine": "edge-tts" | "luxtts",
        "custom_voice_id": "abc123",
        "rate": "+0%"
    }
    """
    await websocket.accept()
    print("🎙️ Voice WebSocket connected")

    session_id = None

    try:
        while True:
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
                tts_engine = data.get("tts_engine", "edge-tts")
                custom_voice_id = data.get("custom_voice_id")

                if not user_text:
                    await websocket.send_json(
                        {"type": "error", "message": "Empty speech text"}
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

                    user_msg = ChatMessage(
                        session_id=session_id, role="user", content=user_text
                    )
                    db.add(user_msg)
                    db.commit()

                await websocket.send_json(
                    {"type": "session_id", "session_id": session_id}
                )
                await websocket.send_json({"type": "status", "status": "thinking"})

                try:
                    from routers.settings import _user_settings

                    settings_dict = _user_settings.model_dump()

                    with Session(engine) as db:
                        contexts, sources = rag_service.get_context(
                            db, user_text, top_k=3
                        )

                    ai_response = await agent_service.chat(
                        message=user_text,
                        session_id=session_id,
                        context=contexts if contexts else None,
                        user_settings=settings_dict,
                        mode=mode,
                    )

                    await websocket.send_json(
                        {"type": "transcript", "text": ai_response, "role": "assistant"}
                    )

                    with Session(engine) as db:
                        ai_msg = ChatMessage(
                            session_id=session_id,
                            role="assistant",
                            content=ai_response,
                        )
                        db.add(ai_msg)
                        db.commit()

                    await websocket.send_json(
                        {"type": "status", "status": "speaking"}
                    )

                    clean_text = _clean_for_tts(ai_response)

                    if clean_text:
                        try:
                            # Choose TTS engine
                            if (
                                tts_engine == "luxtts"
                                and custom_voice_id
                            ):
                                # LuxTTS Voice Cloning
                                async for audio_chunk in tts_service.synthesize_stream_luxtts(
                                    text=clean_text,
                                    custom_voice_id=custom_voice_id,
                                ):
                                    audio_b64 = base64.b64encode(
                                        audio_chunk
                                    ).decode("utf-8")
                                    await websocket.send_json(
                                        {"type": "audio_chunk", "data": audio_b64}
                                    )
                            else:
                                # Edge-TTS (default)
                                async for audio_chunk in tts_service.synthesize_stream(
                                    text=clean_text, voice=voice, rate=rate
                                ):
                                    audio_b64 = base64.b64encode(
                                        audio_chunk
                                    ).decode("utf-8")
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

                    await websocket.send_json({"type": "audio_end"})

                except Exception as e:
                    print(f"Voice processing error: {e}")
                    await websocket.send_json({"type": "error", "message": str(e)})
                    await websocket.send_json({"type": "status", "status": "idle"})

            elif data.get("type") == "vision_speech":
                user_text = data.get("text", "").strip()
                image_b64 = data.get("image")
                voice = data.get("voice", tts_service.DEFAULT_VOICE)
                mode = data.get("mode", "chat")
                rate = data.get("rate", "+0%")
                tts_engine = data.get("tts_engine", "edge-tts")
                custom_voice_id = data.get("custom_voice_id")

                if not user_text and not image_b64:
                    await websocket.send_json(
                        {"type": "error", "message": "No speech or image provided"}
                    )
                    continue

                if not user_text and image_b64:
                    user_text = "What do you see in this image? Describe it."

                from routers.settings import _user_settings
                settings_dict = _user_settings.model_dump()

                # Handle session
                req_session_id = data.get("session_id")
                with Session(engine) as db:
                    if req_session_id:
                        session_id = req_session_id
                        session = db.get(ChatSession, session_id)
                        if not session:
                            session = ChatSession(
                                id=req_session_id,
                                title=f"👁️ {user_text[:40]}",
                            )
                            db.add(session)
                            db.commit()
                            db.refresh(session)
                    elif not session_id:
                        session = ChatSession(title=f"👁️ {user_text[:40]}")
                        db.add(session)
                        db.commit()
                        db.refresh(session)
                        session_id = session.id

                    user_msg = ChatMessage(
                        session_id=session_id,
                        role="user",
                        content=f"[📷 Vision] {user_text}",
                    )
                    db.add(user_msg)
                    db.commit()

                await websocket.send_json(
                    {"type": "session_id", "session_id": session_id}
                )
                await websocket.send_json({"type": "status", "status": "thinking"})

                try:
                    from schemas.chat import FileAttachment

                    vision_files = None
                    if image_b64:
                        vision_files = [
                            FileAttachment(
                                name="webcam_frame.jpg",
                                type="image/jpeg",
                                size=len(image_b64),
                                data=image_b64,
                            )
                        ]

                    vision_prompt = (
                        f"[Live Video Call - Vision Mode] "
                        f"The user is showing you their camera. "
                        f'User said: "{user_text}" '
                        f"Analyze the image and respond naturally. "
                        f"Keep responses concise (2-4 sentences) since this is a voice conversation."
                    )

                    ai_response = await agent_service.chat(
                        message=vision_prompt,
                        session_id=session_id,
                        user_settings=settings_dict,
                        files=vision_files,
                        mode=mode,
                    )

                    await websocket.send_json(
                        {
                            "type": "transcript",
                            "text": ai_response,
                            "role": "assistant",
                        }
                    )

                    with Session(engine) as db:
                        ai_msg = ChatMessage(
                            session_id=session_id,
                            role="assistant",
                            content=ai_response,
                        )
                        db.add(ai_msg)
                        db.commit()

                    await websocket.send_json(
                        {"type": "status", "status": "speaking"}
                    )

                    clean_text = _clean_for_tts(ai_response)
                    if clean_text:
                        try:
                            if tts_engine == "luxtts" and custom_voice_id:
                                async for audio_chunk in tts_service.synthesize_stream_luxtts(
                                    text=clean_text,
                                    custom_voice_id=custom_voice_id,
                                ):
                                    audio_b64_out = base64.b64encode(
                                        audio_chunk
                                    ).decode("utf-8")
                                    await websocket.send_json(
                                        {"type": "audio_chunk", "data": audio_b64_out}
                                    )
                            else:
                                async for audio_chunk in tts_service.synthesize_stream(
                                    text=clean_text, voice=voice, rate=rate
                                ):
                                    audio_b64_out = base64.b64encode(
                                        audio_chunk
                                    ).decode("utf-8")
                                    await websocket.send_json(
                                        {"type": "audio_chunk", "data": audio_b64_out}
                                    )
                        except Exception as tts_err:
                            print(f"TTS Error: {tts_err}")
                            await websocket.send_json(
                                {
                                    "type": "error",
                                    "message": f"TTS Error: {str(tts_err)}",
                                }
                            )

                    await websocket.send_json({"type": "audio_end"})

                except Exception as e:
                    error_str = str(e).lower()
                    import traceback

                    traceback.print_exc()

                    model_name = settings_dict.get("model", "unknown")
                    if (
                        "429" in str(e)
                        or "too many requests" in error_str
                        or "rate limit" in error_str
                    ):
                        error_msg = f"⚠️ Rate limit reached for {model_name}. Please wait a minute and try again."
                    elif (
                        "image" in error_str
                        or "vision" in error_str
                        or "multimodal" in error_str
                        or "not supported" in error_str
                    ):
                        error_msg = f"⚠️ Model '{model_name}' does not support vision/image input. Please switch to a vision-capable model (e.g., Gemini, GPT-4o)."
                    else:
                        error_msg = f"⚠️ Vision error: {str(e)[:200]}"

                    await websocket.send_json(
                        {"type": "transcript", "text": error_msg, "role": "assistant"}
                    )
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
    """Clean text from markdown formatting for natural TTS"""
    import re

    text = re.sub(r"```[\s\S]*?```", " code block omitted ", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"__([^_]+)__", r"\1", text)
    text = re.sub(r"_([^_]+)_", r"\1", text)
    text = re.sub(r"#{1,6}\s+", "", text)
    text = re.sub(r"^[\s]*[-*+]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^[\s]*\d+\.\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"!\[([^\]]*)\]\([^)]+\)", "", text)
    text = re.sub(r"^---+$", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text.strip()

    if len(text) > 2000:
        text = text[:2000] + "... I've summarized the rest for brevity."

    return text
