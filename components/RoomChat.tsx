import { useRef, useEffect, useState } from 'react';
import { GifMedia, GifPicker, GiphyBadge } from './GifPicker';
import { giphyKey, loadGifs, type GiphyGif } from '../lib/giphy';
import type { PublicMessage } from '../lib/protocol';

export function RoomChat({ self, messages, send, sendGif, onTyping, close, report }: {
  self: string; messages: PublicMessage[]; send: (message: string) => boolean; onTyping: (active: boolean) => void; close: () => void;
  sendGif: (id: string) => boolean;
  report: (message: PublicMessage) => void;
}) {
  const [picker, setPicker] = useState(false);
  const [gifMedia, setGifMedia] = useState<Record<string, GiphyGif>>({});
  const gifIds = [...new Set(messages.flatMap(message => message.gifId ? [message.gifId] : []))].join(',');
  useEffect(() => {
    if (!giphyKey || !gifIds) return;
    const controller = new AbortController();
    void loadGifs('', {ids: gifIds}, controller.signal).then(results => {
      if (!controller.signal.aborted) setGifMedia(Object.fromEntries(results.filter(gif => gif.rating === 'g').map(gif => [gif.id, gif])));
    }).catch(() => { if (!controller.signal.aborted) setGifMedia({}); });
    return () => controller.abort();
  }, [gifIds]);
  const lastTyping = useRef<number>(undefined);
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined);
  function stopTyping() {
    clearTimeout(idle.current);
    if (lastTyping.current !== undefined) onTyping(false);
    lastTyping.current = undefined;
  }
  useEffect(() => () => {
    clearTimeout(idle.current);
    if (lastTyping.current !== undefined) onTyping(false);
  }, [onTyping]);

  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages, gifMedia]);
  return <section className="social-panel" aria-label="Public chat" onKeyDown={event => {
    if (event.key === 'Escape' && picker) {
      event.stopPropagation();
      setPicker(false);
    }
  }}>
    <header><strong>Room chat</strong><button type="button" onClick={close} aria-label="Close chat">×</button></header>
    {gifIds && !picker && giphyKey && <GiphyBadge />}
    <div className="chat-log" ref={log} role="log">
      {!messages.length && <p className="optional">Start a conversation with the room.</p>}
      {messages.map(message => <div className="chat-message" key={message.id}><strong>{message.name}</strong>{' '}
        {message.gifId && gifMedia[message.gifId] ? null : message.body}
        {message.sender !== self && <button className="report-message" type="button" aria-label={`Report message from ${message.name}`} onClick={() => report(message)}>⋯</button>}
        {message.gifId && gifMedia[message.gifId] && <GifMedia gif={gifMedia[message.gifId]} />}
      </div>)}
    </div>
    {picker && <GifPicker send={sendGif} close={() => setPicker(false)} />}
    <form className="chat-form" onSubmit={event => {
      event.preventDefault();
      const input = event.currentTarget.elements.namedItem('message') as HTMLInputElement;
      if (input.value.trim() && send(input.value.trim())) {
        input.value = '';
        stopTyping();
      }
    }}>
      <input name="message" aria-label="Public message" placeholder="Say something to the room…" maxLength={240} required
        onBlur={stopTyping} onChange={event => {
          if (!event.target.value.trim()) return stopTyping();
          const now = Date.now();
          if (lastTyping.current === undefined || now - lastTyping.current >= 1300) {
            lastTyping.current = now;
            onTyping(true);
          }
          clearTimeout(idle.current);
          idle.current = setTimeout(stopTyping, 2600);
        }} />
      {giphyKey && <button type="button" aria-pressed={picker} onClick={() => {stopTyping(); setPicker(open => !open);}}>GIF</button>}
      <button type="submit">Send</button>
    </form>
  </section>;
}
