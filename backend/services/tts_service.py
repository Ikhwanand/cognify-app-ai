"""
TTS Service — Dual Engine: Edge TTS + LuxTTS Voice Cloning
Mengkonversi text menjadi audio speech dengan pilihan engine
"""

import edge_tts
import io
import os
import json
import uuid
import sys
from pathlib import Path

# Add LuxTTS to path
LUXTTS_DIR = os.path.join(os.path.dirname(__file__), "..", "LuxTTS")
if LUXTTS_DIR not in sys.path:
    sys.path.insert(0, LUXTTS_DIR)

CUSTOM_VOICES_DIR = os.path.join(os.path.dirname(__file__), "..", "custom_voices")
if not os.path.exists(CUSTOM_VOICES_DIR):
    os.makedirs(CUSTOM_VOICES_DIR)

VOICES_META_FILE = os.path.join(CUSTOM_VOICES_DIR, "voices_meta.json")


class TTSService:
    # Edge-TTS voice list
    VOICES = {
        # English voices
        "en-US-GuyNeural": {"name": "Guy (US)", "lang": "en", "gender": "male"},
        "en-US-JennyNeural": {"name": "Jenny (US)", "lang": "en", "gender": "female"},
        "en-US-AriaNeural": {"name": "Aria (US)", "lang": "en", "gender": "female"},
        "en-GB-RyanNeural": {"name": "Ryan (UK)", "lang": "en", "gender": "male"},
        "en-GB-SoniaNeural": {"name": "Sonia (UK)", "lang": "en", "gender": "female"},
        # Indonesian voices
        "id-ID-ArdiNeural": {"name": "Ardi (ID)", "lang": "id", "gender": "male"},
        "id-ID-GadisNeural": {"name": "Gadis (ID)", "lang": "id", "gender": "female"},
        # Japanese
        "ja-JP-KeitaNeural": {"name": "Keita (JP)", "lang": "ja", "gender": "male"},
        "ja-JP-NanamiNeural": {
            "name": "Nanami (JP)",
            "lang": "ja",
            "gender": "female",
        },
        # Korean
        "ko-KR-InJoonNeural": {
            "name": "InJoon (KR)",
            "lang": "ko",
            "gender": "male",
        },
        "ko-KR-SunHiNeural": {
            "name": "SunHi (KR)",
            "lang": "ko",
            "gender": "female",
        },
    }

    DEFAULT_VOICE = "en-US-GuyNeural"

    def __init__(self):
        self._luxtts_model = None
        self._luxtts_loading = False
        self._encoded_prompts = {}  # Cache encoded voice prompts
        self._custom_voices_meta = self._load_voices_meta()

        # Ensure custom voices dir exists
        os.makedirs(CUSTOM_VOICES_DIR, exist_ok=True)

    # ========== Custom Voices Metadata ==========

    def _load_voices_meta(self) -> dict:
        """Load custom voices metadata from JSON file"""
        if os.path.exists(VOICES_META_FILE):
            try:
                with open(VOICES_META_FILE, "r") as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def _save_voices_meta(self):
        """Save custom voices metadata to JSON file"""
        os.makedirs(CUSTOM_VOICES_DIR, exist_ok=True)
        with open(VOICES_META_FILE, "w") as f:
            json.dump(self._custom_voices_meta, f, indent=2)

    # ========== Edge-TTS Methods ==========

    def get_available_voices(self) -> dict:
        """Return daftar voice yang tersedia (Edge-TTS)"""
        return self.VOICES

    async def synthesize(
        self,
        text: str,
        voice: str = None,
        rate: str = "+0%",
        pitch: str = "+0Hz",
    ) -> bytes:
        """Convert text ke audio bytes (MP3 format) using Edge-TTS"""
        voice = voice or self.DEFAULT_VOICE

        if voice not in self.VOICES:
            voice = self.DEFAULT_VOICE

        communicate = edge_tts.Communicate(
            text=text,
            voice=voice,
            rate=rate,
            pitch=pitch,
        )

        audio_buffer = io.BytesIO()

        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_buffer.write(chunk["data"])

        audio_buffer.seek(0)
        return audio_buffer.read()

    async def synthesize_stream(
        self,
        text: str,
        voice: str = None,
        rate: str = "+0%",
        pitch: str = "+0Hz",
    ):
        """Stream audio chunks using Edge-TTS"""
        voice = voice or self.DEFAULT_VOICE

        if voice not in self.VOICES:
            voice = self.DEFAULT_VOICE

        communicate = edge_tts.Communicate(
            text=text,
            voice=voice,
            rate=rate,
            pitch=pitch,
        )

        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                yield chunk["data"]

    # ========== LuxTTS Methods ==========

    def _load_luxtts(self):
        """Lazy load LuxTTS model"""
        if self._luxtts_model is not None:
            return

        if self._luxtts_loading:
            return

        self._luxtts_loading = True
        try:
            import torch

            from zipvoice.luxvoice import LuxTTS

            # Auto-detect device
            if torch.cuda.is_available():
                device = "cuda"
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                device = "mps"
            else:
                device = "cpu"

            print(f"🔊 Loading LuxTTS model on {device}...")
            self._luxtts_model = LuxTTS("YatharthS/LuxTTS", device=device)
            print("✅ LuxTTS model loaded successfully!")
        except Exception as e:
            print(f"❌ Failed to load LuxTTS: {e}")
            self._luxtts_model = None
        finally:
            self._luxtts_loading = False

    def is_luxtts_available(self) -> bool:
        """Check if LuxTTS model is loaded or can be loaded"""
        if self._luxtts_model is not None:
            return True
        try:
            import torch
            from zipvoice.luxvoice import LuxTTS

            return True
        except ImportError:
            return False

    def encode_voice_reference(self, audio_path: str, voice_id: str) -> bool:
        """Encode a reference audio file for voice cloning"""
        self._load_luxtts()
        if self._luxtts_model is None:
            raise RuntimeError("LuxTTS model is not loaded")

        try:
            encoded_prompt = self._luxtts_model.encode_prompt(
                audio_path, duration=5, rms=0.01
            )
            self._encoded_prompts[voice_id] = encoded_prompt
            print(f"✅ Voice reference encoded: {voice_id}")
            return True
        except Exception as e:
            print(f"❌ Failed to encode voice reference: {e}")
            raise

    def save_custom_voice(
        self, audio_data: bytes, filename: str, display_name: str = None
    ) -> dict:
        """Save uploaded/recorded audio as custom voice reference"""
        voice_id = str(uuid.uuid4())[:8]
        ext = Path(filename).suffix or ".wav"
        safe_filename = f"{voice_id}{ext}"
        filepath = os.path.join(CUSTOM_VOICES_DIR, safe_filename)

        # Save audio file
        with open(filepath, "wb") as f:
            f.write(audio_data)

        # Save metadata
        voice_meta = {
            "id": voice_id,
            "name": display_name or Path(filename).stem,
            "filename": safe_filename,
            "filepath": filepath,
            "original_name": filename,
            "engine": "luxtts",
        }

        self._custom_voices_meta[voice_id] = voice_meta
        self._save_voices_meta()

        # Pre-encode the voice reference
        try:
            self.encode_voice_reference(filepath, voice_id)
        except Exception as e:
            print(f"Warning: Voice saved but encoding deferred: {e}")

        return voice_meta

    def get_custom_voices(self) -> list:
        """Get list of saved custom voices"""
        return list(self._custom_voices_meta.values())

    def delete_custom_voice(self, voice_id: str) -> bool:
        """Delete a custom voice"""
        if voice_id not in self._custom_voices_meta:
            return False

        meta = self._custom_voices_meta[voice_id]
        filepath = meta.get("filepath")

        # Delete audio file
        if filepath and os.path.exists(filepath):
            os.remove(filepath)

        # Remove from cache
        if voice_id in self._encoded_prompts:
            del self._encoded_prompts[voice_id]

        # Remove from metadata
        del self._custom_voices_meta[voice_id]
        self._save_voices_meta()

        return True

    async def synthesize_luxtts(
        self,
        text: str,
        custom_voice_id: str,
        num_steps: int = 4,
        speed: float = 1.0,
    ) -> bytes:
        """Generate speech using LuxTTS with a custom voice"""
        import soundfile as sf

        self._load_luxtts()
        if self._luxtts_model is None:
            raise RuntimeError("LuxTTS model is not loaded")

        # Get or encode the voice prompt
        if custom_voice_id not in self._encoded_prompts:
            meta = self._custom_voices_meta.get(custom_voice_id)
            if not meta:
                raise ValueError(f"Custom voice not found: {custom_voice_id}")
            self.encode_voice_reference(meta["filepath"], custom_voice_id)

        encoded_prompt = self._encoded_prompts[custom_voice_id]

        # Generate speech
        final_wav = self._luxtts_model.generate_speech(
            text, encoded_prompt, num_steps=num_steps, speed=speed
        )

        # Convert to WAV bytes
        wav_data = final_wav.numpy().squeeze()
        buffer = io.BytesIO()
        sf.write(buffer, wav_data, 48000, format="WAV")
        buffer.seek(0)
        return buffer.read()

    async def synthesize_stream_luxtts(
        self,
        text: str,
        custom_voice_id: str,
        num_steps: int = 4,
        speed: float = 1.0,
    ):
        """
        Stream LuxTTS audio in chunks.
        LuxTTS generates full audio at once, so we chunk it for streaming.
        """
        full_audio = await self.synthesize_luxtts(
            text, custom_voice_id, num_steps, speed
        )

        # Stream in 32KB chunks (WAV data at 48kHz)
        chunk_size = 32 * 1024
        offset = 0
        while offset < len(full_audio):
            yield full_audio[offset : offset + chunk_size]
            offset += chunk_size


# Singleton instance
tts_service = TTSService()
