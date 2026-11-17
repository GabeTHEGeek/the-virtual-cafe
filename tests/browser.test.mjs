import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const origin = process.env.CAFE_TEST_ORIGIN || 'http://127.0.0.1:8787';
const launchOptions = process.env.CAFE_TEST_BROWSER_CHANNEL ? {channel: process.env.CAFE_TEST_BROWSER_CHANNEL} : {};
const button = (page, name) => page.getByRole('button', {name, exact: typeof name === 'string'});

async function chooseOption(page, menu, option) {
  await button(page, menu).click();
  await page.getByRole('group', {name: `${menu} options`}).getByRole('button', {name: option, exact: true}).click();
}

async function join(page, url, name, presence) {
  await page.goto(url);
  await page.getByText('Connecting to the café…').waitFor({state: 'hidden'});
  await page.getByRole('textbox', {name: 'Nickname'}).fill(name);
  if (presence) await page.getByRole('combobox', {name: 'Starting presence'}).selectOption(presence);
  await button(page, 'Take a seat').click();
  await page.locator('.own-seat').waitFor();
}

test('two browser instances share seats, edit presence, mute chat, and recover on reload', {timeout: 35_000}, async t => {
  const url = `${origin}/?room=browser-${crypto.randomUUID().slice(0, 8)}`;
  const first = await chromium.launch(launchOptions);
  t.after(() => first.close());
  const second = await chromium.launch(launchOptions);
  t.after(() => second.close());
  const a = await first.newPage({viewport: {width: 1440, height: 900}});
  const b = await second.newPage({viewport: {width: 1366, height: 768}});
  a.setDefaultTimeout(6500);
  b.setDefaultTimeout(6500);
  await join(a, url, 'Mochi');
  await join(b, url, 'Juniper', 'Available');
  const aOnB = button(b, /^Mochi, /);
  await aOnB.waitFor();
  await button(a, /^Juniper, Available/).waitFor();
  const board = a.getByRole('status', {name: 'Café welcome board'});
  await board.getByText('Juniper just joined', {exact: true}).waitFor();
  assert.ok(await a.getByRole('img', {name: 'Owl barista behind the counter'}).evaluate(image => image.complete && image.naturalWidth > 0));
  assert.notEqual(await a.locator('.own-seat').getAttribute('id'), await b.locator('.own-seat').getAttribute('id'));

  await button(a, 'Change seat').click();
  await button(a, 'Move to Window Bar seat 1').click();
  await button(b, /Mochi, Focused, Window Bar/).waitFor();
  const seat = 'seat-window-1';
  await a.locator(`#${seat}.own-seat`).waitFor();
  for (const page of [a, b]) await page.evaluate(() => {
    window.registerPlays = 0;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      const started = play.call(this);
      if (this.src.endsWith('/audio/register.m4a')) void started.then(() => window.registerPlays++);
      return started;
    };
  });
  await button(a, 'Order snacks from the barista').click();
  const menu = a.getByRole('dialog', {name: 'Barista menu'});
  await menu.waitFor();
  const bounds = await menu.boundingBox();
  const viewport = a.viewportSize();
  assert.ok(bounds.width >= 650);
  assert.ok(Math.abs(bounds.x + bounds.width / 2 - viewport.width / 2) < 2);
  assert.ok(Math.abs(bounds.y + bounds.height / 2 - viewport.height / 2) < 2);
  assert.equal(await menu.locator('li').count(), 10);
  await a.waitForFunction(() => [...document.querySelectorAll('.snack-menu img')].every(img => img.complete && img.naturalWidth));
  assert.ok(await button(a, 'Order').isDisabled());
  await button(a, 'Butter croissant').click();
  await button(a, 'Café latte').click();
  assert.equal(await b.locator('.seat-snack, .seat-drink').count(), 0);
  await button(a, 'Order').click();
  const snack = page => page.locator('.seat-snack[src$="/croissant.webp"]');
  await snack(a).waitFor();
  await snack(b).waitFor();
  await b.locator('.seat-drink[src$="/latte.webp"]').waitFor();
  await menu.waitFor({state: 'hidden'});
  await a.waitForFunction(() => window.registerPlays === 1);
  assert.equal(await b.evaluate(() => window.registerPlays), 0);
  const barPosition = await snack(b).getAttribute('style');
  await button(a, 'Change seat').click();
  await button(a, 'Move to Window Bar seat 2').click();
  await b.waitForFunction(previous => document.querySelector('.seat-snack')?.getAttribute('style') !== previous, barPosition);
  await button(a, 'Change seat').click();
  await button(a, 'Move to Window Bar seat 1').click();

  await chooseOption(a, 'Your presence', 'Away');
  await button(b, /Mochi, Away, Window Bar/).waitFor();
  await a.reload();
  await a.locator('.own-seat').waitFor();
  assert.equal(await a.locator('.own-seat').getAttribute('id'), seat);

  await button(a, 'Chat').click();
  const longMessage = 'Hello from another browser. ' + 'This is a longer message about what I am working on. '.repeat(4).trim();
  await a.getByRole('textbox', {name: 'Public message'}).fill(longMessage);
  await b.locator('.typing-bubble').waitFor();
  assert.equal(await b.locator('.chat-unread').count(), 0);
  await button(a, 'Send').click();
  await b.locator('.typing-bubble').waitFor({state:'detached'});
  await b.locator('.chat-unread').waitFor();
  await button(b, 'Chat, unread messages').click();
  assert.equal(await b.locator('.chat-unread').count(), 0);
  await b.getByRole('log').getByText(/Hello from another browser/).waitFor();
  const bubble = b.locator('.public-message-bubble');
  await bubble.waitFor();
  assert.equal(await bubble.textContent(), longMessage);
  assert.ok(await bubble.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const scene = element.parentElement.getBoundingClientRect();
    return parseFloat(getComputedStyle(element).fontSize) >= 15
      && element.scrollHeight <= element.clientHeight + 1
      && bounds.left >= scene.left && bounds.right <= scene.right
      && bounds.top >= scene.top && bounds.bottom <= scene.bottom;
  }));
  await bubble.waitFor({state: 'detached', timeout: 17_000});

  await button(b, 'Close chat').click();
  await aOnB.click();
  await button(b, 'Mute').click();
  await button(b, 'Close profile').click();
  await button(b, 'Chat').click();
  await a.getByRole('textbox', {name: 'Public message'}).fill('Muted message QA');
  await button(a, 'Send').click();
  await a.getByRole('log').getByText(/Muted message QA/).waitFor();
  await delay(150);
  assert.equal(await b.getByRole('log').getByText(/Muted message QA/).count(), 0);

  await button(a, 'Close chat').click();
  const sprite = a.locator('.own-seat .guest-sprite');
  const originalWidth = (await sprite.boundingBox()).width;
  await button(a, /Mochi \(you\)/).click();
  await button(a, 'Edit profile').click();
  await a.getByRole('textbox', {name: 'Display name'}).fill('brandon chops');
  await button(a, 'Save profile').click();
  await button(a, /brandon chops \(you\)/).waitFor();
  assert.equal((await sprite.boundingBox()).width, originalWidth);

  await button(b, 'Close chat').click();
  await button(b, /^brandon chops, /).click();
  await button(b, 'Block').click();
  await button(b, 'People').click();
  await b.getByText('Blocked visitors (1)', {exact: true}).click();
  await button(b, 'Unblock brandon chops').click();
  await b.getByText('Blocked visitors (0)', {exact: true}).waitFor();
  await button(b, "Open brandon chops's profile").waitFor();

});

test('local preview preserves occupancy controls, Lo-fi autoplay, and opt-in rain', {timeout: 20_000}, async t => {
  const browser = await chromium.launch(launchOptions);
  t.after(() => browser.close());
  const page = await browser.newPage({viewport: {width: 1440, height: 900}});
  await page.goto(origin + '/?preview=1');
  await button(page, 'Browse café').click();
  const night = button(page, 'Night mode');
  await night.click();
  assert.equal(await night.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.room-art').getAttribute('src'), '/art/cafe-night.webp');
  await page.locator('.room-art').evaluate(img => img.decode());
  assert.equal(await page.locator('.furniture-foreground image').getAttribute('href'), '/art/cafe-night.webp');
  assert.equal(await page.locator('.fireplace-art').getAttribute('src'), '/art/fireplace-night.webp');
  await page.locator('.fireplace-art').evaluate(img => img.decode());
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[aria-label="Night mode"]')?.getAttribute('aria-pressed') === 'true');
  await night.click();
  assert.equal(await page.locator('.room-art').getAttribute('src'), '/art/cafe.webp');
  await button(page, 'Browse café').click();

  const preview = page.getByRole('combobox', {name: 'Developer preview occupancy'});
  const hearth = page.locator('.fireplace-art');
  const lantern = page.locator('.lantern-light').first();
  await hearth.waitFor();
  await hearth.evaluate(image => image.decode());
  for (const reducedMotion of ['no-preference', 'reduce']) {
    await page.emulateMedia({reducedMotion});
    const firstFrame = await hearth.screenshot();
    await page.waitForTimeout(220);
    assert.notDeepEqual(await hearth.screenshot(), firstFrame);
    const initialOpacity = await lantern.getAttribute('opacity');
    await page.waitForFunction(initial => {
      const light = document.querySelector('.lantern-light');
      return light && Math.abs(Number(light.getAttribute('opacity')) - Number(initial)) > .14;
    }, initialOpacity);
  }
  await page.emulateMedia({reducedMotion: 'no-preference'});
  for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080]]) {
    await page.setViewportSize({width, height});
    const room = await page.locator('.room-art').boundingBox();
    assert.equal(room.x, 0);
    assert.equal(room.width, width);
    assert.ok(Math.abs(room.y + room.height - height) < 1);
  }
  for (const count of [0, 5, 15, 25]) {
    await preview.selectOption(String(count));
    await page.waitForFunction(expected => document.querySelectorAll('.occupied').length === expected, count);
  }
  assert.ok(await page.locator('.furniture-foreground mask').count());
  assert.ok(await page.locator('.table-laptop').count());
  assert.ok(await page.locator('.lap-laptop').count());
  await page.waitForFunction(() => {
    const [music, ambience] = document.querySelectorAll('.audio-player audio');
    return music.src.endsWith('/lofi.m4a') && !music.paused && music.currentTime > 0 && ambience.paused;
  });
  await button(page, 'Play soundscape').click();
  await page.waitForFunction(() => Array.from(document.querySelectorAll('audio')).every(audio => !audio.paused && audio.readyState >= 2));
  await page.locator('.window-rain').waitFor();
  for (const [label, file] of [['Storm', 'storm-rolling'], ['Birdsong', 'birds-clear'], ['Fireplace', 'fireplace'],
    ['Ocean', 'ocean'], ['Forest', 'forest'], ['Camping', 'camping-night'], ['White Noise', 'white-noise']]) {
    await chooseOption(page, 'Soundscape', label);
    await page.waitForFunction(name => Array.from(document.querySelectorAll('audio')).some(audio =>
      audio.src.endsWith(`/${name}.m4a`) && !audio.paused && audio.readyState >= 2), file);
    assert.equal((await page.locator('.window-rain').count()) > 0, file === 'storm-rolling');
  }
  assert.equal(await page.locator('.window-rain').count(), 0);
  await button(page, 'Pause music').click();
  await button(page, 'Pause soundscape').click();
  await page.waitForFunction(() => Array.from(document.querySelectorAll('audio')).every(audio => audio.paused));
});

test('People filters live visitors and invites a new browser to the same room', {timeout: 35000}, async t => {
  const browser = await chromium.launch(launchOptions);
  t.after(() => browser.close());
  const a = await browser.newPage({viewport: {width: 1366, height: 768}});
  const b = await browser.newPage({viewport: {width: 1366, height: 768}});
  for (const page of [a,b]) page.setDefaultTimeout(6500);
  const url = `${origin}/?room=social-${crypto.randomUUID().slice(0, 8)}`;
  await a.goto(url);
  await a.getByText('Connecting to the café…').waitFor({state:'hidden'});
  await a.getByRole('textbox', {name:'Nickname'}).fill('Cleo');
  await a.locator('.interest-picker summary').click();
  for (const interest of ['Design','Writing','Books','Travel','Art']) await a.getByRole('checkbox', {name:interest, exact:true}).check();
  assert.ok(await a.getByRole('checkbox', {name:'Gaming', exact:true}).isDisabled());
  await a.locator('.interest-picker summary').click();
  await button(a,'Take a seat').click();
  await a.locator('.own-seat').waitFor();

  await button(a,'Invite').click();
  await a.getByRole('textbox', {name:'Invite link'}).waitFor();
  const invite = await a.getByRole('textbox', {name:'Invite link'}).inputValue();
  await button(a,'Close invitation').click();

  await b.goto(invite);
  await b.getByText('Connecting to the café…').waitFor({state:'hidden'});
  await b.getByRole('textbox', {name:'Nickname'}).fill('Fern');
  await b.getByRole('textbox', {name:/Working on/}).fill('A seaside novel');
  await b.locator('.interest-picker summary').click();
  await b.getByRole('checkbox', {name:'Books', exact:true}).check();
  await b.locator('.interest-picker summary').click();
  await button(b,'Take a seat').click();
  await button(a,/Fern, Focused/).waitFor();
  await button(a,'People').click();
  const search = a.getByRole('searchbox', {name:'Search people'});
  const profile = button(a,"Open Fern's profile");
  for (const term of [' FeRN ', ' seaside NOVEL ', ' Books ']) {
    await search.fill(term);
    await profile.waitFor();
  }
  await search.fill('Gaming');
  await profile.waitFor({state:'detached'});
  await search.fill('');
  await button(a,'Available').click();
  await profile.waitFor({state:'detached'});
  await chooseOption(b, 'Your presence', 'Available');
  await profile.waitFor();
  await button(a,'Shared Interests').click();
  await profile.waitFor();
  await profile.click();
  await button(a,'Locate').click();
  await a.getByRole('button', {name:/Fern, Available/}).and(a.locator('.located-seat')).waitFor();
  await button(a,/Fern, Available/).click();
  await button(a,'Block').click();
  await a.getByText('Visitor blocked.').waitFor();
  await button(a,'People').click();
  await profile.waitFor({state:'detached'});
  await b.reload();
  await b.locator('.own-seat').waitFor();
  await a.setViewportSize({width:390,height:780});
  assert.ok(await a.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const c = await browser.newPage({viewport:{width:1366,height:768}});
  await join(c, origin + '/?room=other-' + crypto.randomUUID().slice(0,8), 'Pip');
  await button(c,'Invite').click();
  const otherLink = c.getByRole('textbox',{name:'Invite link'});
  await otherLink.waitFor();
  await b.goto(await otherLink.inputValue());
  await b.locator('.own-seat').waitFor();
  await button(b,/Pip, Focused/).waitFor();
  assert.equal(await b.getByRole('textbox',{name:'Nickname'}).count(), 0);
  await b.goto(origin + '/cafe/join/' + '0'.repeat(32));
  await b.getByText('This invitation is invalid or has expired.').waitFor();
});

test('Pomodoro continues behind the closed panel and chimes on completion', {timeout: 20000}, async t => {
  const browser = await chromium.launch(launchOptions);
  t.after(() => browser.close());
  const page = await browser.newPage({viewport: {width: 390, height: 710}});
  await page.addInitScript(() => {
    window.chimeNotes = [];
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args) {
      window.chimeNotes.push(args[0]);
      return start.apply(this, args);
    };
  });
  await page.clock.install();
  await page.goto(origin + '/?preview=1');
  await button(page, 'Browse café').click();
  await button(page, 'Pomodoro timer').click();
  const panel = page.getByRole('dialog', {name: 'Pomodoro'});
  const clock = panel.getByRole('timer');
  assert.equal(await clock.textContent(), '25:00');
  const length = panel.getByRole('combobox', {name: 'Session length'});
  await button(page, 'Break · 5 min').click();
  await length.selectOption('3');
  assert.equal(await clock.textContent(), '03:00');
  await button(page, 'Focus · 25 min').click();
  await length.selectOption('15');
  assert.equal(await clock.textContent(), '15:00');
  await panel.getByRole('textbox', {name: 'New checklist task'}).fill('Outline proposal');
  await button(page, 'Add').click();
  await panel.getByRole('checkbox', {name: 'Outline proposal'}).check();
  await panel.getByRole('combobox', {name: 'Chime'}).selectOption('Wood tones');
  await button(page, 'Preview').click();
  await page.waitForFunction(() => window.chimeNotes.length === 3);
  await button(page, 'Start').click();
  await page.clock.fastForward(60_000);
  await button(page, 'Pause').click();
  const pausedTime = await clock.textContent();
  await page.clock.fastForward(60_000);
  assert.equal(await clock.textContent(), pausedTime);
  await button(page, 'Resume').click();
  await button(page, 'Close Pomodoro').click();
  await page.clock.fastForward(15 * 60_000);
  await button(page, 'Pomodoro timer').getByText('Break ready').waitFor();
  await page.waitForFunction(() => window.chimeNotes.length === 12);
  const [first, second, third] = await page.evaluate(() => [window.chimeNotes[3], window.chimeNotes[6], window.chimeNotes[9]]);
  assert.ok(Math.abs(second - first - 2) < .001 && Math.abs(third - second - 2) < .001);
  await button(page, 'Pomodoro timer').click();
  assert.equal(await clock.textContent(), '03:00');
  await panel.getByRole('combobox', {name: 'Chime'}).selectOption('Silent');
  assert.ok(await button(page, 'Preview').isDisabled());
  await button(page, 'Start').click();
  await button(page, 'Reset').click();
  assert.equal(await clock.textContent(), '03:00');
  await page.reload();
  await button(page, 'Browse café').click();
  await button(page, 'Pomodoro timer').click();
  assert.ok(await panel.getByRole('checkbox', {name: 'Outline proposal'}).isChecked());
  await button(page, 'Remove Outline proposal').click();
  await panel.getByRole('checkbox', {name: 'Outline proposal'}).waitFor({state: 'detached'});
});

test('the café guestbook shows new notes to other visitors', {timeout: 20000}, async t => {
  const browser = await chromium.launch(launchOptions);
  t.after(() => browser.close());
  const [a,b] = await Promise.all([browser.newPage(), browser.newPage()]);
  const url = `${origin}/?room=book-${crypto.randomUUID().slice(0, 8)}`;
  await join(a, url, 'Maple');
  await join(b, url, 'Clover');
  for (const page of [a,b]) await button(page, 'Guestbook').click();
  const book = page => page.getByRole('region', {name: 'Café guestbook'});
  const field = book(a).getByRole('textbox', {name: 'What did you make or accomplish today?'});
  await field.fill('Finished my first café sketch.');
  await button(a, 'Post note').click();
  await book(b).getByText('Finished my first café sketch.', {exact: true}).waitFor();
  assert.equal(await field.inputValue(), '');
  await button(a, 'Remove your note').click();
  await book(b).getByText('No notes yet.').waitFor();
});

test('first entries chime, treats reach another seat, and postcards save and share', {timeout: 30000}, async t => {
  const browser = await chromium.launch(launchOptions);
  t.after(() => browser.close());
  const [a, b] = await Promise.all([browser.newPage({acceptDownloads: true}), browser.newPage()]);
  for (const page of [a,b]) await page.addInitScript(() => {
    window.entryChimes = 0;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      const started = play.call(this);
      if (this.src.endsWith('/cafe-entry.m4a')) void started.then(() => window.entryChimes++).catch(() => {});
      return started;
    };
  });
  const url = `${origin}/?room=postcard-${crypto.randomUUID().slice(0, 8)}`;
  const betaCode = process.env.CAFE_TEST_BETA_CODE;
  if (betaCode) for (const page of [a,b]) {
    const response = await page.request.post(origin + '/beta/unlock', {
      headers: {Origin: origin}, form: {code: betaCode}, maxRedirects: 0,
    });
    assert.equal(response.status(), 303);
  }
  await join(a, url, 'Maple');
  await a.waitForFunction(() => window.entryChimes === 1);
  await join(b, url, 'Clover');
  await b.waitForFunction(() => window.entryChimes === 1);
  assert.equal(await a.evaluate(() => window.entryChimes), 1);
  await b.reload();
  await b.locator('.own-seat').waitFor();
  assert.equal(await b.evaluate(() => window.entryChimes), 0);

  await button(a, /^Clover, /).click();
  await button(a, 'Send treat').click();
  const menu = a.getByRole('dialog', {name: 'Barista menu'});
  assert.notEqual(await menu.getByRole('combobox', {name: 'Deliver to'}).inputValue(), '');
  await button(a, 'Café latte').click();
  await menu.getByRole('button', {name: 'Send treat', exact: true}).click();
  await b.getByText('Maple sent you Café latte.', {exact: true}).waitFor();
  await b.locator('.seat-drink[src$="/latte.webp"]').waitFor();

  await button(a, 'Night mode').click();
  await button(a, 'Postcard').click();
  const card = a.getByRole('dialog', {name: 'Café postcard'});
  await card.getByRole('textbox', {name: 'What did you finish today?'}).fill('Finished my sketch <3');
  await card.locator('.postcard-preview').evaluate(image => image.decode());
  const download = a.waitForEvent('download');
  await card.getByRole('button', {name: 'Save PNG'}).click();
  const file = await download;
  assert.equal(file.suggestedFilename(), 'virtual-cafe-postcard.png');
  assert.equal(await file.failure(), null);
  await card.getByRole('button', {name: 'Create public link'}).click();
  const link = card.getByRole('textbox', {name: 'Anyone with this link can view your postcard.'});
  await link.waitFor();
  const share = await browser.newPage();
  const publicUrl = await link.inputValue();
  assert.equal((await share.goto(publicUrl)).status(), 200);
  assert.equal(await share.locator('meta[property="og:description"]').getAttribute('content'), 'Finished my sketch <3');
  const previewUrl = await share.locator('meta[property="og:image"]').getAttribute('content');
  assert.match(previewUrl, /\/night\.jpg$/);
  assert.equal((await share.request.head(previewUrl)).headers()['content-type'], 'image/jpeg');
  const publicArt = share.locator('main img');
  await publicArt.evaluate(image => image.decode());
  assert.equal(await publicArt.evaluate(image => image.naturalWidth), 1200);
  const tampered = publicUrl.replace(/(\/postcard\/)[A-Za-z0-9_-]/, (_, prefix) => prefix + (publicUrl.includes('/postcard/A') ? 'B' : 'A'));
  assert.equal((await share.request.get(tampered)).status(), 404);
  if (betaCode) {
    await share.goto(origin);
    await share.getByText('Enter your private beta access code').waitFor();
    assert.equal((await share.request.get(origin + '/art/cafe.webp')).status(), 403);
  }
});
