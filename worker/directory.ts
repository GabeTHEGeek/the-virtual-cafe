import { activeInvitation, invitationLifetime, type Invitation } from '../lib/invitations';
import { DurableObject } from 'cloudflare:workers';
import type { Env } from './env';

export class CafeDirectory extends DurableObject<Env> {
  createInvite(room: string) {
    const now = Date.now();
    const recordKey = `invite:room:${room}`;
    const previous = this.ctx.storage.kv.get<Invitation>(recordKey);
    if (previous && activeInvitation(previous, now)) return previous;
    const token = crypto.randomUUID().replaceAll('-', '');
    const invite = {token, room, expires: now + invitationLifetime};
    this.ctx.storage.transactionSync(() => {
      const retiredKey = `invite:retired:${room}`;
      const retired = this.ctx.storage.kv.get<string>(retiredKey);
      if (retired) this.ctx.storage.kv.delete(`invite:token:${retired}`);
      if (previous) this.ctx.storage.kv.put(retiredKey, previous.token);
      this.ctx.storage.kv.put(recordKey, invite);
      this.ctx.storage.kv.put(`invite:token:${token}`, invite);
    });
    return invite;
  }

  resolveInvite(token: string) {
    const invite = this.ctx.storage.kv.get<Invitation>(`invite:token:${token}`);
    return invite && {room: invite.room, active: activeInvitation(invite, Date.now())};
  }

  remember(account: string, room: string) {
    const rooms = this.roomsFor(account);
    this.ctx.storage.kv.put(account, [room, ...rooms.filter(existing => existing !== room)].slice(0, 4));
  }

  roomsFor(account: string) {
    return this.ctx.storage.kv.get<string[]>(account) ?? [];
  }
}
