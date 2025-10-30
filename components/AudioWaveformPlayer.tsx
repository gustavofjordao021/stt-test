'use client';

import { useEffect, useRef, useState } from 'react';

interface AudioWaveformPlayerProps {
  audioUrl: string;
  className?: string;
}

export function AudioWaveformPlayer({ audioUrl, className = '' }: AudioWaveformPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      const progress = duration > 0 ? currentTime / duration : 0;

      ctx.clearRect(0, 0, width, height);

      // Draw waveform bars (static pattern)
      const barCount = 40;
      const barWidth = 2;
      const gap = 2;
      const totalWidth = barCount * (barWidth + gap);
      const startX = (width - totalWidth) / 2;

      for (let i = 0; i < barCount; i++) {
        const x = startX + i * (barWidth + gap);
        const normalizedPos = i / barCount;
        const barHeight = Math.sin(normalizedPos * Math.PI * 3) * (height * 0.3) + height * 0.2;
        const y = (height - barHeight) / 2;

        // Color based on progress
        if (normalizedPos <= progress) {
          ctx.fillStyle = 'rgb(59, 130, 246)'; // blue-500
        } else {
          ctx.fillStyle = 'rgb(229, 231, 235)'; // gray-200
        }

        ctx.fillRect(x, y, barWidth, barHeight);
      }

      if (isPlaying) {
        animationRef.current = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [currentTime, duration, isPlaying]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (time: number) => {
    if (!isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas || !duration) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const progress = x / rect.width;
    audio.currentTime = progress * duration;
  };

  return (
    <div className={`flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm ${className}`}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <button
        onClick={togglePlayPause}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-500"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-1">
        <canvas
          ref={canvasRef}
          width={300}
          height={32}
          className="w-full cursor-pointer rounded"
          onClick={handleSeek}
        />
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="tabular-nums">{formatTime(currentTime)}</span>
          <span className="tabular-nums">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
