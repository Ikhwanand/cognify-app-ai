"""
TTS Service menggunakan Edge TTS
Mengkonversi text menjadi audio speech
"""

import edge_tts
import io


class TTSService:
    # Daftar voice yang tersedia
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
        "ja-JP-NanamiNeural": {"name": "Nanami (JP)", "lang": "ja", "gender": "female"},
        # Korean
        "ko-KR-InJoonNeural": {"name": "InJoon (KR)", "lang": "ko", "gender": "male"},
        "ko-KR-SunHiNeural": {"name": "SunHi (KR)", "lang": "ko", "gender": "female"},
    }

    DEFAULT_VOICE = "en-US-GuyNeural"

    def __init__(self):
        pass

    def get_available_voices(self) -> dict:
        """Return daftar voice yang tersedia"""
        return self.VOICES

    async def synthesize(
        self,
        text: str,
        voice: str = None,
        rate: str = "+0%",
        pitch: str = "+0Hz",
    ) -> bytes:
        """Convert text ke audio bytes (MP3 format)

        Args:
            text (str): Teks yang akan di-convert
            voice (str, optional): Voice ID. Defaults to None.
            rate (str, optional): Speed rate. Defaults to "+0%".
            pitch (str, optional): Pitch. Defaults to "+0Hz".

        Returns:
            bytes: Audio data dalam format MP3
        """
        voice = voice or self.DEFAULT_VOICE

        # Validate voice exists
        if voice not in self.VOICES:
            voice = self.DEFAULT_VOICE

        communicate = edge_tts.Communicate(
            text=text,
            voice=voice,
            rate=rate,
            pitch=pitch,
        )

        # Collect audio bytes
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
        """Stream audio chunks untuk real-time playback

        Args:
            text (str): Teks yang akan di-convert
            voice (str, optional): Voice ID. Defaults to None.
            rate (str, optional): Speed rate. Defaults to "+0%".
            pitch (str, optional): _description_. Defaults to "+0Hz".
        """
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


# Singleton instance
tts_service = TTSService()
