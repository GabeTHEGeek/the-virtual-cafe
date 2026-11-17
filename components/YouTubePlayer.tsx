import { useState } from 'react';

const videos = [
  {id: 'MYPVQccHhAQ', title: 'Smooth Piano Jazz'},
  {id: 'QawqxAN3MfY', title: 'Cozy Autumn Jazz with Rain & Fireplace'},
] as const;

export function YouTubePlayer({onClose}: {onClose: () => void}) {
  const [index, setIndex] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const video = videos[index];

  return <section id="cafe-youtube" className={`youtube-panel${minimized ? ' youtube-docked' : ''}`} aria-label="Café YouTube player" onKeyDown={event => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  }}>
    <header>
      {minimized ? <span className="youtube-dock-title">{video.title}</span> :
        <select aria-label="YouTube track" value={index} onChange={event => setIndex(Number(event.target.value))}>
          {videos.map(({id, title}, option) => <option key={id} value={option}>{title}</option>)}
        </select>}
      <button type="button" aria-label={minimized ? 'Expand YouTube player' : 'Minimize YouTube player'}
        title={minimized ? 'Expand player' : 'Minimize player and keep playing'} onClick={() => setMinimized(!minimized)}>
        {minimized ? '↗' : '−'}
      </button>
      <button type="button" aria-label="Close YouTube player" title="Close player and stop playback" onClick={onClose}>×</button>
    </header>
    <iframe key={video.id} title={video.title}
      src={`https://www.youtube.com/embed/${video.id}`}
      referrerPolicy="strict-origin-when-cross-origin"
      allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
    {!minimized && <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a>}
  </section>;
}
