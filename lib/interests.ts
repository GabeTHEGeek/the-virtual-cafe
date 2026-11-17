export const interests = {
  ai: 'AI', technology: 'Technology', startups: 'Startups', entrepreneurship: 'Entrepreneurship',
  product: 'Product Management', design: 'Design', gaming: 'Gaming', music: 'Music', art: 'Art',
  books: 'Books', writing: 'Writing', programming: 'Programming', marketing: 'Marketing',
  photography: 'Photography', cooking: 'Food & Cooking', studying: 'Studying', fitness: 'Fitness', travel: 'Travel',
} as const;
export type InterestId = keyof typeof interests;
export const interestIds = Object.keys(interests) as InterestId[];
export const interestLimit = 5;

export function readInterests(value: string): InterestId[] {
  let values: unknown = value.split(/[,;]+/);
  try { values = JSON.parse(value); } catch { /* Previously saved profiles used free text. */ }
  if (!Array.isArray(values)) return [];
  const normalized = values.filter((item): item is string => typeof item === 'string').map(item => item.trim().toLowerCase());
  return interestIds.filter(id => normalized.includes(id) || normalized.includes(interests[id].toLowerCase())).slice(0, interestLimit);
}
