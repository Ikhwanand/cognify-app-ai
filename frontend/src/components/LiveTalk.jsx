import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "./ui/select";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ArrowLeft,
  Loader2,
  Settings2,
  MessageSquare,
  Camera,
  Eye,
  EyeOff,
  Upload,
  CircleDot,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { voiceAPI } from "@/services/api";
import Avatar3D from "./Avatar3D";

// Audio player helper
class AudioStreamPlayer {
  constructor() {
    this.audioContext = null;
    this.chunks = [];
    this.isPlaying = false;
    this.onPlaybackEnd = null;
  }

  init() {
    if (!this.audioContext) {
      this.audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
    }
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
  }

  addChunk(base64Data) {
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    this.chunks.push(bytes.buffer);
  }

  async playAll() {
    if (this.chunks.length === 0) return;

    this.init();
    this.isPlaying = true;

    const totalLength = this.chunks.reduce(
      (sum, chunk) => sum + chunk.byteLength,
      0,
    );
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      merged.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    try {
      const audioBuffer = await this.audioContext.decodeAudioData(
        merged.buffer.slice(0),
      );
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.onended = () => {
        this.isPlaying = false;
        this.onPlaybackEnd?.();
      };
      source.start(0);
    } catch (err) {
      console.error("Audio decode error:", err);
      try {
        const blob = new Blob(
          this.chunks.map((c) => new Uint8Array(c)),
          { type: "audio/mp3" },
        );
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => {
          this.isPlaying = false;
          URL.revokeObjectURL(url);
          this.onPlaybackEnd?.();
        };
        await audio.play();
      } catch (fallbackErr) {
        console.error("Audio fallback error:", fallbackErr);
        this.isPlaying = false;
        this.onPlaybackEnd?.();
      }
    }

    this.chunks = [];
  }

  stop() {
    this.isPlaying = false;
    this.chunks = [];
  }

  destroy() {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// ============= Speech Recognition Hook ===============
function useSpeechRecognition({
  onResult,
  onInterim,
  enabled,
  language = "en-US",
}) {
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const abortCountRef = useRef(0);
  const restartTimerRef = useRef(null);
  const startRef = useRef(null);

  const stop = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.onerror = null;
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    abortCountRef.current = 0;
  }, []);

  const start = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.onerror = null;
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }

    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      console.error("Speech Recognition not supported");
      return false;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";

      abortCountRef.current = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        onResult?.(finalTranscript);
      }
      if (interimTranscript) {
        onInterim?.(interimTranscript);
      }
    };

    let wasAborted = false;

    recognition.onerror = (event) => {
      if (event.error === "aborted") {
        wasAborted = true;
        abortCountRef.current += 1;
        return;
      }
      if (event.error !== "no-speech") {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;

      if (!enabled) {
        setIsListening(false);
        return;
      }

      if (abortCountRef.current >= 5) {
        console.warn("STT: Too many aborts, waiting 3s before retry...");
        restartTimerRef.current = setTimeout(() => {
          abortCountRef.current = 0;
          startRef.current?.();
        }, 3000);
        return;
      }

      const delay = wasAborted ? 800 : 300;
      restartTimerRef.current = setTimeout(() => {
        startRef.current?.();
      }, delay);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
      return true;
    } catch (e) {
      console.error("Failed to start speech recognition:", e);
      return false;
    }
  }, [language, onResult, onInterim, enabled]);

  useEffect(() => {
    startRef.current = start;
  }, [start]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { isListening, start, stop };
}

// ============= Waveform Visualizer ===============
function WaveformVisualizer({ isActive, color = "rgba(168, 85, 247, 0.8)" }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const barsRef = useRef(Array.from({ length: 32 }, () => 0.15));

  useEffect(() => {
    barsRef.current = Array.from({ length: 32 }, () => Math.random() * 0.3);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const bars = barsRef.current;
      const barWidth = width / bars.length;
      const gap = 2;

      for (let i = 0; i < bars.length; i++) {
        if (isActive) {
          bars[i] += (Math.random() - 0.5) * 0.15;
          bars[i] = Math.max(0.05, Math.min(1, bars[i]));
        } else {
          bars[i] *= 0.95;
          bars[i] = Math.max(0.05, bars[i]);
        }

        const barHeight = bars[i] * height * 0.8;
        const x = i * barWidth + gap / 2;
        const y = (height - barHeight) / 2;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth - gap, barHeight, 3);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, color]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={80}
      className="w-full max-w-xs h-20"
    />
  );
}

// ============= Voice Upload/Record Modal ===============
function VoiceUploadModal({ isOpen, onClose, onVoiceSaved }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [voiceName, setVoiceName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const fileInputRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4",
      });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const rawBlob = new Blob(chunksRef.current, { type: recorder.mimeType });
        setRecordedBlob(rawBlob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setError("");
    } catch {
      setError("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const convertToWav = async (fileOrBlob) => {
    try {
      const arrayBuffer = await fileOrBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const numOfChan = Math.min(audioBuffer.numberOfChannels, 2);
      const length = audioBuffer.length * numOfChan * 2;
      const buffer = new ArrayBuffer(44 + length);
      const view = new DataView(buffer);
      const writeString = (view, offset, string) => {
        for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
      };
      writeString(view, 0, 'RIFF');
      view.setUint32(4, 36 + length, true);
      writeString(view, 8, 'WAVE');
      writeString(view, 12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numOfChan, true);
      view.setUint32(24, audioBuffer.sampleRate, true);
      view.setUint32(28, audioBuffer.sampleRate * 2 * numOfChan, true);
      view.setUint16(32, numOfChan * 2, true);
      view.setUint16(34, 16, true);
      writeString(view, 36, 'data');
      view.setUint32(40, length, true);
      const channels = [];
      for (let i = 0; i < numOfChan; i++) channels.push(audioBuffer.getChannelData(i));
      let offset = 44, pos = 0;
      while (pos < audioBuffer.length) {
        for (let i = 0; i < numOfChan; i++) {
          let sample = Math.max(-1, Math.min(1, channels[i][pos]));
          sample = sample < 0 ? sample * 32768 : sample * 32767;
          view.setInt16(offset, sample, true);
          offset += 2;
        }
        pos++;
      }
      return new File([buffer], "converted_audio.wav", { type: 'audio/wav' });
    } catch (err) {
      console.error("WAV conversion failed:", err);
      return fileOrBlob; // Fallback
    }
  };

  const handleFileUpload = async (e) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    setIsUploading(true);
    setError("");
    try {
      const file = await convertToWav(rawFile);
      const result = await voiceAPI.uploadCustomVoice(
        file,
        voiceName || rawFile.name.replace(/\.[^/.]+$/, "") + ".wav",
      );
      onVoiceSaved?.(result.voice);
      onClose();
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveRecording = async () => {
    if (!recordedBlob) return;

    setIsUploading(true);
    setError("");
    try {
      const wavBlob = await convertToWav(recordedBlob);
      const result = await voiceAPI.recordCustomVoice(
        wavBlob,
        voiceName || "Recorded Voice",
      );
      onVoiceSaved?.(result.voice);
      onClose();
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Upload className="h-5 w-5 text-purple-400" />
            Add Custom Voice
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Upload a WAV/MP3 file (min 3 seconds) or record your voice for AI
          cloning.
        </p>

        {/* Voice name */}
        <div>
          <label className="text-xs text-muted-foreground font-medium mb-1 block">
            Voice Name
          </label>
          <input
            type="text"
            value={voiceName}
            onChange={(e) => setVoiceName(e.target.value)}
            placeholder="e.g., My Voice"
            className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Upload file */}
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/wav,audio/mp3,audio/mpeg,.wav,.mp3"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Upload Audio File
          </Button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Record */}
        <div className="space-y-3">
          <div className="flex gap-2">
            {!isRecording ? (
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={startRecording}
                disabled={isUploading}
              >
                <CircleDot className="h-4 w-4 text-red-400" />
                Start Recording
              </Button>
            ) : (
              <Button
                variant="destructive"
                className="flex-1 gap-2 animate-pulse"
                onClick={stopRecording}
              >
                <MicOff className="h-4 w-4" />
                Stop Recording
              </Button>
            )}
          </div>

          {recordedBlob && !isRecording && (
            <div className="space-y-2">
              <audio
                controls
                src={URL.createObjectURL(recordedBlob)}
                className="w-full h-10"
              />
              <Button
                className="w-full gap-2 bg-purple-600 hover:bg-purple-700"
                onClick={handleSaveRecording}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Save & Clone Voice
              </Button>
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-400 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

// ============ Main LiveTalk Component ===============
export default function LiveTalk({ onBack, mode = "chat" }) {
  // Connection state
  const [isInCall, setIsInCall] = useState(false);

  // Voice state
  const [isMuted, setIsMuted] = useState(false);
  const [aiStatus, setAiStatus] = useState("idle");
  const [selectedVoice, setSelectedVoice] = useState("en-US-GuyNeural");
  const [availableVoices, setAvailableVoices] = useState([]);
  const [sttLanguage, setSttLanguage] = useState("en-US");
  const [showSettings, setShowSettings] = useState(false);

  // TTS Engine state
  const [ttsEngine, setTtsEngine] = useState("edge-tts");
  const [customVoices, setCustomVoices] = useState([]);
  const [selectedCustomVoice, setSelectedCustomVoice] = useState("");
  const [showVoiceUpload, setShowVoiceUpload] = useState(false);
  const [luxTTSAvailable, setLuxTTSAvailable] = useState(false);


  // Transcript
  const [transcripts, setTranscripts] = useState([]);
  const [interimText, setInterimText] = useState("");
  const [showTranscript, setShowTranscript] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [sessionId, setSessionId] = useState(null);

  // Refs
  const wsRef = useRef(null);
  const audioPlayerRef = useRef(new AudioStreamPlayer());
  const durationIntervalRef = useRef(null);
  const transcriptEndRef = useRef(null);

  // Vision state
  const [visionEnabled, setVisionEnabled] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const canvasRef2 = useRef(null);
  const streamRef = useRef(null);

  // STT control ref
  const sttControlRef = useRef({ start: () => {}, stop: () => {} });

  // ===== Camera Control =====
  const startCamera = useCallback(async () => {
    try {
      sttControlRef.current.stop();

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraActive(true);

      setTimeout(() => {
        sttControlRef.current.start();
      }, 500);
    } catch (err) {
      console.error("Camera error:", err);
      alert("Could not access camera. Please check permissions.");
      sttControlRef.current.start();
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef2.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef2.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    return dataUrl.split(",")[1];
  }, []);

  // Speech Recognition
  const handleSpeechResult = useCallback(
    (text) => {
      if (isMuted || aiStatus !== "idle") return;

      setInterimText("");

      setTranscripts((prev) => [
        ...prev,
        { role: "user", text, timestamp: new Date() },
      ]);

      if (wsRef.current) {
        const basePayload = {
          session_id: sessionId,
          voice: selectedVoice,
          mode,
          rate: "+0%",
          tts_engine: ttsEngine,
          custom_voice_id: ttsEngine === "luxtts" ? selectedCustomVoice : undefined,
        };

        if (visionEnabled && cameraActive) {
          const frame = captureFrame();
          wsRef.current.send({
            type: "vision_speech",
            text,
            image: frame,
            ...basePayload,
          });
        } else {
          wsRef.current.send({
            type: "user_speech",
            text,
            ...basePayload,
          });
        }
      }
    },
    [
      isMuted,
      aiStatus,
      sessionId,
      selectedVoice,
      mode,
      ttsEngine,
      selectedCustomVoice,
      visionEnabled,
      cameraActive,
      captureFrame,
    ],
  );

  const handleInterim = useCallback(
    (text) => {
      if (!isMuted && aiStatus === "idle") {
        setInterimText(text);
      }
    },
    [isMuted, aiStatus],
  );

  const {
    isListening,
    start: startListening,
    stop: stopListening,
  } = useSpeechRecognition({
    onResult: handleSpeechResult,
    onInterim: handleInterim,
    enabled: isInCall && !isMuted,
    language: sttLanguage,
  });

  // Wire up STT control ref
  useEffect(() => {
    sttControlRef.current = { start: startListening, stop: stopListening };
  }, [startListening, stopListening]);

  // Load available voices
  useEffect(() => {
    voiceAPI
      .getVoices()
      .then((data) => {
        if (data.voices) {
          setAvailableVoices(data.voices);
          setSelectedVoice(data.default || "en-US-GuyNeural");
        }
      })
      .catch((err) => console.error("Failed to load voices:", err));

    // Load custom voices
    voiceAPI
      .getCustomVoices()
      .then((data) => {
        if (data.voices) setCustomVoices(data.voices);
        setLuxTTSAvailable(data.luxtts_available || false);
      })
      .catch((err) => console.error("Failed to load custom voices:", err));
  }, []);



  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  // Sync STT with aiStatus
  useEffect(() => {
    if (!isInCall) return;

    if (aiStatus === "thinking" || aiStatus === "speaking") {
      stopListening();
    } else if (aiStatus === "idle" && !isMuted) {
      startListening();
    }
  }, [aiStatus, isInCall, isMuted, startListening, stopListening]);

  // ====== Call Control ======

  const endCall = useCallback(() => {
    stopListening();
    audioPlayerRef.current.stop();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Cleanup camera/vision
    stopCamera();
    setVisionEnabled(false);

    setIsInCall(false);
    setAiStatus("idle");
    setInterimText("");
  }, [stopListening, stopCamera]);

  useEffect(() => {
    const player = audioPlayerRef.current;
    return () => {
      endCall();
      player.destroy();
    };
  }, [endCall]);

  const startCall = useCallback(() => {
    audioPlayerRef.current.init();

    const connection = voiceAPI.createConnection(
      // onMessage
      (data) => {
        switch (data.type) {
          case "session_id":
            setSessionId(data.session_id);
            break;
          case "status":
            setAiStatus(data.status);
            break;
          case "transcript":
            setTranscripts((prev) => [
              ...prev,
              {
                role: "assistant",
                text: data.text,
                timestamp: new Date(),
              },
            ]);
            break;
          case "audio_chunk":
            audioPlayerRef.current.addChunk(data.data);
            break;
          case "audio_end":
            setAiStatus("speaking");
            if (audioPlayerRef.current.chunks.length > 0) {
              audioPlayerRef.current.onPlaybackEnd = () => {
                setAiStatus("idle");
              };
              audioPlayerRef.current.playAll();
            } else {
              setAiStatus("idle");
            }
            break;

          case "vision_unsupported":
            // Auto-disable vision
            setVisionEnabled(false);
            stopCamera();
            break;

          case "error":
            console.error("Voice error:", data.message);
            setTranscripts((prev) => [
              ...prev,
              {
                role: "system",
                text: `⚠️ ${data.message}`,
                timestamp: new Date(),
              },
            ]);
            setAiStatus("idle");
            break;

          case "call_ended":
            setIsInCall(false);
            break;

          case "pong":
            break;
        }
      },
      // onClose
      () => {
        setIsInCall(false);
        setAiStatus("idle");
      },
      // onError
      (error) => {
        console.error("WebSocket error:", error);
      },
    );

    wsRef.current = connection;

    connection.ws.onopen = () => {
      setIsInCall(true);
      setCallDuration(0);
      setTranscripts([]);

      durationIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);

      startListening();
    };
  }, [startListening, stopCamera]);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
      startListening();
    } else {
      setIsMuted(true);
      stopListening();
    }
  }, [isMuted, startListening, stopListening]);

  // =========== Helpers ==============

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusText = () => {
    switch (aiStatus) {
      case "thinking":
        return visionEnabled ? "👁️ AI is analyzing..." : "🤔 AI is thinking...";
      case "speaking":
        return "🔊 AI is speaking...";
      default:
        if (isMuted) return "🔇 Microphone muted";
        return visionEnabled ? "👁️ Vision + Listening..." : "🎤 Listening...";
    }
  };

  const getStatusColor = () => {
    switch (aiStatus) {
      case "thinking":
        return "text-yellow-400";
      case "speaking":
        return "text-green-400";
      default:
        if (isMuted) return "text-red-400";
        return "text-purple-400";
    }
  };

  // Available STT languages
  const sttLanguages = [
    { value: "en-US", label: "English (US)" },
    { value: "en-GB", label: "English (UK)" },
    { value: "id-ID", label: "Bahasa Indonesia" },
    { value: "ja-JP", label: "Japanese" },
    { value: "ko-KR", label: "Korean" },
    { value: "zh-CN", label: "Chinese" },
    { value: "es-ES", label: "Spanish" },
    { value: "fr-FR", label: "French" },
    { value: "de-DE", label: "German" },
  ];

  // Toggle vision mode
  const toggleVision = useCallback(() => {
    if (visionEnabled) {
      setVisionEnabled(false);
      stopCamera();
    } else {
      setVisionEnabled(true);
      startCamera();
    }
  }, [visionEnabled, startCamera, stopCamera]);

  // Start/stop camera with call lifecycle
  // Camera cleanup is handled in endCall callback, no need for separate effect
  // that causes cascading setState

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Custom voice saved handler
  const handleVoiceSaved = (voice) => {
    setCustomVoices((prev) => [...prev, voice]);
    setSelectedCustomVoice(voice.id);
    setTtsEngine("luxtts");
    setShowVoiceUpload(false);
  };

  // Delete custom voice
  const handleDeleteCustomVoice = async (voiceId) => {
    try {
      await voiceAPI.deleteCustomVoice(voiceId);
      setCustomVoices((prev) => prev.filter((v) => v.id !== voiceId));
      if (selectedCustomVoice === voiceId) {
        setSelectedCustomVoice("");
        setTtsEngine("edge-tts");
      }
    } catch (err) {
      console.error("Failed to delete voice:", err);
    }
  };

  // ========= Render =============
  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef2} className="hidden" />

      {/* Voice Upload Modal */}
      <VoiceUploadModal
        isOpen={showVoiceUpload}
        onClose={() => setShowVoiceUpload(false)}
        onVoiceSaved={handleVoiceSaved}
      />

      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Chat
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTranscript(!showTranscript)}
            className="gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            {showTranscript ? "Hide" : "Show"} Transcript
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button
            variant={visionEnabled ? "default" : "ghost"}
            size="sm"
            onClick={toggleVision}
            disabled={!isInCall}
            className={cn(
              "gap-2",
              visionEnabled && "bg-blue-600 hover:bg-blue-700 text-white",
            )}
            title="Toggle Vision Mode"
          >
            {visionEnabled ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}{" "}
            Vision
          </Button>
        </div>
      </div>

      {/* Settings Panel (collapsible) */}
      {showSettings && (
        <div className="px-6 py-4 border-b border-border bg-muted/30 flex flex-wrap gap-4 items-end">
          {/* TTS Engine Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">
              TTS Engine
            </label>
            <Select value={ttsEngine} onValueChange={setTtsEngine}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="edge-tts">Edge TTS</SelectItem>
                <SelectItem value="luxtts" disabled={!luxTTSAvailable}>
                  LuxTTS (Clone)
                  {!luxTTSAvailable && " ⚠️"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Voice Selection — conditional on engine */}
          {ttsEngine === "edge-tts" ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">
                AI Voice
              </label>
              <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                <SelectTrigger className="w-[200px] h-9">
                  <SelectValue placeholder="Select voice" />
                </SelectTrigger>
                <SelectContent>
                  {availableVoices.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.name} ({voice.gender})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">
                Custom Voice
              </label>
              <div className="flex gap-2">
                <Select
                  value={selectedCustomVoice}
                  onValueChange={setSelectedCustomVoice}
                >
                  <SelectTrigger className="w-[200px] h-9">
                    <SelectValue placeholder="Select custom voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {customVoices.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        No custom voices yet
                      </div>
                    ) : (
                      customVoices.map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          {voice.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 gap-1.5"
                  onClick={() => setShowVoiceUpload(true)}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Add
                </Button>
                {selectedCustomVoice && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2 text-red-400 hover:text-red-300"
                    onClick={() => handleDeleteCustomVoice(selectedCustomVoice)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* STT Language */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">
              Speech Language
            </label>
            <Select value={sttLanguage} onValueChange={setSttLanguage}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sttLanguages.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}



      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Call Area */}
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-6 p-8",
            "flex-1",
          )}
        >
          {/* 3D Avatar — replaces old status circle */}
          <div className="w-64 h-64 relative">
            <Avatar3D
              aiStatus={aiStatus}
              isMuted={isMuted}
              isInCall={isInCall}
              visionEnabled={visionEnabled}
            />
          </div>

          {/* Camera Preview */}
          {isInCall && visionEnabled && (
            <div className="relative w-64 h-48 rounded-2xl overflow-hidden ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/20">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover mirror"
                style={{ transform: "scaleX(-1)" }}
              />
              <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded-full">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] text-white font-medium">
                  LIVE
                </span>
              </div>
              <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded-full">
                <Camera className="h-3 w-3 text-white" />
              </div>
            </div>
          )}

          {/* Status Text */}
          <div className="text-center space-y-2">
            {isInCall ? (
              <>
                <p className={cn("text-lg font-medium", getStatusColor())}>
                  {getStatusText()}
                </p>
                <p className="text-2xl font-mono text-muted-foreground">
                  {formatDuration(callDuration)}
                </p>
                {/* Show active TTS engine */}
                <p className="text-xs text-muted-foreground">
                  {ttsEngine === "luxtts" && selectedCustomVoice
                    ? `🎤 LuxTTS — ${customVoices.find((v) => v.id === selectedCustomVoice)?.name || "Custom"}`
                    : `🔊 Edge TTS — ${availableVoices.find((v) => v.id === selectedVoice)?.name || selectedVoice}`}
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-medium text-foreground">
                  Cognify Live Talk
                </p>
                <p className="text-sm text-muted-foreground">
                  Press the call button to start a voice conversation
                </p>
              </>
            )}
          </div>

          {/* Waveform */}
          {isInCall && (
            <WaveformVisualizer
              isActive={
                aiStatus === "speaking" ||
                (isListening && !isMuted && aiStatus === "idle")
              }
              color={
                aiStatus === "speaking"
                  ? "rgba(74, 222, 128, 0.7)"
                  : "rgba(168, 85, 247, 0.7)"
              }
            />
          )}

          {/* Interim text */}
          {interimText && aiStatus === "idle" && (
            <div className="px-4 py-2 rounded-lg bg-muted/50 text-sm text-muted-foreground italic max-w-md text-center">
              {interimText}...
            </div>
          )}

          {/* Call Controls */}
          <div className="flex items-center gap-4">
            {isInCall ? (
              <>
                {/* Mute Toggle */}
                <Button
                  variant={isMuted ? "destructive" : "outline"}
                  size="lg"
                  className="h-14 w-14 rounded-full"
                  onClick={toggleMute}
                >
                  {isMuted ? (
                    <MicOff className="h-6 w-6" />
                  ) : (
                    <Mic className="h-6 w-6" />
                  )}
                </Button>

                {/* End Call */}
                <Button
                  variant="destructive"
                  size="lg"
                  className="h-16 w-16 rounded-full shadow-lg shadow-red-500/25"
                  onClick={endCall}
                >
                  <PhoneOff className="h-7 w-7" />
                </Button>

                {/* Volume indicator */}
                <Button
                  variant="outline"
                  size="lg"
                  className="h-14 w-14 rounded-full"
                  disabled
                >
                  {aiStatus === "speaking" ? (
                    <Volume2 className="h-6 w-6 text-green-500" />
                  ) : (
                    <VolumeX className="h-6 w-6 text-muted-foreground" />
                  )}
                </Button>

                {/* Vision Toggle */}
                <Button
                  variant={visionEnabled ? "default" : "outline"}
                  size="lg"
                  className={cn(
                    "h-14 w-14 rounded-full",
                    visionEnabled &&
                      "bg-blue-600 hover:bg-blue-700 border-blue-600",
                  )}
                  onClick={toggleVision}
                  title="Toggle camera"
                >
                  <Camera
                    className={cn("h-6 w-6", visionEnabled && "text-white")}
                  />
                </Button>
              </>
            ) : (
              <Button
                size="lg"
                className="h-16 w-16 rounded-full bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/25"
                onClick={startCall}
              >
                <Phone className="h-7 w-7" />
              </Button>
            )}
          </div>
        </div>

        {/* Transcript Panel */}
        {showTranscript && isInCall && (
          <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-border flex flex-col bg-muted/20">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-medium">Transcript</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {transcripts.map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex gap-3",
                    item.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                      item.role === "user"
                        ? "bg-purple-600 text-white rounded-br-md"
                        : item.role === "system"
                          ? "bg-yellow-500/20 text-yellow-300 rounded-bl-md"
                          : "bg-muted rounded-bl-md text-foreground",
                    )}
                  >
                    {item.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:mb-1.5 prose-p:last:mb-0 prose-headings:mb-1.5 prose-headings:mt-2 prose-ul:mb-1.5 prose-ol:mb-1.5 prose-li:mb-0.5 prose-pre:my-1.5 prose-code:text-xs">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: (props) => (
                              <p className="mb-1.5 last:mb-0" {...props} />
                            ),
                            ul: (props) => (
                              <ul
                                className="list-disc pl-4 mb-1.5"
                                {...props}
                              />
                            ),
                            ol: (props) => (
                              <ol
                                className="list-decimal pl-4 mb-1.5"
                                {...props}
                              />
                            ),
                            li: (props) => (
                              <li className="mb-0.5" {...props} />
                            ),
                            h1: (props) => (
                              <h1
                                className="text-base font-bold mb-1.5 mt-2"
                                {...props}
                              />
                            ),
                            h2: (props) => (
                              <h2
                                className="text-sm font-bold mb-1 mt-1.5"
                                {...props}
                              />
                            ),
                            h3: (props) => (
                              <h3
                                className="text-sm font-semibold mb-1 mt-1"
                                {...props}
                              />
                            ),
                            blockquote: (props) => (
                              <blockquote
                                className="border-l-2 border-foreground/20 pl-3 italic my-1.5 text-muted-foreground"
                                {...props}
                              />
                            ),
                            code: ({ children, ...props }) => {
                              const isInline =
                                !props.className?.includes("language-");
                              return isInline ? (
                                <code
                                  className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded font-mono text-xs"
                                  {...props}
                                >
                                  {children}
                                </code>
                              ) : (
                                <pre className="bg-black/10 dark:bg-black/30 p-2 rounded-lg overflow-x-auto my-1.5">
                                  <code
                                    className="font-mono text-xs"
                                    {...props}
                                  >
                                    {children}
                                  </code>
                                </pre>
                              );
                            },
                            table: (props) => (
                              <div className="overflow-x-auto my-2 w-full">
                                <table
                                  className="w-full border-collapse text-xs"
                                  {...props}
                                />
                              </div>
                            ),
                            thead: (props) => (
                              <thead
                                className="bg-black/5 dark:bg-white/5"
                                {...props}
                              />
                            ),
                            th: (props) => (
                              <th
                                className="border border-border px-2 py-1 text-left font-bold text-xs"
                                {...props}
                              />
                            ),
                            td: (props) => (
                              <td
                                className="border border-border px-2 py-1 text-xs"
                                {...props}
                              />
                            ),
                            a: (props) => (
                              <a
                                className="text-blue-400 underline hover:text-blue-300"
                                target="_blank"
                                rel="noopener noreferrer"
                                {...props}
                              />
                            ),
                          }}
                        >
                          {item.text}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{item.text}</p>
                    )}
                    <p
                      className={cn(
                        "text-[10px] mt-1",
                        item.role === "user"
                          ? "text-purple-200"
                          : "text-muted-foreground",
                      )}
                    >
                      {item.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
