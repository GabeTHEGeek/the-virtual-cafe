import { Fragment, useEffect, useState } from 'react';
import { defaultTables, layoutStorageKey, placementFor, validTables, type TableLayouts } from '../lib/table-layout';
import { TableLayoutEditor } from './TableLayoutEditor';
import { snackPlacements } from '../lib/snacks';
import { MessageBubble } from './MessageBubble';
import { CafeLighting } from './CafeLighting';
import { BaristaCounter } from './BaristaCounter';
import type { Arrival } from '../lib/protocol';
import { useId, type CSSProperties, type ReactNode } from 'react';
import { cafeArtwork, tabletopSilhouettes, type CafeTime } from '../lib/artwork';
import type { OccupiedSeat } from '../lib/cafe';
import { avatarWidthPercent, roomWidth, roomHeight, seatedAnchor, zones, type Zone } from '../lib/seats';
import { AvatarProfile } from './AvatarProfile';
import { CafeSeat } from './CafeSeat';
import { isSideDesk, TableLaptop } from './Laptop';
import { Icon } from './Icon';
import { WindowCats } from './WindowCats';

const markers: Record<Zone, [number, number, string]> = {
  window: [31, 13, 'cup'],
  lounge: [15, 39, 'chair'],
  shared: [49, 34, 'users'],
  work: [90, 33, 'laptop'],
};

export function CafeScene({ occupancy: originalOccupancy, editable = false, onLayoutOpen, visitorId, profileId, locatedId, choosing, rain, arrival, bubbles, typing, profileActions, time, onBarista, onSeat, onClose }: {
  occupancy: OccupiedSeat[]; editable?: boolean; onLayoutOpen?: () => void; visitorId?: string; profileId?: string; locatedId?: string; choosing: boolean;
  time: CafeTime; rain: boolean; arrival?: Arrival; bubbles?: Record<string, string>; typing?: Record<string, boolean>; profileActions?: ReactNode; onBarista: () => void; onSeat: (seat: OccupiedSeat) => void; onClose: () => void;
}) {
  const [tables, setTables] = useState<TableLayouts>(defaultTables);
  const [editing, setEditing] = useState(false);
  const [layoutError, setLayoutError] = useState('');
  useEffect(() => {
    try {
      const saved = localStorage.getItem(layoutStorageKey);
      if (saved) {
        const value: unknown = JSON.parse(saved);
        if (validTables(value)) setTables(value);
      }
    } catch { /* The bundled layout remains available. */ }
  }, []);
  function changeTables(value: TableLayouts) {
    setTables(value);
    try {
      localStorage.setItem(layoutStorageKey, JSON.stringify(value));
      setLayoutError('');
    } catch { setLayoutError('Browser storage is unavailable. Export JSON to keep this layout.'); }
  }
  const occupancy = originalOccupancy.map(seat => {
    const placement = placementFor(tables, seat.id, 'avatar');
    const placed = placement ? {...seat, x: placement.x, y: placement.y, scale: placement.scale, layer: placement.layer} : seat;
    if (!editing || seat.zone !== 'shared') return placed;
    return {...placed, occupant: {...(seat.occupant ?? {
      id: 'layout-' + seat.id, name: seat.id, animal: 'panda' as const, presence: 'Focused' as const,
      work: 'Layout preview', seatId: seat.id,
    }), snack: 'croissant' as const, drink: 'latte' as const}};
  });
  const roomArt = cafeArtwork.rooms[time];
  const foregroundId = useId();
  const tableClip = `${foregroundId}-tables`;
  const headMask = `${foregroundId}-heads`;
  const selected = occupancy.find(seat => seat.occupant && seat.occupant.id === profileId);
  return <div className="scene-scroll">
    <div className="scene" style={{ aspectRatio: cafeArtwork.aspect }} aria-label="Café floor">
      <img className="room-art" src={roomArt.art} alt={roomArt.description} fetchPriority="high" />
      <img className="fireplace-art" src={roomArt.hearth} alt="" aria-hidden="true"
        style={{
          left: `${35 / roomWidth * 100}%`, top: `${360 / roomHeight * 100}%`,
          width: `${220 / roomWidth * 100}%`, height: `${210 / roomHeight * 100}%`,
        }} />
      <BaristaCounter arrival={arrival} onBarista={onBarista} />
      {time === 'day' && <div className="sunlight" aria-hidden="true" />}
      {rain && cafeArtwork.windows.map(shape => <div key={shape} className="window-rain" style={{ clipPath: shape }} aria-hidden="true" />)}
      {cafeArtwork.steam.map(([x, y], index) => <div key={x} className="steam" aria-hidden="true"
        style={{ left: `${x}%`, top: `${y}%`, '--delay': `-${index * 1.3}s` } as CSSProperties}><i /><i /></div>)}
      {(Object.keys(markers) as Zone[]).map(zone => {
        const [x, y, icon] = markers[zone];
        const group = occupancy.filter(seat => seat.zone === zone);
        return <div key={zone} className="zone-label" style={{ left: `${x}%`, top: `${y}%` }}>
          <Icon name={icon} size={16} /><span>{zones[zone]}</span>
          <small>{group.filter(seat => seat.occupant).length}/{group.length}</small>
        </div>;
      })}
      {occupancy.map(seat => <CafeSeat key={seat.id} seat={seat}
        own={Boolean(visitorId && seat.occupant?.id === visitorId)}
        selected={Boolean(profileId && seat.occupant?.id === profileId)}
        located={Boolean(locatedId && locatedId === seat.occupant?.id)} choosing={choosing} typing={Boolean(seat.occupant && !seat.occupant.disconnected && typing?.[seat.occupant.id])} onSelect={onSeat} />)}
      <svg className="furniture-foreground" aria-hidden="true" viewBox={`0 0 ${roomWidth} ${roomHeight}`} preserveAspectRatio="none">
        <defs>
          <clipPath id={tableClip}>{tabletopSilhouettes.map(points => <polygon key={points} points={points} />)}</clipPath>
          <mask id={headMask} maskUnits="userSpaceOnUse" width={roomWidth} height={roomHeight}>
            <rect width={roomWidth} height={roomHeight} fill="white" />
            {occupancy.filter(seat => seat.occupant).map(seat => {
              const sprite = roomWidth * avatarWidthPercent / 100 * seat.scale;
              const x = seat.x * roomWidth / 100;
              const y = seat.y * roomHeight / 100;
              const hasBubble = Boolean(seat.occupant && typing?.[seat.occupant.id]);
              const width = Math.max(sprite + 12, (seat.occupant?.name.length ?? 0) * 8 + 18, hasBubble ? 170 : 0);
              const from = y - sprite * 1.25 * seatedAnchor - (hasBubble ? 85 : 31);
              return <rect key={seat.id} x={x - width / 2} y={from} width={width}
                height={y - sprite * (isSideDesk(seat) ? .25 : .49) - from} fill="black" />;
            })}
          </mask>
        </defs>
        <image href={roomArt.art} width={roomWidth} height={roomHeight} preserveAspectRatio="none"
          clipPath={`url(#${tableClip})`} mask={`url(#${headMask})`} />
      </svg>
      <CafeLighting />
      <WindowCats />
      {occupancy.filter(seat => seat.occupant && seat.zone !== 'lounge').map(seat => <TableLaptop key={seat.id} seat={seat} placement={placementFor(tables, seat.id, 'laptop')} />)}
      {occupancy.map(seat => {
        const {snack, drink} = seat.occupant ?? {};
        const point = snackPlacements[seat.id];
        if (!point || (!snack && !drink)) return null;
        const [x, y] = point;
        const snackPoint = placementFor(tables, seat.id, 'snack');
        const drinkPoint = placementFor(tables, seat.id, 'drink');
        return <Fragment key={seat.id}>
          {snack && <img className="seat-snack" src={`/art/snacks/${snack}.webp`} alt=""
            style={{left: `${snackPoint?.x ?? x / roomWidth * 100}%`, top: `${snackPoint?.y ?? y / roomHeight * 100}%`, width: `${1.5 * (snackPoint?.scale ?? seat.scale)}cqw`, zIndex: snackPoint?.layer}} />}
          {drink && <img className="seat-drink" src={`/art/drinks/${drink}.webp`} alt=""
            style={{left: `${drinkPoint?.x ?? (x + (snack ? 20 : 0)) / roomWidth * 100}%`, top: `${drinkPoint?.y ?? (y - (snack ? 9 : 0)) / roomHeight * 100}%`, width: `${1.12 * (drinkPoint?.scale ?? seat.scale)}cqw`, zIndex: drinkPoint?.layer}} />}
        </Fragment>;
      })}
      {occupancy.map(seat => {
        const person = seat.occupant;
        const message = person && !typing?.[person.id] && bubbles?.[person.id];
        return message && <MessageBubble key={seat.id} seat={seat} message={message} />;
      })}
      {editable && <button className="layout-toggle pill" type="button" aria-pressed={editing} onClick={() => {
        if (!editing) onLayoutOpen?.();
        setEditing(value => !value);
      }}>
        {editing ? 'Close layout editor' : 'Edit table layout'}
      </button>}
      {editing && <TableLayoutEditor tables={tables} onChange={changeTables} />}
      {editing && layoutError && <p className="layout-storage-error" role="alert">{layoutError}</p>}
      {selected?.occupant && <div className="profile-anchor" style={{
        left: `${Math.max(17, Math.min(83, selected.x))}%`,
        top: `${selected.y < 44 ? selected.y + 3 : selected.y - 15}%`,
        transform: selected.y < 44 ? undefined : 'translate(-50%, -100%)',
      }}>
        <AvatarProfile visitor={selected.occupant} seat={selected} own={visitorId === profileId} onClose={onClose}>{profileActions}</AvatarProfile>
      </div>}
    </div>
  </div>;
}
