import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import WebSocket from 'ws';

const origin = process.env.CAFE_TEST_ORIGIN || 'http://127.0.0.1:8787';
const room = suffix => `test-${crypto.randomUUID().slice(0, 8)}-${suffix}`;

async function newCookie() {
  const response = await fetch(origin + '/api/guest', {method: 'POST', headers: {Origin: origin}});
  assert.equal(response.status, 204);
  return response.headers.get('set-cookie').split(';')[0];
}

async function connect(name, cookie, invite) {
  cookie ??= await newCookie();
  const url = new URL('/api/connect', origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set(invite ? 'invite' : 'room', invite ?? name);
  const ws = new WebSocket(url, {headers: {Cookie: cookie, Origin: origin}});
  const frames = [];
  ws.on('message', value => {
    if (value.toString() !== 'pong') frames.push({...JSON.parse(value.toString()), receivedAt: performance.now()});
  });
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  async function wait(predicate) {
    for (let i = 0; i < 400; i++) {
      const match = frames.findIndex(predicate);
      if (match !== -1) return frames.splice(match, 1)[0];
      await delay(10);
    }
    throw new Error('Timed out waiting for frame. Received ' + JSON.stringify(frames.slice(-4)));
  }
  return {
    ws, wait, cookie,
    send: (type, args = {}) => ws.send(JSON.stringify({v: 1, command: {type, ...args}})),
    async join(name, presence = 'Focused') {
      this.send('JOIN_ROOM', {profile: {name, animal: 'fox', work: '', presence}});
      return wait(frame => frame.type === 'ROOM_SNAPSHOT' && frame.self && frame.visitors.some(v => v.id === frame.self));
    },
  };
}

const snapshot = predicate => frame => frame.type === 'ROOM_SNAPSHOT' && predicate(frame);
const error = code => frame => frame.type === 'ERROR' && frame.code === code;

test('separate guest sessions see the same room and race for one open seat', async t => {
  const name = room('race');
  const a = await connect(name);
  const b = await connect(name);
  const c = await connect(room('isolated'));
  t.after(() => [a,b,c].forEach(({ws}) => ws.close()));
  const [one, two] = await Promise.all([a.join('Mochi'), b.join('Fern', 'Available')]);
  assert.notEqual(one.self, two.self);
  const both = one.visitors.length === 2 ? one : await a.wait(snapshot(f => f.visitors.length === 2));
  assert.equal(new Set(both.visitors.map(v => v.seatId)).size, 2);
  assert.equal((await c.wait(snapshot(() => true))).visitors.length, 0);
  await delay(100);
  a.send('CHANGE_SEAT', {seatId: 'window-1'});
  b.send('CHANGE_SEAT', {seatId: 'window-1'});
  const [afterA, afterB] = await Promise.all([a,b].map(client =>
    client.wait(snapshot(f => f.visitors.some(v => v.seatId === 'window-1')))));
  assert.deepEqual(afterA.visitors, afterB.visitors);
  assert.equal(afterA.visitors.filter(v => v.seatId === 'window-1').length, 1);
  await (afterA.visitors.find(v => v.seatId === 'window-1').id === one.self ? b : a).wait(error('SEAT_UNAVAILABLE'));
});

test('25 guests keep unique seats and the full room rejects another join', async t => {
  const name = room('full');
  const clients = await Promise.all(Array.from({length: 26}, () => connect(name)));
  t.after(() => clients.forEach(({ws}) => ws.close()));
  await Promise.all(clients.slice(0,25).map((client,i) => client.join(`Guest ${i}`)));
  const full = await clients[0].wait(snapshot(f => f.visitors.length === 25));
  assert.equal(new Set(full.visitors.map(v => v.seatId)).size, 25);
  clients[25].send('JOIN_ROOM', {profile: {name: 'Extra', animal: 'cat', work: '', presence: 'Focused'}});
  await clients[25].wait(error('ROOM_FULL'));
});

test('chat is ordered and rendered as data, profiles update, and only the signed session reclaims the seat', async t => {
  const name = room('chat');
  const a = await connect(name);
  const b = await connect(name);
  t.after(() => [a,b].forEach(({ws}) => ws.close()));
  const one = await a.join('Mochi');
  await b.join('Fern');
  await delay(100);
  a.send('UPDATE_STATUS', {presence: 'Away'});
  await b.wait(snapshot(f => f.visitors.some(v => v.id === one.self && v.presence === 'Away')));
  await delay(100);
  a.send('UPDATE_WORKING_ON', {work: 'Finishing a chapter'});
  await b.wait(snapshot(f => f.visitors.some(v => v.id === one.self && v.work === 'Finishing a chapter')));
  await delay(100);
  a.send('SEND_PUBLIC_MESSAGE', {body: '<script> still text'});
  const isMessage = f => f.type === 'PUBLIC_MESSAGE';
  const [sent, received] = await Promise.all([a.wait(isMessage), b.wait(isMessage)]);
  assert.deepEqual(received.message, sent.message);
  assert.equal(received.message.body, '<script> still text');
  await delay(100);
  a.send('SEND_PUBLIC_MESSAGE', {body: 'Too fast'});
  await a.wait(error('SLOW_DOWN'));
  a.ws.close();
  await b.wait(snapshot(f => f.visitors.some(v => v.id === one.self && v.disconnected)));
  const impostor = await connect(name);
  t.after(() => impostor.ws.close());
  const falseIdentity = await impostor.join('Mochi');
  assert.notEqual(falseIdentity.self, one.self);
  const resumed = await connect(name, a.cookie);
  t.after(() => resumed.ws.close());
  const restored = await resumed.wait(snapshot(f => f.self === one.self));
  assert.equal(restored.visitors.find(v => v.id === one.self).seatId, one.visitors.find(v => v.id === one.self).seatId);
  assert.equal(restored.visitors.find(v => v.id === one.self).presence, 'Away');
});

test('reservations expire by alarm after 60 seconds', {skip: !process.env.CAFE_TEST_EXPIRY, timeout: 70000}, async t => {
  const name = room('expiry');
  const a = await connect(name);
  const observer = await connect(name);
  t.after(() => [a,observer].forEach(({ws}) => ws.close()));
  const joined = await a.join('Mochi');
  a.ws.close();
  await observer.wait(snapshot(f => f.visitors.some(v => v.id === joined.self && v.disconnected)));
  await delay(58_500);
  const before = await connect(name);
  t.after(() => before.ws.close());
  assert.equal((await before.wait(snapshot(() => true))).visitors.length, 1);
  await observer.wait(snapshot(f => f.visitors.length === 0));
});

test('25 active sockets receive each broadcast consistently with measured latency', async t => {
  const name = room('load');
  const clients = await Promise.all(Array.from({length: 25}, () => connect(name)));
  t.after(() => clients.forEach(({ws}) => ws.close()));
  const joins = await Promise.all(clients.map((client, i) => client.join(`Load ${i}`)));
  const snapshots = await Promise.all(clients.map((client, i) => joins[i].connected === 25 ? joins[i]
    : client.wait(snapshot(f => f.connected === 25 && f.visitors.length === 25))));
  for (const frame of snapshots) assert.deepEqual(frame.visitors, snapshots[0].visitors);
  await delay(110);
  const start = performance.now();
  clients.forEach((client, i) => client.send('SEND_PUBLIC_MESSAGE', {body: `Message ${i}`}));
  const all = await Promise.all(clients.map(async client => {
    const received = [];
    for (let i = 0; i < clients.length; i++) {
      const frame = await client.wait(frame => frame.type === 'PUBLIC_MESSAGE');
      received.push({id: frame.message.id, elapsed: frame.receivedAt - start});
    }
    return received;
  }));
  for (const messages of all) assert.deepEqual(messages.map(m => m.id), all[0].map(m => m.id));
  await delay(2000);
  assert.equal(clients.filter(client => client.ws.readyState === WebSocket.OPEN).length, 25);
  const samples = all.flatMap(messages => messages.map(message => message.elapsed)).sort((a,b) => a-b);
  t.diagnostic(`25 connected sockets, ${samples.length} ordered deliveries, local p50 ${samples[312].toFixed(1)} ms, p95 ${samples[593].toFixed(1)} ms`);
});

test('guest block, message reports and room removal work without public moderation details', async t => {
  const name = room('moderation');
  const a = await connect(name), b = await connect(name), c = await connect(name);
  t.after(() => [a,b,c].forEach(({ws}) => ws.close()));
  await a.join('Mochi');
  const target = (await b.join('Fern')).self;
  await c.join('Sage');
  await delay(110);
  b.send('SEND_PUBLIC_MESSAGE', {body: 'Sample reportable test text'});
  const published = await a.wait(f => f.type === 'PUBLIC_MESSAGE');
  a.send('REPORT', {target, messageId: published.message.id, reason: 'Integration fixture'});
  await a.wait(f => f.type === 'MODERATION_UPDATED' && f.action === 'REPORT');
  await delay(3050);
  a.send('BLOCK', {target});
  await a.wait(snapshot(f => f.blocked.includes(target) && !f.messages.some(m => m.sender === target)));
  const pre = await c.wait(snapshot(f => f.visitors.length === 3));
  assert.equal(pre.blocked.length, 0);
  b.send('SEND_PUBLIC_MESSAGE', {body: 'Visible to other visitors'});
  await c.wait(f => f.type === 'PUBLIC_MESSAGE' && f.message.body === 'Visible to other visitors');
  await delay(110);
  a.send('REQUEST_ROOM_STATE');
  const after = await a.wait(snapshot(f => f.blocked.includes(target)));
  assert.ok(!after.messages.some(m => m.sender === target));
  const admin = process.env.CAFE_TEST_ADMIN;
  if (admin) {
    const reports = await fetch(origin + '/api/admin/reports', {headers: {Authorization: `Bearer ${admin}`}});
    assert.equal(reports.status, 200);
    assert.ok((await reports.json()).some(row => row.target === target && row.room === name));
    const removed = await fetch(origin + '/api/admin/remove', {method: 'POST',
      headers: {Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({room: name, visitor: target, restrict: true})});
    assert.equal(removed.status, 204);
    await a.wait(snapshot(f => !f.visitors.some(v => v.id === target) && f.visitors.length === 2));
  }
});

test('guests cannot read or send persistent messages', async () => {
  const Cookie = await newCookie();
  assert.equal((await fetch(origin + '/api/dm?peer=another', {headers: {Cookie}})).status, 401);
  assert.equal((await fetch(origin + '/api/dm', {method: 'POST', headers: {Cookie, Origin: origin}})).status, 401);
  assert.equal((await fetch(origin + '/api/admin/reports')).status, 403);
});

test('authenticated participants get persistent private DMs, while outsiders and blocked senders are denied',
  {skip: !process.env.CAFE_TEST_AUTH_SECRET}, async t => {
    assert.match(origin, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
    const identities = ['Owner', 'Peer', 'Outsider'].map(name => ({id: crypto.randomUUID(), token: crypto.randomUUID(), name}));
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 86_400_000).toISOString();
    const sql = identities.map(({id, token, name}) => `INSERT INTO "user" (id,name,email,emailVerified,createdAt,updatedAt)
      VALUES ('${id}','${name}','${id}@example.invalid',1,'${now}','${now}');
      INSERT INTO "session" (id,expiresAt,token,createdAt,updatedAt,userId)
      VALUES ('${token}','${expires}','${token}','${now}','${now}','${id}');`).join(' ');
    const persist = process.env.CAFE_TEST_PERSIST_TO ? ['--persist-to', process.env.CAFE_TEST_PERSIST_TO] : [];
    execFileSync('./node_modules/.bin/wrangler', ['d1','execute','DB','--local',...persist,'--command',sql], {stdio: 'pipe'});
    const cookies = await Promise.all(identities.map(async ({token}) => {
      const signature = createHmac('sha256', process.env.CAFE_TEST_AUTH_SECRET).update(token).digest('base64');
      return `${await newCookie()}; better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
    }));
    const [owner, peer, outsider] = identities;
    const me = await fetch(origin + '/api/me', {headers: {Cookie: cookies[0]}});
    assert.equal(me.status, 200);
    assert.equal((await me.json()).accountId, owner.id);

    const name = room('dm');
    const guestCookie = cookies[0].split(';')[0];
    const guestSession = await connect(name, guestCookie);
    t.after(() => guestSession.ws.close());
    guestSession.send('JOIN_ROOM', {profile: {name: 'Guest upgraded', animal: 'fox', work: '', presence: 'Focused', interestIds: ['design', 'art']}});
    const guestSeat = await guestSession.wait(snapshot(f => Boolean(f.self)));
    const sender = await connect(name, cookies[0]);
    const recipient = await connect(name, cookies[1]);
    t.after(() => [sender,recipient].forEach(({ws}) => ws.close()));
    const self = await sender.wait(snapshot(f => f.self === guestSeat.self && f.visitors.some(v => v.accountId === owner.id)));
    assert.equal(self.visitors.find(v => v.id === self.self).seatId, guestSeat.visitors[0].seatId);
    assert.deepEqual(self.visitors.find(v => v.id === self.self).interestIds, ['design', 'art']);
    const imported = await fetch(origin + '/api/me', {headers: {Cookie: cookies[0]}});
    assert.deepEqual((await imported.json()).profile.interestIds, ['design', 'art']);
    const target = (await recipient.join('Peer room')).self;
    const otherRoom = await connect(room('other'), cookies[1]);
    t.after(() => otherRoom.ws.close());
    await otherRoom.join('Peer elsewhere');

    sender.send('UPDATE_PROFILE', {profile: {name: 'Saved name', animal: 'rabbit', work: 'Letters', bio: 'Making tea', interestIds: ['writing', 'ai']}});
    await sender.wait(snapshot(f => f.visitors.some(v => v.id === self.self && v.name === 'Saved name')));
    const saved = await fetch(origin + '/api/me', {headers: {Cookie: cookies[0]}});
    const savedProfile = (await saved.json()).profile;
    assert.equal(savedProfile.name, 'Saved name');
    assert.deepEqual(savedProfile.interestIds, ['ai', 'writing']);
    const post = (cookie, to, body) => fetch(origin + '/api/dm', {method: 'POST',
      headers: {Cookie: cookie, Origin: origin, 'Content-Type': 'application/json'}, body: JSON.stringify({peer: to, body})});
    const response = await post(cookies[0], peer.id, 'Private note');
    assert.equal(response.status, 201, await response.clone().text());
    const message = await response.json();
    await recipient.wait(f => f.type === 'DIRECT_MESSAGE' && f.message.id === message.id);
    await otherRoom.wait(f => f.type === 'DIRECT_MESSAGE' && f.message.id === message.id);
    assert.equal((await post(cookies[0], peer.id, 'Rapid repeat')).status, 429);
    const thread = (from, to) => fetch(`${origin}/api/dm?peer=${to}`, {headers: {Cookie: cookies[from]}}).then(r => r.json());
    assert.deepEqual(await thread(0, peer.id), [message]);
    assert.deepEqual(await thread(1, owner.id), [message]);
    assert.deepEqual(await thread(2, owner.id), []);
    assert.deepEqual(await thread(0, outsider.id), []);
    await delay(1510);
    sender.send('BLOCK', {target});
    await sender.wait(f => f.type === 'MODERATION_UPDATED' && f.action === 'BLOCK');
    assert.equal((await post(cookies[1], owner.id, 'Blocked message')).status, 403);
    const inbox = await fetch(origin + '/api/conversations', {headers: {Cookie: cookies[0]}});
    assert.equal((await inbox.json())[0].peer, peer.id);
    const currentAccount = index => fetch(origin + '/api/me', {headers: {Cookie: cookies[index]}}).then(r => r.json());
    assert.deepEqual((await currentAccount(0)).ownedBlocks.map(entry => entry.id), [peer.id]);
    assert.deepEqual((await currentAccount(1)).ownedBlocks, []);
    recipient.send('UNBLOCK_ACCOUNT', {target: owner.id});
    await recipient.wait(f => f.type === 'MODERATION_UPDATED' && f.action === 'UNBLOCK_ACCOUNT');
    assert.equal((await post(cookies[1], owner.id, 'Still blocked')).status, 403);
    recipient.ws.close();
    otherRoom.ws.close();
    sender.send('UNBLOCK_ACCOUNT', {target: peer.id});
    await sender.wait(f => f.type === 'MODERATION_UPDATED' && f.action === 'UNBLOCK_ACCOUNT');
    await sender.wait(snapshot(f => f.blocked.length === 0 && f.visitors.find(v => v.id === target)?.disconnected));
    assert.deepEqual((await currentAccount(0)).ownedBlocks, []);
    assert.equal((await post(cookies[1], owner.id, 'Allowed again')).status, 201);

  });

test('validated guest interest tags synchronize without an account', async t => {
  const name = room('interests');
  const a = await connect(name), b = await connect(name);
  t.after(() => [a,b].forEach(client => client.ws.close()));
  const profile = {name: 'Mochi', animal: 'fox', work: 'A remote project', presence: 'Focused'};
  a.send('JOIN_ROOM', {profile: {...profile, interestIds: ['invalid']}});
  await a.wait(error('INVALID'));
  a.send('JOIN_ROOM', {profile: {...profile, interestIds: ['ai','art','music','fitness','travel','design']}});
  await a.wait(error('INVALID'));
  a.send('JOIN_ROOM', {profile: {...profile, interestIds: ['ai','ai','design']}});
  const joined = await a.wait(snapshot(frame => Boolean(frame.self)));
  assert.deepEqual(joined.visitors[0].interestIds, ['ai','design']);
  a.send('UPDATE_PROFILE', {profile: {...profile, interestIds: ['art','books','writing','music','travel']}});
  await b.wait(snapshot(frame => frame.visitors[0]?.interestIds?.length === 5));
  a.ws.close();
  const disconnected = await b.wait(snapshot(frame => frame.visitors[0]?.disconnected));
  assert.equal(disconnected.connected, 0);
  assert.deepEqual(disconnected.discoverable, []);
});

test('opaque invitations route to the exact room, preserve sessions and respect capacity', async t => {
  const name = room('invites');
  const host = await connect(name);
  t.after(() => host.ws.close());
  const initial = await host.join('Host');
  const response = await fetch(`${origin}/api/invite?room=${name}`, {method:'POST', headers:{Origin:origin, Cookie:host.cookie}});
  assert.equal(response.status, 200, await response.clone().text());
  const url = new URL((await response.json()).link);
  assert.match(url.pathname, /^\/cafe\/join\/[\da-f]{32}$/);
  assert.equal(url.search, '');
  assert.ok(!url.href.includes(name) && !url.href.includes(initial.self));
  const token = url.pathname.split('/').at(-1);
  const landing = await fetch(url, {redirect:'manual'});
  assert.equal(landing.status, 302);
  assert.equal(new URL(landing.headers.get('location')).searchParams.get('invite'), token);
  const invalid = await fetch(`${origin}/api/guest?invite=${'0'.repeat(32)}`, {method:'POST', headers:{Origin:origin}});
  assert.equal(invalid.status, 410);
  const resumed = await connect('main', host.cookie, token);
  t.after(() => resumed.ws.close());
  const reclaimed = await resumed.wait(snapshot(frame => frame.self === initial.self));
  assert.equal(reclaimed.visitors[0].seatId, initial.visitors[0].seatId);
  const guests = await Promise.all(Array.from({length:25}, () => connect('main', undefined, token)));
  t.after(() => guests.forEach(client => client.ws.close()));
  await Promise.all(guests.slice(0,24).map((client,i) => client.join(`Invited ${i}`)));
  const full = await resumed.wait(snapshot(frame => frame.visitors.length === 25));
  assert.equal(new Set(full.visitors.map(person => person.seatId)).size, 25);
  guests[24].send('JOIN_ROOM', {profile:{name:'Overflow', animal:'fox', work:'', presence:'Available'}});
  await guests[24].wait(error('ROOM_FULL'));
});

test('invitation expiry uses a strict cutoff', async () => {
  const {activeInvitation} = await import('../lib/invitations.ts');
  const invite = {token: 'token', room: 'main', expires: 200};
  assert.equal(activeInvitation(invite, 199), true);
  assert.equal(activeInvitation(invite, 200), false);
  assert.equal(activeInvitation(undefined, 199), false);
});

test('public chat masks explicit text for the sender, other visitors, and room history', async t => {
  const name = room('language');
  const sender = await connect(name);
  const receiver = await connect(name);
  t.after(() => [sender, receiver].forEach(({ws}) => ws.close()));
  await sender.join('Maple');
  await receiver.join('Clover');
  sender.send('SEND_PUBLIC_MESSAGE', {body: 'FUCK! Classic café ☕'});
  for (const client of [sender, receiver]) {
    const frame = await client.wait(frame => frame.type === 'PUBLIC_MESSAGE');
    assert.equal(frame.message.body, '****! Classic café ☕');
  }
  receiver.send('REQUEST_ROOM_STATE');
  const history = await receiver.wait(snapshot(frame => frame.messages.length > 0));
  assert.equal(history.messages[0].body, '****! Classic café ☕');
});

test('guestbook notes are room-scoped, filtered, and removable only by their author', async t => {
  const name = room('guestbook');
  const [author, guest, other] = await Promise.all([connect(name), connect(name), connect(room('other-book'))]);
  t.after(() => [author, guest, other].forEach(({ws}) => ws.close()));
  await author.join('Maple');
  await guest.join('Clover');
  await other.join('Fern');
  guest.send('WATCH_GUESTBOOK', {active: true});
  await guest.wait(frame => frame.type === 'GUESTBOOK' && frame.notes.length === 0);
  const id = crypto.randomUUID();
  author.send('POST_GUESTBOOK_NOTE', {id, body: 'Finished the café outline. Fuck yeah!'});
  const gotNote = frame => frame.type === 'GUESTBOOK' && frame.notes[0]?.id === id;
  const [posted, received] = await Promise.all([author.wait(gotNote), guest.wait(gotNote)]);
  assert.equal(posted.notes[0].own, true);
  assert.equal(received.notes[0].own, false);
  assert.equal(received.notes[0].body, 'Finished the café outline. **** yeah!');
  assert.ok(!Object.hasOwn(received.notes[0], 'guest'));
  other.send('WATCH_GUESTBOOK', {active: true});
  assert.deepEqual((await other.wait(frame => frame.type === 'GUESTBOOK')).notes, []);
  guest.send('REMOVE_GUESTBOOK_NOTE', {id});
  await guest.wait(error('GUESTBOOK_NOTE'));
  author.ws.close();
  const again = await connect(name, author.cookie);
  t.after(() => again.ws.close());
  await again.wait(snapshot(frame => Boolean(frame.self)));
  again.send('WATCH_GUESTBOOK', {active: true});
  assert.equal((await again.wait(gotNote)).notes[0].own, true);
  again.send('REMOVE_GUESTBOOK_NOTE', {id});
  await guest.wait(frame => frame.type === 'GUESTBOOK' && frame.notes.length === 0);
});

test('seat confirmations belong to the requester and a different visitor id cannot move anyone', async t => {
  const name = room('seat-identity');
  const a = await connect(name);
  const b = await connect(name);
  t.after(() => [a,b].forEach(({ws}) => ws.close()));
  const one = await a.join('Clover');
  const two = await b.join('Juniper');
  const originalA = one.visitors.find(v => v.id === one.self).seatId;
  const originalB = two.visitors.find(v => v.id === two.self).seatId;
  const invalid = crypto.randomUUID();
  a.send('CHANGE_SEAT', {seatId: 'window-1', visitorId: two.self, requestId: invalid});
  const denied = await a.wait(snapshot(frame => frame.seatRequestId === invalid));
  assert.equal(denied.visitors.find(v => v.id === one.self).seatId, originalA);
  assert.equal(denied.visitors.find(v => v.id === two.self).seatId, originalB);
  await a.wait(error('SESSION_CHANGED'));
  const requestId = crypto.randomUUID();
  a.send('CHANGE_SEAT', {seatId: 'window-1', visitorId: one.self, requestId});
  const accepted = await a.wait(snapshot(frame => frame.seatRequestId === requestId));
  assert.equal(accepted.self, one.self);
  assert.equal(accepted.visitors.find(v => v.id === one.self).seatId, 'window-1');
  assert.equal(accepted.visitors.find(v => v.id === two.self).seatId, originalB);
  const observed = await b.wait(snapshot(frame => frame.visitors.some(v => v.id === one.self && v.seatId === 'window-1')));
  assert.equal(observed.seatRequestId, undefined);
});
