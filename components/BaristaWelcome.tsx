import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';

const introduction = [
  {
    title: 'Welcome to the café',
    image: 'meet-mr-owly',
    imageAlt: 'Mr. Owly behind the café counter, where visitors can order drinks and snacks.',
    targets: [{selector: '[data-tour=barista]', label: 'Mr. Owly · Drinks & snacks'}],
    body: 'I’m Mr. Owly, your barista. This is a cozy place to work, unwind, and meet a friend. May I show you around?',
  },
  {
    title: 'Let’s find your seat',
    image: 'choose-your-seat',
    imageAlt: 'The real entry form showing the four animal avatars and nickname field.',
    targets: [{selector: '[data-tour=seats]', label: 'Your coworking seats'}],
    body: 'Choose an animal avatar, add your nickname, and tell us what you’re working on. I’ll find you a seat. You can use Change seat to pick another empty spot whenever you like.',
  },
  {
    title: 'Find your rhythm',
    image: 'music-and-soundscapes',
    imageAlt: 'The café audio controls with a music selector, playback button, volume, and soundscapes.',
    targets: [{selector: '[data-tour=audio]', label: 'Music & soundscapes'}, {selector: '.pomodoro-trigger', label: 'Pomodoro timer'}],
    body: 'Music and soundscapes are down here. Use Pomodoro for a little focus session. Once seated, set your presence to Focused, Available, or Away.',
  },
  {
    title: 'Make yourself at home',
    image: 'chat-with-friends',
    imageAlt: 'The public chat panel with fictional café visitors planning a focus session.',
    targets: [{selector: '.chat-action, [data-tour=barista]', label: 'Say hello · Order a treat'}],
    body: 'Once you’re seated, say hello in Chat, or @mention a friend to give them a gentle ping. Click me when you fancy a complimentary drink or snack. Before you go, leave a little accomplishment in the Guestbook.',
  },
];

export const welcomeStorageKey = 'cafe-mr-owly-intro-v1';

export function BaristaWelcome({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0);
  const [guides, setGuides] = useState<{x: number; y: number; width: number; height: number; label: string; path: string}[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const nextButton = useRef<HTMLButtonElement>(null);
  const current = introduction[step];
  const last = step === introduction.length - 1;

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    nextButton.current?.focus();
    return () => element.close();
  }, []);

  useEffect(() => {
    let frame = 0;
    function measure() {
      const card = dialog.current?.getBoundingClientRect();
      if (!card) return;
      const next = current.targets.flatMap(({selector, label}) => {
        const target = document.querySelector(selector);
        if (!target) return [];
        const rect = target.getBoundingClientRect();
        if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= window.innerHeight) return [];
        const x = Math.max(6, rect.left - 7);
        const y = Math.max(6, rect.top - 7);
        const width = Math.min(window.innerWidth - 6, rect.right + 7) - x;
        const height = Math.min(window.innerHeight - 6, rect.bottom + 7) - y;
        const endX = x + width / 2;
        const endY = y + height / 2;
        const below = endY > card.bottom;
        const above = endY < card.top;
        const startX = below || above ? card.left + card.width / 2 : endX > card.right ? card.right : card.left;
        const startY = below ? card.bottom : above ? card.top : card.top + card.height / 2;
        const tipY = below ? y - 4 : above ? y + height + 4 : endY;
        const tipX = below || above ? endX : endX > card.right ? x - 4 : x + width + 4;
        return [{x, y, width, height, label,
          path: `M ${startX} ${startY} Q ${startX} ${tipY} ${tipX} ${tipY}`}];
      });
      setGuides(next);
    }
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    if (dialog.current) observer.observe(dialog.current);
    for (const {selector} of current.targets) {
      const element = document.querySelector(selector);
      if (element) observer.observe(element);
    }
    schedule();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [current]);

  return <dialog ref={dialog} className="barista-welcome visual-welcome" data-step={step} aria-labelledby={titleId} aria-describedby={bodyId}
    onCancel={event => {event.preventDefault(); onFinish();}}>
    <svg className="welcome-guide-layer" aria-hidden="true">
      <defs><marker id={`${titleId}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffcf86" />
      </marker></defs>
      {guides.map(guide => <g key={guide.label}>
        <rect x={guide.x} y={guide.y} width={guide.width} height={guide.height} rx="12" fill="#ffcf8612" stroke="#ffcf86" strokeWidth="3" />
        <path d={guide.path} fill="none" stroke="#ffcf86" strokeWidth="2.5" markerEnd={`url(#${titleId}-arrow)`} />
      </g>)}
    </svg>
    {guides.map(guide => <span key={guide.label} className="welcome-target-label" style={{
      left: Math.max(8, Math.min(window.innerWidth - 200, guide.x)),
      top: guide.y > 38 ? guide.y - 33 : guide.y + guide.height + 8,
    }}>{guide.label}</span>)}
    <div className="welcome-surface">
      <button className="welcome-close icon-button" type="button" aria-label="Skip introduction" onClick={onFinish}>
        <Icon name="close" size={19} />
      </button>
      <img className="welcome-owl" src="/art/barista.webp" alt="Mr. Owly, your café barista" width="110" height="130" />
      <span className="welcome-host">Mr. Owly · Your barista</span>
      <div className="welcome-copy" aria-live="polite" aria-atomic="true">
        <h2 id={titleId}>{current.title}</h2>
        <p id={bodyId}>{current.body}</p>
      </div>
      <figure className="welcome-screenshot">
        <img key={current.image} src={`/tutorial/${current.image}.webp`} alt={current.imageAlt}
          width="480" height="260" decoding="async" />
      </figure>
      <div className="welcome-progress" aria-label={`Introduction step ${step + 1} of ${introduction.length}`}>
        {introduction.map((item, index) => <span key={item.title} className={index === step ? 'current' : ''} aria-hidden="true" />)}
      </div>
      <div className="welcome-navigation">
        {step > 0 && <button className="welcome-back" type="button" onClick={() => setStep(value => value - 1)}>Back</button>}
        <button ref={nextButton} className="welcome-next" type="button"
          onClick={() => {if (last) onFinish(); else setStep(value => value + 1);}}>
          {last ? 'Let’s settle in' : step === 0 ? 'Show me around' : 'Next'} <Icon name="arrow" size={16} />
        </button>
      </div>
      <button className="welcome-skip" type="button" onClick={onFinish}>I’ve been here before · Skip intro</button>
    </div>
  </dialog>;
}
