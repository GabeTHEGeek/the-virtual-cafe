import { memo, type CSSProperties } from 'react';
import type { OccupiedSeat } from '../lib/cafe';
import { avatarWidthPercent, seatedAnchor, zones } from '../lib/seats';
import { Avatar, PresenceDot } from './Avatar';
import { gearFor, isSideDesk, Laptop } from './Laptop';
import { Icon } from './Icon';

export const CafeSeat = memo(function CafeSeat({ seat, own, selected, located, choosing, typing, onSelect }: {
  seat: OccupiedSeat; own: boolean; selected: boolean; located: boolean; choosing: boolean; typing?: boolean; onSelect: (seat: OccupiedSeat) => void;
}) {
  const { occupant } = seat;
  const style = {
    left: `${seat.x}%`, top: `${seat.y}%`, '--scale': seat.scale, '--flip': seat.flip ? -1 : 1,
    '--avatar-width': `${avatarWidthPercent * seat.scale}cqw`, '--seated-anchor': `${seatedAnchor * 100}%`, '--idle-delay': `-${seat.x / 5}s`, zIndex: occupant ? seat.layer ?? Math.round(seat.y) : 100,
  } as CSSProperties;

  if (!occupant && !choosing) return null;

  const gear = occupant ? gearFor(seat, occupant) : undefined;

  return occupant ? <button id={`seat-${seat.id}`} style={style} type="button"
    className={`seat occupied ${located ? 'located-seat' : ''} ${own ? 'own-seat' : ''} ${occupant.disconnected ? 'reserved-seat' : ''}`} aria-pressed={selected}
    aria-label={`${occupant.name}${own ? ' (you)' : ''}, ${occupant.presence}, ${zones[seat.zone]}`}
    onClick={() => onSelect(seat)}>
    {typing && <span className="speech-bubble typing-bubble" aria-label={`${occupant.name} is typing`}>
      <i /><i /><i />
    </span>}
    <span className="guest-label"><PresenceDot presence={occupant.presence} /><span className="guest-name">{occupant.name}</span></span>
    <span className="guest-sprite">
      <Avatar animal={occupant.animal} headphones={gear?.headphones} working={isSideDesk(seat)} />
      {seat.zone === 'lounge' && gear?.laptop && <span className="lap-laptop"><Laptop angle="lap" /></span>}
    </span>
  </button> : <button style={style} type="button" className="seat empty-seat"
    aria-label={`Move to ${zones[seat.zone]} seat ${seat.id.split('-')[1]}`}
    title={`Available · ${zones[seat.zone]}`} onClick={() => onSelect(seat)}><Icon name="chair" size={16} /></button>;
}, (before, after) => {
  const left = before.seat.occupant;
  const right = after.seat.occupant;
  return before.seat.id === after.seat.id && before.own === after.own && before.selected === after.selected
    && before.seat.layer === after.seat.layer && before.seat.x === after.seat.x && before.seat.y === after.seat.y && before.seat.scale === after.seat.scale
    && before.located === after.located && before.choosing === after.choosing && before.typing === after.typing && before.onSelect === after.onSelect
    && left?.id === right?.id && left?.name === right?.name && left?.animal === right?.animal
    && left?.presence === right?.presence && left?.disconnected === right?.disconnected;
});
