import { z } from 'zod';
import type { Env } from './env';
import { privateHeaders, readJson } from './messages';
import { roomName } from './session';

const removal = z.object({room: z.string().regex(roomName), visitor: z.string().uuid(), restrict: z.boolean().default(false)});
const encoder = new TextEncoder();

async function sameSecret(candidate: string, required: string) {
  const hash = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  const [left, right] = await Promise.all([hash(candidate), hash(required)]);
  return left.reduce((different, byte, index) => different | (byte ^ right[index]), 0) === 0;
}

export async function moderate(request: Request, env: Env) {
  const token = env.CAFE_ADMIN_TOKEN;
  if (!token || !(await sameSecret(request.headers.get('Authorization') ?? '', `Bearer ${token}`))) {
    return new Response('Forbidden', {status: 403});
  }
  const path = new URL(request.url).pathname;
  if (path === '/api/admin/reports' && request.method === 'GET') {
    const {results} = await env.DB.prepare('SELECT * FROM reports ORDER BY id DESC LIMIT 100').all();
    return Response.json(results, {headers: privateHeaders});
  }
  if (path === '/api/admin/remove' && request.method === 'POST') {
    const parsed = removal.safeParse(await readJson(request));
    if (!parsed.success) return new Response('Invalid removal request', {status: 400});
    const {room, visitor, restrict} = parsed.data;
    const removed = await env.ROOMS.getByName(room).removeVisitor(visitor, restrict);
    return new Response(null, {status: removed ? 204 : 404});
  }
  return new Response('Not found', {status: 404});
}
