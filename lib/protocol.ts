import { drinkIds, snackIds, type CafeOrder, type Snack } from './snacks';
import { interestIds, interestLimit } from './interests';
import { postcardNoteLimit } from './postcards';
import { z } from 'zod';
import { animals, presences, type Visitor } from './cafe';

const clean = (max: number) => z.string().trim().max(max).transform((value) =>
  value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g, '').trim());
export const text = (max: number) => clean(max).pipe(z.string().min(1));
const publicId = z.string().uuid();
export const guestbookNoteLimit = 240;
export const profileSchema = z.object({
  name: text(18), animal: z.enum(animals), work: clean(96),
  bio: clean(160).optional(), interests: clean(100).optional(),
  interestIds: z.array(z.enum(interestIds)).max(interestLimit).transform(ids => [...new Set(ids)]).optional(),
});
const presence = z.enum(presences);

export const commandSchema = z.discriminatedUnion('type', [
  z.object({type: z.literal('JOIN_ROOM'), profile: profileSchema.extend({presence})}),
  z.object({type: z.literal('CHANGE_SEAT'), seatId: z.string().max(20)}),
  z.object({type: z.literal('UPDATE_STATUS'), presence}),
  z.object({type: z.literal('UPDATE_PROFILE'), profile: profileSchema}),
  z.object({type: z.literal('UPDATE_WORKING_ON'), work: clean(96)}),
  z.object({type: z.literal('ORDER_SNACK'), snack: z.enum(snackIds)}),
  z.object({type: z.literal('ORDER_CAFE_ITEMS'), target: publicId.optional(), snack: z.enum(snackIds).optional(), drink: z.enum(drinkIds).optional()})
    .refine(order => Boolean(order.snack || order.drink)),
  z.object({type: z.literal('SET_TYPING'), active: z.boolean()}),
  z.object({type: z.literal('SEND_PUBLIC_MESSAGE'), body: text(240)}),
  z.object({type: z.literal('SEND_PUBLIC_GIF'), gifId: z.string().regex(/^[A-Za-z0-9]{1,64}$/)}),
  z.object({type: z.literal('REQUEST_ROOM_STATE')}),
  z.object({type: z.literal('CREATE_POSTCARD'), requestId: publicId, time: z.enum(['day','night']), note: text(postcardNoteLimit)}),
  z.object({type: z.literal('WATCH_GUESTBOOK'), active: z.boolean()}),
  z.object({type: z.literal('POST_GUESTBOOK_NOTE'), id: publicId, body: text(guestbookNoteLimit)}),
  z.object({type: z.literal('REMOVE_GUESTBOOK_NOTE'), id: publicId}),
  z.object({type: z.literal('BLOCK'), target: publicId}),
  z.object({type: z.literal('UNBLOCK'), target: publicId}),
  z.object({type: z.literal('UNBLOCK_ACCOUNT'), target: z.string().min(1).max(128)}),
  z.object({type: z.literal('REPORT'), target: publicId, messageId: z.string().max(64).optional(), reason: text(200)}),
]);
export const frameSchema = z.object({v: z.literal(1), command: commandSchema});
export type Command = z.infer<typeof commandSchema>;
export type Arrival = { id: string; name: string; at: number };
export type PublicMessage = { id: string; sender: string; accountId?: string; name: string; body: string; gifId?: string; time: number };
export type GuestbookNote = {id: string; sender: string; accountId?: string; name: string; body: string; time: number; own: boolean};
export type DirectMessage = { id: number; sender: string; recipient: string; body: string; time: number };
export type ServerFrame = { v: 1 } & (
  | {type: 'ROOM_SNAPSHOT'; visitors: Visitor[]; self: string; connected: number; blocked: string[]; blockedNames?: Record<string, string>; blockedAccounts?: Record<string, string>; discoverable?: string[]; arrival?: Arrival; messages: PublicMessage[]}
  | {type: 'GUESTBOOK'; notes: GuestbookNote[]}
  | {type: 'SNACK_ORDERED'; snack: Snack}
  | ({type: 'CAFE_ORDERED'; recipient?: string} & CafeOrder)
  | ({type: 'TREAT_DELIVERED'; from: string} & CafeOrder)
  | {type: 'CAFE_ENTERED'}
  | {type: 'POSTCARD_CREATED'; requestId: string; path: string}
  | {type: 'PUBLIC_TYPING'; sender: string; active: boolean}
  | {type: 'PUBLIC_MESSAGE'; message: PublicMessage}
  | {type: 'ERROR'; code: string; message: string}
  | {type: 'MODERATION_UPDATED'; target: string; action: 'BLOCK' | 'REPORT' | 'UNBLOCK' | 'UNBLOCK_ACCOUNT'}
  | {type: 'ACCOUNT_BLOCKS_CHANGED'}
  | {type: 'DIRECT_MESSAGE'; message: DirectMessage}
);
