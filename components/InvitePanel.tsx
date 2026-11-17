import { useEffect, useRef, useState } from 'react';

export function InvitePanel({ room, token, close }: { room: string; token?: string; close: () => void }) {
  const [invite, setInvite] = useState<{name: string; link: string}>();
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams(token ? {invite: token} : {room});
    void fetch(`/api/invite?${query}`, {method: 'POST', signal: controller.signal}).then(async response => {
      if (!response.ok) throw new Error(await response.text());
      const value = await response.json();
      if (!controller.signal.aborted) setInvite(value);
    }).catch(error => {
      if (!controller.signal.aborted) setFeedback(error.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [room, token]);

  return <section className="social-panel" aria-label="Invite to café">
    <header><strong>{invite?.name ?? 'Invite to this café'}</strong>
      <button type="button" aria-label="Close invitation" onClick={close}>×</button></header>
    {loading && <p className="optional">Getting the invite link…</p>}
    {invite && <div className="social-fields">
      <label>Invite link<input ref={field} readOnly value={invite.link} onFocus={event => event.currentTarget.select()} /></label>
      <button type="button" onClick={async () => {
        try { await navigator.clipboard.writeText(invite.link); setFeedback('Invite link copied.'); }
        catch { field.current?.focus(); field.current?.select(); setFeedback('The link is selected for copying.'); }
      }}>Copy invite link</button>
      {typeof navigator.share === 'function' && <button type="button" onClick={async () => {
        try { await navigator.share({title: invite.name, url: invite.link}); }
        catch { /* The copy option remains available. */ }
      }}>Share invite</button>}
    </div>}
    {feedback && <p className="optional" role="status">{feedback}</p>}
  </section>;
}
