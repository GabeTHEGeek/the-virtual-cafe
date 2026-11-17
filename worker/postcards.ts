import { z } from 'zod';
import { animals } from '../lib/cafe';
import { escapeMarkup, postcardHeight, postcardNoteLimit, postcardSources, postcardSvg, postcardWidth, type Postcard } from '../lib/postcards';
import { seats } from '../lib/seats';
import type { Env } from './env';

const encoder = new TextEncoder();
const bytes = (content: Uint8Array) => {
  let encoded = '';
  for (let i = 0; i < content.length; i += 16_384) encoded += String.fromCharCode(...content.subarray(i, i + 16_384));
  return btoa(encoded);
};
const base64url = (value: Uint8Array) => bytes(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const fromBase64url = (value: string) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
const signingKey = (secret: string) => crypto.subtle.importKey('raw', encoder.encode(`cafe-postcards-v1:${secret}`), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign', 'verify']);
const payload = z.object({
  time: z.enum(['day', 'night']), animal: z.enum(animals), seatId: z.string().refine(id => seats.some(seat => seat.id === id)),
  name: z.string().min(1).max(18), note: z.string().min(1).max(postcardNoteLimit),
});
const sharedHeaders = {
  'Cache-Control': 'public, max-age=86400',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
};

export async function signPostcard(card: Postcard, secret: string) {
  const data = base64url(encoder.encode(JSON.stringify(card)));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), encoder.encode(data));
  return `/postcard/${data}.${base64url(new Uint8Array(signature))}`;
}

export async function servePostcard(request: Request, env: Env, url: URL, secret: string) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', {status: 405});
  const preview = /^\/postcard\/preview\/(day|night)\.jpg$/.exec(url.pathname);
  if (preview) {
    const asset = await env.ASSETS.fetch(new Request(new URL(`/art/postcard-${preview[1]}.jpg`, url), {method: request.method}));
    return new Response(asset.body, {status: asset.status, headers: {...sharedHeaders, 'Content-Type': 'image/jpeg'}});
  }

  const route = /^\/postcard\/([A-Za-z0-9_-]{20,1450})\.([A-Za-z0-9_-]{43})(\/image\.svg)?$/.exec(url.pathname);
  if (!route || !secret) return new Response('Postcard not found', {status: 404});
  const [, data, signature, artwork] = route;
  let card: Postcard;
  try {
    if (!(await crypto.subtle.verify('HMAC', await signingKey(secret), fromBase64url(signature), encoder.encode(data)))) throw new Error();
    card = payload.parse(JSON.parse(new TextDecoder().decode(fromBase64url(data))));
  } catch {
    return new Response('Postcard not found', {status: 404});
  }

  const origin = url.origin;
  if (artwork) {
    const layers = await Promise.all(postcardSources(card).map(async path => {
      const asset = await env.ASSETS.fetch(new Request(new URL(path, origin)));
      if (!asset.ok) throw new Error('Postcard artwork unavailable.');
      const encoded = bytes(new Uint8Array(await asset.arrayBuffer()));
      return `data:${path.endsWith('.svg') ? 'image/svg+xml' : 'image/webp'};base64,${encoded}`;
    }));
    return new Response(request.method === 'HEAD' ? null : postcardSvg(card, layers), {headers: {
      ...sharedHeaders, 'Content-Type': 'image/svg+xml; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
    }});
  }
  const title = escapeMarkup(`A Virtual Café postcard from ${card.name}`);
  const note = escapeMarkup(card.note);
  const address = escapeMarkup(origin + url.pathname);
  return new Response(request.method === 'HEAD' ? null : `<!doctype html><html lang="en"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
    <meta name="description" content="${note}"><meta property="og:title" content="${title}">
    <meta property="og:description" content="${note}"><meta property="og:type" content="website">
    <meta property="og:url" content="${address}"><meta property="og:image" content="${escapeMarkup(origin)}/postcard/preview/${card.time}.jpg">
    <meta name="twitter:card" content="summary_large_image"><style>
    body{margin:0;padding:24px;min-height:100dvh;box-sizing:border-box;display:grid;place-items:center;color:#fff0d8;background:#171c18;font-family:system-ui,sans-serif}
    main{width:min(100%,840px);text-align:center}img{display:block;width:100%;height:auto;border-radius:12px}a{display:inline-block;margin-top:15px;color:#ffd08b}</style></head>
    <body><main><img src="${address}/image.svg" alt="${title}. ${note}" width="${postcardWidth}" height="${postcardHeight}"><a href="/">Visit The Virtual Café</a></main></body></html>`, {headers: {
    ...sharedHeaders, 'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'",
  }});
}
