import { roomHeight, roomWidth } from './seats';

export type Placement = {x: number; y: number; scale: number; layer: number};
export type TableSeatLayout = {avatar: Placement; laptop: Placement; snack: Placement; drink: Placement};
export type TableLayout = {id: string; name: string; origin: [number, number]; seats: Record<string, TableSeatLayout>};
export type TableLayouts = TableLayout[];
const point = (x: number, y: number, scale = 1, layer = 90): Placement => ({x, y, scale, layer});

// All positions belong to their table, in painted-room units relative to its origin.
export const defaultTables: TableLayouts = [
  {id: 'shared-west', name: 'Coworking table · left', origin: [630, 434], seats: {
    'shared-1': {avatar: point(31, 79, .92, 55), laptop: point(69, 58, .92, 89), snack: point(97, 76, .92), drink: point(119, 65, .92)},
    'shared-2': {avatar: point(-10, 187, 1.03, 66), laptop: point(27, 166, 1.03, 89), snack: point(49, 180, 1.03), drink: point(71, 169, 1.03)},
    'shared-3': {avatar: point(299, 52, .94, 52), laptop: point(262, 31, .94, 89), snack: point(241, 46, .94), drink: point(219, 35, .94)},
    'shared-4': {avatar: point(261, 188, 1.02, 66), laptop: point(222, 167, 1.02, 89), snack: point(195, 175, 1.02), drink: point(173, 164, 1.02)},
  }},
  {id: 'shared-east', name: 'Coworking table · right', origin: [1044, 424], seats: {
    'shared-5': {avatar: point(-1, 50, .93, 50), laptop: point(35, 29, .93, 89), snack: point(53, 43, .93), drink: point(75, 32, .93)},
    'shared-6': {avatar: point(-7, 177, 1, 64), laptop: point(27, 144, 1, 89), snack: point(50, 129), drink: point(72, 118)},
    'shared-7': {avatar: point(225, 50, .95, 50), laptop: point(189, 29, .95, 89), snack: point(167, 43, .95), drink: point(145, 32, .95)},
    'shared-8': {avatar: point(212, 179, 1, 64), laptop: point(182, 144, 1, 89), snack: point(160, 129), drink: point(138, 118)},
  }},
];
export const layoutStorageKey = 'cafe-table-layout-v1';

export function placementFor(tables: TableLayouts, seatId: string, kind: keyof TableSeatLayout) {
  const table = tables.find(table => table.seats[seatId]);
  if (!table) return;
  const placement = table.seats[seatId][kind];
  return {...placement, x: (table.origin[0] + placement.x) / roomWidth * 100,
    y: (table.origin[1] + placement.y) / roomHeight * 100};
}

export function validTables(value: unknown): value is TableLayouts {
  if (!Array.isArray(value) || value.length !== defaultTables.length) return false;
  return defaultTables.every((base, index) => {
    const table = value[index];
    if (table?.id !== base.id || typeof table.name !== 'string' || !Array.isArray(table.origin) || table.origin.length !== 2
      || !table.origin.every((n: unknown) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 2000)
      || !table.seats || Object.keys(table.seats).length !== 4) return false;
    return Object.keys(base.seats).every(id => ['avatar', 'laptop', 'snack', 'drink'].every(kind => {
      const p = table.seats[id]?.[kind];
      return p && [p.x, p.y, p.scale, p.layer].every(Number.isFinite)
        && Math.abs(p.x) <= 2000 && Math.abs(p.y) <= 2000 && p.scale >= .2 && p.scale <= 3
        && p.layer >= 0 && p.layer <= 100;
    }));
  });
}
