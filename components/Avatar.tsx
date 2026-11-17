import type { Animal, Presence } from '../lib/cafe';

export function Avatar({ animal, portrait = false, headphones = false, working = false }: { animal: Animal; portrait?: boolean; headphones?: boolean; working?: boolean }) {
  return <img draggable={false} className={portrait ? 'avatar portrait' : 'avatar'} src={`/art/${animal}${working ? '-working' : headphones ? '-headphones' : ''}.webp`} alt="" />;
}

export function PresenceDot({ presence }: { presence: Presence }) {
  return <span className={`presence-dot ${presence.toLowerCase()}`} aria-hidden="true" />;
}
