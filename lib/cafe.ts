import type { CafeOrder } from './snacks';
import type { InterestId } from './interests';
import { seats, type Seat, type Zone } from './seats';

export const animals = ['panda', 'fox', 'cat', 'rabbit'] as const;
export const presences = ['Focused', 'Available', 'Away'] as const;
export type Animal = typeof animals[number];
export type Presence = typeof presences[number];
export type Visitor = CafeOrder & { id: string; name: string; animal: Animal; work: string; presence: Presence; seatId: string; bio?: string; interests?: string; interestIds?: InterestId[]; accountId?: string; disconnected?: boolean };
export type VisitorDetails = Omit<Visitor, 'id' | 'seatId' | 'accountId' | 'disconnected' | keyof CafeOrder>;
export type OccupiedSeat = Seat & { occupant?: Visitor };

export function getOccupancy(visitors: readonly Visitor[]): OccupiedSeat[] {
  const occupants = new Map(visitors.map(visitor => [visitor.seatId, visitor]));
  return seats.map(seat => ({ ...seat, occupant: occupants.get(seat.id) }));
}

export function assignSeat(presence: Presence, visitors: readonly Visitor[]) {
  const preferred: Zone[] = presence === 'Available'
    ? ['shared', 'lounge', 'window', 'work']
    : ['work', 'window', 'shared', 'lounge'];
  const occupancy = getOccupancy(visitors);
  for (const zone of preferred) {
    const options = occupancy.filter(seat => seat.zone === zone && !seat.occupant);
    if (!options.length) continue;
    const neighbors = occupancy.filter(seat => seat.zone === zone && seat.occupant?.presence === presence);
    if (!neighbors.length) return options[0];
    const proximity = (seat: Seat) => Math.min(...neighbors.map(other => (seat.x - other.x) ** 2 + (seat.y - other.y) ** 2));
    return options.sort((a,b) => proximity(a) - proximity(b))[0];
  }
}
