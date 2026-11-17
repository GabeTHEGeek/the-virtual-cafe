import { useEffect, useState } from 'react';
import type { Arrival } from '../lib/protocol';
import { roomWidth, roomHeight } from '../lib/seats';

const welcomeDuration = 18_000;

export function BaristaCounter({ arrival, onBarista }: { arrival?: Arrival; onBarista: () => void }) {
  const [expired, setExpired] = useState<string>();
  useEffect(() => {
    if (!arrival) return;
    const timer = setTimeout(() => setExpired(arrival.id), Math.max(0, arrival.at + welcomeDuration - Date.now()));
    return () => clearTimeout(timer);
  }, [arrival?.id, arrival?.at]);
  const name = arrival && expired !== arrival.id && Date.now() - arrival.at < welcomeDuration ? arrival.name : undefined;
  const size = name ? Math.min(13, 138 / name.length) : 14;

  return <>
    <img className="counter-art" src="/art/cafe-counter.svg" alt="Owl barista behind the counter" draggable={false} />
    <button type="button" className="barista-order" aria-label="Order snacks from the barista"
      onClick={onBarista}><span>Order snacks</span></button>
    <div className="counter-board" role="status" aria-label="Café welcome board">
      <span className="sr-only">{name ? `${name} just joined` : 'The Virtual Café'}</span>
      <svg viewBox={`0 0 ${roomWidth} ${roomHeight}`} preserveAspectRatio="none" aria-hidden="true">
        {/* Align text with the painted board's interior edges. */}
        <g transform="matrix(1 .216 -.009 1.008 1213.5 85.8)" textAnchor="middle">
          <text x="55" y="45" fontSize="8" letterSpacing=".8">{name ? 'JUST JOINED' : 'THE VIRTUAL'}</text>
          <text x="55" y="64" fontWeight="700" fontSize={size}>{name ?? 'CAFÉ'}</text>
        </g>
      </svg>
    </div>
  </>;
}
