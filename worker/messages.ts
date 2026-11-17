import { z } from 'zod';
import { text, type DirectMessage } from '../lib/protocol';
import type { Env } from './env';

const accountId = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const requestSchema = z.object({peer: accountId, body: text(500)});
export const privateHeaders = {'Cache-Control': 'no-store'};

export async function readJson(request: Request, limit = 4096): Promise<unknown> {
  if (!request.headers.get('Content-Type')?.startsWith('application/json') || !request.body) return;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = '';
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) return JSON.parse(body + decoder.decode()) as unknown;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return;
      }
      body += decoder.decode(value, {stream: true});
    }
  } catch { return; }
}

export async function messages(request: Request, env: Env, account: string, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/api/conversations') {
    const {results} = await env.DB.prepare(`WITH contacts AS (
      SELECT recipient AS peer, id, time FROM direct_messages WHERE sender = ?1
      UNION ALL SELECT sender, id, time FROM direct_messages WHERE recipient = ?1
    ) SELECT peer, COALESCE(profiles.name, "user".name, 'Visitor') AS name, MAX(contacts.time) AS time
      FROM contacts JOIN "user" ON "user".id = peer LEFT JOIN profiles ON profiles.user_id = peer
      GROUP BY peer ORDER BY MAX(contacts.id) DESC LIMIT 40`).bind(account).all();
    return Response.json(results, {headers: privateHeaders});
  }
  if (request.method === 'GET') {
    const peer = accountId.safeParse(url.searchParams.get('peer'));
    const before = Number(url.searchParams.get('before') ?? Number.MAX_SAFE_INTEGER);
    if (!peer.success || peer.data === account || !Number.isSafeInteger(before) || before <= 0) {
      return new Response('Invalid conversation', {status: 400});
    }
    const {results} = await env.DB.prepare(`SELECT id, sender, recipient, body, time FROM direct_messages
      WHERE id < ?3 AND ((sender = ?1 AND recipient = ?2) OR (sender = ?2 AND recipient = ?1))
      ORDER BY id DESC LIMIT 50`).bind(account, peer.data, before).all<DirectMessage>();
    return Response.json(results.reverse(), {headers: privateHeaders});
  }
  if (request.method !== 'POST' || url.pathname !== '/api/dm') return new Response('Method not allowed', {status: 405});
  const parsed = requestSchema.safeParse(await readJson(request));
  if (!parsed.success || parsed.data.peer === account) return new Response('Invalid message', {status: 400});
  const {peer, body} = parsed.data;
  const now = Date.now();
  // Authorization, block checks, rate limit and insert execute as a single D1 statement.
  const message = await env.DB.prepare(`INSERT INTO direct_messages (sender, recipient, body, time)
    SELECT ?1, ?2, ?3, ?4
    WHERE EXISTS (SELECT 1 FROM "user" WHERE id = ?2)
    AND NOT EXISTS (SELECT 1 FROM blocks WHERE (owner = ?1 AND target = ?2) OR (owner = ?2 AND target = ?1))
    AND NOT EXISTS (SELECT 1 FROM direct_messages WHERE sender = ?1 AND time > ?5)
    RETURNING id, sender, recipient, body, time`).bind(account, peer, body, now, now - 1500).first<DirectMessage>();
  if (!message) {
    const recent = await env.DB.prepare('SELECT 1 FROM direct_messages WHERE sender = ? AND time > ? LIMIT 1')
      .bind(account, now - 1500).first();
    return new Response(recent ? 'Wait a moment before sending another message.' : 'This visitor cannot receive messages.',
      {status: recent ? 429 : 403});
  }
  ctx.waitUntil(deliver(env, message));
  return Response.json(message, {status: 201, headers: privateHeaders});
}

async function deliver(env: Env, message: DirectMessage) {
  try {
    const directory = env.DIRECTORY.getByName('accounts');
    const rooms = await Promise.all([directory.roomsFor(message.sender), directory.roomsFor(message.recipient)]);
    await Promise.all(Array.from(new Set(rooms.flat())).map(room => env.ROOMS.getByName(room).notifyDirectMessage(message)));
  } catch {
    console.error('Live DM notification failed; message remains in D1');
  }
}
