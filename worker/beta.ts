const encoder = new TextEncoder();
const cookie = '__Host-cafe_beta';

async function hash(value: string) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

async function same(a: string, b: string) {
  const [left, right] = await Promise.all([hash(a), hash(b)]);
  return left.reduce((diff, byte, i) => diff | (byte ^ right[i]), 0) === 0;
}

async function proof(secret: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode('virtual-cafe-beta-v1'));
  return Array.from(new Uint8Array(signed), byte => byte.toString(16).padStart(2, '0')).join('');
}

const headers = {
  'Cache-Control': 'no-store',
  'Content-Type': 'text/html; charset=utf-8',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};

function screen(next: string, invalid = false) {
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>The Virtual Café · Private beta</title>
<style>body{background:#222721;color:#fff0d6;font:16px system-ui;margin:0;min-height:100dvh;display:grid;place-items:center}
main{width:min(340px,calc(100% - 64px));padding:24px;background:#282c24;border:1px solid #a57d50;border-radius:18px}
h1{font:28px Georgia,serif;margin:0}p{color:#dccab0}label,input,button{display:block;width:100%;box-sizing:border-box}
input,button{padding:10px;margin-top:6px;border-radius:8px;font:inherit}input{color:inherit;background:#151713;border:1px solid #a57d50}
button{margin-top:14px;background:#ffd08b;border:0;color:#302216;cursor:pointer;font-weight:700}</style>
<main><h1>The Virtual Café</h1><p>Enter your private beta access code.</p>
${invalid ? '<p role="alert">That code didn’t match. Try again.</p>' : ''}
<form method="post" action="/beta/unlock?next=${encodeURIComponent(next)}">
<label for="code">Access code</label><input id="code" name="code" type="password" maxlength="128" autocomplete="current-password" required>
<button>Enter the café</button></form></main></html>`, {status: invalid ? 403 : 200, headers});
}

export async function betaGate(request: Request, url: URL, secret: string): Promise<Response | undefined> {
  const supplied = request.headers.get('Cookie')?.split(';').map(part => part.trim())
    .find(part => part.startsWith(cookie + '='))?.slice(cookie.length + 1);
  if (supplied && await same(supplied, await proof(secret))) return;
  if (url.pathname === '/beta/unlock' && request.method === 'POST') {
    if (request.headers.get('Origin') !== url.origin ||
        !request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded') ||
        !(Number(request.headers.get('Content-Length')) > 0 && Number(request.headers.get('Content-Length')) <= 512)) {
      return new Response('Invalid request', {status: 400, headers});
    }
    const target = url.searchParams.get('next') ?? '/';
    const candidate = URL.canParse(target, url) ? new URL(target, url) : undefined;
    const next = target.startsWith('/') && candidate?.origin === url.origin
      ? candidate.pathname + candidate.search : '/';
    const submitted = new URLSearchParams(await request.text()).get('code')?.trim() ?? '';
    if (!(await same(submitted, secret))) return screen(next, true);
    return new Response(null, {status: 303, headers: {
      ...headers, Location: url.origin + next,
      'Set-Cookie': `${cookie}=${await proof(secret)}; Path=/; Max-Age=604800; Secure; HttpOnly; SameSite=Lax`,
    }});
  }
  if (request.method === 'GET' && !url.pathname.startsWith('/api/') && request.headers.get('Accept')?.includes('text/html')) {
    return screen(url.pathname + url.search);
  }
  return new Response('Private beta access required', {status: 403, headers});
}
