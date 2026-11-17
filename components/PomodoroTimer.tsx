import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';
import { PomodoroChecklist } from './PomodoroChecklist';

const durationOptions = {Focus: [10, 15, 25, 30, 45, 50, 60], Break: [3, 5, 10, 15, 20]};
const defaultMinutes = {Focus: 25, Break: 5};
type Session = keyof typeof defaultMinutes;

const chimes = {
  'Soft bell': {type: 'sine', notes: [659, 880], spacing: .25, length: .85},
  'Wood tones': {type: 'triangle', notes: [392, 523, 587], spacing: .17, length: .3},
  'Double chime': {type: 'sine', notes: [784, 784], spacing: .43, length: .51},
} as const;
type Chime = keyof typeof chimes | 'Silent';
const chimeOptions: Chime[] = ['Soft bell', 'Wood tones', 'Double chime', 'Silent'];

const timeLabel = (milliseconds: number) => {
  const seconds = Math.ceil(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

export function PomodoroTimer() {
  const title = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const context = useRef<AudioContext | null>(null);
  const [session, setSession] = useState<Session>('Focus');
  const [minutes, setMinutes] = useState(defaultMinutes);
  const duration = minutes[session] * 60_000;
  const [remaining, setRemaining] = useState(defaultMinutes.Focus * 60_000);
  const [deadline, setDeadline] = useState<number>();
  const [chime, setChime] = useState<Chime>('Soft bell');
  const [notice, setNotice] = useState('');
  const running = deadline !== undefined;

  useEffect(() => () => {
    void context.current?.close().catch(() => {});
  }, []);

  function enableChime(choice: Chime) {
    if (choice === 'Silent' || !window.AudioContext) return;
    const audio = context.current ??= new AudioContext();
    return audio.resume().then(() => audio).catch(() => undefined);
  }

  function playChime(audio: AudioContext, repeats = 1) {
    if (chime === 'Silent' || audio.state !== 'running') return;
    const {type, notes, spacing, length} = chimes[chime];
    const start = audio.currentTime + .02;
    for (let repeat = 0; repeat < repeats; repeat++) {
      notes.forEach((frequency, index) => {
        const when = start + repeat * 2 + spacing * index;
        const tone = audio.createOscillator();
        const gain = audio.createGain();
        tone.type = type;
        tone.frequency.value = frequency;
        gain.gain.setValueAtTime(.001, when);
        gain.gain.exponentialRampToValueAtTime(.08, when + .035);
        gain.gain.exponentialRampToValueAtTime(.001, when + length);
        tone.connect(gain);
        gain.connect(audio.destination);
        tone.start(when);
        tone.stop(when + length);
      });
    }
  }

  useEffect(() => {
    if (deadline === undefined) return;
    let completed = false;
    const sync = () => {
      if (completed) return;
      const left = Math.max(0, deadline - Date.now());
      setRemaining(left);
      if (left > 0) return;
      completed = true;
      const next = session === 'Focus' ? 'Break' : 'Focus';
      setDeadline(undefined);
      setSession(next);
      setRemaining(minutes[next] * 60_000);
      setNotice(`${session} complete. Ready for ${next.toLowerCase()}.`);
      const audio = context.current;
      if (audio?.state === 'running') playChime(audio, 3);
      else if (audio && chime !== 'Silent') {
        void audio.resume().then(() => playChime(audio, 3)).catch(() => {});
      }
    };
    const timer = window.setInterval(sync, 250);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [deadline, session, chime, minutes]);

  function reset(next = session) {
    setDeadline(undefined);
    setSession(next);
    setRemaining(minutes[next] * 60_000);
    setNotice('');
  }

  return <>
    <button type="button" className="pill pomodoro-trigger" aria-label="Pomodoro timer" onClick={() => dialog.current?.showModal()}>
      <Icon name="timer" size={16} /><span>{running || remaining !== duration ? timeLabel(remaining) : notice ? `${session} ready` : 'Pomodoro'}</span>
    </button>
    <dialog ref={dialog} className="pomodoro-panel" aria-labelledby={title} onKeyDown={event => {
      if (event.key === 'Escape') event.stopPropagation();
    }}>
      <header>
        <h2 id={title}>Pomodoro</h2>
        <button type="button" className="pomodoro-close" aria-label="Close Pomodoro" onClick={() => dialog.current?.close()}>
          <Icon name="close" size={18} />
        </button>
      </header>
      <div className="pomodoro-modes" role="group" aria-label="Session">
        {(Object.keys(defaultMinutes) as Session[]).map(option => <button type="button" key={option} disabled={running}
          aria-pressed={session === option} onClick={() => reset(option)}>{option} · {minutes[option]} min</button>)}
      </div>
      <label className="pomodoro-duration">
        <span>Session length</span>
        <select value={minutes[session]} disabled={running} onChange={event => {
          const value = Number(event.target.value);
          setMinutes(current => ({...current, [session]: value}));
          setRemaining(value * 60_000);
          setNotice('');
        }}>
          {durationOptions[session].map(value => <option key={value} value={value}>{value} min</option>)}
        </select>
      </label>
      <div className="pomodoro-clock-card">
        <div className="pomodoro-time" role="timer" aria-label={`${session} time remaining`}>{timeLabel(remaining)}</div>
        <div className="pomodoro-controls">
          <button type="button" className="pomodoro-start" onClick={() => {
            if (deadline !== undefined) {
              setRemaining(Math.max(0, deadline - Date.now()));
              setDeadline(undefined);
            } else {
              void enableChime(chime);
              setNotice('');
              setDeadline(Date.now() + remaining);
            }
          }}>{running ? 'Pause' : remaining === duration ? 'Start' : 'Resume'}</button>
          <button type="button" className="pomodoro-reset" onClick={() => reset()}>Reset</button>
        </div>
      </div>
      <div className="pomodoro-chimes">
        <label htmlFor={`${title}-chime`}>Chime</label>
        <div className="pomodoro-chime-controls">
          <select id={`${title}-chime`} value={chime} onChange={event => {
            const choice = event.target.value as Chime;
            setChime(choice);
            if (running) void enableChime(choice);
          }}>
            {chimeOptions.map(option => <option key={option}>{option}</option>)}
          </select>
          <button type="button" disabled={chime === 'Silent'} onClick={() => {
            void enableChime(chime)?.then(audio => { if (audio) playChime(audio); });
          }}>Preview</button>
        </div>
      </div>
      {notice && <p>{notice}</p>}
      <PomodoroChecklist />
    </dialog>
    <span className="sr-only" role="status">{notice}</span>
  </>;
}
