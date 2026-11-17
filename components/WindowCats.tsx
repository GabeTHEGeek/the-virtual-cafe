import { useEffect, useRef, useState } from 'react';
import { roomHeight, roomWidth } from '../lib/seats';

const cats = [
  {id: 'tabby', name: 'orange tabby', x: 407, y: 319, width: 55.8},
  {id: 'tuxedo', name: 'tuxedo cat', x: 700, y: 250, width: 50.4},
] as const;

export function WindowCats() {
  const sound = useRef<HTMLAudioElement | null>(null);
  const reset = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [pet, setPet] = useState<{id: string; count: number}>();
  useEffect(() => () => {
    sound.current?.pause();
    clearTimeout(reset.current);
  }, []);

  function petCat(id: string) {
    setPet(previous => ({id, count: (previous?.count ?? 0) + 1}));
    clearTimeout(reset.current);
    reset.current = setTimeout(() => setPet(undefined), 1200);
    const audio = sound.current ??= new Audio('/audio/cat-purr-soft.m4a');
    audio.volume = .55;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }

  return <>
    {cats.map(cat => <button key={cat.id} type="button" className="window-cat" aria-label={`Pet the ${cat.name}`}
      title={`Pet the ${cat.name}`} onClick={() => petCat(cat.id)}
      style={{left: `${cat.x / roomWidth * 100}%`, top: `${cat.y / roomHeight * 100}%`, width: `${cat.width / roomWidth * 100}%`}}>
      <img src={`/art/window-cats/${cat.id}.webp`} alt="" draggable={false} />
      {pet?.id === cat.id && <span key={pet.count} className="cat-heart" aria-hidden="true">♥</span>}
    </button>)}
    <span className="sr-only" role="status">{pet ? `The ${cats.find(cat => cat.id === pet.id)?.name} purrs.` : ''}</span>
  </>;
}
