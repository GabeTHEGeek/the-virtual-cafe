export const snacks = {
  croissant: 'Butter croissant',
  cookie: 'Chocolate chip cookie',
  muffin: 'Blueberry muffin',
  brownie: 'Chocolate brownie',
  shortcake: 'Strawberry shortcake',
} as const;

export type Snack = keyof typeof snacks;
export const snackIds = Object.keys(snacks) as Snack[];

export const drinks = {
  espresso: 'Espresso',
  latte: 'Café latte',
  'iced-coffee': 'Iced coffee',
  matcha: 'Matcha',
  'hot-chocolate': 'Hot chocolate',
} as const;

export type Drink = keyof typeof drinks;
export const drinkIds = Object.keys(drinks) as Drink[];
export type CafeOrder = {snack?: Snack; drink?: Drink};

// Plate centers in room-art coordinates. Desk plates sit beside the laptop;
// lounge plates use the coffee table or the edge of the guest's cushion.
export const snackPlacements: Record<string, readonly [number, number]> = {
  'work-1': [1550, 422], 'work-2': [1558, 478], 'work-3': [1560, 519],
  'work-4': [1564, 602], 'work-5': [1570, 685], 'work-6': [1049, 243],
  'work-7': [1120, 258], 'work-8': [1193, 270],
  'shared-1': [727, 510], 'shared-2': [679, 614], 'shared-3': [871, 480], 'shared-4': [825, 609],
  'shared-5': [1097, 467], 'shared-6': [1094, 553], 'shared-7': [1211, 467], 'shared-8': [1204, 553],
  'window-1': [477, 311], 'window-2': [576, 286], 'window-3': [679, 265], 'window-4': [771, 241],
  'lounge-1': [202, 603], 'lounge-2': [318, 593], 'lounge-3': [395, 593],
  'lounge-4': [219, 669], 'lounge-5': [410, 669],
};
