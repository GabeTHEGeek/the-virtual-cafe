import { InterestPicker } from './Interests';
import type { InterestId } from '../lib/interests';
import { useState } from 'react';
import { animals, type Animal, type Presence, type VisitorDetails } from '../lib/cafe';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { PresenceSelector } from './PresenceSelector';

export function EntryForm({ full, defaults, onEnter, onBrowse }: { full: boolean; defaults?: Omit<VisitorDetails, 'presence'>; onEnter: (visitor: VisitorDetails) => boolean; onBrowse: () => void }) {
  const [animal, setAnimal] = useState<Animal>();
  const selectedAnimal = animal ?? defaults?.animal ?? 'panda';
  const [presence, setPresence] = useState<Presence>('Focused');
  const [error, setError] = useState<'details' | 'full'>();

  return <section className="entry-card" aria-labelledby="entry-title">
    <div className="entry-heading">
      <span className="entry-emblem"><Icon name="cup" size={25} /></span>
      <button type="button" className="icon-button entry-close" onClick={onBrowse} aria-label="Browse café"><Icon name="close" size={19} /></button>
    </div>
    <h1 id="entry-title">Welcome to the café</h1>
    <p>Pick a companion and settle in.</p>
    <form onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const name = String(data.get('name')).trim();
      const work = String(data.get('work')).trim();
      if (!name) {
        setError('details');
        return;
      }
      setError(!onEnter({ ...defaults, animal: selectedAnimal, presence, name, work, interestIds: data.getAll('interestIds') as InterestId[] }) && full ? 'full' : undefined);
    }}>
      <fieldset className="avatar-field">
        <legend>Choose your avatar</legend>
        <div className="avatar-options">
          {animals.map(option => <label key={option} className={selectedAnimal === option ? 'selected' : ''}>
            <input type="radio" name="animal" value={option} checked={selectedAnimal === option} onChange={() => setAnimal(option)} />
            <Avatar animal={option} portrait />
            <span>{option}</span>
          </label>)}
        </div>
      </fieldset>
      <label className="text-field">Nickname<input required name="name" defaultValue={defaults?.name} autoComplete="nickname" maxLength={18} placeholder="e.g. Mochi" /></label>
      <label className="text-field">Working on <span className="optional">(optional)</span><input name="work" defaultValue={defaults?.work} maxLength={96} placeholder="e.g. Writing my next chapter" /></label>
      <InterestPicker initial={defaults?.interestIds} />
      <span className="start-status">Presence</span>
      <PresenceSelector value={presence} onChange={setPresence} onboarding />
      {error === 'details' && <p className="form-error" role="alert">Enter a nickname.</p>}
      {error === 'full' && full && <p className="form-error" role="alert">The café is full. Choose a smaller preview to take a seat.</p>}
      <button className="enter-button" type="submit">Take a seat <Icon name="arrow" size={18} /></button>
    </form>
  </section>;
}
