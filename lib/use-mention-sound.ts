'use client';

import { useCallback, useEffect, useRef } from 'react';

export function useMentionSound() {
  const context = useRef<AudioContext | null>(null);
  useEffect(() => {
    const enable = () => {
      if (!window.AudioContext) return;
      const audio = context.current ??= new AudioContext();
      if (audio.state === 'suspended') void audio.resume().catch(() => {});
    };
    window.addEventListener('pointerdown', enable);
    window.addEventListener('keydown', enable);
    return () => {
      window.removeEventListener('pointerdown', enable);
      window.removeEventListener('keydown', enable);
      void context.current?.close();
      context.current = null;
    };
  }, []);
  return useCallback(() => {
    const audio = context.current;
    if (!audio || audio.state !== 'running') return;
    for (const [index, frequency] of [660, 880].entries()) {
      const start = audio.currentTime + index * .16;
      const tone = audio.createOscillator();
      const gain = audio.createGain();
      tone.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(.065, start + .012);
      gain.gain.exponentialRampToValueAtTime(.001, start + .32);
      tone.connect(gain).connect(audio.destination);
      tone.onended = () => {tone.disconnect(); gain.disconnect();};
      tone.start(start);
      tone.stop(start + .34);
    }
  }, []);
}
