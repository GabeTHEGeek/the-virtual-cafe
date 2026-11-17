import { useEffect, useState } from 'react';
import { guestbookNoteLimit, type GuestbookNote } from '../lib/protocol';

export function Guestbook({notes, ready, error, close, post, remove, report}: {
  notes?: GuestbookNote[];
  ready: boolean;
  error?: string;
  close: () => void;
  post: (id: string, body: string) => boolean;
  remove: (id: string) => void;
  report: (note: GuestbookNote) => void;
}) {
  const [draft, setDraft] = useState('');
  const [pendingId, setPendingId] = useState<string>();
  const posted = pendingId && notes?.some(note => note.id === pendingId && note.own);
  useEffect(() => {
    if (posted) setDraft('');
    if (posted || error || !ready) setPendingId(undefined);
  }, [posted, error, ready]);

  return <section className="social-panel guestbook" aria-label="Café guestbook">
    <header><strong>Café guestbook</strong><button type="button" aria-label="Close guestbook" onClick={close}>×</button></header>
    <form className="guestbook-form" onSubmit={event => {
      event.preventDefault();
      if (!ready || pendingId || !draft.trim()) return;
      const id = crypto.randomUUID();
      if (post(id, draft.trim())) setPendingId(id);
    }}>
      <label htmlFor="guestbook-note">What did you make or accomplish today?</label>
      <textarea id="guestbook-note" rows={3} maxLength={guestbookNoteLimit} value={draft}
        disabled={Boolean(pendingId)} onChange={event => setDraft(event.target.value)} />
      <div>
        <small>{draft.length}/{guestbookNoteLimit}</small>
        <button type="submit" disabled={!ready || Boolean(pendingId) || !draft.trim()}>Post note</button>
      </div>
    </form>
    {error && <p role="status">{error}</p>}
    <ul className="guestbook-notes" aria-label="Guestbook notes">
      {notes?.map(note => <li key={note.id}>
        <header>
          <strong>{note.name}</strong>
          <time dateTime={new Date(note.time).toISOString()}>{new Date(note.time).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</time>
          {note.own
            ? <button type="button" disabled={!ready} aria-label="Remove your note" onClick={() => remove(note.id)}>×</button>
            : <button type="button" disabled={!ready} aria-label={`Report note by ${note.name}`} onClick={() => report(note)}>⋯</button>}
        </header>
        <p>{note.body}</p>
      </li>)}
      {!notes?.length && <li className="optional">{notes ? 'No notes yet.' : 'Loading guestbook…'}</li>}
    </ul>
  </section>;
}
