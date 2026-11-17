import { useState } from 'react';
import type { Visitor } from '../lib/cafe';
import { interests, type InterestId } from '../lib/interests';
import { Avatar, PresenceDot } from './Avatar';
import { InterestTags } from './Interests';

const filters = ['All', 'Available', 'Focused', 'Shared Interests'] as const;
type Member = Pick<Visitor, 'id' | 'animal' | 'name' | 'presence' | 'work' | 'interestIds'>;

export function PeoplePanel({ members, ownInterests, blockedVisitors, openProfile, close }: {
  blockedVisitors: {id: string; name: string; unblock: () => void}[];
  members: Member[]; ownInterests?: InterestId[]; openProfile: (id: string) => void; close: () => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<typeof filters[number]>('All');
  const search = query.trim().toLowerCase();
  const matches = members.filter(person => {
    if (filter === 'Shared Interests' && !person.interestIds?.some(id => ownInterests?.includes(id))) return false;
    if ((filter === 'Available' || filter === 'Focused') && person.presence !== filter) return false;
    return [person.name, person.work, ...person.interestIds?.map(id => interests[id]) ?? []]
      .some(value => value.toLowerCase().includes(search));
  });

  return <section className="social-panel people-panel" aria-label="People in this café">
    <header><strong>People <small>{members.length} online</small></strong>
      <button type="button" aria-label="Close people" onClick={close}>×</button></header>
    <label className="sr-only" htmlFor="people-search">Search people</label>
    <input id="people-search" type="search" value={query} onChange={event => setQuery(event.target.value)}
      placeholder="Search name, work, or interests" />
    <div className="people-filters" aria-label="Filter people">
      {filters.map(option => <button type="button" key={option} aria-pressed={filter === option} onClick={() => setFilter(option)}>{option}</button>)}
    </div>
    <ul className="people-list">
      {matches.map(person => <li key={person.id}><button type="button" aria-label={`Open ${person.name}'s profile`} onClick={() => openProfile(person.id)}>
        <span className="profile-avatar"><Avatar animal={person.animal} portrait /></span>
        <span className="people-details"><strong>{person.name}</strong>
          <span className="profile-status"><PresenceDot presence={person.presence} />{person.presence}</span>
          {person.work && <span className="people-work">{person.work}</span>}
          <InterestTags ids={person.interestIds} />
        </span>
      </button></li>)}
      {!matches.length && <li className="optional">No visitors match these filters.</li>}
    </ul>
    <details className="people-blocks">
      <summary>Blocked visitors ({blockedVisitors.length})</summary>
      {blockedVisitors.length ? <ul className="people-list">
        {blockedVisitors.map(person => <li key={person.id}><span>{person.name}</span>
          <button type="button" aria-label={`Unblock ${person.name}`} onClick={person.unblock}>Unblock</button>
        </li>)}
      </ul> : <p className="optional">No visitors blocked.</p>}
    </details>
  </section>;
}
