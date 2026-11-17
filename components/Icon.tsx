import type { ReactNode } from 'react';

const paths: Record<string, ReactNode> = {
  cup: <><path d="M4 10h13v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zm13 1h2a2.5 2.5 0 0 1 0 5h-3M3 21h17M8 7c-2-2 2-2 0-4m5 4c-2-2 2-2 0-4"/></>,
  home: <><path d="m3 10 9-7 9 7M5 9v12h5v-6h4v6h5V9"/></>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2zM16 5a3 3 0 0 1 0 6m1 3a4 4 0 0 1 4 4v2h-3"/></>,
  chair: <><path d="M5 13V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6M4 17h16M6 17v3m12-3v3M5 13h14a2 2 0 0 1 2 2v2H3v-2a2 2 0 0 1 2-2Z"/></>,
  laptop: <><path d="M5 17V6h14v11M3 17h18v2H3Z"/></>,
  music: <><path d="M9 18V5l11-2v13M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/></>,
  play: <path d="M8 5v14l12-7z" fill="currentColor"/>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19"/></>,
  moon: <path d="M21 13a9 9 0 0 1-10-10 9 9 0 1 0 10 10Z"/>,
  timer: <><circle cx="12" cy="13" r="7"/><path d="M12 9v4l2 1M9 3h6m-3 0v3m5 1 2-2"/></>,
  pause: <><path d="M8 5v14m8-14v14" strokeWidth="3"/></>,
  rain: <><path d="M5 15a4 4 0 1 1 1-8 5.5 5.5 0 0 1 10 1A3.5 3.5 0 1 1 18 15Zm2 3-1 2m6-2-1 2m6-2-1 2"/></>,
  volume: <><path d="M3 9h4l5-4v14l-5-4H3zm13 0a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12"/></>,
  arrow: <path d="M4 12h15m-6-6 6 6-6 6"/>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
};

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
