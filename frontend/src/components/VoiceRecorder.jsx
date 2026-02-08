import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Mic, Square, X } from "lucide-react"

// Voice recording states
const RecordingState = {
  IDLE: 'idle',
  RECORDING: 'recording',
  PROCESSING: 'processing',
}

// Format duration in mm:ss
const formatDuration = (seconds) => {
  // Handle invalid values
  if (!seconds || !isFinite(seconds) || isNaN(seconds)) {
    return '00:00'
  }
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const VoiceRecorder = ({ 
  onRecordingComplete, 
  onCancel,
  disabled = false,
  autoStart = false,
  className 
}) => {
  const [state, setState] = React.useState(RecordingState.IDLE)
  const [duration, setDuration] = React.useState(0)
  const [audioLevel, setAudioLevel] = React.useState(0)
  const [error, setError] = React.useState(null)
  
  const mediaRecorderRef = React.useRef(null)
  const audioChunksRef = React.useRef([])
  const streamRef = React.useRef(null)
  const timerRef = React.useRef(null)
  const analyserRef = React.useRef(null)
  const animationFrameRef = React.useRef(null)
  const hasAutoStartedRef = React.useRef(false)
  const durationRef = React.useRef(0)

  // Stop recording function - defined first as it's used by startRecording
  const stopRecording = React.useCallback((cancel = false) => {
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      if (cancel) {
        audioChunksRef.current = [] // Clear chunks if cancelled
      }
      mediaRecorderRef.current.stop()
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    setAudioLevel(0)
    
    if (cancel) {
      setState(RecordingState.IDLE)
      setDuration(0)
      durationRef.current = 0
      onCancel?.()
    }
  }, [onCancel])

  // Start recording function
  const startRecording = React.useCallback(async () => {
    try {
      setError(null)
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      })
      streamRef.current = stream

      // Setup audio analysis for visualization
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      // Start visualizing audio level
      const updateLevel = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
          analyserRef.current.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
          setAudioLevel(average / 255) // Normalize to 0-1
          animationFrameRef.current = requestAnimationFrame(updateLevel)
        }
      }
      updateLevel()

      // Setup MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : 'audio/mp4'
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        // Process recorded audio
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
          const audioUrl = URL.createObjectURL(audioBlob)
          
          onRecordingComplete?.({
            blob: audioBlob,
            url: audioUrl,
            duration: durationRef.current,
            mimeType: mimeType
          })
        }
        setState(RecordingState.IDLE)
        durationRef.current = 0
      }

      mediaRecorder.start(100) // Collect data every 100ms
      setState(RecordingState.RECORDING)
      setDuration(0)
      durationRef.current = 0

      // Start duration timer
      timerRef.current = setInterval(() => {
        durationRef.current += 1
        setDuration(prev => prev + 1)
      }, 1000)

    } catch (err) {
      console.error('Error starting recording:', err)
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access.')
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.')
      } else {
        setError('Failed to start recording. Please try again.')
      }
      setState(RecordingState.IDLE)
    }
  }, [onRecordingComplete])

  // Auto-start recording if autoStart prop is true
  React.useEffect(() => {
    if (autoStart && !hasAutoStartedRef.current && state === RecordingState.IDLE) {
      hasAutoStartedRef.current = true
      startRecording()
    }
  }, [autoStart, state, startRecording])

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      // Stop animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }, [])

  const handleClick = () => {
    if (state === RecordingState.IDLE) {
      startRecording()
    } else if (state === RecordingState.RECORDING) {
      stopRecording(false)
    }
  }

  const handleCancel = () => {
    stopRecording(true)
  }

  // Generate stable bar heights based on index (not random each render)
  const getBarHeight = (index, level) => {
    const baseHeight = 20
    const variation = Math.sin(index * 1.5) * 15 + Math.cos(index * 0.7) * 10
    return Math.min(100, Math.max(baseHeight, level * 100 + variation))
  }

  // Render based on state
  if (state === RecordingState.IDLE && !autoStart) {
    return (
      <div className={cn("relative", className)}>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={handleClick}
          disabled={disabled}
          className="h-10 w-10 rounded-xl shrink-0 text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-colors"
          title="Record voice note"
        >
          <Mic className="h-5 w-5" />
        </Button>
        {error && (
          <div className="absolute bottom-full mb-2 left-0 right-0 p-2 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive whitespace-nowrap">
            {error}
          </div>
        )}
      </div>
    )
  }

  // Show recording UI or loading state when autoStart is true but recording hasn't begun
  if (state === RecordingState.IDLE && autoStart) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl",
        className
      )}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" />
          <span className="text-sm font-medium text-foreground">
            Starting...
          </span>
        </div>
        {error && (
          <span className="text-xs text-destructive">{error}</span>
        )}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={handleCancel}
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-destructive/10 shrink-0 ml-auto"
          title="Cancel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-xl",
      className
    )}>
      {/* Recording indicator */}
      <div className="flex items-center gap-2">
        <div 
          className="w-3 h-3 rounded-full bg-red-500 animate-pulse"
          style={{
            boxShadow: `0 0 ${10 + audioLevel * 20}px rgba(239, 68, 68, ${0.5 + audioLevel * 0.5})`
          }}
        />
        <span className="text-sm font-medium text-foreground">
          {formatDuration(duration)}
        </span>
      </div>

      {/* Audio level bars */}
      <div className="flex items-center gap-0.5 h-6">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="w-1 bg-red-500/80 rounded-full transition-all duration-100"
            style={{
              height: `${getBarHeight(i, audioLevel)}%`,
              opacity: audioLevel > (i * 0.2) ? 1 : 0.3
            }}
          />
        ))}
      </div>

      {/* Stop button */}
      <Button
        type="button"
        size="icon"
        variant="default"
        onClick={handleClick}
        className="h-8 w-8 rounded-lg bg-red-500 hover:bg-red-600 shrink-0"
        title="Stop recording"
      >
        <Square className="h-3 w-3 fill-current" />
      </Button>

      {/* Cancel button */}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={handleCancel}
        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-destructive/10 shrink-0"
        title="Cancel recording"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

// Audio player component for displaying recorded voice notes
const VoiceNotePlayer = ({ audioUrl, duration, className }) => {
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [currentTime, setCurrentTime] = React.useState(0)
  const [totalDuration, setTotalDuration] = React.useState(duration || 0)
  const audioRef = React.useRef(null)
  
  // Generate stable waveform heights on mount
  const waveformHeights = React.useMemo(() => {
    return [...Array(20)].map((_, i) => 20 + Math.sin(i * 0.8) * 40 + (i % 3) * 10)
  }, [])

  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const handleLoadedMetadata = () => {
      // audio.duration can be Infinity for some formats like webm
      // Use prop duration as fallback, or 0 if both are invalid
      if (audio.duration && isFinite(audio.duration) && !isNaN(audio.duration)) {
        setTotalDuration(audio.duration)
      } else if (duration && isFinite(duration) && !isNaN(duration)) {
        setTotalDuration(duration)
      }
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (e) => {
    const audio = audioRef.current
    if (!audio) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    audio.currentTime = percentage * totalDuration
  }

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl min-w-[200px]",
      className
    )}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      {/* Play/Pause button */}
      <button
        onClick={togglePlayPause}
        className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shrink-0 hover:scale-105 transition-transform"
      >
        {isPlaying ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
      </button>

      {/* Waveform / Progress */}
      <div className="flex-1">
        <div 
          className="h-8 bg-black/10 dark:bg-white/10 rounded-lg cursor-pointer relative overflow-hidden"
          onClick={handleSeek}
        >
          {/* Progress bar */}
          <div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500/30 to-pink-500/30 rounded-lg transition-all"
            style={{ width: `${progress}%` }}
          />
          
          {/* Waveform visualization */}
          <div className="absolute inset-0 flex items-center justify-around px-2">
            {waveformHeights.map((height, i) => (
              <div
                key={i}
                className={cn(
                  "w-1 rounded-full transition-colors",
                  (i / 20) * 100 < progress ? "bg-purple-500" : "bg-gray-400/50"
                )}
                style={{
                  height: `${height}%`
                }}
              />
            ))}
          </div>
        </div>
        
        {/* Time */}
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{formatDuration(currentTime)}</span>
          <span>{formatDuration(totalDuration)}</span>
        </div>
      </div>
    </div>
  )
}

export { VoiceRecorder, VoiceNotePlayer }
