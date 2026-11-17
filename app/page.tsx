'use client';

import { mentionsVisitor } from '../lib/mentions';
import { useMentionSound } from '../lib/use-mention-sound';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioPlayer } from '../components/AudioPlayer';
import { PomodoroTimer } from '../components/PomodoroTimer';
import type { CafeTime } from '../lib/artwork';
import { CafeScene } from '../components/CafeScene';
import { EntryForm } from '../components/EntryForm';
import { Icon } from '../components/Icon';
import { PresenceSelector } from '../components/PresenceSelector';
import { DirectMessages, type Contact } from '../components/DirectMessages';
import { InvitePanel } from '../components/InvitePanel';
import { PeoplePanel } from '../components/PeoplePanel';
import { ProfileEditor } from '../components/ProfileEditor';
import { RoomChat } from '../components/RoomChat';
import { Guestbook } from '../components/Guestbook';
import { PostcardComposer } from '../components/PostcardComposer';
import { roomPattern, useRoom } from '../lib/use-room';
import type { Arrival, Command, PublicMessage } from '../lib/protocol';
import { SnackMenu } from '../components/SnackMenu';
import { drinks, snacks, type CafeOrder } from '../lib/snacks';
import { SeatSelector } from '../components/SeatSelector';
import { assignSeat, getOccupancy, type OccupiedSeat, type Visitor, type VisitorDetails } from '../lib/cafe';
import { mockVisitors, previewCounts, type PreviewCount } from '../lib/mock-visitors';
import { seats, zones } from '../lib/seats';

export default function Cafe() {
  const [preview, setPreview] = useState<PreviewCount>(5);
  const [guests, setGuests] = useState(() => mockVisitors.slice(0, 5));
  const [localVisitor, setVisitor] = useState<Visitor>();
  const [entryOpen, setEntryOpen] = useState(true);
  const [profileId, setProfileId] = useState<string>();
  const [choosing, setChoosing] = useState(false);
  const [mockArrival, setMockArrival] = useState<Arrival>();
  const [rain, setRain] = useState(false);
  const [cafeTime, setCafeTime] = useState<CafeTime>('day');
  const [announcement, setAnnouncement] = useState('');

  const [mock, setMock] = useState<boolean>();
  const [inviteToken, setInviteToken] = useState<string>();
  const [savedGuestProfile, setSavedGuestProfile] = useState<VisitorDetails>();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [room, setRoom] = useState('main');
  const [account, setAccount] = useState<{enabled: boolean; accountId?: string; profile?: Omit<VisitorDetails, 'presence'>; blocked?: string[]; ownedBlocks?: {id: string; name: string}[]}>();
  const [accountError, setAccountError] = useState('');
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [locatedId, setLocatedId] = useState<string>();
  const locateTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [snackMenu, setSnackMenu] = useState(false);
  const [recipient, setRecipient] = useState<string>();
  const [treatToast, setTreatToast] = useState('');
  const entryAudio = useRef<HTMLAudioElement | null>(null);
  const register = useRef<HTMLAudioElement | null>(null);
  const [chat, setChat] = useState(false);
  const [guestbookOpen, setGuestbookOpen] = useState(false);
  const [postcardOpen, setPostcardOpen] = useState(false);
  const [unreadChat, setUnreadChat] = useState(false);
  const [unreadMention, setUnreadMention] = useState(false);
  const pingMention = useMentionSound();
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [contact, setContact] = useState<Contact>();
  const [editing, setEditing] = useState(false);
  const [muted, setMuted] = useState<string[]>([]);
  const [bubbles, setBubbles] = useState<Record<string, string>>({});
  const pendingJoin = useRef<VisitorDetails>(undefined);
  const nextJoin = useRef(false);
  const seatedVisit = useRef<{room: string; invite?: string; profile: VisitorDetails; rejoining: boolean}>(undefined);
  const usedInvite = useRef<string>(undefined);
  const bubbleTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const live = useRoom(room, mock === false, inviteToken);
  const visitor = mock ? localVisitor : live.visitors.find(person => person.id === live.self);
  const visitors = mock ? (visitor ? [...guests, visitor] : guests) : live.visitors;
  const blocked = new Set([...muted, ...live.blocked, ...visitors.filter(person =>
    person.accountId && account?.blocked?.includes(person.accountId)).map(person => person.id)]);
  const directory = visitors.filter(person => !person.disconnected && !live.blocked.includes(person.id)
    && !(person.accountId && account?.blocked?.includes(person.accountId))
    && (!live.discoverable || live.discoverable.includes(person.id)))
    .map(({id, animal, name, presence, work, interestIds}) => ({id, animal, name, presence, work, interestIds}));
  const accountBlocks = account?.ownedBlocks ?? [];
  const roomBlocks = live.blocked.flatMap(id => {
    const person = visitors.find(visitor => visitor.id === id);
    const accountId = live.blockedAccounts?.[id] ?? person?.accountId;
    return accountId && accountBlocks.some(item => item.id === accountId)
      ? [] : [{id, name: person?.name ?? live.blockedNames?.[id] ?? 'Café visitor'}];
  });
  useEffect(() => {
    if (live.connection === 'ready' && live.self) live.send({type: 'WATCH_GUESTBOOK', active: guestbookOpen});
  }, [guestbookOpen, live.connection, live.self, live.send]);
  const chosen = visitors.find(person => person.id === profileId);

  useEffect(() => {
    const url = new URL(window.location.href);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    setMock(process.env.NODE_ENV === 'development' || (local && url.searchParams.get('preview') === '1'));
    setInviteToken(url.searchParams.get('invite') ?? undefined);
    try {
      if (localStorage.getItem('cafe-time') === 'night') setCafeTime('night');
      const saved = localStorage.getItem('cafe-guest-profile');
      if (saved) setSavedGuestProfile(JSON.parse(saved) as VisitorDetails);
    } catch { /* The guest can enter manually. */ }
    const invited = url.searchParams.get('room');
    const saved = sessionStorage.getItem('cafe-room');
    if (invited && roomPattern.test(invited)) setRoom(invited);
    else if (saved && roomPattern.test(saved)) setRoom(saved);
  }, []);

  useEffect(() => {
    if (mock !== false) return;
    const controller = new AbortController();
    void fetch('/api/me', {signal: controller.signal}).then(response => {
      if (response.ok) return response.json();
    }).then(value => { if (value) setAccount(value); }).catch(() => {});
    return () => controller.abort();
  }, [mock, live.accountBlocksVersion]);

  useEffect(() => {
    if (mock !== false) return;
    const visit = seatedVisit.current;
    if (live.connection === 'closed') seatedVisit.current = undefined;
    if (live.connection !== 'ready') {
      if (visit) visit.rejoining = false;
      return;
    }
    if (visitor) {
      if (inviteToken) usedInvite.current = inviteToken;
      setEntryOpen(false);
      setChoosing(false);
      revealSeat(visitor.seatId);
      if (!inviteToken) sessionStorage.setItem('cafe-room', room);
    } else if (nextJoin.current && pendingJoin.current) {
      nextJoin.current = false;
      const profile = pendingJoin.current;
      live.send({type: 'JOIN_ROOM', profile});
    } else if (visit?.room === room && visit.invite === inviteToken) {
      if (visit.rejoining) return;
      pendingJoin.current = visit.profile;
      visit.rejoining = live.send({type: 'JOIN_ROOM', profile: visit.profile});
    } else if (inviteToken && usedInvite.current !== inviteToken) {
      const profile = account?.profile ? {...account.profile, presence: savedGuestProfile?.presence ?? 'Focused' as const} : savedGuestProfile;
      if (profile) {
        usedInvite.current = inviteToken;
        enter(profile);
      }
    }
  }, [mock, live.connection, live.send, room, inviteToken, account?.profile, savedGuestProfile, visitor?.seatId, visitor?.id]);

  useEffect(() => {
    if (mock !== false || !visitor || live.connection !== 'ready') return;
    const {name, animal, presence, work, bio, interestIds} = visitor;
    const profile = {name, animal, presence, work, bio, interestIds};
    seatedVisit.current = {room, invite: inviteToken, profile, rejoining: false};
    try { localStorage.setItem('cafe-guest-profile', JSON.stringify(profile)); }
    catch { /* Room membership is maintained on the server. */ }
  }, [mock, live.connection, visitor, room, inviteToken]);

  useEffect(() => {
    const timers = bubbleTimers.current;
    setBubbles({});
    setUnreadChat(false);
    setUnreadMention(false);
    return () => {timers.forEach(clearTimeout); timers.clear();};
  }, [room, inviteToken]);

  useEffect(() => {
    const message = live.lastMessage;
    if (!message) return;
    const incoming = message.sender !== live.self && !blocked.has(message.sender)
      && !(message.accountId && account?.blocked?.includes(message.accountId));
    if (incoming && visitor && !message.gifId && mentionsVisitor(message.body, visitor.name)) {
      pingMention();
      if (!chat || document.visibilityState !== 'visible') setUnreadMention(true);
    }
    if (!chat && message.sender !== live.self && !blocked.has(message.sender)
      && !(message.accountId && account?.blocked?.includes(message.accountId))) setUnreadChat(true);
    const timers = bubbleTimers.current;
    clearTimeout(timers.get(message.sender));
    setBubbles(current => ({...current, [message.sender]: message.body}));
    timers.set(message.sender, setTimeout(() => {
      setBubbles(current => {
        const updated = {...current};
        delete updated[message.sender];
        return updated;
      });
      timers.delete(message.sender);
    }, Math.max(5500, 2200 + message.body.length * 52)));
  }, [live.lastMessage]);

  useEffect(() => {
    const update = live.moderation;
    if (!update) return;
    if (update.action === 'BLOCK') {
      const targetAccount = live.visitors.find(person => person.id === update.target)?.accountId;
      if (targetAccount) setAccount(current => current && ({...current, blocked: [...new Set([...(current.blocked ?? []), targetAccount])]}));
    }
    setAnnouncement(update.action === 'BLOCK' ? 'Visitor blocked.'
      : update.action === 'REPORT' ? 'Report sent.' : 'Visitor unblocked.');
  }, [live.moderation]);
  const occupancy = getOccupancy(visitors);
  const available = seats.length - visitors.length;

  function playEntrySound() {
    const sound = entryAudio.current ??= new Audio('/audio/cafe-entry.m4a');
    sound.currentTime = 0;
    void sound.play().catch(() => {});
  }

  useEffect(() => {
    if (live.entered) playEntrySound();
  }, [live.entered]);

  useEffect(() => {
    if (!live.receivedTreat) return;
    const {from, snack, drink} = live.receivedTreat;
    const items = [snack && snacks[snack], drink && drinks[drink]].filter(Boolean).join(' and ');
    setTreatToast(`${from} sent you ${items}.`);
  }, [live.receivedTreat]);

  useEffect(() => {
    if (!treatToast) return;
    const timer = window.setTimeout(() => setTreatToast(''), 7500);
    return () => clearTimeout(timer);
  }, [treatToast]);

  function enter(details: VisitorDetails) {
    if (!mock) {
      entryAudio.current ??= new Audio('/audio/cafe-entry.m4a');
      pendingJoin.current = details;
      return live.send({type: 'JOIN_ROOM', profile: details});
    }
    if (preview === seats.length) return false;
    const seat = assignSeat(details.presence, visitors);
    if (!seat) return false;
    setGuests(guests.slice(0, Math.max(0, preview - 1)));
    setVisitor({ ...details, id: 'local-visitor', seatId: seat.id });
    setMockArrival({id: 'local-visitor', name: details.name, at: Date.now()});
    playEntrySound();
    setEntryOpen(false);
    setProfileId(undefined);
    setAnnouncement(`Seated at ${zones[seat.zone]}.`);
    revealSeat(seat.id);
    return true;
  }

  const selectSeat = useCallback((seat: OccupiedSeat) => {
    if (seat.occupant) {
      setPeopleOpen(false);
      setInviteOpen(false);
      const id = seat.occupant.id;
      setProfileId(current => current === id ? undefined : id);
      return;
    }
    if (!visitor || !choosing) return;
    if (!mock) {
      if (live.send({type: 'CHANGE_SEAT', seatId: seat.id})) {
        setChoosing(false);
        setProfileId(undefined);
      }
      return;
    }
    setVisitor(current => current && ({ ...current, seatId: seat.id }));
    setChoosing(false);
    setProfileId(undefined);
    setAnnouncement(`Moved to ${zones[seat.zone]} seat ${seat.id.split('-')[1]}.`);
    revealSeat(seat.id);
  }, [visitor?.id, choosing, mock, live.send]);

  async function googleSignIn() {
    setAccountError('');
    try {
      const callbackURL = new URL('/', window.location.origin);
      callbackURL.searchParams.set(inviteToken ? 'invite' : 'room', inviteToken ?? room);
      const response = await fetch('/api/auth/sign-in/social', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({provider: 'google', callbackURL: callbackURL.href, disableRedirect: true}),
      });
      if (!response.ok) throw new Error();
      const {url} = await response.json() as {url: string};
      const target = new URL(url);
      if (target.origin !== 'https://accounts.google.com') throw new Error();
      window.location.assign(target);
    } catch {
      setAccountError('Google sign-in could not start. Try again.');
    }
  }

  async function signOut() {
    try {
      const response = await fetch('/api/auth/sign-out', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'});
      if (!response.ok) throw new Error();
      window.location.reload();
    } catch {
      setAccountError('Sign-out could not complete. Try again.');
    }
  }

  async function anotherRoom() {
    if (!pendingJoin.current) return;
    const next = /^cafe-(\d{1,6})$/.exec(room);
    let destination = `cafe-${next ? Number(next[1]) + 1 : 2}`;
    if (inviteToken) {
      try {
        const response = await fetch(`/api/alternative?invite=${encodeURIComponent(inviteToken)}`);
        if (!response.ok) throw new Error();
        destination = (await response.json()).room;
      } catch {
        setAccountError('Could not find another café. Try again.');
        return;
      }
    }
    setAccountError('');
    const url = new URL(window.location.href);
    url.searchParams.delete('invite');
    url.searchParams.set('room', destination);
    setInviteToken(undefined);
    history.replaceState(null, '', url);
    seatedVisit.current = undefined;
    nextJoin.current = true;
    setRoom(destination);
  }

  function report(target: string, messageId?: string) {
    const reason = window.prompt('Why are you reporting this?');
    if (reason?.trim()) live.send({type: 'REPORT', target, reason: reason.trim().slice(0, 200), messageId});
  }

  const sendTyping = useCallback((active: boolean) => {
    live.sendTyping(active);
  }, [live.sendTyping]);

  function confirmOrder({snack, drink, recipient}: CafeOrder & {recipient?: string}) {
    setSnackMenu(false);
    const names = [snack && snacks[snack], drink && drinks[drink]].filter(Boolean);
    const delivery = `${names.join(' and ')} delivered to ${recipient ? `${recipient}’s seat` : 'your seat'}.`;
    setAnnouncement(delivery);
    if (recipient) setTreatToast(delivery);
    const sound = register.current ??= new Audio('/audio/register.m4a');
    sound.currentTime = 0;
    void sound.play().catch(() => {});
  }

  useEffect(() => {
    if (live.snackOrder) confirmOrder(live.snackOrder);
  }, [live.snackOrder]);

  function orderItems(order: CafeOrder) {
    if (!visitor) return;
    register.current ??= new Audio('/audio/register.m4a');
    if (mock) {
      const guest = guests.find(person => person.id === recipient);
      if (guest) setGuests(current => current.map(person => person.id === guest.id ? {...person, ...order} : person));
      else setVisitor(current => current && {...current, ...order});
      confirmOrder({...order, recipient: guest?.name});
    } else live.send({type: 'ORDER_CAFE_ITEMS', target: recipient, ...order});
  }

  function saveProfile(profile: Extract<Command, {type: 'UPDATE_PROFILE'}>['profile']) {
    if (live.send({type: 'UPDATE_PROFILE', profile})) setEditing(false);
  }

  useEffect(() => () => clearTimeout(locateTimer.current), []);

  function locate(person: Visitor) {
    clearTimeout(locateTimer.current);
    setPeopleOpen(false);
    setProfileId(undefined);
    setLocatedId(person.id);
    revealSeat(person.seatId);
    setAnnouncement(`${person.name} is seated at ${zones[seats.find(seat => seat.id === person.seatId)!.zone]}.`);
    locateTimer.current = setTimeout(() => setLocatedId(undefined), 3500);
  }

  function revealSeat(id: string) {
    requestAnimationFrame(() => document.getElementById(`seat-${id}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  }

  return <main className="cafe-shell" onKeyDown={event => {
    if (event.key !== 'Escape') return;
    if (snackMenu || postcardOpen) return;
    else if (inviteOpen) setInviteOpen(false);
    else if (peopleOpen) setPeopleOpen(false);
    else if (messagesOpen) setMessagesOpen(false);
    else if (editing) setEditing(false);
    else if (guestbookOpen) setGuestbookOpen(false);
    else if (chat) setChat(false);
    else if (entryOpen) setEntryOpen(false);
    else if (profileId) setProfileId(undefined);
    else setChoosing(false);
  }}>
    <header className="topbar">
      <div className="brand"><Icon name="cup" size={28} /><span>The Virtual Café</span></div>
      <span className="nav-current" aria-current="page"><Icon name="home" size={17} /> Café</span>
      <div className="header-controls">
        <button type="button" className="time-toggle" aria-label="Night mode" aria-pressed={cafeTime === 'night'}
          onClick={() => {
            const next = cafeTime === 'day' ? 'night' : 'day';
            setCafeTime(next);
            try { localStorage.setItem('cafe-time', next); } catch { /* The theme can still change for this visit. */ }
          }}>
          <Icon name={cafeTime === 'night' ? 'moon' : 'sun'} size={16} />
          {cafeTime === 'night' ? 'Night' : 'Day'}
        </button>
        {mock && <label className="preview-control"><Icon name="users" size={18} /><span>Developer preview</span>
          <select aria-label="Developer preview occupancy" value={preview} onChange={event => {
            const count = Number(event.target.value) as PreviewCount;
            setPreview(count);
            const guestCount = Math.max(0, count - (visitor ? 1 : 0));
            setGuests(mockVisitors.filter(guest => guest.seatId !== visitor?.seatId).slice(0, guestCount));
            setProfileId(undefined);
            setChoosing(false);
          }}>
            {previewCounts.map(count => <option key={count} value={count}>
              {count === 0 ? (visitor ? 'Just you' : 'Empty room') : `${count} people`}
            </option>)}
          </select>
        </label>}
        {!mock && visitor && live.connection === 'ready' && <button className="social-action" type="button" aria-pressed={inviteOpen}
          onClick={() => {setGuestbookOpen(false); setInviteOpen(!inviteOpen); setSnackMenu(false); setPeopleOpen(false); setChat(false); setMessagesOpen(false); setEditing(false); setProfileId(undefined);}}>Invite</button>}
        {visitor && <button className="social-action" type="button" aria-pressed={peopleOpen} onClick={() => {
          setGuestbookOpen(false); setPeopleOpen(!peopleOpen); setSnackMenu(false); setInviteOpen(false); setChat(false); setEditing(false); setMessagesOpen(false); setProfileId(undefined);
        }}>People</button>}
        {!mock && visitor && <button type="button" aria-pressed={chat} onClick={() => {setGuestbookOpen(false); setChat(!chat); setSnackMenu(false); if (!chat) {setUnreadChat(false); setUnreadMention(false);} setInviteOpen(false); setPeopleOpen(false); setEditing(false); setMessagesOpen(false); setProfileId(undefined);}} className="social-action chat-action" aria-label={unreadMention ? 'Chat, you were mentioned' : unreadChat ? 'Chat, unread messages' : 'Chat'}>Chat
          {unreadMention ? <span className="chat-mention-badge" aria-hidden="true">@</span> : unreadChat && <span className="chat-unread" aria-hidden="true" />}</button>}
        {!mock && visitor && <button type="button" className="social-action" aria-pressed={guestbookOpen} onClick={() => {
          setGuestbookOpen(!guestbookOpen); setChat(false); setSnackMenu(false); setInviteOpen(false);
          setPeopleOpen(false); setEditing(false); setMessagesOpen(false); setProfileId(undefined);
        }}>Guestbook</button>}
        {visitor && <button type="button" className="social-action" onClick={() => {
          setPostcardOpen(true); setGuestbookOpen(false); setChat(false); setSnackMenu(false);
          setInviteOpen(false); setPeopleOpen(false); setEditing(false); setMessagesOpen(false); setProfileId(undefined);
        }}>Postcard</button>}
        {account?.accountId && <button className="social-action" type="button" aria-pressed={messagesOpen}
          onClick={() => {setGuestbookOpen(false); setContact(undefined); setMessagesOpen(!messagesOpen); setSnackMenu(false); setInviteOpen(false); setPeopleOpen(false); setChat(false); setProfileId(undefined); setEditing(false);}}>Messages</button>}
        {account?.enabled && <button className="social-action" type="button" onClick={account.accountId ? signOut : googleSignIn}>
          {account.accountId ? 'Sign out' : 'Google sign-in'}
        </button>}
        <span className="online"><i /> <span>{mock ? visitors.length : live.connected} online</span></span>
      </div>
    </header>

    <section className="stage" aria-label="The Virtual Café">
      <CafeScene onLayoutOpen={() => {setEntryOpen(false); setProfileId(undefined);}} editable={mock === true} occupancy={occupancy} time={cafeTime} visitorId={visitor?.id} profileId={profileId} locatedId={locatedId} choosing={choosing} rain={rain} arrival={mock ? mockArrival : live.arrival && !blocked.has(live.arrival.id) ? live.arrival : undefined}
        bubbles={Object.fromEntries(Object.entries(bubbles).filter(([id]) => !blocked.has(id)))}
        typing={Object.fromEntries(Object.entries(live.typing).filter(([id]) => !blocked.has(id)))}
        onBarista={() => {
          setGuestbookOpen(false); setRecipient(undefined); setSnackMenu(open => !open); setProfileId(undefined); setChat(false);
          setInviteOpen(false); setPeopleOpen(false); setMessagesOpen(false); setEditing(false);
        }}
        profileActions={visitor && chosen && <div className="profile-actions">
          <button type="button" onClick={() => locate(chosen)}>Locate</button>
          {chosen.id !== visitor.id && !chosen.disconnected && !blocked.has(chosen.id)
            && (!live.discoverable || live.discoverable.includes(chosen.id)) && <button type="button" onClick={() => {
              setRecipient(chosen.id);
              setProfileId(undefined);
              setSnackMenu(true);
            }}>Send treat</button>}
          {!mock && (
          chosen.id === visitor.id ? <button type="button" onClick={() => {setGuestbookOpen(false); setEditing(true); setChat(false); setMessagesOpen(false); setProfileId(undefined);}}>Edit profile</button> : <>
            <button type="button" onClick={() => setMuted(current => current.includes(chosen.id) ? current.filter(id => id !== chosen.id) : [...current, chosen.id])}>
              {muted.includes(chosen.id) ? 'Unmute' : 'Mute'}
            </button>
            {account?.accountId && chosen.accountId && !blocked.has(chosen.id) && (!live.discoverable || live.discoverable.includes(chosen.id)) && <button type="button" onClick={() => {
              setContact({peer: chosen.accountId!, name: chosen.name});
              setGuestbookOpen(false); setMessagesOpen(true); setChat(false); setEditing(false); setProfileId(undefined);
            }}>Message</button>}
            <button type="button" disabled={live.blocked.includes(chosen.id) || Boolean(chosen.accountId && account?.blocked?.includes(chosen.accountId))} onClick={() => live.send({type: 'BLOCK', target: chosen.id})}>Block</button>
            <button type="button" onClick={() => report(chosen.id)}>Report</button>
          </>)}
        </div>}
        onSeat={selectSeat} onClose={() => setProfileId(undefined)} />
      {!mock && (accountError || live.error || live.connection !== 'ready') && <div className="room-feedback pill" role="status">
        {accountError || (live.error?.message ?? (live.connection === 'offline' ? 'Connection lost. Reconnecting…' : 'Connecting to the café…'))}
        {live.error?.code === 'ROOM_FULL' && <>
          <button className="social-action" type="button" onClick={() => {if (pendingJoin.current) enter(pendingJoin.current);}}>Retry</button>
          <button className="social-action" type="button" onClick={anotherRoom}>Try another café</button>
        </>}
        {live.error?.code === 'INVALID_INVITE' && <a className="social-action" href="/">Open the café</a>}
        {live.connection === 'closed' && live.error?.code !== 'INVALID_INVITE' && <button className="social-action" type="button" onClick={live.retry}>Reconnect</button>}
      </div>}
      {treatToast && <div className="treat-toast pill" role="status">{treatToast}</div>}
      {snackMenu && <SnackMenu canOrder={Boolean(visitor)} recipient={recipient} setRecipient={setRecipient}
        recipients={directory.filter(person => person.id !== visitor?.id && !blocked.has(person.id))}
        error={live.error?.code.startsWith('TREAT_') ? live.error.message : undefined}
        onOrder={orderItems} onClose={() => setSnackMenu(false)} />}
      {visitor && postcardOpen && <PostcardComposer
        details={{time: cafeTime, animal: visitor.animal, seatId: visitor.seatId, name: visitor.name}}
        receipt={live.postcard} canShare={!mock && live.connection === 'ready'}
        error={live.error?.code === 'POSTCARD_FAILED' ? live.error.message : undefined}
        create={(requestId, note) => live.send({type: 'CREATE_POSTCARD', requestId, time: cafeTime, note})}
        close={() => setPostcardOpen(false)} />}
      {visitor && inviteOpen && <InvitePanel room={room} token={inviteToken} close={() => setInviteOpen(false)} />}
      {visitor && peopleOpen && <PeoplePanel members={directory} ownInterests={visitor.interestIds}
        blockedVisitors={[
          ...accountBlocks.map(item => ({...item, unblock: () => live.send({type: 'UNBLOCK_ACCOUNT', target: item.id})})),
          ...roomBlocks.map(item => ({...item, unblock: () => live.send({type: 'UNBLOCK', target: item.id})})),
        ]}
        close={() => setPeopleOpen(false)} openProfile={id => {setPeopleOpen(false); setProfileId(id);
          const member = visitors.find(person => person.id === id);
          if (member) revealSeat(member.seatId);
        }} />}
      {!mock && visitor && guestbookOpen && <Guestbook key={room + (inviteToken ?? '')}
        notes={live.guestbook?.filter(note => !blocked.has(note.sender) &&
          !(note.accountId && account?.blocked?.includes(note.accountId)))}
        ready={live.connection === 'ready'} error={live.error?.code.startsWith('GUESTBOOK_') ? live.error.message : undefined}
        close={() => setGuestbookOpen(false)}
        post={(id, body) => live.send({type: 'POST_GUESTBOOK_NOTE', id, body})}
        remove={id => live.send({type: 'REMOVE_GUESTBOOK_NOTE', id})}
        report={note => report(note.sender, note.id)} />}
      {!mock && visitor && chat && <RoomChat self={visitor.id} selfName={visitor.name} people={directory.filter(person => person.id !== visitor.id)} messages={live.messages.filter(message => !blocked.has(message.sender) && !(message.accountId && account?.blocked?.includes(message.accountId)))}
        onTyping={sendTyping} send={body => live.send({type: 'SEND_PUBLIC_MESSAGE', body})}
        sendGif={gifId => live.send({type: 'SEND_PUBLIC_GIF', gifId})} close={() => setChat(false)}
        report={(message: PublicMessage) => report(message.sender, message.id)} />}
      {!mock && account?.accountId && messagesOpen && <DirectMessages key={contact?.peer ?? 'inbox'} account={account.accountId}
        contact={contact} setContact={setContact} delivery={live.direct} close={() => setMessagesOpen(false)} />}
      {!mock && visitor && editing && <ProfileEditor visitor={visitor} close={() => setEditing(false)} save={saveProfile} />}
      {entryOpen && !visitor && live.error?.code !== 'INVALID_INVITE' && <EntryForm full={available === 0} defaults={account?.profile ?? (!mock ? savedGuestProfile : undefined)} onEnter={enter} onBrowse={() => setEntryOpen(false)} />}
      {choosing && <div className="move-hint pill" role="status">Choose an open seat in the café</div>}
      <div className="stage-actions">
        <PomodoroTimer />
        {!visitor && !entryOpen && live.error?.code !== 'INVALID_INVITE' && <button type="button" className="pill take-seat" onClick={() => setEntryOpen(true)}>Take a seat <Icon name="arrow" size={16} /></button>}
        {visitor && <SeatSelector available={available} choosing={choosing} onToggle={() => {
          setChoosing(!choosing);
          setProfileId(undefined);
        }} />}
        <span className="pill capacity" aria-label={`${available} open seats out of ${seats.length}`}><Icon name="chair" size={18} />{available} open <span>/ {seats.length}</span></span>
      </div>
      <footer className="toolbar">
        <AudioPlayer onRainChange={setRain} />
        {visitor && <PresenceSelector value={visitor.presence} onChange={presence => {
          if (mock) setVisitor({ ...visitor, presence });
          else live.send({type: 'UPDATE_STATUS', presence});
          setAnnouncement(`Presence set to ${presence}.`);
        }} />}
      </footer>
    </section>
    <div className="sr-only" role="status">{announcement}</div>
  </main>;
}
