import { useEffect, useState } from 'react';
import type { DirectMessage } from '../lib/protocol';

export type Contact = {peer: string; name: string};
const merge = (current: DirectMessage[], incoming: DirectMessage[]) =>
  [...new Map([...current, ...incoming].map(message => [message.id, message])).values()].sort((a,b) => a.id - b.id);

export function DirectMessages({ account, contact, setContact, delivery, close }: {
  account: string; contact?: Contact; setContact: (contact?: Contact) => void;
  delivery?: DirectMessage; close: () => void;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const peer = contact?.peer;

  useEffect(() => {
    const cancel = new AbortController();
    setError('');
    setMessages([]);
    setMore(false);
    const path = peer ? `/api/dm?peer=${encodeURIComponent(peer)}` : '/api/conversations';
    void fetch(path, {signal: cancel.signal}).then(async response => {
      if (!response.ok) throw new Error('Messages could not load.');
      if (peer) {
        const rows = await response.json() as DirectMessage[];
        setMessages(current => merge(current, rows));
        setMore(rows.length === 50);
      } else setContacts(await response.json() as Contact[]);
    }).catch(reason => {if (!cancel.signal.aborted) setError(reason.message);});
    return () => cancel.abort();
  }, [peer, delivery?.id && !peer ? delivery.id : undefined]);

  useEffect(() => {
    if (delivery && peer && (delivery.sender === peer || delivery.recipient === peer)) {
      setMessages(current => merge(current, [delivery]));
    }
  }, [delivery, peer]);

  async function earlier() {
    try {
      const response = await fetch(`/api/dm?peer=${encodeURIComponent(peer!)}&before=${messages[0].id}`);
      if (!response.ok) throw new Error('Earlier messages could not load.');
      const rows = await response.json() as DirectMessage[];
      setMessages(current => merge(current, rows));
      setMore(rows.length === 50);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Earlier messages could not load.');
    }
  }

  return <section className="social-panel" aria-label="Direct messages">
    <header>
      {contact && <button type="button" aria-label="Back to conversations" onClick={() => setContact(undefined)}>‹</button>}
      <strong>{contact?.name ?? 'Messages'}</strong>
      <button type="button" aria-label="Close messages" onClick={close}>×</button>
    </header>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!contact ? <div className="chat-log dm-contacts">
      {contacts.length ? contacts.map(person => <button type="button" key={person.peer} onClick={() => setContact(person)}>{person.name}</button>)
        : <p className="optional">Open a registered visitor’s profile to start a conversation.</p>}
    </div> : <>
      <div className="chat-log" role="log">
        {more && <button type="button" onClick={earlier}>Load earlier messages</button>}
        {messages.map(message => <p key={message.id}><strong>{message.sender === account ? 'You' : contact.name}</strong> {message.body}</p>)}
      </div>
      <form className="chat-form" onSubmit={async event => {
        event.preventDefault();
        if (sending) return;
        const input = event.currentTarget.elements.namedItem('body') as HTMLInputElement;
        if (!input.value.trim()) return;
        setSending(true);
        setError('');
        try {
          const response = await fetch('/api/dm', {method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({peer: contact.peer, body: input.value.trim()})});
          if (!response.ok) throw new Error(await response.text());
          const message = await response.json() as DirectMessage;
          setMessages(current => merge(current, [message]));
          input.value = '';
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : 'Message could not be sent.');
        } finally { setSending(false); }
      }}>
        <input aria-label="Direct message" name="body" placeholder="Write a private message…" disabled={sending} maxLength={500} required />
        <button type="submit" disabled={sending}>Send</button>
      </form>
    </>}
  </section>;
}
