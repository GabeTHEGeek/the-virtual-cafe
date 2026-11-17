import { useRef, useEffect, useState } from 'react';
import { GifMedia, GifPicker, GiphyBadge } from './GifPicker';
import { giphyKey, loadGifs, type GiphyGif } from '../lib/giphy';
import type { PublicMessage } from '../lib/protocol';
import { mentionText, mentionsVisitor } from '../lib/mentions';
import { useId } from 'react';

export function RoomChat({ self, selfName, people, messages, send, sendGif, onTyping, close, report }: {
  selfName: string; people: {id: string; name: string}[];
  self: string; messages: PublicMessage[]; send: (message: string) => boolean; onTyping: (active: boolean) => void; close: () => void;
  sendGif: (id: string) => boolean;
  report: (message: PublicMessage) => void;
}) {
  const [picker, setPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mention, setMention] = useState<{start: number; end: number; query: string}>();
  const [activeOption, setActiveOption] = useState(0);
  const optionsId = useId();
  const suggestions = mention ? people.filter(person => person.name.toLocaleLowerCase().startsWith(mention.query.toLocaleLowerCase())).slice(0, 6) : [];
  function findMention(input: HTMLInputElement) {
    const end = input.selectionStart ?? input.value.length;
    const match = /(?:^|\s)@([^@\n]*)$/.exec(input.value.slice(0, end));
    setMention(match ? {start: end - match[1].length - 1, end, query: match[1]} : undefined);
    setActiveOption(0);
  }
  function insertMention(name: string) {
    const input = inputRef.current;
    if (!input || !mention) return;
    const token = mentionText(name) + ' ';
    input.value = input.value.slice(0, mention.start) + token + input.value.slice(mention.end);
    input.focus();
    input.setSelectionRange(mention.start + token.length, mention.start + token.length);
    setMention(undefined);
  }
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
  return <section className="social-panel public-chat-panel" aria-label="Public chat" onKeyDown={event => {
    if (event.key === 'Escape' && picker) {
      event.stopPropagation();
      setPicker(false);
    }
  }}>
    <header><strong>Room chat</strong><button type="button" onClick={close} aria-label="Close chat">×</button></header>
    {gifIds && !picker && giphyKey && <GiphyBadge />}
    <div className="chat-log" ref={log} role="log">
      {!messages.length && <p className="optional">Start a conversation with the room.</p>}
      {messages.map(message => <div className={`chat-message ${message.sender !== self && !message.gifId && mentionsVisitor(message.body, selfName) ? 'mentioned-message' : ''}`} key={message.id}><strong>{message.name}</strong>{' '}
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
        setMention(undefined);
        stopTyping();
      }
    }}>
      <input ref={inputRef} name="message" aria-label="Public message" placeholder="Message the room · @ to mention" maxLength={240} required
        aria-autocomplete="list" aria-controls={suggestions.length ? optionsId : undefined}
        aria-activedescendant={suggestions.length ? `${optionsId}-${activeOption}` : undefined}
        onClick={event => findMention(event.currentTarget)}
        onKeyDown={event => {
          if (!suggestions.length) return;
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveOption(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length);
          } else if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault();
            insertMention(suggestions[activeOption].name);
          } else if (event.key === 'Escape') {
            event.stopPropagation();
            setMention(undefined);
          }
        }}
        onBlur={() => {stopTyping(); setMention(undefined);}} onChange={event => {
          findMention(event.target);
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
    {suggestions.length > 0 && <div className="mention-suggestions" role="listbox" id={optionsId} aria-label="Mention a visitor">
      {suggestions.map((person, index) => <button type="button" role="option" key={person.id}
        id={`${optionsId}-${index}`} aria-selected={index === activeOption}
        onMouseDown={event => event.preventDefault()} onClick={() => insertMention(person.name)}>@{person.name}</button>)}
    </div>}
  </section>;
}
