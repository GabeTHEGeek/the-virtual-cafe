import { useLayoutEffect, useRef } from 'react';
import { avatarWidthPercent, seatedAnchor, type Seat } from '../lib/seats';

export function MessageBubble({ seat, message }: { seat: Seat; message: string }) {
  const bubbleRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const bubble = bubbleRef.current;
    const scene = bubble?.parentElement;
    if (!bubble || !scene) return;

    function position() {
      if (!bubble || !scene) return;
      const x = scene.clientWidth * seat.x / 100;
      const y = scene.clientHeight * seat.y / 100;
      const spriteHeight = scene.clientWidth * avatarWidthPercent / 100 * seat.scale * 1.25;
      const margin = 8;
      const above = y - spriteHeight * seatedAnchor - 27 - bubble.offsetHeight;
      const below = y + spriteHeight * (1 - seatedAnchor) + margin;
      bubble.style.left = `${Math.max(margin, Math.min(x - bubble.offsetWidth / 2, scene.clientWidth - bubble.offsetWidth - margin))}px`;
      bubble.style.top = `${Math.max(margin, Math.min(above >= margin ? above : below, scene.clientHeight - bubble.offsetHeight - margin))}px`;
    }

    position();
    const observer = new ResizeObserver(position);
    observer.observe(scene);
    observer.observe(bubble);
    return () => observer.disconnect();
  }, [seat.x, seat.y, seat.scale, message]);

  return <span ref={bubbleRef} className="speech-bubble public-message-bubble" aria-hidden="true">{message}</span>;
}
