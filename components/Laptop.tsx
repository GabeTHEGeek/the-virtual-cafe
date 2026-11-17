import type { CSSProperties } from 'react';
import { roomWidth, roomHeight, type Seat } from '../lib/seats';
import type { Visitor } from '../lib/cafe';

export function gearFor(seat: Seat, visitor: Visitor) {
  const variant = Array.from(visitor.name).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const coffee = visitor.animal === 'fox' || visitor.animal === 'rabbit';
  const headphones = (seat.zone === 'lounge' && coffee) || variant % 3 !== 0;
  const laptop = seat.zone !== 'lounge' || !(coffee && headphones);
  return { headphones, laptop };
}

type Angle = 'left' | 'right' | 'window' | 'counter' | 'lap';
const tableAnchors: Record<string, readonly [number, number, Exclude<Angle, 'lap'>]> = {
  'shared-1': [699, 492, 'left'], 'shared-2': [657, 600, 'left'],
  'shared-3': [892, 465, 'right'], 'shared-4': [852, 601, 'right'],
  'shared-5': [1079, 453, 'left'], 'shared-6': [1071, 568, 'left'],
  'shared-7': [1233, 453, 'right'], 'shared-8': [1226, 568, 'right'],
  'work-1': [1510, 414, 'left'], 'work-2': [1524, 468, 'left'],
  'work-3': [1519, 528, 'left'], 'work-4': [1529, 613, 'left'],
  'work-5': [1529, 688, 'left'], 'work-6': [1072, 247, 'counter'],
  'work-7': [1143, 257, 'counter'], 'work-8': [1214, 273, 'counter'],
  'window-1': [455, 315, 'window'], 'window-2': [553, 293, 'window'],
  'window-3': [653, 270, 'window'], 'window-4': [743, 247, 'window'],
};

export function isSideDesk(seat: Seat) {
  const angle = tableAnchors[seat.id]?.[2];
  return angle === 'left' || angle === 'right';
}

export function TableLaptop({ seat }: { seat: Seat }) {
  const anchor = tableAnchors[seat.id];
  if (!anchor) return null;
  const [x, y, angle] = anchor;
  const sideDesk = angle === 'left' || angle === 'right';
  return <span className={sideDesk ? 'table-laptop desk-laptop' : 'table-laptop'} aria-hidden="true" style={{
    left: `${x * 100 / roomWidth}%`, top: `${y * 100 / roomHeight}%`, '--laptop-size': seat.scale,
    zIndex: sideDesk ? undefined : Math.round(seat.y) - 1,
  } as CSSProperties}><Laptop angle={angle} /></span>;
}

export function Laptop({angle}: {angle: Angle}) {
  return <img className="laptop-sprite" src={`/art/laptops/${angle}.webp`} alt="" draggable={false} />;
}
