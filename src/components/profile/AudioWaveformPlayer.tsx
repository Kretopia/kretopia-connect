import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface AudioWaveformPlayerProps {
  src: string;
  title?: string;
  autoPlay?: boolean;
}

export const AudioWaveformPlayer = ({ src, title, autoPlay = false }: AudioWaveformPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]);

  // Generate waveform data from audio
  useEffect(() => {
    const generateWaveform = async () => {
      try {
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const channelData = audioBuffer.getChannelData(0);
        const samples = 100;
        const blockSize = Math.floor(channelData.length / samples);
        const waveform: number[] = [];
        
        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[i * blockSize + j]);
          }
          waveform.push(sum / blockSize);
        }
        
        // Normalize
        const max = Math.max(...waveform);
        setWaveformData(waveform.map(v => v / max));
      } catch (error) {
        // Fallback: generate random waveform for visual
        const fallback = Array.from({ length: 100 }, () => Math.random() * 0.5 + 0.3);
        setWaveformData(fallback);
      }
    };
    
    generateWaveform();
  }, [src]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const drawWaveform = () => {
      const { width, height } = canvas;
      const progress = duration > 0 ? currentTime / duration : 0;
      
      ctx.clearRect(0, 0, width, height);
      
      const barWidth = width / waveformData.length;
      const playedBars = Math.floor(progress * waveformData.length);
      
      waveformData.forEach((amplitude, i) => {
        const barHeight = amplitude * height * 0.8;
        const x = i * barWidth;
        const y = (height - barHeight) / 2;
        
        // Played bars - primary color
        if (i < playedBars) {
          ctx.fillStyle = "hsl(var(--primary))";
        } else {
          ctx.fillStyle = "hsl(var(--muted-foreground) / 0.3)";
        }
        
        ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
      });
    };
    
    drawWaveform();
  }, [waveformData, currentTime, duration]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      if (autoPlay) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      const newTime = (value[0] / 100) * duration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0] / 100;
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  return (
    <div className="w-full bg-card rounded-xl p-4 space-y-3">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />
      
      {/* Title */}
      {title && (
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
      )}
      
      {/* Waveform */}
      <div className="relative h-16 cursor-pointer" onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = (x / rect.width) * 100;
        handleSeek([percentage]);
      }}>
        <canvas
          ref={canvasRef}
          width={400}
          height={64}
          className="w-full h-full"
        />
      </div>
      
      {/* Controls */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={togglePlay}
          className="h-10 w-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </Button>
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>
        
        <div className="flex-1" />
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleMute} className="h-8 w-8">
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume * 100]}
            max={100}
            step={1}
            className="w-20"
            onValueChange={handleVolumeChange}
          />
        </div>
      </div>
    </div>
  );
};