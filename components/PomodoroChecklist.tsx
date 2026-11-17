import { useEffect, useState } from 'react';

type ChecklistItem = {id: string; text: string; done: boolean};
const storageKey = 'cafe-pomodoro-checklist';

export function PomodoroChecklist() {
  const [items, setItems] = useState<ChecklistItem[]>();
  const [draft, setDraft] = useState('');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]') as unknown;
      setItems(Array.isArray(saved) ? saved.filter((item): item is ChecklistItem =>
        item && typeof item.id === 'string' && typeof item.text === 'string' && typeof item.done === 'boolean'
      ) : []);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    if (!items) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch { /* The checklist remains available for this visit. */ }
  }, [items]);

  return <section className="pomodoro-checklist" aria-label="Checklist">
    <h3>Checklist {Boolean(items?.length) && <small>{items?.filter(item => item.done).length}/{items?.length}</small>}</h3>
    <form onSubmit={event => {
      event.preventDefault();
      const text = draft.trim();
      if (!text) return;
      const item = {id: crypto.randomUUID(), text, done: false};
      setItems(current => [...(current ?? []), item]);
      setDraft('');
    }}>
      <input aria-label="New checklist task" placeholder="Add a task…" maxLength={120} value={draft}
        onChange={event => setDraft(event.target.value)} />
      <button type="submit" disabled={!items || !draft.trim()}>Add</button>
    </form>
    {Boolean(items?.length) && <ul>
      {items?.map(item => <li key={item.id}>
        <label>
          <input type="checkbox" checked={item.done} onChange={event => {
            const done = event.target.checked;
            setItems(current => current?.map(task => task.id === item.id ? {...task, done} : task));
          }} />
          <span>{item.text}</span>
        </label>
        <button type="button" aria-label={`Remove ${item.text}`} onClick={() => {
          setItems(current => current?.filter(task => task.id !== item.id));
        }}>×</button>
      </li>)}
    </ul>}
  </section>;
}
