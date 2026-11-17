'use client';

import type { CafeOrder } from './snacks';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Visitor } from './cafe';
import type { Arrival, Command, DirectMessage, GuestbookNote, PublicMessage, ServerFrame } from './protocol';

export const roomPattern = /^[a-z0-9][a-z0-9-]{0,31}$/;
type Snapshot = { room?: string; invite?: string; visitors: Visitor[]; self: string; connected: number; blocked: string[]; blockedNames?: Record<string, string>; blockedAccounts?: Record<string, string>; discoverable?: string[]; arrival?: Arrival; messages: PublicMessage[] };
const empty: Snapshot = { visitors: [], self: '', connected: 0, blocked: [], messages: [] };

export function useRoom(room: string, enabled: boolean, invite?: string) {
  const [connection, setConnection] = useState<'connecting' | 'ready' | 'offline' | 'closed'>('connecting');
  const [state, setState] = useState(empty);
  const [error, setError] = useState<{ code: string; message: string }>();
  const [guestbook, setGuestbook] = useState<GuestbookNote[]>();
  const [snackOrder, setSnackOrder] = useState<CafeOrder & {recipient?: string}>();
  const [receivedTreat, setReceivedTreat] = useState<CafeOrder & {from: string}>();
  const [postcard, setPostcard] = useState<Extract<ServerFrame, {type: 'POSTCARD_CREATED'}>>();
  const [entered, setEntered] = useState(0);
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [lastMessage, setLastMessage] = useState<PublicMessage>();
  const [direct, setDirect] = useState<DirectMessage>();
  const [accountBlocksVersion, setAccountBlocksVersion] = useState(0);
  const [moderation, setModeration] = useState<Extract<ServerFrame, {type: 'MODERATION_UPDATED'}>>();
  const socket = useRef<WebSocket>(null);
  const [attempt, setAttempt] = useState(0);
  const living = useRef<() => void>(undefined);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let retry: ReturnType<typeof setTimeout>;
    let heartbeat: ReturnType<typeof setTimeout>;
    let deadline: ReturnType<typeof setTimeout>;
    let failCount = 0;
    setState(empty);
    setGuestbook(undefined);
    setError(undefined);
    setLastMessage(undefined);
    setTyping({});
    const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
    function updateTyping(sender: string, active: boolean) {
      clearTimeout(typingTimers.get(sender));
      typingTimers.delete(sender);
      setTyping(current => {
        if (active) return {...current, [sender]: true};
        if (!current[sender]) return current;
        const next = {...current};
        delete next[sender];
        return next;
      });
      if (active) typingTimers.set(sender, setTimeout(() => updateTyping(sender, false), 3600));
    }

    function schedule() {
      if (!active) return;
      setConnection('offline');
      clearTimeout(retry);
      retry = setTimeout(connect, Math.min(12_000, 500 * 2 ** failCount++) + Math.random() * 250);
    }

    async function connect() {
      if (!active) return;
      setConnection('connecting');
      try {
        const response = await fetch(invite ? `/api/guest?invite=${encodeURIComponent(invite)}` : '/api/guest', {method: 'POST'});
        if (!active) return;
        if (response.status === 410) {
          setConnection('closed');
          setError({code: 'INVALID_INVITE', message: 'This invitation is invalid or has expired.'});
          return;
        }
        if (!response.ok) throw new Error('Guest session unavailable');
        const url = new URL('/api/connect', window.location.href);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        url.searchParams.set(invite ? 'invite' : 'room', invite ?? room);
        const peer = new WebSocket(url);
        socket.current = peer;
        const ping = () => {
          if (peer.readyState !== WebSocket.OPEN) return;
          clearTimeout(heartbeat);
          clearTimeout(deadline);
          peer.send('ping');
          deadline = setTimeout(() => peer.close(), 18_000);
        };
        living.current = ping;
        peer.onopen = () => {
          if (!active) return;
          heartbeat = setTimeout(ping, 45_000);
        };
        peer.onmessage = event => {
          if (!active) return;
          if (event.data === 'pong') {
            clearTimeout(deadline);
            heartbeat = setTimeout(ping, 45_000);
            return;
          }
          const frame = JSON.parse(String(event.data)) as ServerFrame;
          if (frame.v !== 1) return;
          switch (frame.type) {
            case 'ROOM_SNAPSHOT':
              failCount = 0;
              setConnection('ready');
              setState({...frame, room, invite});
              break;
            case 'GUESTBOOK':
              setGuestbook(frame.notes);
              break;
            case 'ERROR':
              setError(frame);
              break;
            case 'CAFE_ORDERED':
            case 'SNACK_ORDERED':
              setSnackOrder({snack: frame.snack, drink: frame.type === 'CAFE_ORDERED' ? frame.drink : undefined,
                recipient: frame.type === 'CAFE_ORDERED' ? frame.recipient : undefined});
              break;
            case 'POSTCARD_CREATED':
              setPostcard(frame);
              break;
            case 'TREAT_DELIVERED':
              setReceivedTreat(frame);
              break;
            case 'CAFE_ENTERED':
              setEntered(previous => previous + 1);
              break;
            case 'PUBLIC_TYPING':
              updateTyping(frame.sender, frame.active);
              break;
            case 'PUBLIC_MESSAGE':
              updateTyping(frame.message.sender, false);
              setLastMessage(frame.message);
              setState(current => ({...current, messages: [...current.messages, frame.message].slice(-40)}));
              break;
            case 'DIRECT_MESSAGE':
              setDirect(frame.message);
              break;
            case 'MODERATION_UPDATED':
              setModeration(frame);
              if (frame.action === 'BLOCK' || frame.action === 'UNBLOCK_ACCOUNT') setAccountBlocksVersion(version => version + 1);
              break;
            case 'ACCOUNT_BLOCKS_CHANGED':
              setAccountBlocksVersion(version => version + 1);
              break;
          }
        };
        peer.onclose = event => {
          clearTimeout(heartbeat);
          clearTimeout(deadline);
          if (!active) return;
          if (event.code === 4001 || event.code === 4003) {
            setConnection('closed');
            setError({code: 'CLOSED', message: event.code === 4001 ? 'This session is active in another tab.' : 'A moderator removed you from this café.'});
          } else schedule();
        };
      } catch {
        schedule();
      }
    }

    void connect();
    const wake = () => { if (document.visibilityState === 'visible') living.current?.(); };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    return () => {
      active = false;
      clearTimeout(retry);
      clearTimeout(heartbeat);
      clearTimeout(deadline);
      typingTimers.forEach(clearTimeout);
      socket.current?.close();
      socket.current = null;
      living.current = undefined;
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
    };
  }, [room, enabled, attempt, invite]);

  const send = useCallback((command: Command) => {
    const peer = socket.current;
    if (!peer || peer.readyState !== WebSocket.OPEN) {
      setError({code: 'OFFLINE', message: 'The café connection is unavailable. Try again when it reconnects.'});
      return false;
    }
    setError(undefined);
    peer.send(JSON.stringify({v: 1, command}));
    return true;
  }, []);

  const sendTyping = useCallback((active: boolean) => {
    const peer = socket.current;
    if (peer?.readyState === WebSocket.OPEN) {
      peer.send(JSON.stringify({v: 1, command: {type: 'SET_TYPING', active}}));
    }
  }, []);

  return { ...state, guestbook, sendTyping, snackOrder, receivedTreat, entered, postcard, connection: connection === 'ready' && (state.room !== room || state.invite !== invite) ? 'connecting' as const : connection, error, typing, lastMessage, direct, moderation, accountBlocksVersion, send, retry: () => setAttempt(value => value + 1) };
}
