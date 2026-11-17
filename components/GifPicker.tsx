import { useEffect, useState } from 'react';
import { gifLabel, gifMedia, loadGifs, type GiphyGif } from '../lib/giphy';

export function GiphyBadge() {
  return <img className="giphy-badge" src="/art/powered-by-giphy.png" alt="Powered by GIPHY" width={100} />;
}

export function GifMedia({gif}: {gif: GiphyGif}) {
  const label = gifLabel(gif);
  const animated = gifMedia(gif.images?.fixed_width?.url);
  const still = gifMedia(gif.images?.fixed_width_still?.url);
  const [failed, setFailed] = useState(false);
  const showAnimation = animated && !failed;
  const source = showAnimation ? animated : still;
  return source ? <img className="gif-media" src={source} alt={label}
    onError={showAnimation ? () => setFailed(true) : undefined} /> : <span>{label}</span>;
}

export function GifPicker({send, close}: {send: (id: string) => boolean; close: () => void}) {
  const [request, setRequest] = useState({query: ''});
  const [gifs, setGifs] = useState<GiphyGif[]>();
  const [selected, setSelected] = useState<GiphyGif>();
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const query = request.query;
    setGifs(undefined);
    setError('');
    void loadGifs(query ? '/search' : '/trending', query ? {q: query, limit: '15'} : {limit: '15'}, controller.signal)
      .then(results => { if (!controller.signal.aborted) setGifs(results); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [request]);

  return <section className="gif-picker" aria-label="GIF picker">
    <header><GiphyBadge /><button type="button" aria-label="Close GIF picker" onClick={close}>×</button></header>
    {selected ? <div className="gif-preview">
      <GifMedia key={selected.id} gif={selected} />
      {selected.username && <small>By @{selected.username}</small>}
      <div><button type="button" onClick={() => setSelected(undefined)}>Back to results</button>
        <button type="button" onClick={() => { if (send(selected.id)) close(); }}>Send GIF</button></div>
    </div> : <>
      <form className="chat-form" onSubmit={event => {
        event.preventDefault();
        const query = String(new FormData(event.currentTarget).get('query') ?? '');
        setRequest({query});
      }}>
        <input type="search" name="query" aria-label="Search GIFs" placeholder="Search GIPHY" maxLength={80} />
        <button type="submit">Search</button>
      </form>
      {error ? <p role="status">{error}</p> : !gifs ? <p role="status">Loading GIFs…</p> : !gifs.length ? <p>No GIFs found.</p> :
        <div className="gif-results" aria-label={request.query ? 'GIF search results' : 'Trending GIFs'}>
          {gifs.map(gif => {
            const still = gifMedia(gif.images?.fixed_width_small_still?.url) ?? gifMedia(gif.images?.fixed_width_still?.url);
            const animated = gifMedia(gif.images?.fixed_width_small?.url) ?? gifMedia(gif.images?.fixed_width?.url);
            const thumbnail = animated ?? still;
            return <button type="button" key={gif.id} aria-label={gifLabel(gif)} onClick={() => setSelected(gif)}>
              {thumbnail ? <img alt="" src={thumbnail} loading="lazy" /> : gifLabel(gif)}
            </button>;
          })}
        </div>}
    </>}
  </section>;
}
