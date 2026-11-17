import { useState } from 'react';
import { interestIds, interestLimit, interests, type InterestId } from '../lib/interests';

export function InterestPicker({ initial = [] }: { initial?: InterestId[] }) {
  const [selected, setSelected] = useState<InterestId[]>();
  const values = selected ?? initial;
  return <details className="interest-picker">
    <summary>Interests <span>{values.length}/{interestLimit} · optional</span></summary>
    <fieldset aria-label="Choose up to five interests">
      {interestIds.map(id => <label key={id}>
        <input type="checkbox" name="interestIds" value={id} checked={values.includes(id)}
          disabled={values.length >= interestLimit && !values.includes(id)}
          onChange={event => setSelected(event.target.checked ? [...values, id] : values.filter(value => value !== id))} />
        <span>{interests[id]}</span>
      </label>)}
    </fieldset>
  </details>;
}

export function InterestTags({ ids }: { ids?: InterestId[] }) {
  return ids?.length ? <div className="interest-tags" aria-label="Interests">
    {ids.map(id => <span key={id}>{interests[id]}</span>)}
  </div> : null;
}
