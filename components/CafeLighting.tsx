import { useEffect, useId, useRef } from 'react';
import { tableLanterns } from '../lib/artwork';
import { roomHeight, roomWidth } from '../lib/seats';

export function CafeLighting() {
  const id = useId();
  const tableGlow = `${id}-table-glow`;
  const layer = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!layer.current) return;
    const lanterns = Array.from(layer.current.querySelectorAll<SVGGElement>('.lantern-light'));
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pulse = (phase: number) => (1 + Math.sin(phase)) / 2;
    let frame = 0;
    let previous = -Infinity;

    function tick(now: number) {
      if (now - previous >= 45) {
        previous = now;
        const slow = preference.matches;
        const seconds = now / 1000;
        lanterns.forEach((light, index) => {
          const phase = seconds * (slow ? 1.65 : 2.45) + index * 1.71;
          light.setAttribute('opacity', String(.08 + .9 * pulse(phase + .25 * Math.sin(seconds * 2.7 + index))));
        });
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <svg ref={layer} className="cafe-lighting" viewBox={`0 0 ${roomWidth} ${roomHeight}`}
    preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <radialGradient id={tableGlow}>
        <stop stopColor="#fff2b1" stopOpacity=".92" />
        <stop offset=".34" stopColor="#ffd07b" stopOpacity=".67" />
        <stop offset=".66" stopColor="#ffc064" stopOpacity=".28" />
        <stop offset="1" stopColor="#ffc064" stopOpacity="0" />
      </radialGradient>
    </defs>
    {tableLanterns.map(([x,y,radius]) => <g className="lantern-light" key={`${x}-${y}`} opacity=".48">
      <ellipse cx={x} cy={y + 13} rx={radius * 1.65} ry={radius * .92} fill={`url(#${tableGlow})`} />
      <ellipse cx={x} cy={y} rx={radius * .53} ry={radius * .76} fill={`url(#${tableGlow})`} />
    </g>)}
  </svg>;
}
