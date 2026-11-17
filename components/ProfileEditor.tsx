import { InterestPicker } from './Interests';
import type { InterestId } from '../lib/interests';
import { animals, type Visitor } from '../lib/cafe';
import type { Command } from '../lib/protocol';

export function ProfileEditor({ visitor, close, save }: {
  visitor: Visitor; close: () => void;
  save: (profile: Extract<Command, {type: 'UPDATE_PROFILE'}>['profile']) => void;
}) {
  return <section className="social-panel" aria-label="Edit profile">
    <header><strong>Edit profile</strong><button type="button" onClick={close} aria-label="Close editor">×</button></header>
    <form className="social-fields" onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      save({
        name: String(data.get('name')).trim(), animal: data.get('animal') as Visitor['animal'],
        work: String(data.get('work')).trim(), bio: String(data.get('bio')).trim(),
        interestIds: data.getAll('interestIds') as InterestId[],
      });
    }}>
      <label>Display name<input name="name" defaultValue={visitor.name} maxLength={18} required /></label>
      <label>Avatar<select name="animal" defaultValue={visitor.animal}>{animals.map(animal => <option key={animal}>{animal}</option>)}</select></label>
      <label>Working on<input name="work" defaultValue={visitor.work} maxLength={96} /></label>
      <label>Bio<input name="bio" defaultValue={visitor.bio} maxLength={160} /></label>
      <InterestPicker initial={visitor.interestIds} />
      <button type="submit">Save profile</button>
    </form>
  </section>;
}
