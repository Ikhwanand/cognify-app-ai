import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
} from "lucide-react";
import { voiceAPI } from "@/services/api";

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
    // Convert base64 to ArrayBuffer
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

    // Merge all chunks into one ArrayBuffer
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
      // Fallback: play as blob
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
  const startRef = useRef(null); // self-reference for onend restart

  const stop = useCallback(() => {
    // Clear any pending restart
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // Prevent auto-restart
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
    // Clean up any existing instance first
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

    // Create a fresh instance every time
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";

      // Reset abort counter on successful result
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
        // Suppress console spam for aborted — it's expected during camera init
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

      // If too many consecutive aborts, stop trying (prevents infinite loop)
      if (abortCountRef.current >= 5) {
        console.warn("STT: Too many aborts, waiting 3s before retry...");
        restartTimerRef.current = setTimeout(() => {
          abortCountRef.current = 0;
          startRef.current?.();
        }, 3000);
        return;
      }

      // Restart with a fresh instance after a delay
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

  // Keep startRef in sync
  useEffect(() => {
    startRef.current = start;
  }, [start]);

  // Cleanup on unmount
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

  // Initialize bars with random values once on mount
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
          // Animate bars
          bars[i] += (Math.random() - 0.5) * 0.15;
          bars[i] = Math.max(0.05, Math.min(1, bars[i]));
        } else {
          // Decay to low
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

// ============ Main LiveTalk Component ===============
export default function LiveTalk({ onBack, mode = "chat" }) {
  // Connection state
  const [isInCall, setIsInCall] = useState(false);

  // Voice state
  const [isMuted, setIsMuted] = useState(false);
  const [aiStatus, setAiStatus] = useState("idle"); // idle, thinking, speaking
  const [selectedVoice, setSelectedVoice] = useState("en-US-GuyNeural");
  const [availableVoices, setAvailableVoices] = useState([]);
  const [sttLanguage, setSttLanguage] = useState("en-US");
  const [showSettings, setShowSettings] = useState(false);

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
  const canvasRef2 = useRef(null); // for capturing frames
  const streamRef = useRef(null); // MediaStream ref

  // Refs for STT control (to avoid circular dependency with useSpeechRecognition)
  const sttControlRef = useRef({ start: () => {}, stop: () => {} });

  // ===== Camera Control (must be before handleSpeechResult) =====
  const startCamera = useCallback(async () => {
    try {
      // Stop STT before requesting camera to avoid abort conflicts
      sttControlRef.current.stop();

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraActive(true);

      // Restart STT after camera is ready (small delay for stability)
      setTimeout(() => {
        sttControlRef.current.start();
      }, 500);
    } catch (err) {
      console.error("Camera error:", err);
      alert("Could not access camera. Please check permissions.");
      // Restart STT even if camera failed
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

      // Add user transcript
      setTranscripts((prev) => [
        ...prev,
        { role: "user", text, timestamp: new Date() },
      ]);

      // Send to backend
      if (wsRef.current) {
        if (visionEnabled && cameraActive) {
          // Capture camera frame and send with speech
          const frame = captureFrame();
          wsRef.current.send({
            type: "vision_speech",
            text,
            image: frame,
            session_id: sessionId,
            voice: selectedVoice,
            mode,
          });
        } else {
          // Normal voice-only
          wsRef.current.send({
            type: "user_speech",
            text,
            session_id: sessionId,
            voice: selectedVoice,
            mode,
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

  // Wire up STT control ref (used by startCamera to avoid circular deps)
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
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  // Sync STT with aiStatus — stop listening when AI is busy, restart when idle
  useEffect(() => {
    if (!isInCall) return;

    if (aiStatus === "thinking" || aiStatus === "speaking") {
      // Stop STT when AI is processing or speaking to avoid feedback
      stopListening();
    } else if (aiStatus === "idle" && !isMuted) {
      // Resume STT when AI is done and mic is not muted
      startListening();
    }
  }, [aiStatus, isInCall, isMuted, startListening, stopListening]);

  // ====== Call Control ======

  const endCall = useCallback(() => {
    // Stop listening
    stopListening();

    // Stop audio
    audioPlayerRef.current.stop();

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Clear timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    setIsInCall(false);
    setAiStatus("idle");
    setInterimText("");
  }, [stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    const player = audioPlayerRef.current;
    return () => {
      endCall();
      player.destroy();
    };
  }, [endCall]);

  const startCall = useCallback(() => {
    // Init audio context (needs user gesture)
    audioPlayerRef.current.init();

    // Connect WebSocket
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
            // Ensure status is 'speaking' during playback
            setAiStatus("speaking");
            if (audioPlayerRef.current.chunks.length > 0) {
              // Play collected audio
              audioPlayerRef.current.onPlaybackEnd = () => {
                setAiStatus("idle");
              };
              audioPlayerRef.current.playAll();
            } else {
              // No audio chunks received — go back to idle
              setAiStatus("idle");
            }
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

    // Wait for connection
    connection.ws.onopen = () => {
      setIsInCall(true);
      setCallDuration(0);
      setTranscripts([]);

      // Start call timer
      durationIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);

      // Start listening
      startListening();
    };
  }, [startListening]);

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
  useEffect(() => {
    if (!isInCall && cameraActive) {
      stopCamera();
      setVisionEnabled(false);
    }
  }, [isInCall, cameraActive, stopCamera]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // ========= Render =============
  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef2} className="hidden" />
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
          {/* Voice Selection */}
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
            "flex flex-col items-center justify-center gap-8 p-8",
            showTranscript ? "flex-1" : "flex-1",
          )}
        >
          {/* Call Status Circle */}
          <div
            className={cn(
              "relative w-48 h-48 rounded-full flex items-center justify-center transition-all duration-500",
              isInCall
                ? aiStatus === "thinking"
                  ? "bg-yellow-500/10 ring-4 ring-yellow-500/30 animate-pulse"
                  : aiStatus === "speaking"
                    ? "bg-green-500/10 ring-4 ring-green-500/30"
                    : "bg-purple-500/10 ring-4 ring-purple-500/30"
                : "bg-muted/50 ring-2 ring-border",
            )}
          >
            {/* Inner glow */}
            {isInCall && (
              <div
                className={cn(
                  "absolute inset-4 rounded-full opacity-20 animate-ping",
                  aiStatus === "thinking"
                    ? "bg-yellow-500"
                    : aiStatus === "speaking"
                      ? "bg-green-500"
                      : "bg-purple-500",
                )}
              />
            )}

            {/* Icon */}
            <div className="relative z-10">
              {!isInCall ? (
                <Phone className="h-16 w-16 text-muted-foreground" />
              ) : aiStatus === "thinking" ? (
                <Loader2 className="h-16 w-16 text-yellow-400 animate-spin" />
              ) : aiStatus === "speaking" ? (
                <Volume2 className="h-16 w-16 text-green-400" />
              ) : isMuted ? (
                <MicOff className="h-16 w-16 text-red-400" />
              ) : (
                <Mic className="h-16 w-16 text-purple-400" />
              )}
            </div>
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
                <span className="text-[10px] text-white font-medium">LIVE</span>
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

          {/* Interim text (what user is currently saying) */}
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
                            li: (props) => <li className="mb-0.5" {...props} />,
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
