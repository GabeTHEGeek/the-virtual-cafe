export const cafeArtwork = {
  rooms: {
    day: {art: '/art/cafe.webp', hearth: '/art/fireplace.webp', description: 'Sunlight fills the leafy café and its cherry blossom windows.'},
    night: {art: '/art/cafe-night.webp', hearth: '/art/fireplace-night.webp', description: 'Amber lanterns and firelight warm the leafy café under a deep blue sky.'},
  },
  aspect: '16 / 9',
  steam: [[64.8, 22.1], [61.2, 20.8], [63.0, 22.2]],
  windows: [
    'polygon(10.5% 37%, 10.5% 15%, 44% 3.5%, 44% 22%)',
  ],
};

export type CafeTime = keyof typeof cafeArtwork.rooms;

// Pixel coordinates use the same viewBox as the painted room. The silhouettes
// include the front lip so characters and props respect the furniture depth.
export const tabletopSilhouettes = [
  '698,434 922,434 924,438 877,625 873,633 631,633 630,623',
  '1064,424 1255,424 1258,427 1252,570 1250,578 1044,578 1045,570',
  '1485,354 1588,353 1601,449 1489,449',
  '1495,459 1602,459 1617,534 1497,534',
  '1504,555 1625,554 1641,626 1507,626',
  '1510,649 1647,648 1663,734 1516,734',
];

// Positions are the painted lantern centers in the room's artwork coordinates.
export const tableLanterns = [
  [375, 568, 27], [755, 463, 24], [754, 495, 24], [829, 490, 23], [744, 590, 27],
  [1151, 440, 24], [1188, 480, 23], [1149, 533, 26], [1583, 392, 23],
  [1593, 487, 24], [1619, 582, 25], [1637, 682, 27],
] as const;
