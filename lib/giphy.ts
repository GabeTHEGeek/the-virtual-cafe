export const giphyKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY;

type Rendition = {url?: string};
export type GiphyGif = {
  id: string;
  rating: string;
  title?: string;
  alt_text?: string;
  username?: string;
  images?: {fixed_width?: Rendition; fixed_width_small?: Rendition; fixed_width_still?: Rendition; fixed_width_small_still?: Rendition};
};

export async function loadGifs(endpoint: '' | '/trending' | '/search', params: Record<string, string>, signal: AbortSignal) {
  if (!giphyKey) throw new Error('GIF search is unavailable.');
  const query = new URLSearchParams({api_key: giphyKey, rating: 'g', ...params});
  const response = await fetch(`https://api.giphy.com/v1/gifs${endpoint}?${query}`, {signal, cache: 'no-store'});
  if (response.status === 429) throw new Error('GIF search has reached its hourly limit. Try again later.');
  if (!response.ok) throw new Error('Could not load GIFs. Try again.');
  const {data} = await response.json() as {data: GiphyGif[]};
  return data;
}

export function gifLabel(gif: GiphyGif) {
  return gif.alt_text || gif.title || 'GIF from GIPHY';
}

export function gifMedia(url?: string) {
  if (!url) return;
  try {
    const source = new URL(url);
    if (source.protocol === 'https:' && !source.username && !source.password && !source.port
      && /^media\d*\.giphy\.com$/i.test(source.hostname) && source.pathname.startsWith('/media/')) return url;
  } catch { /* Use the fallback when media is unavailable. */ }
}
