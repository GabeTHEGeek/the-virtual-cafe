export const zones = {
  work: 'Individual Work',
  shared: 'Coworking Tables',
  lounge: 'Lounge',
  window: 'Window Bar',
} as const;

export type Zone = keyof typeof zones;
export type Seat = {
  id: string;
  zone: Zone;
  x: number;
  y: number;
  scale: number;
  flip?: boolean;
  layer?: number;
};

// Seat centers are measured at the cushion surface in the room artwork.
export const roomWidth = 1672;
export const roomHeight = 941;
export const avatarWidthPercent = 4.98;
export const seatedAnchor = 0.86;
const layout: Record<Zone, readonly (readonly [number, number, number, boolean?])[]> = {
  work: [[1473, 435, .91], [1488, 489, .9], [1474, 549, .96], [1497, 635, 1], [1490, 712, 1.02],
    [1075, 282, .76], [1146, 294, .78], [1218, 308, .8]],
  shared: [[661, 513, .92], [620, 621, 1.03], [929, 486, .94, true], [891, 622, 1.02, true],
    [1043, 474, .93], [1037, 601, 1], [1269, 474, .95, true], [1256, 603, 1, true]],
  lounge: [[174, 583, 1.08], [246, 554, 1.1], [418, 538, 1.1, true], [194, 666, 1.1], [398, 673, 1.03]],
  window: [[463, 342, .81, true], [561, 314, .79, true], [664, 287, .76, true], [751, 263, .73, true]],
};

export const seats: Seat[] = (Object.keys(layout) as Zone[]).flatMap(zone =>
  layout[zone].map(([x, y, scale, flip], index) => ({ id: `${zone}-${index + 1}`, zone, x: x * 100 / roomWidth, y: y * 100 / roomHeight, scale, flip })),
);
