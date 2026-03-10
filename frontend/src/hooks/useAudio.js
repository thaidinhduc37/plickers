/**
 * src/hooks/useAudio.js
 * Hook quản lý audio file playback với support cho countdown timer
 */
import { useRef, useCallback } from "react";

export function useAudio() {
  const audioRef = useRef(null);
  const contextRef = useRef(null);

  // Khởi tạo Web Audio Context (lazy)
  const getContext = useCallback(() => {
    if (!contextRef.current) {
      contextRef.current = new (
        window.AudioContext || window.webkitAudioContext
      )();
    }
    return contextRef.current;
  }, []);

  // Phát file audio từ URL
  const play = useCallback(async (url, options = {}) => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      audioRef.current = new Audio(url);
      audioRef.current.volume = options.volume ?? 0.8;

      if (options.loop) {
        audioRef.current.loop = true;
      }

      await audioRef.current.play();
      return true;
    } catch (error) {
      console.error("Audio playback failed:", error);
      return false;
    }
  }, []);

  // Dừng playback
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  // Tạo beep sound đơn giản bằng Web Audio API
  const beep = useCallback(
    (frequency = 800, duration = 200) => {
      try {
        const ctx = getContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = frequency;
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
          0.01,
          ctx.currentTime + duration / 1000,
        );

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration / 1000);
      } catch (error) {
        console.error("Beep failed:", error);
      }
    },
    [getContext],
  );

  return { play, stop, beep, getContext };
}

/**
 * Tạo URL cho countdown timer sounds
 * Nếu có file MP3 thực tế, thay thế bằng import
 */
export const COUNTDOWN_SOUNDS = {
  10: "/sounds/10s.mp3",
  15: "/sounds/15s.mp3",
  20: "/sounds/20s.mp3",
  30: "/sounds/30s.mp3",
  45: "/sounds/45s.mp3",
  60: "/sounds/60s.mp3",
};

// Fallback: dùng Web Audio API để tạo sound nếu file không có
export function startCountdownTimer(duration, onTick, onComplete) {
  const interval = setInterval(() => {
    duration--;
    onTick?.(duration);
    if (duration <= 0) {
      clearInterval(interval);
      onComplete?.();
    }
  }, 1000);

  return () => clearInterval(interval);
}
