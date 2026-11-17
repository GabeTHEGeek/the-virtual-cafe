import type { Visitor } from './cafe';

const guests: [string, Visitor['animal'], string, Visitor['presence'], string][] = [
  ['Mika', 'fox', 'Editing travel photos', 'Focused', 'window-1'],
  ['Nova', 'cat', 'Sketching a greenhouse', 'Available', 'lounge-2'],
  ['Kai', 'fox', 'Building a tiny game', 'Focused', 'shared-1'],
  ['Nia', 'panda', 'Reading for my thesis', 'Focused', 'shared-3'],
  ['Theo', 'cat', 'Studying Japanese', 'Away', 'work-2'],
  ['Luna', 'rabbit', 'Writing a short story', 'Focused', 'window-2'],
  ['Jules', 'panda', 'Planning a pottery class', 'Available', 'lounge-3'],
  ['Sage', 'cat', 'Catching up on my reading', 'Available', 'lounge-4'],
  ['Cleo', 'panda', 'Making a budget for next month', 'Focused', 'shared-2'],
  ['Fern', 'rabbit', 'Organizing my notes', 'Focused', 'shared-4'],
  ['Maya', 'fox', 'Finishing a pitch deck', 'Focused', 'work-5'],
  ['Ava', 'fox', 'Planning a weekend hike', 'Available', 'window-4'],
  ['Ivy', 'rabbit', 'Designing a book cover', 'Focused', 'shared-5'],
  ['Rowan', 'panda', 'Practicing chord changes', 'Away', 'work-4'],
  ['Rex', 'cat', 'Refactoring a side project', 'Focused', 'window-3'],
  ['Ari', 'rabbit', 'Writing postcards', 'Available', 'lounge-1'],
  ['Emi', 'fox', 'Editing a podcast', 'Focused', 'work-3'],
  ['Pip', 'cat', 'Planning meals for the week', 'Available', 'shared-7'],
  ['Orla', 'panda', 'Plotting a novel', 'Focused', 'shared-6'],
  ['Sol', 'rabbit', 'Comparing fabric swatches', 'Away', 'lounge-5'],
  ['Ren', 'cat', 'Preparing for a code review', 'Focused', 'work-7'],
  ['June', 'rabbit', 'Translating a poem', 'Focused', 'work-6'],
  ['Wren', 'fox', 'Illustrating recipe cards', 'Available', 'shared-8'],
  ['Bea', 'panda', 'Drafting my newsletter', 'Focused', 'work-8'],
  ['Ollie', 'cat', 'Learning some TypeScript', 'Focused', 'work-1'],
];

export const mockVisitors: Visitor[] = guests.map(([name, animal, work, presence, seatId]) => ({
  id: `guest-${name.toLowerCase()}`, name, animal, work, presence, seatId,
}));

export const previewCounts = [0, 5, 15, 25] as const;
export type PreviewCount = typeof previewCounts[number];
