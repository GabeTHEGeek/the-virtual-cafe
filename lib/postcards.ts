import { cafeArtwork, tabletopSilhouettes, type CafeTime } from './artwork';
import type { Animal } from './cafe';
import { avatarWidthPercent, roomHeight, roomWidth, seatedAnchor, seats } from './seats';

export const postcardNoteLimit = 160;
export const postcardWidth = 1200;
export const postcardHeight = 902;
export type Postcard = {time: CafeTime; animal: Animal; seatId: string; name: string; note: string};

export const escapeMarkup = (value: string) => value.replace(/[<>&"']/g, character =>
  ({'<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'})[character]!,
);

export function postcardSources(card: Postcard) {
  const seat = seats.find(seat => seat.id === card.seatId);
  return [
    cafeArtwork.rooms[card.time].art,
    `/art/${card.animal}-${seat?.zone === 'lounge' ? 'headphones' : 'working'}.webp`,
    '/art/cafe-counter.svg',
    '/art/window-cats/tabby.webp',
    '/art/window-cats/tuxedo.webp',
  ];
}

function wrapNote(note: string) {
  const lines: string[] = [];
  let line = '';
  for (const word of note.trim().split(/\s+/).flatMap(word => word.match(/.{1,48}/gu) ?? [])) {
    if (line && Array.from(`${line} ${word}`).length > 48) {
      lines.push(line);
      line = '';
    }
    line += (line ? ' ' : '') + word;
  }
  if (line) lines.push(line);
  return lines;
}

export function postcardSvg(card: Postcard, [room, avatar, counter, tabby, tuxedo]: string[]) {
  const seat = seats.find(seat => seat.id === card.seatId);
  if (!seat) throw new Error('Unknown postcard seat.');
  const x = seat.x / 100 * roomWidth;
  const y = seat.y / 100 * roomHeight;
  const width = seat.scale * avatarWidthPercent / 100 * roomWidth;
  const height = width * 1.25;
  const top = y - height * seatedAnchor;
  const image = (url: string, x: number, y: number, width: number, height: number) =>
    `<image href="${escapeMarkup(url)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${postcardWidth} ${postcardHeight}" width="${postcardWidth}" height="${postcardHeight}">
    <title>Postcard from ${escapeMarkup(card.name)}</title>
    <rect width="1200" height="${postcardHeight}" rx="14" fill="#24221b"/>
    <svg x="24" y="24" width="1152" height="648.34" viewBox="0 0 ${roomWidth} ${roomHeight}" preserveAspectRatio="none">
      <defs>
        <clipPath id="tables">${tabletopSilhouettes.map(points => `<polygon points="${points}"/>`).join('')}</clipPath>
        <mask id="foreground"><rect width="${roomWidth}" height="${roomHeight}" fill="white"/>
          <rect x="${x-width/2-7}" y="${top}" width="${width+14}" height="${height*.61}" fill="black"/>
        </mask>
      </defs>
      ${image(room, 0, 0, roomWidth, roomHeight)}
      ${image(counter, 0, 0, roomWidth, roomHeight)}
      <g${seat.flip ? ` transform="translate(${2*x} 0) scale(-1 1)"` : ''}>${image(avatar,x-width/2,top,width,height)}</g>
      <g clip-path="url(#tables)" mask="url(#foreground)">${image(room, 0, 0, roomWidth, roomHeight)}</g>
      ${image(tabby,379.1,272.5,55.8,46.5)}
      ${image(tuxedo,674.8,207.5,50.4,42.5)}
    </svg>
    <rect x="24" y="672" width="1152" height="206" fill="#2a2d24"/>
    <circle cx="82" cy="738" r="30" fill="#e7c18b"/>
    ${image(avatar,57,703,50,62.5)}
    <text x="129" y="708" font-family="Georgia, serif" font-size="24" font-weight="bold" fill="#f3ca92">Postcard from ${escapeMarkup(card.name)}</text>
    <text x="1148" y="708" text-anchor="end" font-family="Georgia, serif" font-size="17" fill="#f3ca92">The Virtual Café</text>
    <text font-family="system-ui, sans-serif" font-size="20" fill="#fff1db">
      ${wrapNote(card.note).map((line, index) => `<tspan x="129" y="${738 + 23 * index}">${escapeMarkup(line)}</tspan>`).join('')}
    </text>
  </svg>`;
}

