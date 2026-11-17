export type Identity = { guest: string; accountId?: string };
export const localGuestSecret = 'local-cafe-development-only-rotate-in-production';
const encoder = new TextEncoder();
export const localHost = (url: URL) => ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const roomName = /^[a-z0-9][a-z0-9-]{0,31}$/;
const cookieName = 'cafe_guest';
const bytesToHex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
async function key(secret: string) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign', 'verify']);
}
export async function guestId(request: Request, secret: string) {
  const token = request.headers.get('Cookie')?.split(';').map(part => part.trim())
    .find(part => part.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  const [guest, expiry, signature, extra] = token?.split('.') ?? [];
  if (!guest || !uuid.test(guest) || !/^\d{10}$/.test(expiry ?? '') || Number(expiry) <= Date.now() / 1000 ||
      !signature || !/^[a-f0-9]{64}$/.test(signature) || extra !== undefined) return;
  const bytes = Uint8Array.from(signature.match(/../g)!, hex => parseInt(hex, 16));
  if (await crypto.subtle.verify('HMAC', await key(secret), bytes, encoder.encode(`${guest}.${expiry}`))) return guest;
}
export async function guestCookie(request: Request, secret: string) {
  const maxAge = 60 * 60 * 24 * 30;
  const payload = `${crypto.randomUUID()}.${Math.floor(Date.now() / 1000) + maxAge}`;
  const signature = bytesToHex(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(payload)));
  return `${cookieName}=${payload}.${signature}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${localHost(new URL(request.url)) ? '' : '; Secure'}`;
}
