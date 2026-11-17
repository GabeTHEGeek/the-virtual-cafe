import { readInterests } from '../lib/interests';
import { DurableObject } from 'cloudflare:workers';
import { assignSeat, type Visitor } from '../lib/cafe';
import { seats } from '../lib/seats';
import { frameSchema, type Arrival, type GuestbookNote, type PublicMessage, type ServerFrame } from '../lib/protocol';
import { saveProfile } from './accounts';
import type { Env } from './env';
import { filterPublicChat } from './public-chat-filter';
import { localGuestSecret, type Identity } from './session';
import { signPostcard } from './postcards';

type Member = { identity: Identity; visitor: Visitor; expires?: number; lastChat?: number; lastGuestbook?: number; lastTreat?: number; lastAction?: number; lastInvite?: number; blocked?: string[]; blockedNames?: Record<string, string>; blockedAccounts?: Record<string, string> };
type RoomState = { members: Member[]; messages: PublicMessage[]; sequence: number; arrival?: Arrival; bans: string[] };
type SocketData = Identity & { memberId?: string; room: string; sessionId?: string; retired?: boolean; typingUntil?: number; watchingGuestbook?: boolean; frameWindow?: number; framesInWindow?: number };
type SavedNote = Omit<GuestbookNote, 'own'> & {guest: string};
const guestbookKey = 'guestbook';
const maxGuestbookNotes = 40;
const reservation = 60_000;
const maxHistory = 40;
const frameLimit = 4096;

export class CafeRoom extends DurableObject<Env> {
  private room: RoomState;
  private alarmAt?: number;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.room = ctx.storage.kv.get<RoomState>('room') ?? { members: [], messages: [], sequence: 0, bans: [] };
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    // Hibernation preserves attachments. A runtime restart can lose the sockets
    // before close handlers run, so recover orphaned seats when the object wakes.
    const active = new Set(ctx.getWebSockets().filter(socket => socket.readyState === WebSocket.OPEN)
      .map(socket => this.data(socket)?.memberId));
    let recovered = false;
    for (const member of this.room.members) {
      if (!member.expires && !active.has(member.visitor.id)) {
        member.expires = Date.now() + reservation;
        recovered = true;
      }
    }
    const pruned = this.prune();
    if (recovered || pruned) this.save();
  }

  private data(socket: WebSocket): SocketData {
    return socket.deserializeAttachment() as SocketData;
  }

  private save() {
    if (!this.room.members.length) {
      this.room.messages = [];
      delete this.room.arrival;
    }
    this.ctx.storage.kv.put('room', this.room);
    const expiries = this.room.members.flatMap(member => member.expires ? [member.expires] : []);
    const next = expiries.length ? Math.min(...expiries) : undefined;
    if (this.alarmAt !== next) {
      this.alarmAt = next;
      void (next === undefined ? this.ctx.storage.deleteAlarm() : this.ctx.storage.setAlarm(next));
    }
  }

  private prune() {
    const before = this.room.members.length;
    const now = Date.now();
    this.room.members = this.room.members.filter(member => !member.expires || member.expires > now);
    return this.room.members.length !== before;
  }

  canResume(identity: Identity) {
    const member = this.member(identity);
    return Boolean(member && (!member.expires || member.expires > Date.now()));
  }

  canInvite(identity: Identity) {
    const visitor = this.member(identity);
    if (!visitor || visitor.expires || (visitor.lastInvite && Date.now() - visitor.lastInvite < 1500)) return false;
    visitor.lastInvite = Date.now();
    this.save();
    return true;
  }

  private member(identity: Identity) {
    return this.room.members.find(member => identity.accountId && member.identity.accountId === identity.accountId)
      ?? this.room.members.find(member => member.identity.guest === identity.guest
        && (!member.identity.accountId || member.identity.accountId === identity.accountId));
  }

  private send(socket: WebSocket, frame: ServerFrame) {
    if (socket.readyState === WebSocket.OPEN) try { socket.send(JSON.stringify(frame)); } catch { /* close event handles the reservation */ }
  }

  private error(socket: WebSocket, code: string, message: string) {
    this.send(socket, { v: 1, type: 'ERROR', code, message });
  }

  private snapshot(socket: WebSocket) {
    const id = this.data(socket).memberId;
    const owner = this.room.members.find(member => member.visitor.id === id);
    const blocked = owner?.blocked ?? [];
    this.send(socket, {
      v: 1, type: 'ROOM_SNAPSHOT', self: id ?? '', blocked, blockedNames: owner?.blockedNames, blockedAccounts: owner?.blockedAccounts,
      discoverable: this.room.members.filter(member => !member.expires && !blocked.includes(member.visitor.id)
        && (!id || !member.blocked?.includes(id))).map(member => member.visitor.id),
      visitors: this.room.members.map(({visitor, expires}) => ({...visitor, interestIds: visitor.interestIds ?? readInterests(visitor.interests ?? ''), disconnected: Boolean(expires)})),
      connected: this.room.members.filter(member => !member.expires).length,
      arrival: this.room.arrival && !blocked.includes(this.room.arrival.id) ? this.room.arrival : undefined,
      messages: id ? this.room.messages.filter(message => !blocked.includes(message.sender))
        .map(message => message.gifId ? message : {...message, body: filterPublicChat(message.body)}) : [],
    });
  }

  private guestbookNotes() {
    return this.ctx.storage.kv.get<SavedNote[]>(guestbookKey) ?? [];
  }

  private ownsNote(viewer: Identity, note: SavedNote) {
    return note.accountId ? note.accountId === viewer.accountId : note.guest === viewer.guest;
  }

  private sendGuestbook(socket: WebSocket, viewer: Member, notes: SavedNote[]) {
    this.send(socket, {v: 1, type: 'GUESTBOOK', notes: notes
      .filter(note => !viewer.blocked?.includes(note.sender))
      .map(saved => {
        const {guest, ...note} = saved;
        return {...note, own: this.ownsNote(viewer.identity, saved)};
      })});
  }

  private updateGuestbook(notes: SavedNote[]) {
    this.ctx.storage.kv.put(guestbookKey, notes);
    for (const socket of this.ctx.getWebSockets()) {
      const data = this.data(socket);
      if (!data.watchingGuestbook || data.retired) continue;
      const viewer = this.room.members.find(member => member.visitor.id === data.memberId);
      if (viewer) this.sendGuestbook(socket, viewer, notes);
    }
  }

  private synchronize() {
    this.save();
    for (const socket of this.ctx.getWebSockets()) this.snapshot(socket);
  }

  private bind(socket: WebSocket, identity: SocketData, member: Member) {
    identity.memberId = member.visitor.id;
    socket.serializeAttachment(identity);
    if (identity.accountId) this.ctx.waitUntil(
      this.env.DIRECTORY.getByName('accounts').remember(identity.accountId, identity.room)
        .catch(() => console.error('Could not register live DM route')),
    );
    const upgraded = Boolean(identity.accountId && !member.identity.accountId);
    member.identity = {guest: identity.guest, accountId: identity.accountId};
    member.visitor.accountId = identity.accountId;
    delete member.expires;
    if (upgraded && identity.accountId) this.ctx.waitUntil(
      saveProfile(this.env.DB, identity.accountId, member.visitor, false).catch(() => console.error('Could not initialize café profile')),
    );
    // Supersede the old attachment before its close event can reserve the seat.
    for (const older of this.ctx.getWebSockets()) {
      if (older !== socket && this.data(older).memberId === member.visitor.id) {
        const stale = this.data(older);
        delete stale.memberId;
        stale.retired = true;
        older.serializeAttachment(stale);
        older.close(4001, 'Session replaced');
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    const identity: SocketData = {
      room: request.headers.get('x-cafe-room') ?? 'main',
      sessionId: request.headers.get('x-cafe-session') || undefined,
      guest: request.headers.get('x-cafe-guest') ?? '',
      accountId: request.headers.get('x-cafe-account') || undefined,
    };
    if (!identity.guest) return new Response('Unauthorized', {status: 401});
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('Expected WebSocket', {status: 426});
    if (this.room.bans.includes(identity.guest) || (identity.accountId && this.room.bans.includes(identity.accountId))) {
      return new Response('Access restricted', {status: 403});
    }
    if (this.ctx.getWebSockets().length >= 100) return new Response('Room connection limit reached', {status: 503});
    const changed = this.prune();
    const existing = this.member(identity);
    if (!existing && request.headers.get('x-cafe-resume-only') === '1') {
      if (changed) this.synchronize();
      return new Response('Invitation expired', {status: 410});
    }
    if (existing && identity.accountId) {
      const links = {...existing.blockedAccounts};
      if (Object.keys(links).length) {
        const {results} = await this.env.DB.prepare('SELECT target FROM blocks WHERE owner = ?')
          .bind(identity.accountId).all<{target: string}>();
        const saved = new Set(results.map(row => row.target));
        this.clearRoomBlocks(existing, Object.keys(links).filter(id => !saved.has(links[id])));
      }
    }
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(identity);
    if (existing) this.bind(server, identity, existing);
    if (existing || changed) this.synchronize();
    else this.snapshot(server);
    return new Response(null, {status: 101, webSocket: client});
  }

  async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string' || raw.length > frameLimit) {
      this.error(socket, 'INVALID', 'That request is too large.');
      socket.close(1009, 'Frame too large');
      return;
    }
    const data = this.data(socket);
    if (data.retired) return;
    const now = Date.now();
    if (data.frameWindow === undefined || now - data.frameWindow >= 1000) {
      data.frameWindow = now;
      data.framesInWindow = 0;
    }
    const count = data.framesInWindow ?? 0;
    if (count >= 12) return this.error(socket, 'SLOW_DOWN', 'Please slow down.');
    data.framesInWindow = count + 1;
    socket.serializeAttachment(data);
    let json: unknown;
    try { json = JSON.parse(raw); } catch { return this.error(socket, 'INVALID', 'Invalid room request.'); }
    const frame = frameSchema.safeParse(json);
    if (!frame.success) return this.error(socket, 'INVALID', 'Invalid room request.');
    if (this.prune()) this.synchronize();
    const {command} = frame.data;
    if (command.type === 'REQUEST_ROOM_STATE') return this.snapshot(socket);
    const current = this.room.members.find(member => member.visitor.id === data.memberId);
    if (command.type === 'JOIN_ROOM') {
      if (current) return this.snapshot(socket);
      if (this.room.bans.includes(data.guest) || (data.accountId && this.room.bans.includes(data.accountId))) {
        this.error(socket, 'RESTRICTED', 'Access is restricted.');
        socket.close(4003, 'Access restricted');
        return;
      }
      const existing = this.member(data);
      if (existing) {
        this.bind(socket, data, existing);
        return this.synchronize();
      }
      const seat = assignSeat(command.profile.presence, this.room.members.map(member => member.visitor));
      if (!seat) {
        this.snapshot(socket);
        return this.error(socket, 'ROOM_FULL', 'The café is full. Retry here or try another café.');
      }
      const visitor = { ...command.profile, id: crypto.randomUUID(), seatId: seat.id };
      const member: Member = { identity: {guest: data.guest}, visitor };
      this.room.members.push(member);
      this.room.arrival = {id: visitor.id, name: visitor.name, at: now};
      this.bind(socket, data, member);
      this.synchronize();
      this.send(socket, {v: 1, type: 'CAFE_ENTERED'});
      return;
    }
    if (!current) return this.error(socket, 'JOIN_FIRST', 'Take a seat first.');
    switch (command.type) {
      case 'CREATE_POSTCARD': {
        try {
          const path = await signPostcard({
            time: command.time, animal: current.visitor.animal, seatId: current.visitor.seatId,
            name: filterPublicChat(current.visitor.name), note: filterPublicChat(command.note),
          }, this.env.GUEST_SECRET || localGuestSecret);
          this.send(socket, {v: 1, type: 'POSTCARD_CREATED', requestId: command.requestId, path});
        } catch {
          this.error(socket, 'POSTCARD_FAILED', 'Could not create the postcard link. Try again.');
        }
        return;
      }
      case 'WATCH_GUESTBOOK':
        data.watchingGuestbook = command.active;
        socket.serializeAttachment(data);
        if (command.active) this.sendGuestbook(socket, current, this.guestbookNotes());
        return;
      case 'POST_GUESTBOOK_NOTE': {
        const notes = this.guestbookNotes();
        const saved = notes.find(note => note.id === command.id);
        if (saved) {
          if (!this.ownsNote(current.identity, saved)) return this.error(socket, 'GUESTBOOK_NOTE', 'Could not post this note. Try again.');
          this.sendGuestbook(socket, current, notes);
          return;
        }
        if (current.lastGuestbook && now - current.lastGuestbook < 15_000) {
          return this.error(socket, 'GUESTBOOK_SLOW_DOWN', 'Wait 15 seconds between notes.');
        }
        const note: SavedNote = {id: command.id, sender: current.visitor.id, guest: current.identity.guest,
          accountId: current.identity.accountId, name: filterPublicChat(current.visitor.name),
          body: filterPublicChat(command.body), time: now};
        current.lastGuestbook = now;
        this.save();
        const next = [note, ...notes].slice(0, maxGuestbookNotes);
        this.updateGuestbook(next);
        if (!data.watchingGuestbook) this.sendGuestbook(socket, current, next);
        return;
      }
      case 'REMOVE_GUESTBOOK_NOTE': {
        const notes = this.guestbookNotes();
        const note = notes.find(note => note.id === command.id);
        if (!note || !this.ownsNote(current.identity, note)) {
          return this.error(socket, 'GUESTBOOK_NOTE', 'That note is unavailable or belongs to another visitor.');
        }
        const next = notes.filter(note => note.id !== command.id);
        this.updateGuestbook(next);
        if (!data.watchingGuestbook) this.sendGuestbook(socket, current, next);
        return;
      }
      case 'CHANGE_SEAT': {
        if (!seats.some(seat => seat.id === command.seatId)
          || this.room.members.some(member => member.visitor.seatId === command.seatId && member !== current)) {
          this.snapshot(socket);
          return this.error(socket, 'SEAT_UNAVAILABLE', 'That seat is unavailable. Pick another open seat.');
        }
        current.visitor.seatId = command.seatId;
        break;
      }
      case 'UPDATE_STATUS':
        current.visitor.presence = command.presence;
        break;
      case 'UPDATE_PROFILE':
        if (current.identity.accountId) {
          const account = current.identity.accountId;
          try {
            if (!(await this.validAccount(data))) return this.error(socket, 'SIGN_IN', 'Sign in again to save your profile.');
            await saveProfile(this.env.DB, account, {...current.visitor, ...command.profile,
              interestIds: command.profile.interestIds ?? (command.profile.interests !== undefined ? readInterests(command.profile.interests) : current.visitor.interestIds)}, true);
          } catch {
            return this.error(socket, 'PROFILE_FAILED', 'The profile could not be saved. Try again.');
          }
          const latest = this.room.members.find(member => member === current && member.identity.accountId === account);
          if (!latest) return;
        }
        Object.assign(current.visitor, command.profile);
        if (command.profile.interestIds === undefined && command.profile.interests !== undefined) {
          current.visitor.interestIds = readInterests(command.profile.interests);
        }
        break;
      case 'UPDATE_WORKING_ON':
        current.visitor.work = command.work;
        break;
      case 'ORDER_SNACK':
        current.visitor.snack = command.snack;
        this.synchronize();
        this.send(socket, {v: 1, type: 'SNACK_ORDERED', snack: command.snack});
        return;
      case 'ORDER_CAFE_ITEMS': {
        const {snack, drink, target} = command;
        const gift = target && target !== current.visitor.id;
        const recipient = gift ? this.room.members.find(member => member.visitor.id === target) : current;
        if (!recipient) return this.error(socket, 'TREAT_UNAVAILABLE', 'That visitor cannot receive treats right now.');
        if (gift) {
          if (current.lastTreat && now - current.lastTreat < 12_000) {
            return this.error(socket, 'TREAT_SLOW_DOWN', 'Wait a moment before sending another treat.');
          }
          const senderAccount = current.identity.accountId;
          const recipientAccount = recipient.identity.accountId;
          if (senderAccount && recipientAccount && await this.env.DB.prepare(
            'SELECT 1 FROM blocks WHERE (owner = ?1 AND target = ?2) OR (owner = ?2 AND target = ?1)',
          ).bind(senderAccount, recipientAccount).first()) {
            return this.error(socket, 'TREAT_UNAVAILABLE', 'That visitor cannot receive treats right now.');
          }
          if (!this.room.members.includes(recipient) || recipient.expires || this.data(socket).retired
            || current.blocked?.includes(recipient.visitor.id) || recipient.blocked?.includes(current.visitor.id)) {
            return this.error(socket, 'TREAT_UNAVAILABLE', 'That visitor cannot receive treats right now.');
          }
          if (current.lastTreat && Date.now() - current.lastTreat < 12_000) {
            return this.error(socket, 'TREAT_SLOW_DOWN', 'Wait a moment before sending another treat.');
          }
          current.lastTreat = Date.now();
        }
        if (snack) recipient.visitor.snack = snack;
        if (drink) recipient.visitor.drink = drink;
        this.synchronize();
        this.send(socket, {v: 1, type: 'CAFE_ORDERED', snack, drink, recipient: gift ? recipient.visitor.name : undefined});
        if (gift) for (const peer of this.ctx.getWebSockets()) {
          if (this.data(peer).memberId === recipient.visitor.id && !this.data(peer).retired) {
            this.send(peer, {v: 1, type: 'TREAT_DELIVERED', from: current.visitor.name, snack, drink});
          }
        }
        return;
      }
      case 'SET_TYPING': {
        if (command.active && (data.typingUntil ?? 0) > now + 2400) return;
        if (!command.active && !data.typingUntil) return;
        data.typingUntil = command.active ? now + 3600 : undefined;
        socket.serializeAttachment(data);
        for (const peer of this.ctx.getWebSockets()) {
          if (peer === socket) continue;
          const observer = this.room.members.find(member => member.visitor.id === this.data(peer).memberId);
          if (observer && !observer.blocked?.includes(current.visitor.id) && !current.blocked?.includes(observer.visitor.id)) {
            this.send(peer, {v: 1, type: 'PUBLIC_TYPING', sender: current.visitor.id, active: command.active});
          }
        }
        return;
      }
      case 'SEND_PUBLIC_GIF':
      case 'SEND_PUBLIC_MESSAGE': {
        if (current.lastChat && now - current.lastChat < 1800) return this.error(socket, 'SLOW_DOWN', 'Wait a moment before posting again.');
        current.lastChat = now;
        const gif = command.type === 'SEND_PUBLIC_GIF';
        const message: PublicMessage = {id: String(++this.room.sequence), sender: current.visitor.id,
          name: current.visitor.name, accountId: current.identity.accountId,
          body: gif ? 'Sent a GIF' : filterPublicChat(command.body), gifId: gif ? command.gifId : undefined, time: now};
        this.room.messages = [...this.room.messages, message].slice(-maxHistory);
        this.save();
        for (const peer of this.ctx.getWebSockets()) {
          const observer = this.room.members.find(member => member.visitor.id === this.data(peer).memberId);
          if (observer && !observer.blocked?.includes(message.sender)) this.send(peer, {v: 1, type: 'PUBLIC_MESSAGE', message});
        }
        return;
      }
      case 'UNBLOCK':
      case 'UNBLOCK_ACCOUNT':
        try {
          return await this.unblock(socket, current, command);
        } catch {
          return this.error(socket, 'MODERATION_FAILED', 'Could not unblock that visitor. Try again.');
        }
      case 'BLOCK':
      case 'REPORT':
        try {
          return await this.moderate(socket, current, command);
        } catch {
          return this.error(socket, 'MODERATION_FAILED', 'Could not complete that action. Try again.');
        }
    }
    this.synchronize();
  }

  private async validAccount(data: SocketData) {
    if (!data.sessionId || !data.accountId) return false;
    return Boolean(await this.env.DB.prepare(`SELECT 1 FROM "session" WHERE id = ? AND userId = ?
      AND (CASE WHEN typeof(expiresAt) IN ('integer','real') THEN expiresAt
        ELSE unixepoch(expiresAt) * 1000 END) > ?`)
      .bind(data.sessionId, data.accountId, Date.now()).first());
  }

  private async unblock(socket: WebSocket, current: Member, command: Extract<import('../lib/protocol').Command, {type: 'UNBLOCK' | 'UNBLOCK_ACCOUNT'}>) {
    const {target, type} = command;
    const accountId = current.identity.accountId;
    let localIds = [target];
    let removedAccountBlock = false;
    if (type === 'UNBLOCK_ACCOUNT') {
      if (!accountId || !(await this.validAccount(this.data(socket)))) {
        return this.error(socket, 'SIGN_IN', 'Sign in again to remove an account block.');
      }
      const deleted = await this.env.DB.prepare('DELETE FROM blocks WHERE owner = ? AND target = ?')
        .bind(accountId, target).run();
      removedAccountBlock = deleted.meta.changes > 0;
      localIds = Object.keys(current.blockedAccounts ?? {}).filter(id => current.blockedAccounts?.[id] === target);
      for (const member of this.room.members) if (member.identity.accountId === target) localIds.push(member.visitor.id);
      for (const message of this.room.messages) if (message.accountId === target) localIds.push(message.sender);
    }
    this.clearRoomBlocks(current, localIds);
    this.synchronize();
    if (removedAccountBlock) this.notifyAccountBlocks(target);
    this.send(socket, {v: 1, type: 'MODERATION_UPDATED', target, action: type});
  }

  private notifyAccountBlocks(accountId: string) {
    for (const socket of this.ctx.getWebSockets()) {
      if (this.data(socket).accountId === accountId) this.send(socket, {v: 1, type: 'ACCOUNT_BLOCKS_CHANGED'});
    }
  }

  private clearRoomBlocks(member: Member, ids: string[]) {
    member.blocked = member.blocked?.filter(id => !ids.includes(id));
    for (const id of ids) {
      delete member.blockedNames?.[id];
      delete member.blockedAccounts?.[id];
    }
  }

  private async moderate(socket: WebSocket, current: Member, command: Extract<import('../lib/protocol').Command, {type: 'BLOCK' | 'REPORT'}>) {
    const target = this.room.members.find(member => member.visitor.id === command.target);
    const reported = command.type === 'REPORT' && command.messageId
      ? this.room.messages.find(message => message.id === command.messageId && message.sender === command.target) : undefined;
    const note = command.type === 'REPORT' && command.messageId?.includes('-')
      ? this.guestbookNotes().find(note => note.id === command.messageId && note.sender === command.target) : undefined;
    if ((!target && !reported && !note) || command.target === current.visitor.id || (note && this.ownsNote(current.identity, note))
      || (command.type === 'REPORT' && command.messageId && !reported && !note)) {
      return this.error(socket, 'INVALID_TARGET', 'That visitor or message is unavailable.');
    }
    if (current.lastAction && Date.now() - current.lastAction < 3000) return this.error(socket, 'SLOW_DOWN', 'Wait a moment before trying again.');
    current.lastAction = Date.now();
    this.save();
    if (command.type === 'BLOCK' && current.identity.accountId && target?.identity.accountId) {
      if (!(await this.validAccount(this.data(socket)))) return this.error(socket, 'SIGN_IN', 'Sign in again to save a block.');
      await this.env.DB.prepare('INSERT OR IGNORE INTO blocks (owner, target) VALUES (?, ?)').bind(current.identity.accountId, target.identity.accountId).run();
    }
    if (command.type === 'REPORT') {
      await this.env.DB.prepare('INSERT INTO reports (room, reporter, target, target_account, reason, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(this.data(socket).room, current.identity.accountId ?? current.visitor.id, command.target, target?.identity.accountId ?? reported?.accountId ?? note?.accountId ?? null,
          command.reason, reported?.gifId ? `GIPHY ID: ${reported.gifId}` : reported?.body ?? note?.body ?? null, Date.now()).run();
    }
    if (command.type === 'BLOCK') {
      current.blocked = Array.from(new Set([...(current.blocked ?? []), command.target])).slice(-100);
      current.blockedNames = Object.fromEntries(current.blocked.flatMap(id => {
        const name = id === command.target ? target?.visitor.name : current.blockedNames?.[id];
        return name ? [[id, name]] : [];
      }));
      current.blockedAccounts = Object.fromEntries(current.blocked.flatMap(id => {
        const account = id === command.target && current.identity.accountId ? target?.identity.accountId : current.blockedAccounts?.[id];
        return account ? [[id, account]] : [];
      }));
      this.synchronize();
    }
    if (command.type === 'BLOCK' && current.identity.accountId && target?.identity.accountId) {
      this.notifyAccountBlocks(target.identity.accountId);
    }
    this.send(socket, {v: 1, type: 'MODERATION_UPDATED', target: command.target, action: command.type});
  }

  webSocketClose(socket: WebSocket) {
    const id = this.data(socket).memberId;
    if (!id) return;
    const current = this.room.members.find(member => member.visitor.id === id);
    if (current && !current.expires) {
      current.expires = Date.now() + reservation;
      this.synchronize();
    }
  }

  webSocketError(socket: WebSocket) {
    this.webSocketClose(socket);
    try { socket.close(1011, 'Connection error'); } catch { /* already closed */ }
  }

  async alarm() {
    this.alarmAt = undefined;
    this.prune();
    this.synchronize();
  }

  async notifyDirectMessage(message: import('../lib/protocol').DirectMessage) {
    for (const socket of this.ctx.getWebSockets()) {
      const data = this.data(socket);
      const account = data.accountId;
      if (account && (account === message.sender || account === message.recipient) && await this.validAccount(data)) {
        this.send(socket, {v: 1, type: 'DIRECT_MESSAGE', message});
      }
    }
  }

  removeVisitor(id: string, restrict: boolean) {
    const current = this.room.members.find(member => member.visitor.id === id);
    if (!current) return false;
    if (restrict) {
      this.room.bans = Array.from(new Set([...this.room.bans, current.identity.guest, ...(current.identity.accountId ? [current.identity.accountId] : [])]));
    }
    this.room.members = this.room.members.filter(member => member !== current);
    for (const socket of this.ctx.getWebSockets()) {
      if (this.data(socket).memberId === id) socket.close(4003, 'Removed by a moderator');
    }
    this.synchronize();
    return true;
  }
}
