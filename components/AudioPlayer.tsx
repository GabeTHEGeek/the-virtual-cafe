'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { YouTubePlayer } from './YouTubePlayer';
import { ToolbarOptions } from './ToolbarOptions';

const tracks = [
  { name: 'Lo-fi', title: 'Lo-fi Café', description: 'Chill beats', file: 'lofi' },
  { name: 'Hip-hop Lo-fi', title: 'Lofi Hip Hop', description: 'Chill beats · omfgdude', file: 'hip-hop-lofi', credits: '/audio/hip-hop-lofi-credits.txt' },
  { name: 'Jazz', title: 'After Hours Jazz', description: 'Piano trio', file: 'jazz' },
  { name: 'Piano', title: 'Afterglow Piano', description: 'Quiet keys', file: 'piano' },
  { name: 'Medieval Calm', title: 'Praeludium CCVII', description: 'Solo Renaissance lute', file: 'medieval-lute', credits: '/audio/medieval-lute-credits.txt' },
  { name: 'Radiant Calm', title: 'Radiant Calm', description: 'Spa ambience', file: 'radiant-calm' },
  { name: 'Hymns', title: 'Amazing Grace', description: 'Acoustic piano', file: 'amazing-grace-piano', credits: '/audio/amazing-grace-credits.txt' },
  { name: 'Countryside Morning', title: 'Countryside Morning', description: 'Acoustic morning', file: 'countryside-morning' },
] as const;

type Track = typeof tracks[number];
const defaultMusicVolume = .55;

const soundscapes = [
  {name: 'Rain', file: 'rain'},
  {name: 'Storm', file: 'storm-rolling'},
  {name: 'Birdsong', file: 'birds-clear'},
  {name: 'Fireplace', file: 'fireplace'},
  {name: 'Ocean', file: 'ocean'},
  {name: 'Forest', file: 'forest'},
  {name: 'Camping', file: 'camping-night'},
  {name: 'White Noise', file: 'white-noise'},
] as const;
type Soundscape = typeof soundscapes[number];

export function AudioPlayer({ onRainChange }: { onRainChange: (active: boolean) => void }) {
  const [track, setTrack] = useState<Track>(tracks[0]);
  const [playing, setPlaying] = useState(false);
  const [youtubeOpen, setYouTubeOpen] = useState(false);
  const youtubeButton = useRef<HTMLButtonElement>(null);
  const [soundscape, setSoundscape] = useState<Soundscape>(soundscapes[0]);
  const [ambiencePlaying, setAmbiencePlaying] = useState(false);
  const [volume, setVolume] = useState(defaultMusicVolume);
  const [ambienceVolume, setAmbienceVolume] = useState(.45);
  const [message, setMessage] = useState('');
  const musicRef = useRef<HTMLAudioElement>(null);
  const ambienceRef = useRef<HTMLAudioElement>(null);
  const musicRequested = useRef(false);
  const musicRequest = useRef(0);
  const cancelAutoplay = useRef<() => void>(undefined);
  const ambienceRequest = useRef(0);
  const ambienceRequested = useRef(false);

  useEffect(() => {
    const audio = musicRef.current;
    if (!audio) return;
    audio.src = `/audio/${tracks[0].file}.m4a`;
    audio.volume = defaultMusicVolume;
    let active = true;

    function stopAutoplay() {
      active = false;
      document.removeEventListener('click', retry, true);
      document.removeEventListener('keydown', retry, true);
      cancelAutoplay.current = undefined;
    }

    const tryAutoplay = () => {
      void audio.play().then(() => {
        if (active) stopAutoplay();
      }).catch(error => {
        if (active && error.name !== 'NotAllowedError') stopAutoplay();
      });
    };

    function retry(event: Event) {
      if (!event.isTrusted || event.target instanceof Element && event.target.closest('.play-button, .genres')) return;
      if (event instanceof KeyboardEvent && (event.ctrlKey || event.metaKey || event.altKey ||
        ['Tab', 'Escape', 'Shift', 'Control', 'Alt', 'Meta'].includes(event.key))) return;
      if (!navigator.userActivation || navigator.userActivation.isActive) tryAutoplay();
    }

    cancelAutoplay.current = stopAutoplay;
    document.addEventListener('click', retry, true);
    document.addEventListener('keydown', retry, true);
    tryAutoplay();
    return () => {
      stopAutoplay();
      musicRequest.current++;
      ambienceRequest.current++;
      audio.pause();
    };
  }, []);

  function playMusic(next: Track) {
    const audio = musicRef.current;
    if (!audio) return;
    const request = ++musicRequest.current;
    cancelAutoplay.current?.();
    setYouTubeOpen(false);
    musicRequested.current = true;
    setPlaying(true);
    const source = `/audio/${next.file}.m4a`;
    if (audio.getAttribute('src') !== source) audio.src = source;
    else if (audio.error) audio.load();
    audio.volume = volume;
    setMessage('');
    void audio.play().catch((error: DOMException) => {
      if (musicRequest.current === request && error.name !== 'AbortError') {
        musicRequested.current = false;
        setPlaying(false);
        setMessage(error.name === 'NotAllowedError' ? 'Press play to start music.' : `Could not load ${next.title}. Press play to retry.`);
      }
    });
  }

  function selectTrack(next: Track) {
    if (track !== next) setTrack(next);
    if (cancelAutoplay.current || (track !== next && musicRequested.current)) playMusic(next);
  }

  function playSoundscape(next: Soundscape) {
    const audio = ambienceRef.current;
    if (!audio) return;
    const request = ++ambienceRequest.current;
    ambienceRequested.current = true;
    setAmbiencePlaying(true);
    const source = `/audio/${next.file}.m4a`;
    if (audio.getAttribute('src') !== source) audio.src = source;
    else if (audio.error) audio.load();
    setMessage('');
    audio.volume = ambienceVolume;
    if (next.file !== 'rain' && next.file !== 'storm-rolling') onRainChange(false);
    void audio.play().catch((error: DOMException) => {
      if (ambienceRequest.current !== request || error.name === 'AbortError') return;
      ambienceRequested.current = false;
      setAmbiencePlaying(false);
      onRainChange(false);
      setMessage(`${next.name} is unavailable. Try playing it again.`);
    });
  }

  return <div className="audio-player pill" data-tour="audio" aria-label="Café audio">
    <audio ref={musicRef} preload="auto" loop onPlaying={event => {
      if (event.currentTarget.paused) return;
      musicRequested.current = true;
      setPlaying(true);
    }} onPause={event => {
      if (event.currentTarget.paused && !musicRequested.current) {
        setPlaying(false);
      }
    }} />
    <audio ref={ambienceRef} preload="metadata" loop onPlaying={event => {
      setAmbiencePlaying(true);
      const source = event.currentTarget.getAttribute('src');
      onRainChange(source === '/audio/rain.m4a' || source === '/audio/storm-rolling.m4a');
    }} onPause={event => {
      if (event.currentTarget.paused && !ambienceRequested.current) {
        setAmbiencePlaying(false);
        onRainChange(false);
      }
    }} />
    <div className="now-playing">
      <span className="album-art"><Icon name="music" size={19} /></span>
      <div><strong>{track.title}</strong><small>{track.description}
        {'credits' in track && <> · <a href={track.credits} target="_blank" rel="noopener">Credits</a></>}
      </small></div>
    </div>
    <button type="button" className="play-button" aria-label={playing ? 'Pause music' : 'Play music'}
      onClick={() => {
        if (!musicRequested.current) {
          playMusic(track);
          return;
        }
        cancelAutoplay.current?.();
        musicRequest.current++;
        musicRequested.current = false;
        setPlaying(false);
        musicRef.current?.pause();
      }}>
      <Icon name={playing ? 'pause' : 'play'} size={17} />
    </button>
    <div className="genres" aria-label="Music style">
      <div className="music-presets">
        {tracks.map(option => <button type="button" key={option.name} aria-pressed={track === option}
          onClick={() => selectTrack(option)}>{option.name}</button>)}
      </div>
      <div className="music-options">
        <ToolbarOptions label="Music style" value={track.file}
          options={tracks.map(option => ({value: option.file, label: option.name}))}
          onChange={file => {
            const next = tracks.find(option => option.file === file);
            if (next) selectTrack(next);
          }} />
      </div>
      <button ref={youtubeButton} className="youtube-trigger" type="button" aria-expanded={youtubeOpen} aria-controls={youtubeOpen ? 'cafe-youtube' : undefined}
        onClick={() => {
          if (!youtubeOpen) {
            cancelAutoplay.current?.();
            musicRequest.current++;
            musicRef.current?.pause();
            musicRequested.current = false;
            setPlaying(false);
          }
          setYouTubeOpen(!youtubeOpen);
        }}>YouTube</button>
    </div>
    {youtubeOpen && <YouTubePlayer onClose={() => {
      setYouTubeOpen(false);
      youtubeButton.current?.focus();
    }} />}
    <label className="slider music-volume"><Icon name="volume" size={18} />
      <input aria-label="Music volume" type="range" min="0" max="1" step=".01" value={volume} onChange={event => {
        const value = event.target.valueAsNumber;
        setVolume(value);
        if (musicRef.current) musicRef.current.volume = value;
      }} />
    </label>
    <div className="ambience-controls">
      <button type="button" className="ambience-toggle" aria-label={ambiencePlaying ? 'Pause soundscape' : 'Play soundscape'}
        aria-pressed={ambiencePlaying} onClick={() => {
          if (ambienceRequested.current) {
            ambienceRequest.current++;
            ambienceRequested.current = false;
            setAmbiencePlaying(false);
            onRainChange(false);
            ambienceRef.current?.pause();
          } else playSoundscape(soundscape);
        }}><Icon name={ambiencePlaying ? 'pause' : 'play'} size={15} /></button>
      <ToolbarOptions label="Soundscape" value={soundscape.file}
        options={soundscapes.map(option => ({value: option.file, label: option.name}))}
        onChange={file => {
          const next = soundscapes.find(option => option.file === file);
          if (!next || next === soundscape) return;
          setSoundscape(next);
          if (ambienceRequested.current) playSoundscape(next);
        }} />
      <label className="slider"><input aria-label="Soundscape volume" type="range" min="0" max="1" step=".01" value={ambienceVolume} onChange={event => {
        const value = event.target.valueAsNumber;
        setAmbienceVolume(value);
        if (ambienceRef.current) ambienceRef.current.volume = value;
      }} /></label>
    </div>
    {message && <span className="audio-error" role="status">{message}</span>}
  </div>;
}
