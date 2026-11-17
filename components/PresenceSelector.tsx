import { presences, type Presence } from '../lib/cafe';
import { PresenceDot } from './Avatar';
import { ToolbarOptions } from './ToolbarOptions';

export function PresenceSelector({ value, onChange, onboarding = false }: {
  value: Presence;
  onChange: (value: Presence) => void;
  onboarding?: boolean;
}) {
  return <div className={`presence-selector ${onboarding ? 'entry-presence' : 'pill'}`}>
    <PresenceDot presence={value} />
    {onboarding ? <select aria-label="Starting presence" value={value}
      onChange={event => onChange(event.target.value as Presence)}>
      {presences.slice(0, 2).map(presence => <option key={presence}>{presence}</option>)}
    </select> : <ToolbarOptions label="Your presence" value={value} onChange={onChange}
      options={presences.map(presence => ({value: presence, label: presence}))} />}
  </div>;
}
