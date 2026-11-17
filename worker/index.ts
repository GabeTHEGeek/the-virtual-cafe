import { betaGate } from './beta';
import { invitationToken } from '../lib/invitations';
import { authFor, getProfile } from './accounts';
import { messages, privateHeaders } from './messages';
import { moderate } from './moderation';
import type { Env } from './env';
import { servePostcard } from './postcards';
import { guestCookie, guestId, localGuestSecret, localHost, roomName } from './session';
export { CafeDirectory } from './directory';
export { CafeRoom } from './room';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const secret = env.GUEST_SECRET || (localHost(url) ? localGuestSecret : '');
    if (url.pathname.startsWith('/postcard/')) return servePostcard(request, env, url, secret);
    if (env.BETA_ACCESS_CODE) {
      const blocked = await betaGate(request, url, env.BETA_ACCESS_CODE);
      if (blocked) return blocked;
    } else if (env.BETA_REQUIRED === '1' && !localHost(url)) {
      return new Response('Beta access is being configured', {status: 503});
    }
    if (url.pathname.startsWith('/cafe/join/')) {
      const destination = new URL('/', url.origin);
      const token = url.pathname.slice('/cafe/join/'.length);
      destination.searchParams.set('invite', invitationToken.test(token) ? token : 'invalid');
      return new Response(null, {status: 302, headers: {Location: destination.href, ...privateHeaders, 'Referrer-Policy': 'no-referrer'}});
    }
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (!secret) return new Response('Room unavailable', {status: 503});
    const origin = request.headers.get('Origin');
    if (url.pathname.startsWith('/api/admin/')) return moderate(request, env);
    const websocket = url.pathname === '/api/connect';
    if ((websocket || !['GET', 'HEAD'].includes(request.method)) && origin !== url.origin) {
      return new Response('Forbidden', {status: 403});
    }
    const auth = authFor(env, url.origin);
    if (url.pathname.startsWith('/api/auth/')) {
      return auth ? auth.handler(request) : new Response('Google sign-in is not configured', {status: 503});
    }
    if (url.pathname === '/api/dm' || url.pathname === '/api/conversations') {
      const session = await auth?.api.getSession({headers: request.headers});
      return session ? messages(request, env, session.user.id, ctx) : new Response('Sign in to use direct messages', {status: 401});
    }
    if (request.method === 'GET' && url.pathname === '/api/me') {
      const session = await auth?.api.getSession({headers: request.headers});
      const profile = session ? await getProfile(env.DB, session.user.id) : null;
      const blocked = session ? (await env.DB.prepare('SELECT CASE WHEN owner = ?1 THEN target ELSE owner END AS target FROM blocks WHERE owner = ?1 OR target = ?1').bind(session.user.id).all<{target: string}>()).results.map(row => row.target) : [];
      const ownedBlocks = session ? (await env.DB.prepare(
        `SELECT blocks.target AS id, COALESCE(profiles.name, 'Café visitor') AS name FROM blocks
          LEFT JOIN profiles ON profiles.user_id = blocks.target WHERE blocks.owner = ? ORDER BY name, id`,
      ).bind(session.user.id).all<{id: string; name: string}>()).results : [];
      return Response.json({enabled: Boolean(auth), profile, accountId: session?.user.id, blocked, ownedBlocks}, {headers: privateHeaders});
    }
    const guest = await guestId(request, secret);
    const token = url.searchParams.get('invite');
    const directory = env.DIRECTORY.getByName('invitations');
    let resumeOnly = false;
    async function resolveRoom() {
      if (!token) return url.searchParams.get('room') ?? 'main';
      if (!invitationToken.test(token)) return;
      const invitation = await directory.resolveInvite(token);
      if (!invitation) return;
      if (invitation.active) return invitation.room;
      if (!guest) return;
      // Expiration prevents new joins. An existing signed session can still
      // reclaim an active or temporarily reserved seat via its previous link.
      const session = await auth?.api.getSession({headers: request.headers});
      if (await env.ROOMS.getByName(invitation.room).canResume({guest, accountId: session?.user.id})) {
        resumeOnly = true;
        return invitation.room;
      }
    }
    if (request.method === 'GET' && url.pathname === '/api/alternative') {
      if (!guest || !token) return new Response('Invitation required', {status: 400});
      const invited = await resolveRoom();
      if (!invited) return new Response('Invitation is invalid or expired.', {status: 410});
      const numbered = /^cafe-(\d{1,6})$/.exec(invited);
      const room = `cafe-${numbered ? Number(numbered[1]) + 1 : 2}`;
      return Response.json({room}, {headers: privateHeaders});
    }
    if (request.method === 'POST' && url.pathname === '/api/invite') {
      if (!guest) return new Response('Guest session required', {status: 401});
      const room = await resolveRoom();
      if (!room || !roomName.test(room)) return new Response('Café unavailable', {status: 404});
      const session = await auth?.api.getSession({headers: request.headers});
      if (!(await env.ROOMS.getByName(room).canInvite({guest, accountId: session?.user.id}))) {
        return new Response('Take a seat or wait a moment before trying again.', {status: 429});
      }
      const invite = await directory.createInvite(room);
      const publicOrigin = env.PUBLIC_ORIGIN ? new URL(env.PUBLIC_ORIGIN).origin : url.origin;
      const link = new URL(`/cafe/join/${invite.token}`, publicOrigin);
      return Response.json({link: link.href, name: 'The Virtual Café', expires: invite.expires}, {headers: privateHeaders});
    }
    if (request.method === 'POST' && url.pathname === '/api/guest') {
      if (token && !(await resolveRoom())) return new Response('Invitation is invalid or expired.', {status: 410, headers: privateHeaders});
      return new Response(null, {status: 204, headers: guest ? privateHeaders : {...privateHeaders, 'Set-Cookie': await guestCookie(request, secret)}});
    }
    if (request.method === 'GET' && url.pathname === '/api/connect') {
      if (!guest) return new Response('Guest session required', {status: 401});
      const room = await resolveRoom();
      if (!room || !roomName.test(room)) return new Response('Invalid café', {status: 400});
      const headers = new Headers(request.headers);
      headers.set('x-cafe-guest', guest);
      const session = await auth?.api.getSession({headers: request.headers});
      headers.delete('x-cafe-account');
      headers.delete('x-cafe-session');
      if (session) {
        headers.set('x-cafe-account', session.user.id);
        headers.set('x-cafe-session', session.session.id);
      }
      headers.set('x-cafe-room', room);
      headers.set('x-cafe-resume-only', resumeOnly ? '1' : '0');
      return env.ROOMS.getByName(room).fetch(new Request(request, {headers}));
    }
    return new Response('Not found', {status: 404});
  },
} satisfies ExportedHandler<Env>;
