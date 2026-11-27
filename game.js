/* Turkey Day Takedown — a 3/4-view Thanksgiving arena shooter. */
(() => {
'use strict';

// ---------- utilities ----------
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const lerp = (a, b, t) => a + (b - a) * t;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ---------- assets ----------
const ASSET_NAMES = ['grandpa','grandma','teen','kidred','kidstripe','turkey','potato','corn','pumpkin','cranberry','boss',
  'w_gravy','w_cran','w_corn','w_bomb','w_pie','hay','table','gravyboat','slice','w_mac','scrap'];
const AN = window.ANIM || {};
const IMG = {};
const WHITE = {}; // white silhouettes for hit flashes
function loadAssets() {
  const list = ASSET_NAMES.map(n => [n, `assets/${n}.png`]).concat([['floor', 'assets/floor.jpg']])
    .concat(Object.keys(AN).map(n => ['anim_' + n, `assets/anim/${n}.webp`]));
  return Promise.all(list.map(([n, src]) => new Promise(res => {
    const im = new Image();
    im.onload = () => { IMG[n] = im; res(); };
    im.onerror = () => { console.warn('missing', src); res(); };
    im.src = src;
  })));
}
function whiteOf(name) {
  if (WHITE[name]) return WHITE[name];
  const im = IMG[name]; if (!im) return null;
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  return (WHITE[name] = c);
}

// ---------- data ----------
const CHARS = {
  grandpa:   { name:'Jan',          role:'The Gravy Baron', hp:130, speed:245, perk:'Gravy Gun hits 40% harder and splashes more slick puddles.', gravyMul:1.4, puddleMul:2 },
  grandma:   { name:'Grandma',      role:'Pie Commander',   hp:120, speed:250, perk:'Starts with a stack of Pie Frisbees. Pie slices heal double.', startPie:20, healMul:2 },
  teen:      { name:'Eli',          role:'Junkyard Inventor', hp:100, speed:265, perk:'Picks up junk scraps. Collect 5 and he builds a Mac & Cheese Blaster that traps enemies in sticky cheese webs for 10s!', rateMul:0.85, startCorn:250, special:'scrap' },
  kidred:    { name:'Issac',        role:'Human Cannonball', hp:85,  speed:315, perk:'Super speedy. SPECIAL: winds up, then charges like crazy, smashing through enemy after enemy!', dashCd:0.45, special:'charge' },
  kidstripe: { name:'Ben',          role:'Trash Talker',    hp:90,  speed:290, perk:'Starts with 6 Stuffing Bombs with bigger blasts, and roasts every enemy he takes out.', bombs:6, bombMul:1.5, special:'taunt' },
};
const CHAR_ORDER = ['grandpa','grandma','teen','kidred','kidstripe'];

const WEAPONS = {
  gravy: { name:'Gravy Gun',            img:'w_gravy', rate:0.15, dmg:12, speed:720, spread:0.05, count:1, r:9,  life:1.2, color:'#8a5523', hi:'#c58a4a', ammo:Infinity },
  cran:  { name:'Cranberry Blunderbuss',img:'w_cran',  rate:0.55, dmg:10, speed:680, spread:0.55, count:7, r:7,  life:0.45, color:'#b0102a', hi:'#ff5a6e', pickup:40 },
  corn:  { name:'Corn Gatling',         img:'w_corn',  rate:0.07, dmg:6,  speed:950, spread:0.13, count:1, r:5,  life:0.7, color:'#f4c430', hi:'#fff2a0', pickup:300 },
  mac:   { name:'Mac & Cheese Blaster', img:'w_mac',   rate:0.2,  dmg:16, speed:620, spread:0.08, count:1, r:13, life:1.0, color:'#ffb627', hi:'#fff1a8', special:true },
  pie:   { name:'Pie Frisbee',          img:'w_pie',   rate:0.45, dmg:34, speed:620, spread:0,    count:1, r:22, life:1.4, pierce:true, boomerang:true, pickup:16 },
};
const WEAPON_ORDER = ['gravy','cran','corn','pie'];

const ENEMIES = {
  turkey:    { img:'turkey',    hp:30,  speed:150, r:26, h:84,  dmg:12, score:100, ai:'charge', face:-1, gobble:true, hip:0.74, mass:1, stride:0.3 },
  potato:    { img:'potato',    hp:45,  speed:72,  r:26, h:70,  dmg:10, score:80,  ai:'chase',  face:1, split:true, hip:0.8, mass:1.4, stride:0.2 },
  tot:       { img:'potato',    hp:12,  speed:125, r:14, h:38,  dmg:6,  score:30,  ai:'chase',  face:1, hip:0.8, mass:0.5, stride:0.2 },
  cranberry: { img:'cranberry', hp:14,  speed:150, r:17, h:46,  dmg:8,  score:40,  ai:'hop',    face:1, mass:0.6 },
  corn:      { img:'corn',      hp:35,  speed:95,  r:22, h:86,  dmg:10, score:120, ai:'ranged', face:1, hip:0.8, mass:1, stride:0.26 },
  pumpkin:   { img:'pumpkin',   hp:190, speed:52,  r:42, h:118, dmg:20, score:250, ai:'chase',  face:1, heavy:true, hip:0.8, mass:3, stride:0.24 },
  boss:      { img:'boss',      hp:2400,speed:95,  r:85, h:270, dmg:25, score:5000,ai:'boss',   face:-1, heavy:true, gobble:true, hip:0.78, mass:6, stride:0.26 },
};

const ARENA = { w: 2400, h: 1600 };

// Ben's trash talk: rude, but kid-friendly
const TAUNTS = {
  any: ['Get stuffed, nerd!', 'Smell ya later, loser!', 'Too slow, slowpoke!', 'Cry about it!', 'Bye-bye, dumdum!', 'You got roasted!',
    'Lame-o!', 'Nice try, dorkasaurus!', 'Sit DOWN!', 'Go home, stinky!', 'Is that all you got?!', 'Ha! Wimp!', 'Eat my dust, weirdo!',
    'You smell like old gravy!', 'Booo! Next!', 'Get wrecked, goofball!', 'Your mom is a casserole!', 'Ha-ha! Butt-face!'],
  turkey: ['Gobble THIS, birdbrain!', 'Bye-bye, butterball!', 'Who\'s the turkey now?!', 'Go back in the oven, featherbutt!'],
  potato: ['Mashed ya, spud-face!', 'Get baked, potato brain!', 'Couch potato!', 'Sit down, tater tot!'],
  tot: ['Tiny tot, tiny brain!', 'Go cry, baby potato!'],
  corn: ['Pop goes the corn dork!', 'Shucked ya, corn-head!', 'You\'re a-maize-ingly bad!', 'Cob-loser!'],
  pumpkin: ['Smashed, pumpkin butt!', 'Big head, no brain!', 'Pie filling now, dummy!'],
  cranberry: ['Jelly belly jerk!', 'Splat! Stay in the can!', 'Wobble wobble, loser!'],
  boss: ['WHO\'S THE TURKEY NOW, BIG BABY?!', 'Gobble-ZILLA? More like Gobble-LOSER!', 'Bye-bye, giant butterball!'],
};
const POW = ['POW!', 'BAM!', 'WHAM!', 'KAPOW!', 'BONK!', 'SMACK!', 'BOOM!'];


// ---------- canvas ----------
const cv = $('game');
const ctx = cv.getContext('2d');
let VW = 0, VH = 0, DPR = 1, ZOOM = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  VW = window.innerWidth; VH = window.innerHeight;
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
  ZOOM = clamp(Math.sqrt(VW * VH) / 880, 0.55, 2.2);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.visualViewport) visualViewport.addEventListener('resize', resize);
resize();

// ---------- audio (synthesised) ----------
const Sfx = (() => {
  let ac = null, master = null, muted = store.get('tg_muted', false);
  const ensure = () => {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ac.destination); }
      catch { return false; }
    }
    if (ac.state === 'suspended') ac.resume();
    return true;
  };
  let noiseBuf = null;
  const noise = () => {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  };
  const last = {};
  const throttle = (k, ms) => { const t = performance.now(); if (last[k] && t - last[k] < ms) return true; last[k] = t; return false; };
  function tone({ f = 440, f2 = null, type = 'square', dur = 0.1, vol = 0.2, delay = 0 }) {
    if (!ac || muted) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(f2, 1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function burst({ dur = 0.3, vol = 0.4, freq = 800, q = 1, type = 'lowpass', delay = 0 }) {
    if (!ac || muted) return;
    const t = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = noise();
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(freq, t); fl.frequency.exponentialRampToValueAtTime(60, t + dur); fl.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
  }
  return {
    unlock: ensure,
    get muted() { return muted; },
    toggle() { muted = !muted; store.set('tg_muted', muted); if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    shoot(w) {
      if (throttle('shoot', 45)) return;
      if (w === 'gravy') { burst({ dur: 0.09, vol: 0.18, freq: 900, type: 'bandpass', q: 3 }); tone({ f: 220, f2: 120, type: 'sine', dur: 0.08, vol: 0.12 }); }
      else if (w === 'cran') { burst({ dur: 0.25, vol: 0.4, freq: 1500 }); tone({ f: 140, f2: 50, type: 'triangle', dur: 0.2, vol: 0.25 }); }
      else if (w === 'corn') { tone({ f: rand(700, 900), f2: 300, type: 'square', dur: 0.04, vol: 0.06 }); }
      else if (w === 'pie') { tone({ f: 300, f2: 900, type: 'sine', dur: 0.18, vol: 0.12 }); }
    },
    hit() { if (throttle('hit', 40)) return; burst({ dur: 0.06, vol: 0.15, freq: 2500, type: 'highpass' }); },
    splat() { if (throttle('splat', 60)) return; burst({ dur: 0.15, vol: 0.25, freq: 600 }); tone({ f: 180, f2: 60, type: 'sine', dur: 0.12, vol: 0.18 }); },
    boom() { burst({ dur: 0.7, vol: 0.7, freq: 1200 }); tone({ f: 90, f2: 30, type: 'sine', dur: 0.5, vol: 0.5 }); },
    throw() { tone({ f: 500, f2: 200, type: 'triangle', dur: 0.2, vol: 0.12 }); },
    gobble(pitch = 1) {
      if (throttle('gobble', 350) || !ac || muted) return;
      const t = ac.currentTime;
      const o = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
      o.type = 'sawtooth'; o.frequency.value = 420 * pitch; lfo.frequency.value = 22; lg.gain.value = 140 * pitch;
      lfo.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t);
      for (let i = 0; i < 4; i++) { g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.07 + 0.02); g.gain.exponentialRampToValueAtTime(0.01, t + i * 0.07 + 0.06); }
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      const fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 900 * pitch; fl.Q.value = 2;
      o.connect(fl); fl.connect(g); g.connect(master); o.start(t); lfo.start(t); o.stop(t + 0.35); lfo.stop(t + 0.35);
    },
    hurt() { tone({ f: 300, f2: 90, type: 'sawtooth', dur: 0.25, vol: 0.2 }); },
    windup() { tone({ f: 150, f2: 900, type: 'sawtooth', dur: 0.55, vol: 0.12 }); tone({ f: 300, f2: 1800, type: 'square', dur: 0.55, vol: 0.04 }); },
    clank() { tone({ f: 1200, f2: 600, type: 'square', dur: 0.06, vol: 0.08 }); tone({ f: 1800, f2: 900, type: 'triangle', dur: 0.1, vol: 0.06, delay: 0.04 }); },
    assemble() { [300, 420, 300, 520].forEach((f, i) => tone({ f, f2: f * 0.6, type: 'square', dur: 0.06, vol: 0.09, delay: i * 0.07 })); [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ f, type: 'triangle', dur: 0.14, vol: 0.12, delay: 0.32 + i * 0.07 })); },
    taunt() { if (throttle('taunt', 300)) return; [0, 1, 2].forEach(i => tone({ f: rand(500, 900), f2: rand(400, 1100), type: 'square', dur: 0.06, vol: 0.05, delay: i * 0.07 })); },
    pickup() { [660, 880, 1320].forEach((f, i) => tone({ f, type: 'square', dur: 0.08, vol: 0.08, delay: i * 0.06 })); },
    heal() { [523, 659, 784, 1046].forEach((f, i) => tone({ f, type: 'triangle', dur: 0.12, vol: 0.12, delay: i * 0.07 })); },
    dash() { burst({ dur: 0.18, vol: 0.2, freq: 3000, type: 'bandpass', q: 0.7 }); },
    wave() { [392, 523, 659, 784].forEach((f, i) => tone({ f, type: 'square', dur: 0.15, vol: 0.09, delay: i * 0.1 })); },
    over() { [392, 330, 262, 196].forEach((f, i) => tone({ f, type: 'triangle', dur: 0.3, vol: 0.15, delay: i * 0.22 })); },
  };
})();

// ---------- input ----------
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const keys = {};
const mouse = { x: VW / 2, y: VH / 2, down: false, active: false };
const sticks = { move: null, aim: null }; // {id, ox, oy, x, y}
let wantBomb = false, wantDash = false, wantSwap = 0, wantWeapon = null, wantSpecial = false;

window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (k === ' ' ) { wantBomb = true; e.preventDefault(); }
  if (k === 'shift') wantDash = true;
  if (k === 'q') wantSwap = -1;
  if (k === 'e') wantSwap = 1;
  if (k === 'f') wantSpecial = true;
  if (k >= '1' && k <= '4') wantWeapon = WEAPON_ORDER[+k - 1];
  if (k === 'escape' || k === 'p') togglePause();
  if (k === 'm') toggleMute();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; if (state === 'play') togglePause(); });

cv.addEventListener('contextmenu', e => e.preventDefault());
let hudSlots = []; // tappable weapon/bomb slots, filled by drawHUD
function hudSlotAt(x, y) { return hudSlots.find(r => x >= r.x - 4 && x <= r.x + r.w + 4 && y >= r.y - 4 && y <= r.y + r.w + 4); }
// --- mouse (pointer events) ---
cv.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse') return;
  Sfx.unlock();
  if (state === 'play') {
    const slot = hudSlotAt(e.clientX, e.clientY);
    if (slot) { if (slot.k === 'bomb') wantBomb = true; else if (slot.k === 'special') wantSpecial = true; else if (slot.k !== 'info') selectWeapon(slot.k); return; }
  }
  mouse.active = true; mouse.x = e.clientX; mouse.y = e.clientY;
  if (e.button === 0) mouse.down = true;
  if (e.button === 2) wantDash = true;
});
window.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; } });
window.addEventListener('pointerup', e => { if (e.pointerType === 'mouse' && e.button === 0) mouse.down = false; });

// --- touch (raw touch events: more reliable than pointer events on iOS Safari) ---
cv.addEventListener('touchstart', e => {
  e.preventDefault();
  Sfx.unlock();
  for (const t of e.changedTouches) {
    const x = t.clientX, y = t.clientY;
    if (state === 'play') {
      const slot = hudSlotAt(x, y);
      if (slot) { if (slot.k === 'bomb') wantBomb = true; else if (slot.k === 'special') wantSpecial = true; else if (slot.k !== 'info') selectWeapon(slot.k); continue; }
    }
    const s = { id: t.identifier, ox: x, oy: y, x, y };
    if (x < VW * 0.5) { if (!sticks.move) sticks.move = s; }
    else if (!sticks.aim) sticks.aim = s;
  }
}, { passive: false });
window.addEventListener('touchmove', e => {
  if (state === 'play') e.preventDefault();
  for (const t of e.changedTouches) {
    for (const k of ['move', 'aim']) {
      const s = sticks[k];
      if (s && s.id === t.identifier) {
        s.x = t.clientX; s.y = t.clientY;
        // drag the stick origin along if the finger goes far
        const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy), max = 70;
        if (d > max) { s.ox = s.x - dx / d * max; s.oy = s.y - dy / d * max; }
      }
    }
  }
}, { passive: false });
const endTouch = e => {
  Sfx.unlock();
  for (const t of e.changedTouches)
    for (const k of ['move', 'aim']) if (sticks[k] && sticks[k].id === t.identifier) sticks[k] = null;
  if (e.touches.length === 0) { sticks.move = sticks.aim = null; }
};
window.addEventListener('touchend', endTouch);
window.addEventListener('touchcancel', endTouch);
cv.addEventListener('wheel', e => { wantSwap = e.deltaY > 0 ? 1 : -1; }, { passive: true });
const tapBtn = (id, fn) => {
  const el = $(id);
  el.addEventListener('touchstart', e => { e.stopPropagation(); e.preventDefault(); Sfx.unlock(); fn(); }, { passive: false });
  el.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); Sfx.unlock(); fn(); });
};
tapBtn('tBomb', () => wantBomb = true);
tapBtn('tDash', () => wantDash = true);
tapBtn('tSwap', () => wantSwap = 1);
tapBtn('tSpecial', () => wantSpecial = true);

// ---------- game state ----------
let state = 'title';
let selected = store.get('tg_char', 'grandpa');
const OLD_DEFAULTS = ['Grandpa', 'The Professor', 'Cheeto Kid', "Lil' Stripes"];
const names = Object.assign({}, ...CHAR_ORDER.map(k => ({ [k]: CHARS[k].name })),
  Object.fromEntries(Object.entries(store.get('tg_names', {})).filter(([, v]) => !OLD_DEFAULTS.includes(v))));
let corpses = [], webs = [];
let player, enemies, bullets, ebullets, bombs, particles, puddles, pickups, floaters, props, spawnQueue;
let wave, waveState, waveTimer, score, kills, shake, time, banner, boss, hitStop;
const cam = { x: ARENA.w / 2, y: ARENA.h / 2 };

function newGame() {
  const c = CHARS[selected];
  player = {
    x: ARENA.w / 2, y: ARENA.h / 2 + 120, vx: 0, vy: 0, z: 0, vz: 0, r: 20, h: 96,
    hp: c.hp, maxHp: c.hp, speed: c.speed, ch: selected,
    ammo: { gravy: Infinity, cran: 20, corn: c.startCorn || 0, pie: c.startPie || 0 },
    cur: c.startCorn ? 'corn' : c.startPie ? 'pie' : 'gravy',
    bombs: c.bombs || 3, fireCd: 0, dashCd: 0, dashT: 0, dashDir: [0, 0], inv: 0,
    face: 1, aim: 0, moving: false, flash: 0, bombCd: 0,
    // animation / body dynamics
    dir: 'front', flipX: false, dirHold: 0, stride: 0, frame: 1, lastFrame: 1, bodyAng: Math.PI / 2,
    lastFire: 9, lean: 0, leanV: 0, sq: 0, sqV: 0, hurtT: 0, victoryT: 0, dead: false, deadT: 0, gunAng: Math.PI / 2,
    scraps: 0, macT: 0, prevWeapon: 'gravy', chargeCd: 0, chargeWind: 0, chargeT: 0, chargeDir: [1, 0], chargeTarget: null, lastTaunt: -9, speech: null,
  };
  enemies = []; bullets = []; ebullets = []; bombs = []; particles = []; puddles = []; pickups = []; floaters = []; corpses = []; webs = [];
  spawnQueue = []; wave = Math.max(0, (parseInt(new URLSearchParams(location.search).get('wave')) || 1) - 1); score = 0; kills = 0; shake = 0; time = 0; banner = null; boss = null; hitStop = 0;
  props = makeProps();
  cam.x = player.x; cam.y = player.y;
  startWave();
}

function makeProps() {
  const P = [];
  const add = (img, x, y, h, w, d) => P.push({ img, x, y, h, w, d });
  // picnic feast in the middle-top, hay bales and gravy barrels scattered
  add('table', ARENA.w / 2, ARENA.h / 2 - 140, 170, 170, 60);
  const spots = [[420, 380], [1980, 380], [420, 1240], [1980, 1240], [800, 800], [1600, 820], [1200, 1300]];
  spots.forEach(([x, y], i) => {
    if (i % 3 === 2) add('gravyboat', x, y, 96, 60, 36);
    else add('hay', x, y, 110, 100, 44);
  });
  return P;
}

function startWave() {
  wave++;
  waveState = 'intro'; waveTimer = 2.2;
  const isBoss = wave % 5 === 0;
  banner = { text: isBoss ? `WAVE ${wave}: GOBBLEZILLA!` : `WAVE ${wave}`, sub: isBoss ? 'The Turkey King approaches...' : pick(['Here come the leftovers!', 'Gravy up!', 'They want seconds...', 'Pass the ammo!', 'Defend the feast!', 'No one touches the pie.']), t: 2.2 };
  Sfx.wave();
  spawnQueue = buildWave(wave);
  if (player && CHARS[player.ch].special === 'scrap' && player.macT <= 0) {
    for (let i = 0; i < 2; i++) { const a = rand(0, Math.PI * 2), d = rand(250, 600); dropPickup(clamp(player.x + Math.cos(a) * d, 80, ARENA.w - 80), clamp(player.y + Math.sin(a) * d, 100, ARENA.h - 80), 'scrap'); }
  }
}

function buildWave(n) {
  const q = [];
  const pool = [['turkey', 3], ['potato', 3]];
  if (n >= 2) pool.push(['cranberry', 2]);
  if (n >= 3) pool.push(['corn', 4]);
  if (n >= 4) pool.push(['pumpkin', 8]);
  if (n % 5 === 0) {
    q.push({ type: 'boss', delay: 1.0 });
    for (let i = 0; i < 4 + n; i++) q.push({ type: pick(['turkey', 'potato', 'cranberry']), delay: 1.2 });
    return q;
  }
  let budget = 8 + n * 5;
  while (budget > 0) {
    const [t, cost] = pick(pool);
    if (t === 'cranberry') { for (let i = 0; i < 3; i++) q.push({ type: t, delay: 0.15 }); }
    else q.push({ type: t, delay: Math.max(0.25, 1.1 - n * 0.06) });
    budget -= cost;
  }
  return q;
}

function spawnEnemy(type, x, y) {
  const d = ENEMIES[type];
  let fromX, fromY, leap = false;
  if (x === undefined) {
    // pick an edge away from the player; enemies LEAP in over the fence
    for (let tries = 0; tries < 20; tries++) {
      const side = randi(0, 3), m = 70;
      if (side === 0) { x = rand(80, ARENA.w - 80); y = m + 20; fromX = x + rand(-40, 40); fromY = -90; }
      else if (side === 1) { x = ARENA.w - m; y = rand(120, ARENA.h - 80); fromX = ARENA.w + 90; fromY = y + rand(-30, 30); }
      else if (side === 2) { x = rand(80, ARENA.w - 80); y = ARENA.h - m; fromX = x + rand(-40, 40); fromY = ARENA.h + 90; }
      else { x = m; y = rand(120, ARENA.h - 80); fromX = -90; fromY = y + rand(-30, 30); }
      if ((x - player.x) ** 2 + (y - player.y) ** 2 > 480 ** 2) break;
    }
    leap = true;
  }
  const hpScale = 1 + (wave - 1) * 0.09;
  const e = {
    type, d, x, y, vx: 0, vy: 0, r: d.r, h: d.h, hp: d.hp * hpScale, maxHp: d.hp * hpScale,
    speed: d.speed * (1 + Math.min(wave, 15) * 0.015) * rand(0.9, 1.1), flash: 0, t: rand(0, 3), cd: rand(1, 2.5),
    st: 'move', stT: 0, z: 0, vz: 0, face: 1, kx: 0, ky: 0,
    mass: d.mass || 1, flank: rand(-0.9, 0.9), seed: rand(0, 100),
    dir: 'front', flipX: false, dirHold: 0, stride: rand(0, 100), frame: 1, act: null, hurtT: 0, sq: 0, sqV: 0, lean: 0,
    spawnT: leap ? 0.75 : 0.25, spawnMax: leap ? 0.75 : 0.25, leap, fromX, fromY, toX: x, toY: y,
  };
  if (leap) { e.x = fromX; e.y = fromY; }
  if (type === 'boss') { e.hp = e.maxHp = d.hp * (1 + (wave / 5 - 1) * 0.6); boss = e; e.phase = 0; e.cd = 2; Sfx.gobble(0.5); shake = 20; e.spawnT = e.spawnMax = 1.2; }
  enemies.push(e);
  return e;
}

// ---------- update ----------
function update(dt) {
  time += dt;
  if (hitStop > 0) { hitStop -= dt; return; }
  updateWave(dt);
  updatePlayer(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updateBombs(dt);
  updateMisc(dt);
  // camera
  const look = isTouch && !mouse.active ? 0 : 1;
  const lookX = Math.cos(player.aim) * 60 * look, lookY = Math.sin(player.aim) * 40 * look;
  cam.x = lerp(cam.x, player.x + lookX, 1 - Math.exp(-dt * 6));
  cam.y = lerp(cam.y, player.y - 40 + lookY, 1 - Math.exp(-dt * 6));
  const hw = VW / ZOOM / 2, hh = VH / ZOOM / 2;
  cam.x = hw * 2 > ARENA.w + 200 ? ARENA.w / 2 : clamp(cam.x, hw - 100, ARENA.w + 100 - hw);
  cam.y = hh * 2 > ARENA.h + 260 ? ARENA.h / 2 : clamp(cam.y, hh - 180, ARENA.h + 80 - hh);
  shake = Math.max(0, shake - dt * 40);
}

function updateWave(dt) {
  if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
  if (waveState === 'intro') {
    waveTimer -= dt;
    if (waveTimer <= 0) { waveState = 'fight'; waveTimer = 0; }
  } else if (waveState === 'fight') {
    waveTimer -= dt;
    if (spawnQueue.length && waveTimer <= 0) {
      const s = spawnQueue.shift();
      spawnEnemy(s.type);
      waveTimer = s.delay;
    }
    if (!spawnQueue.length && enemies.length === 0) {
      waveState = 'clear'; waveTimer = 3.5;
      const bonus = wave * 250; score += bonus;
      banner = { text: 'WAVE CLEARED!', sub: `+${bonus} bonus`, t: 2.5 };
      player.victoryT = 2.0;
      Sfx.wave();
      // reward crate near the player
      const w = pick(['cran', 'corn', 'pie']);
      dropPickup(clamp(player.x + rand(-120, 120), 80, ARENA.w - 80), clamp(player.y + rand(-120, 120), 80, ARENA.h - 80), 'weapon', w);
      if (wave % 2 === 0) dropPickup(clamp(player.x + rand(-150, 150), 80, ARENA.w - 80), clamp(player.y + rand(-150, 150), 80, ARENA.h - 80), 'slice');
    }
  } else if (waveState === 'clear') {
    waveTimer -= dt;
    if (waveTimer <= 0) startWave();
  }
}

function nearestEnemy(x, y, maxD, exclude) {
  let best = null, bd = maxD * maxD;
  for (const e of enemies) {
    if (e.dead || e.spawnT > 0 || e === exclude) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function onScreen(e, margin = 10) {
  // is the enemy's body visible in the viewport (accounting for HUD-free margin)?
  const sx = (e.x - cam.x) * ZOOM + VW / 2, sy = (e.y - e.h * 0.5 - e.z - cam.y) * ZOOM + VH / 2;
  return sx > margin && sx < VW - margin && sy > margin && sy < VH - margin;
}

function aimInput() {
  // returns {ax, ay, firing} in world-direction terms
  const c = CHARS[player.ch];
  if (sticks.aim) {
    const dx = sticks.aim.x - sticks.aim.ox, dy = sticks.aim.y - sticks.aim.oy;
    if (Math.hypot(dx, dy) > 12) return { a: Math.atan2(dy, dx), fire: true };
    return { a: player.aim, fire: false };
  }
  if (isTouch && !mouse.active) {
    // auto-aim + auto-fire at the nearest enemy
    let best = null, bd = Infinity;
    for (const e of enemies) {
      if (e.spawnT > 0 || !onScreen(e)) continue;
      const d = dist2(e, player); if (d < bd) { bd = d; best = e; }
    }
    if (best) return { a: Math.atan2(best.y - best.h * 0.35 - (player.y - 40), best.x - player.x), fire: true, target: best };
    return { a: player.aim, fire: false };
  }
  const w = screenToWorld(mouse.x, mouse.y);
  return { a: Math.atan2(w.y - (player.y - 40), w.x - player.x), fire: mouse.down };
}

function updatePlayer(dt) {
  const p = player, c = CHARS[p.ch];
  p.dashCd -= dt; p.inv -= dt; p.fireCd -= dt; p.flash -= dt; p.bombCd -= dt;
  p.hurtT -= dt; p.victoryT -= dt; p.lastFire += dt;

  // knocked out: ragdoll-ish slide, then the game-over screen
  if (p.dead) {
    p.deadT -= dt;
    const fr = Math.exp(-dt * (p.z > 0 ? 0.5 : 5));
    p.vx *= fr; p.vy *= fr;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vz -= 1400 * dt; p.z += p.vz * dt;
    if (p.z <= 0) { if (p.vz < -250) { p.vz = -p.vz * 0.3; dustBurst(p.x, p.y, 6, 1); } else p.vz = 0; p.z = 0; }
    collideProps(p);
    p.x = clamp(p.x, p.r + 10, ARENA.w - p.r - 10); p.y = clamp(p.y, p.r + 30, ARENA.h - p.r - 10);
    springs(p, dt);
    if (p.deadT <= 0 && state === 'play') gameOver();
    return;
  }

  // movement input
  let mx = 0, my = 0;
  if (keys['w'] || keys['arrowup']) my -= 1;
  if (keys['s'] || keys['arrowdown']) my += 1;
  if (keys['a'] || keys['arrowleft']) mx -= 1;
  if (keys['d'] || keys['arrowright']) mx += 1;
  if (sticks.move) {
    const dx = sticks.move.x - sticks.move.ox, dy = sticks.move.y - sticks.move.oy, d = Math.hypot(dx, dy);
    if (d > 8) { const m = Math.min(1, d / 60); mx = dx / d * m; my = dy / d * m; }
  }
  const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  p.moving = ml > 0.1;

  if (wantDash && p.dashCd <= 0) {
    const dir = p.moving ? [mx, my] : [Math.cos(p.bodyAng), Math.sin(p.bodyAng)];
    const dl = Math.hypot(dir[0], dir[1]) || 1;
    p.dashDir = [dir[0] / dl, dir[1] / dl]; p.dashT = 0.2; p.dashCd = c.dashCd || 0.9; p.inv = Math.max(p.inv, 0.3);
    p.sq = -0.22; p.sqV = 0; // stretch on launch
    Sfx.dash();
    dustBurst(p.x, p.y, 10, 1.4);
  }
  wantDash = false;

  // ----- Eli: Mac & Cheese Blaster timer -----
  if (p.macT > 0) {
    p.macT -= dt;
    if (p.macT <= 0) {
      p.cur = p.ammo[p.prevWeapon] > 0 ? p.prevWeapon : 'gravy';
      floatText(p.x, p.y - 120, 'Blaster fell apart!', '#ffd84a', 1.4, 17);
      for (let i = 0; i < 10; i++) particles.push({ x: p.x, y: p.y, z: 40, vx: rand(-150, 150), vy: rand(-100, 100), vz: rand(100, 300), life: 0.8, max: 0.8, color: pick(['#9aa4ad', '#c8a040', '#ffb627']), size: rand(3, 7), grav: 900 });
      Sfx.hit();
    }
  }

  // ----- Issac: wind-up -> crazy homing charge -----
  if (wantSpecial && c.special === 'charge' && p.chargeCd <= 0 && p.chargeT <= 0 && p.chargeWind <= 0) {
    p.chargeWind = 0.55; Sfx.windup();
  }
  wantSpecial = false;
  p.chargeCd -= dt;
  if (p.chargeWind > 0) {
    p.chargeWind -= dt;
    p.vx *= Math.exp(-dt * 12); p.vy *= Math.exp(-dt * 12);
    p.sq = 0.22 + Math.sin(time * 80) * 0.03; p.sqV = 0; // crouched, trembling with energy
    if (Math.random() < 0.8) particles.push({ x: p.x + rand(-16, 16), y: p.y, z: 2, vx: rand(-90, 90), vy: rand(-20, 20), vz: rand(30, 120), life: 0.35, max: 0.35, color: 'rgba(214,196,156,.9)', size: rand(4, 8), grav: 300 });
    if (p.chargeWind <= 0) {
      const t = nearestEnemy(p.x, p.y, 900, null);
      const a = t ? Math.atan2(t.y - p.y, t.x - p.x) : p.moving ? Math.atan2(p.vy || 0.01, p.vx) : p.aim;
      p.chargeDir = [Math.cos(a), Math.sin(a)]; p.chargeTarget = t; p.chargeT = 1.8; p.inv = Math.max(p.inv, 1.9);
      p.sq = -0.3; p.sqV = 0; shake = Math.max(shake, 8); dustBurst(p.x, p.y, 14, 1.5); Sfx.dash(); Sfx.boom();
    }
  }
  if (p.chargeT > 0) {
    p.chargeT -= dt;
    let tg = p.chargeTarget;
    if (!tg || tg.dead) tg = p.chargeTarget = nearestEnemy(p.x, p.y, 700, null);
    let a = Math.atan2(p.chargeDir[1], p.chargeDir[0]);
    if (tg) a += clamp(angDiff(a, Math.atan2(tg.y - p.y, tg.x - p.x)), -9 * dt, 9 * dt);
    p.chargeDir = [Math.cos(a), Math.sin(a)];
    const cs = p.speed * 3.4;
    p.vx = p.chargeDir[0] * cs; p.vy = p.chargeDir[1] * cs;
    // bounce off the yard edges like a pinball
    if ((p.x < p.r + 14 && p.vx < 0) || (p.x > ARENA.w - p.r - 14 && p.vx > 0)) { p.chargeDir[0] *= -1; shake = Math.max(shake, 5); }
    if ((p.y < p.r + 34 && p.vy < 0) || (p.y > ARENA.h - p.r - 14 && p.vy > 0)) { p.chargeDir[1] *= -1; shake = Math.max(shake, 5); }
    for (const e of enemies) {
      if (e.dead || e.spawnT > 0 || (e.chargeHitT || 0) > time) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r + 14) {
        e.chargeHitT = time + 0.4;
        damageEnemy(e, 45 + wave * 3, p.chargeDir[0], p.chargeDir[1], 700);
        hitStop = Math.max(hitStop, 0.035); shake = Math.max(shake, 9);
        floatText(e.x, e.y - e.h - 20, pick(POW), '#ffec3d', 0.7, 26);
        for (let i = 0; i < 8; i++) particles.push({ x: e.x, y: e.y, z: e.h * 0.5, vx: rand(-200, 200), vy: rand(-120, 120), vz: rand(100, 300), life: 0.4, max: 0.4, color: pick(['#fff3a0', '#ffffff', '#ff9a3d']), size: rand(4, 8), grav: 600 });
        if (e === p.chargeTarget) p.chargeTarget = nearestEnemy(p.x, p.y, 700, e);
      }
    }
    if (Math.random() < 0.8) particles.push({ x: p.x, y: p.y, z: 0, vx: 0, vy: 0, vz: 0, life: 0.2, max: 0.2, ghost: true, anim: p.ch, row: 'act', frame: 1, flip: p.chargeDir[0] < 0, h: p.h, img: p.ch, face: p.chargeDir[0] < 0 ? -1 : 1 });
    if (Math.random() < 0.9) particles.push({ x: p.x + rand(-10, 10), y: p.y, z: 2, vx: -p.vx * 0.15 + rand(-40, 40), vy: -p.vy * 0.15 + rand(-30, 30), vz: rand(30, 100), life: 0.4, max: 0.4, color: 'rgba(214,196,156,.85)', size: rand(5, 9), grav: 250 });
    if (p.chargeT <= 0) { p.chargeCd = 6; p.vx *= 0.35; p.vy *= 0.35; p.sq = 0.25; p.sqV = 0; dustBurst(p.x, p.y, 10, 1.2); }
  }
  const charging = p.chargeT > 0 || p.chargeWind > 0;

  const sp = p.speed;
  const pvx = p.vx, pvy = p.vy;
  if (charging) {
    // velocity set by the charge above
  } else if (p.dashT > 0) {
    p.dashT -= dt;
    const k = p.dashT > 0.05 ? 3.6 : 1.6; // burst, then brake
    p.vx = p.dashDir[0] * sp * k; p.vy = p.dashDir[1] * sp * k;
    if (Math.random() < 0.7) particles.push({ x: p.x, y: p.y, z: 0, vx: 0, vy: 0, vz: 0, life: 0.22, max: 0.22, ghost: true, anim: p.ch, row: 'act', frame: 1, flip: p.dashDir[0] < 0, h: p.h, img: p.ch, face: p.dashDir[0] < 0 ? -1 : 1 });
    if (p.dashT <= 0) { p.sq = 0.16; p.sqV = 0; dustBurst(p.x, p.y, 6, 1); } // squash on the stop
  } else {
    // acceleration-limited velocity -> real momentum: quick to start, a short slide to stop
    const tvx = mx * sp, tvy = my * sp;
    let dvx = tvx - p.vx, dvy = tvy - p.vy;
    const dl = Math.hypot(dvx, dvy);
    const spd0 = Math.hypot(p.vx, p.vy);
    const reversing = p.moving && spd0 > sp * 0.55 && (p.vx * tvx + p.vy * tvy) < -0.3 * spd0 * sp;
    const a = (p.moving ? 2300 : 1900) * (reversing ? 1.25 : 1) * dt;
    if (dl > a) { dvx *= a / dl; dvy *= a / dl; }
    p.vx += dvx; p.vy += dvy;
    if (reversing && Math.random() < 0.6) { // skid
      particles.push({ x: p.x + rand(-8, 8), y: p.y, z: 2, vx: p.vx * 0.3 + rand(-30, 30), vy: p.vy * 0.3 + rand(-20, 20), vz: rand(30, 80), life: 0.4, max: 0.4, color: 'rgba(200,180,140,.85)', size: rand(5, 9), grav: 200 });
    }
  }
  p.x += p.vx * dt; p.y += p.vy * dt;
  collideProps(p);
  p.x = clamp(p.x, p.r + 10, ARENA.w - p.r - 10); p.y = clamp(p.y, p.r + 30, ARENA.h - p.r - 10);

  // body lean follows ACCELERATION (leans into starts, turns and stops), via a damped spring
  const ax = (p.vx - pvx) / Math.max(dt, 1e-3);
  p.leanTarget = clamp(ax / 2300, -1, 1) * 0.16 + clamp(p.vx / sp, -1, 1) * 0.05;
  springs(p, dt);

  // aiming / firing
  const ai = aimInput();
  p.aim = ai.a;
  if (wantSwap) { cycleWeapon(wantSwap); wantSwap = 0; }
  if (wantWeapon) { selectWeapon(wantWeapon); wantWeapon = null; }
  if (ai.fire && p.fireCd <= 0 && !charging) { fire(ai); p.lastFire = 0; }
  if (wantBomb && p.bombs > 0 && p.bombCd <= 0 && !charging) { throwBomb(ai); p.lastFire = 0; }
  wantBomb = false;

  // which way the BODY faces: the aim while shooting (or when a mouse is aiming), otherwise travel direction
  const spd = Math.hypot(p.vx, p.vy);
  const aiming = p.lastFire < 0.7 || (mouse.active && !isTouch) || (mouse.active && mouse.down);
  const want = aiming ? p.aim : spd > 40 ? Math.atan2(p.vy, p.vx) : p.bodyAng;
  p.bodyAng = angLerp(p.bodyAng, want, 1 - Math.exp(-dt * (aiming ? 22 : 12)));
  // the gun is raised toward the target when shooting, carried pointing along the body otherwise
  const carry = aiming ? p.aim : p.bodyAng + (Math.cos(p.bodyAng) >= 0 ? 0.35 : -0.35);
  p.gunAng = angLerp(p.gunAng, carry, 1 - Math.exp(-dt * 25));
  p.face = Math.cos(p.bodyAng) >= 0 ? 1 : -1;
  facing(p, Math.cos(p.bodyAng), Math.sin(p.bodyAng), dt);

  // stride-synced walk cycle: frames advance by DISTANCE travelled (no foot sliding);
  // moving opposite to where you face plays the cycle backwards (back-pedalling)
  const strideLen = p.h * 0.27;
  const back = (p.vx * Math.cos(p.bodyAng) + p.vy * Math.sin(p.bodyAng)) < -0.25 * spd;
  p.stride += spd * dt * (back ? -1 : 1);
  if (spd > 25) p.frame = ((Math.floor(p.stride / strideLen) % 4) + 4) % 4;
  else if (p.frame % 2 === 0) p.frame = (p.frame + 1) % 4; // settle into a passing (feet-together) pose
  if (p.frame !== p.lastFrame) {
    if (spd > 60 && p.frame % 2 === 0) footstep(p.x, p.y, spd / sp);
    p.lastFrame = p.frame;
  }
}

function cycleWeapon(dir) {
  const p = player;
  if (p.macT > 0) { floatText(p.x, p.y - 115, 'Mac & Cheese time!', '#ffd84a', 1, 15); return; }
  let i = WEAPON_ORDER.indexOf(p.cur);
  for (let n = 0; n < 3; n++) {
    i = (i + dir + 4) % 4;
    if (p.ammo[WEAPON_ORDER[i]] > 0) { p.cur = WEAPON_ORDER[i]; Sfx.pickup(); return; }
  }
  floatText(p.x, p.y - 115, 'No other weapons yet - grab a crate!', '#fff4dc', 1.4, 15);
}

function selectWeapon(k) {
  const p = player;
  if (p.macT > 0) { floatText(p.x, p.y - 115, 'Mac & Cheese time!', '#ffd84a', 1, 15); return; }
  if (p.ammo[k] > 0) { if (p.cur !== k) { p.cur = k; Sfx.pickup(); } }
  else floatText(p.x, p.y - 115, `No ${WEAPONS[k].name} ammo - find a crate!`, '#fff4dc', 1.4, 15);
}

function gunTip() {
  const p = player;
  return { x: p.x + Math.cos(p.aim) * 44, y: p.y + Math.sin(p.aim) * 30, z: 40 - Math.sin(p.aim) * 6 };
}

function fire() {
  const p = player, c = CHARS[p.ch], w = WEAPONS[p.cur];
  if (!w.special && p.ammo[p.cur] <= 0) { p.cur = 'gravy'; return; }
  p.fireCd = w.rate * (c.rateMul || 1);
  const tip = gunTip();
  for (let i = 0; i < w.count; i++) {
    const a = p.aim + (w.count > 1 ? (i / (w.count - 1) - 0.5) * w.spread : rand(-w.spread, w.spread));
    const sp = w.speed * (w.count > 1 ? rand(0.85, 1.1) : 1);
    let dmg = w.dmg;
    if (p.cur === 'gravy') dmg *= (c.gravyMul || 1);
    bullets.push({ w: p.cur, x: tip.x, y: tip.y, z: tip.z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: w.r, dmg, life: w.life * (w.count > 1 ? rand(0.8, 1.15) : 1), max: w.life, hits: new Set(), rot: 0 });
  }
  if (!w.special && p.ammo[p.cur] !== Infinity) {
    p.ammo[p.cur]--;
    if (p.ammo[p.cur] <= 0) { p.ammo[p.cur] = 0; floatText(p.x, p.y - 110, 'Out of ammo!', '#fff'); setTimeout(() => { if (player && player.ammo[player.cur] <= 0) player.cur = 'gravy'; }, 150); }
  }
  // recoil + muzzle puff
  p.vx -= Math.cos(p.aim) * (p.cur === 'cran' ? 160 : 15); p.vy -= Math.sin(p.aim) * (p.cur === 'cran' ? 160 : 15);
  if (p.cur === 'cran') shake = Math.max(shake, 5);
  for (let i = 0; i < 3; i++) particles.push({ x: tip.x, y: tip.y, z: tip.z, vx: Math.cos(p.aim) * rand(40, 120) + rand(-30, 30), vy: Math.sin(p.aim) * rand(40, 120) + rand(-30, 30), vz: rand(-10, 30), life: 0.2, max: 0.2, color: w.hi || '#fff', size: rand(3, 6), grav: 0 });
  Sfx.shoot(p.cur);
}

function throwBomb(ai) {
  const p = player, c = CHARS[p.ch];
  p.bombs--; p.bombCd = 0.35;
  let tx, ty;
  if (!isTouch || mouse.active) { const w = screenToWorld(mouse.x, mouse.y); tx = w.x; ty = w.y + 20; }
  else if (ai.target) { tx = ai.target.x; ty = ai.target.y; }
  else { tx = p.x + Math.cos(p.aim) * 320; ty = p.y + Math.sin(p.aim) * 320; }
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), maxD = 480;
  if (d > maxD) { tx = p.x + dx / d * maxD; ty = p.y + dy / d * maxD; }
  const T = 0.65;
  bombs.push({ x: p.x, y: p.y, z: 50, vx: (tx - p.x) / T, vy: (ty - p.y) / T, vz: 420, g: (420 * 2 + 100) / T, t: T, rot: 0, radius: 135 * (c.bombMul || 1), dmg: 90 });
  Sfx.throw();
}

function collideProps(o) {
  for (const pr of props) {
    // props are ellipse-ish footprints; treat as AABB
    const hw = pr.w / 2, hd = pr.d / 2;
    const cx = clamp(o.x, pr.x - hw, pr.x + hw), cy = clamp(o.y, pr.y - hd, pr.y + hd);
    const dx = o.x - cx, dy = o.y - cy, d2 = dx * dx + dy * dy;
    if (d2 < o.r * o.r) {
      const d = Math.sqrt(d2) || 0.01;
      if (d2 === 0) { o.y = pr.y + hd + o.r; continue; }
      o.x = cx + dx / d * o.r; o.y = cy + dy / d * o.r;
    }
  }
}

function hitProp(b) {
  for (const pr of props) {
    if (Math.abs(b.x - pr.x) < pr.w / 2 && Math.abs(b.y - pr.y) < pr.d / 2 && b.z < pr.h * 0.6) return true;
  }
  return false;
}

function updateEnemies(dt) {
  const p = player;
  for (const e of enemies) {
    e.t += dt; e.flash -= dt; e.cd -= dt; e.stT -= dt; e.hurtT -= dt;
    const d = e.d, ai = d.ai;

    // leaping in over the fence
    if (e.spawnT > 0) {
      e.spawnT -= dt;
      const k = 1 - Math.max(0, e.spawnT) / e.spawnMax;
      if (e.leap) {
        e.x = lerp(e.fromX, e.toX, k); e.y = lerp(e.fromY, e.toY, k);
        e.z = Math.sin(k * Math.PI) * (90 + e.h * 0.4);
        e.vx = (e.toX - e.fromX) / e.spawnMax; e.vy = (e.toY - e.fromY) / e.spawnMax;
      }
      facing(e, e.vx || (p.x - e.x), e.vy || (p.y - e.y), 1);
      e.act = ai === 'hop' ? 2 : null;
      if (e.spawnT <= 0) {
        e.z = 0; e.vx *= 0.2; e.vy *= 0.2;
        e.sq = 0.3 * Math.min(2, e.mass); e.sqV = 0;
        dustBurst(e.x, e.y, 8 + e.mass * 3, 0.8 + e.mass * 0.25);
        if (e.mass >= 3) shake = Math.max(shake, 6 + e.mass);
      }
      springs(e, dt);
      continue;
    }

    const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist, ny = dy / dist;
    let slow = 1;
    for (const pu of puddles) if ((e.x - pu.x) ** 2 + ((e.y - pu.y) * 1.6) ** 2 < pu.r * pu.r) { slow = d.heavy ? 0.75 : 0.45; break; }
    const sp = e.speed * slow;
    let accel = 1100 / Math.pow(e.mass, 0.6);
    const airborne = e.z > 0.5 && ai !== 'hop';

    // --- steering: approach along a personal flanking angle so groups SURROUND you, with a little wander
    const flankAmt = clamp((dist - 110) / 380, 0, 1);
    const ang = Math.atan2(ny, nx) + e.flank * flankAmt + Math.sin(e.t * 1.3 + e.seed) * 0.22 * flankAmt;
    let dvx = Math.cos(ang) * sp, dvy = Math.sin(ang) * sp;
    let act = null;

    if (ai === 'charge') {
      if (e.st === 'move' && dist < 300 && e.cd <= 0 && !p.dead) { e.st = 'wind'; e.stT = 0.5; if (Math.random() < 0.5) Sfx.gobble(rand(0.9, 1.2)); }
      if (e.st === 'wind') {
        dvx = 0; dvy = 0; accel *= 2.5; act = 1;
        if (e.stT <= 0) { e.st = 'dash'; e.stT = 0.6; e.cdir = [nx, ny]; e.sq = -0.25; dustBurst(e.x, e.y, 6, 1); }
      } else if (e.st === 'dash') {
        // limited homing: can only turn ~1.3 rad/s mid-charge, so you can sidestep
        const want = Math.atan2(ny, nx), cur = Math.atan2(e.cdir[1], e.cdir[0]);
        const na = cur + clamp(angDiff(cur, want), -1.3 * dt, 1.3 * dt);
        e.cdir = [Math.cos(na), Math.sin(na)];
        dvx = e.cdir[0] * sp * 3.1; dvy = e.cdir[1] * sp * 3.1; accel = 4000; act = 2;
        if (e.stT <= 0) { e.st = 'skid'; e.stT = 0.4; }
      } else if (e.st === 'skid') {
        dvx = 0; dvy = 0; accel = 700; // momentum carries it past you
        if (Math.random() < 0.7) particles.push({ x: e.x + rand(-10, 10), y: e.y, z: 2, vx: e.vx * 0.2 + rand(-30, 30), vy: e.vy * 0.2 + rand(-20, 20), vz: rand(30, 90), life: 0.45, max: 0.45, color: 'rgba(200,180,140,.85)', size: rand(5, 10), grav: 200 });
        if (e.stT <= 0) { e.st = 'move'; e.cd = rand(1.4, 2.6); }
      }
    } else if (ai === 'hop') {
      // anticipation squash -> spring up -> airborne -> splat landing
      dvx = 0; dvy = 0;
      if (e.z <= 0) {
        if (e.st === 'land') { act = 3; if (e.stT <= 0) e.st = 'move'; }
        else if (e.cd <= 0.18) { act = 0; e.sqT = 1; }
        else act = 0;
        if (e.cd <= 0 && e.st !== 'land') {
          e.vz = 330; e.cd = rand(0.55, 0.85);
          const hop = Math.atan2(ny, nx) + e.flank * flankAmt * 0.8;
          e.vx = Math.cos(hop) * sp * 1.9; e.vy = Math.sin(hop) * sp * 1.9;
          e.sq = -0.25; e.sqV = 0;
        }
        accel = 2500; // stick to the ground
      } else {
        act = e.vz > 60 ? 1 : 2;
        accel = 0;
      }
    } else if (ai === 'ranged') {
      const pref = 330;
      const side = Math.sin(e.t * 0.6 + e.seed) > 0 ? 1 : -1;
      if (dist > pref + 60) { dvx = nx * sp; dvy = ny * sp; }
      else if (dist < pref - 60) { dvx = -nx * sp; dvy = -ny * sp; }
      else { dvx = -ny * sp * 0.6 * side; dvy = nx * sp * 0.6 * side; }
      if (e.st === 'move' && e.cd <= 0 && dist < 650 && onScreen(e, -40) && !p.dead) { e.st = 'aim'; e.stT = 0.4; }
      if (e.st === 'aim') {
        dvx = 0; dvy = 0; accel *= 2; act = 1;
        if (e.stT <= 0) {
          const a = Math.atan2(dy, dx);
          for (let i = -1; i <= 1; i++) ebullets.push({ x: e.x + nx * 20, y: e.y + ny * 10, z: 45, vx: Math.cos(a + i * 0.18) * 330, vy: Math.sin(a + i * 0.18) * 330, r: 7, dmg: 7, life: 2.2, kind: 'kernel' });
          e.vx -= nx * 90; e.vy -= ny * 90; // recoil
          e.st = 'shoot'; e.stT = 0.22; e.cd = rand(1.4, 2.2);
        }
      } else if (e.st === 'shoot') { dvx = 0; dvy = 0; act = 2; if (e.stT <= 0) e.st = 'move'; }
    } else if (ai === 'chase') {
      // melee lunge: telegraphed windup, then a short burst at you
      if (e.st === 'move' && dist < e.r + p.r + 60 && e.cd <= 0 && !p.dead) { e.st = 'wind'; e.stT = d.heavy ? 0.5 : 0.32; }
      if (e.st === 'wind') { dvx = 0; dvy = 0; accel *= 3; act = 1; if (e.stT <= 0) { e.st = 'lunge'; e.stT = 0.25; e.cdir = [nx, ny]; e.sq = -0.2; } }
      else if (e.st === 'lunge') {
        dvx = e.cdir[0] * sp * (d.heavy ? 3.5 : 3); dvy = e.cdir[1] * sp * (d.heavy ? 3.5 : 3); accel = 3500; act = 2;
        if (e.stT <= 0) {
          e.st = 'move'; e.cd = rand(1.0, 1.6);
          if (d.heavy) { // ground slam
            shake = Math.max(shake, 8); dustBurst(e.x, e.y, 14, 1.6); e.sq = 0.3;
            particles.push({ x: e.x, y: e.y, z: 0, ring: true, r: 80, life: 0.3, max: 0.3 });
            if (Math.hypot(p.x - e.x, p.y - e.y) < 90 && p.inv <= 0) hurtPlayer(d.dmg * 0.8, nx, ny);
          }
        }
      }
    } else if (ai === 'boss') {
      updateBoss(e, dt, nx, ny, dist);
      dvx = e.tvx; dvy = e.tvy;
      act = e.st === 'wind' || e.st === 'burst' ? 1 : e.st === 'dash' || e.st === 'summon' ? 2 : null;
      if (e.st === 'dash') accel = 3000;
    }

    // --- obstacle avoidance: steer around hay bales / barrels / the table instead of grinding into them
    if (e.type !== 'boss' && ai !== 'hop') {
      const mv = Math.hypot(dvx, dvy);
      if (mv > 1) {
        const fx = dvx / mv, fy = dvy / mv;
        for (const pr of props) {
          const ox = pr.x - e.x, oy = pr.y - e.y, rad = Math.max(pr.w, pr.d * 1.6) * 0.55 + e.r + 30;
          const od = Math.hypot(ox, oy);
          if (od < rad + 60 && (ox * fx + oy * fy) > 0) {
            const side = (fx * oy - fy * ox) > 0 ? -1 : 1;
            const s = clamp(1 - (od - rad) / 60, 0, 1) * mv * 1.2;
            dvx += -fy * side * s; dvy += fx * side * s;
          }
        }
      }
    }
    // --- separation from the crowd
    for (const o of enemies) {
      if (o === e || o.spawnT > 0) continue;
      const sx = e.x - o.x, sy = e.y - o.y, sd2 = sx * sx + sy * sy, rr = (e.r + o.r) * 1.05;
      if (sd2 < rr * rr && sd2 > 0.01) { const sd = Math.sqrt(sd2); const push = (rr - sd) / rr * 260 * (o.mass / (e.mass + o.mass)) * 2; dvx += sx / sd * push; dvy += sy / sd * push; }
    }

    // stagger: a hit interrupts control briefly
    if (e.hurtT > 0) { dvx = 0; dvy = 0; accel *= 0.35; act = 0; if (e.st === 'wind' || e.st === 'aim') e.st = 'move'; }
    // sticky cheese webs: walking into one glues you in place for a bit
    if ((e.stuckT || 0) <= 0 && (e.webCd || 0) < time && e.z < 10) {
      for (const w of webs) if ((e.x - w.x) ** 2 + ((e.y - w.y) * 1.6) ** 2 < w.r * w.r) { webEnemy(e, e.type === 'boss' ? 0.5 : e.d.heavy ? 1 : 1.6); break; }
    }
    if (e.stuckT > 0) {
      e.stuckT -= dt; dvx = 0; dvy = 0; accel = 6000; act = 0;
      if (e.st !== 'move' && e.st !== 'land') e.st = 'move';
      if (e.stuckT <= 0) e.webCd = time + 1.2;
    }
    if (airborne) accel *= 0.05;

    // integrate with an acceleration limit (mass => momentum)
    const pvx = e.vx;
    let ddx = dvx - e.vx, ddy = dvy - e.vy; const dl = Math.hypot(ddx, ddy), amax = accel * dt;
    if (dl > amax) { ddx *= amax / dl; ddy *= amax / dl; }
    e.vx += ddx; e.vy += ddy;
    e.x += e.vx * dt; e.y += e.vy * dt;
    if (e.type !== 'boss') collideProps(e);
    e.x = clamp(e.x, e.r, ARENA.w - e.r); e.y = clamp(e.y, e.r + 20, ARENA.h - e.r);

    // vertical physics (hops, bomb launches)
    if (e.z > 0 || e.vz > 0) {
      e.vz -= (ai === 'hop' ? 1000 : 1300) * dt; e.z += e.vz * dt;
      if (e.z <= 0) {
        const impact = -e.vz; e.z = 0; e.vz = 0;
        if (ai === 'hop') {
          e.st = 'land'; e.stT = 0.14; e.sq = 0.28; e.sqV = 0; e.vx *= 0.3; e.vy *= 0.3;
          for (let i = 0; i < 4; i++) particles.push({ x: e.x + rand(-12, 12), y: e.y, z: 2, vx: rand(-80, 80), vy: rand(-40, 40), vz: rand(40, 120), life: 0.4, max: 0.4, color: pick(['#b0102a', '#ff5a6e']), size: rand(3, 6), grav: 700 });
        } else if (impact > 150) { e.sq = clamp(impact / 1500, 0.1, 0.35); e.sqV = 0; dustBurst(e.x, e.y, 6, 1); }
      }
    }

    // facing & animation
    const spd = Math.hypot(e.vx, e.vy);
    if (act !== null && ai !== 'hop') facing(e, dx, 0.0001, dt, true);            // action poses are side-view
    else if (spd > 20 && ai !== 'hop') facing(e, e.vx, e.vy, dt);
    else facing(e, dx, dy, dt);
    e.act = act;
    const strideLen = e.h * (d.stride || 0.28);
    e.stride += spd * dt;
    if (spd > 15) e.frame = Math.floor(e.stride / strideLen) % 4;
    else if (e.frame % 2 === 0) e.frame = (e.frame + 1) % 4;
    if (e.frame !== e.lastFrame) { if (e.frame % 2 === 0 && spd > 40 && e.mass >= 3) { dustBurst(e.x, e.y, 3, 0.8); if (e.mass >= 6) shake = Math.max(shake, 3); } e.lastFrame = e.frame; }
    e.leanTarget = clamp((e.vx - pvx) / Math.max(dt, 1e-3) / 2500, -1, 1) * 0.12;
    springs(e, dt);
    e.face = dx > 0 ? 1 : -1;

    // contact damage
    if (dist < e.r + p.r && e.z < 30 && p.inv <= 0 && !p.dead) {
      hurtPlayer(d.dmg * (e.st === 'dash' || e.st === 'lunge' ? 1.4 : 1), nx, ny);
    }
  }
}

function updateBoss(e, dt, nx, ny, d) {
  // cycle: chase -> charge x3 -> feather burst -> summon
  e.tvx = nx * e.speed; e.tvy = ny * e.speed;
  if (e.st === 'move') {
    if (e.cd <= 0) {
      e.phase = (e.phase + 1) % 3;
      if (e.phase === 0) { e.st = 'wind'; e.stT = 0.7; e.charges = 3; Sfx.gobble(0.5); }
      else if (e.phase === 1) { e.st = 'burst'; e.stT = 2.0; e.burstCd = 0; }
      else { e.st = 'summon'; e.stT = 1.0; }
    }
  } else if (e.st === 'wind') {
    e.tvx = 0; e.tvy = 0;
    if (e.stT <= 0) { e.st = 'dash'; e.stT = 0.7; e.cdir = [nx, ny]; shake = Math.max(shake, 8); }
  } else if (e.st === 'dash') {
    e.tvx = e.cdir[0] * e.speed * 5; e.tvy = e.cdir[1] * e.speed * 5;
    if (Math.random() < 0.5) particles.push({ x: e.x + rand(-40, 40), y: e.y, z: 5, vx: rand(-50, 50), vy: rand(-50, 50), vz: rand(50, 150), life: 0.5, max: 0.5, color: '#8a6a3a', size: rand(5, 10), grav: 400 });
    if (e.stT <= 0) {
      e.charges--;
      if (e.charges > 0) { e.st = 'wind'; e.stT = 0.45; } else { e.st = 'move'; e.cd = 2.2; }
    }
  } else if (e.st === 'burst') {
    e.tvx *= 0.2; e.tvy *= 0.2;
    e.burstCd -= dt;
    if (e.burstCd <= 0) {
      e.burstCd = 0.5;
      const n = 18, off = rand(0, Math.PI);
      for (let i = 0; i < n; i++) { const a = off + i / n * Math.PI * 2; ebullets.push({ x: e.x, y: e.y - 10, z: 80, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, r: 10, dmg: 10, life: 3, kind: 'feather', rot: a }); }
      Sfx.gobble(0.7);
    }
    if (e.stT <= 0) { e.st = 'move'; e.cd = 2.5; }
  } else if (e.st === 'summon') {
    e.tvx = 0; e.tvy = 0;
    if (e.stT <= 0) {
      for (let i = 0; i < 3 + Math.floor(wave / 5); i++) { const a = rand(0, Math.PI * 2); const m = spawnEnemy(pick(['turkey', 'turkey', 'cranberry', 'potato']), clamp(e.x + Math.cos(a) * 140, 40, ARENA.w - 40), clamp(e.y + Math.sin(a) * 100, 60, ARENA.h - 40)); m.spawnT = m.spawnMax = 0.5; }
      Sfx.gobble(0.6); e.st = 'move'; e.cd = 3;
    }
  }
}

function hurtPlayer(dmg, nx, ny) {
  const p = player;
  if (p.dead) return;
  p.hp -= dmg; p.inv = 0.9; p.flash = 0.15; p.hurtT = 0.28;
  p.vx += nx * 520; p.vy += ny * 520;
  p.sq = 0.18; p.sqV = 0; p.leanV += (nx >= 0 ? 1 : -1) * 6;
  shake = Math.max(shake, 10); hitStop = 0.05;
  floatText(p.x, p.y - p.h - 10, `-${Math.round(dmg)}`, '#ff6b6b');
  Sfx.hurt();
  if (p.hp <= 0) {
    p.hp = 0; p.dead = true; p.deadT = 1.6; p.inv = 99;
    p.vx = nx * 600; p.vy = ny * 600; p.vz = 420; hitStop = 0.18; shake = 18;
    Sfx.over();
  }
}

function damageEnemy(e, dmg, kx, ky, kb = 120) {
  if (e.spawnT > 0) return;
  e.hp -= dmg; e.flash = 0.08;
  // knockback is an impulse divided by mass; big hits briefly stagger
  const imp = kb * 1.7 / e.mass;
  e.vx += kx * imp; e.vy += ky * imp;
  if (kb >= 400) e.vz += 260 / e.mass; // explosions toss things into the air
  if (!e.d.heavy || kb >= 250) e.hurtT = Math.max(e.hurtT, kb >= 250 ? 0.3 : 0.14);
  e.sq = Math.max(e.sq, 0.12); e.lastHit = [kx, ky, kb];
  floatText(e.x + rand(-10, 10), e.y - e.h - 6, Math.round(dmg), '#fff', 0.5);
  Sfx.hit();
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  const mult = 1 + Math.floor(wave / 3) * 0.25;
  score += Math.round(e.d.score * mult); kills++;
  Sfx.splat();
  const colors = { turkey: ['#7a4a22', '#c8752d', '#e8b05a', '#c0392b'], potato: ['#c9a463', '#f2d16b', '#8a6a3a'], tot: ['#c9a463', '#f2d16b'],
    cranberry: ['#b0102a', '#ff5a6e', '#6e0a1a'], corn: ['#f4c430', '#fff2a0', '#4a8a2a'], pumpkin: ['#e8742a', '#ffb347', '#3d6b22'], boss: ['#7a4a22', '#c8752d', '#e8b05a', '#c0392b', '#222'] }[e.type];
  const n = e.type === 'boss' ? 120 : 14;
  for (let i = 0; i < n; i++) {
    const feather = (e.type === 'turkey' || e.type === 'boss') && i % 3 === 0;
    particles.push({ x: e.x, y: e.y, z: e.h * 0.4, vx: rand(-220, 220), vy: rand(-160, 160), vz: rand(100, 420), life: rand(0.6, 1.4), max: 1.4, color: pick(colors), size: rand(4, 10) * (e.type === 'boss' ? 1.8 : 1), grav: feather ? 120 : 900, feather, rot: rand(0, 6) });
  }
  // the body: flung along the killing blow, tumbles, bounces, settles, then fades into the lawn
  const [hx, hy, kb] = e.lastHit || [Math.sign(e.x - player.x) || 1, 0, 120];
  const fling = clamp(kb * 2.2, 160, 900) / Math.sqrt(e.mass);
  corpses.push({
    name: e.d.img, row: AN[e.d.img] && AN[e.d.img].rows.act !== undefined ? 'act' : 'hop', frame: 3, h: e.h, x: e.x, y: e.y, z: e.z,
    vx: e.vx * 0.4 + hx * fling, vy: e.vy * 0.4 + hy * fling * 0.7, vz: clamp(kb, 150, 600) / Math.sqrt(e.mass),
    rot: 0, vrot: (hx >= 0 ? 1 : -1) * rand(6, 12) / e.mass, flip: hx < 0, life: e.type === 'boss' ? 4 : 2.4, max: e.type === 'boss' ? 4 : 2.4, mass: e.mass, r: e.r,
  });
  if (e.type === 'boss') {
    boss = null; shake = 30; hitStop = 0.25; Sfx.boom();
    for (let i = 0; i < 6; i++) dropPickup(e.x + rand(-120, 120), e.y + rand(-80, 80), i < 2 ? 'slice' : i < 4 ? 'weapon' : 'bomb', pick(['cran', 'corn', 'pie']));
    floatText(e.x, e.y - 200, 'GOBBLEZILLA DEFEATED!', '#ffc53d', 2.5, 34);
  }
  if (e.d.split) {
    for (let i = 0; i < 2; i++) {
      const t = spawnEnemy('tot', e.x + rand(-20, 20), e.y + rand(-20, 20));
      t.spawnT = 0; const a = rand(0, Math.PI * 2); t.vx = Math.cos(a) * 260; t.vy = Math.sin(a) * 180; t.vz = 320; t.z = 10; t.hurtT = 0.4;
    }
  }
  const r = Math.random();
  if (e.type !== 'boss') {
    if (r < 0.06) dropPickup(e.x, e.y, 'slice');
    else if (r < 0.13) dropPickup(e.x, e.y, 'weapon', pick(['cran', 'corn', 'pie']));
    else if (r < 0.17) dropPickup(e.x, e.y, 'bomb');
  }
  if (e.type === 'pumpkin' && Math.random() < 0.5) dropPickup(e.x, e.y, 'weapon', pick(['cran', 'corn', 'pie']));
  const pc = CHARS[player.ch];
  if (pc.special === 'scrap' && player.macT <= 0) {
    if (e.type === 'boss') for (let i = 0; i < 3; i++) dropPickup(e.x + rand(-80, 80), e.y + rand(-60, 60), 'scrap');
    else if (Math.random() < 0.38) dropPickup(e.x + rand(-10, 10), e.y + rand(-10, 10), 'scrap');
  }
  if (pc.special === 'taunt' && !player.dead && (e.type === 'boss' || (time - player.lastTaunt > 1.0 && Math.random() < 0.8))) {
    const pool = TAUNTS[e.type] && Math.random() < 0.55 ? TAUNTS[e.type] : TAUNTS.any;
    let line = pick(pool);
    if (player.speech && player.speech.text === line) line = pick(TAUNTS.any);
    player.speech = { text: line, t: 1.9, max: 1.9 }; player.lastTaunt = time;
    Sfx.taunt();
  }
}

function assembleMac() {
  const p = player;
  p.scraps = 0; p.macT = 10;
  if (p.cur !== 'mac') p.prevWeapon = p.cur;
  p.cur = 'mac';
  banner = { text: 'MAC & CHEESE BLASTER!', sub: `${names[p.ch]} built it out of junk!`, t: 1.8 };
  Sfx.assemble();
  p.sq = 0.2; p.sqV = 0;
  for (let i = 0; i < 26; i++) { const a = rand(0, Math.PI * 2); particles.push({ x: p.x, y: p.y, z: 50, vx: Math.cos(a) * rand(80, 260), vy: Math.sin(a) * rand(60, 180), vz: rand(100, 350), life: rand(0.5, 1), max: 1, color: pick(['#ffb627', '#fff1a8', '#9aa4ad', '#ffffff']), size: rand(3, 8), grav: 700 }); }
}

function dropPickup(x, y, kind, weapon) {
  pickups.push({ x, y, z: 0, vz: 220, kind, weapon, life: 16, t: rand(0, 6) });
}

function updateBullets(dt) {
  const p = player;
  for (const b of bullets) {
    b.life -= dt; b.rot += dt * 18;
    if (b.w === 'pie' && b.life < b.max * 0.55) {
      // boomerang back to player
      const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;
      b.vx = lerp(b.vx, dx / d * 720, 1 - Math.exp(-dt * 5)); b.vy = lerp(b.vy, dy / d * 720, 1 - Math.exp(-dt * 5));
      if (d < 40) { b.life = 0; b.caught = true; }
      if (b.hits.size && Math.random() < 0.02) b.hits.clear();
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.w === 'gravy') { b.z -= dt * 25; }
    if (b.w !== 'pie' && hitProp(b)) { b.life = 0; impact(b); continue; }
    if (b.x < 0 || b.x > ARENA.w || b.y < 0 || b.y > ARENA.h) { b.life = 0; continue; }
    for (const e of enemies) {
      if (e.dead || e.spawnT > 0 || b.hits.has(e)) continue;
      const rr = e.r + b.r;
      if ((e.x - b.x) ** 2 + ((e.y - b.y) * 1.2) ** 2 < rr * rr) {
        const sp = Math.hypot(b.vx, b.vy) || 1;
        damageEnemy(e, b.dmg, b.vx / sp, b.vy / sp, b.w === 'cran' ? 260 : b.w === 'pie' ? 200 : b.w === 'mac' ? 40 : 90);
        if (b.w === 'mac' && !e.dead) webEnemy(e, e.type === 'boss' ? 0.9 : e.d.heavy ? 1.8 : 3.2);
        b.hits.add(e);
        if (!WEAPONS[b.w].pierce) { b.life = 0; impact(b); break; }
      }
    }
    if (b.life <= 0 && !b.caught && (b.w === 'gravy' || b.w === 'mac')) impact(b);
  }
  bullets = bullets.filter(b => b.life > 0);

  for (const b of ebullets) {
    b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt;
    if (hitProp(b)) { b.life = 0; continue; }
    if (p.inv <= 0 && (p.x - b.x) ** 2 + (p.y - b.y) ** 2 < (p.r + b.r) ** 2) {
      b.life = 0; const sp = Math.hypot(b.vx, b.vy) || 1; hurtPlayer(b.dmg, b.vx / sp * 0.4, b.vy / sp * 0.4);
    }
  }
  ebullets = ebullets.filter(b => b.life > 0 && b.x > -50 && b.x < ARENA.w + 50 && b.y > -50 && b.y < ARENA.h + 50);
}

function impact(b) {
  const w = WEAPONS[b.w];
  if (b.impacted) return; b.impacted = true;
  for (let i = 0; i < 5; i++) particles.push({ x: b.x, y: b.y, z: b.z, vx: rand(-90, 90), vy: rand(-90, 90), vz: rand(30, 160), life: 0.35, max: 0.35, color: Math.random() < 0.5 ? w.color : w.hi, size: rand(3, 6), grav: 700 });
  if (b.w === 'mac') {
    webs.push({ x: b.x, y: b.y, r: rand(50, 64), life: 4.5, max: 4.5, seed: Math.random() * 10 });
    if (webs.length > 24) webs.shift();
    Sfx.splat();
  }
  if (b.w === 'gravy') {
    const c = CHARS[player.ch];
    if (Math.random() < 0.22 * (c.puddleMul || 1)) puddles.push({ x: b.x, y: b.y, r: rand(34, 52), life: 5, max: 5, seed: Math.random() * 10 });
  }
}

function webEnemy(e, t) {
  if ((e.stuckT || 0) < t) e.stuckT = t;
  e.st = 'move';
}

function updateBombs(dt) {
  for (const b of bombs) {
    b.t -= dt; b.rot += dt * 10;
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.vz -= b.g * dt; b.z += b.vz * dt;
    if (b.t <= 0 || b.z <= 0) {
      b.done = true;
      explode(b.x, b.y, b.radius, b.dmg);
    }
  }
  bombs = bombs.filter(b => !b.done);
}

function explode(x, y, radius, dmg) {
  shake = Math.max(shake, 18); hitStop = 0.05;
  Sfx.boom();
  for (const e of enemies) {
    const d = Math.hypot(e.x - x, (e.y - y) * 1.3);
    if (d < radius + e.r) {
      const f = 1 - Math.min(1, d / (radius + e.r)) * 0.5;
      damageEnemy(e, dmg * f, (e.x - x) / (d || 1), (e.y - y) / (d || 1), 600);
    }
  }
  particles.push({ x, y, z: 0, ring: true, r: radius, life: 0.35, max: 0.35 });
  const cols = ['#c99a55', '#e8c27a', '#7a5a2a', '#4a7a2a', '#f4e1a1'];
  for (let i = 0; i < 50; i++) { const a = rand(0, Math.PI * 2), s = rand(80, radius * 3.2); particles.push({ x, y, z: 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rand(150, 500), life: rand(0.5, 1.1), max: 1.1, color: pick(cols), size: rand(5, 12), grav: 900 }); }
  for (let i = 0; i < 12; i++) particles.push({ x: x + rand(-30, 30), y: y + rand(-20, 20), z: rand(10, 50), vx: rand(-30, 30), vy: rand(-30, 30), vz: rand(30, 90), life: rand(0.6, 1.0), max: 1.0, smoke: true, size: rand(30, 55), grav: -20 });
}

function updateMisc(dt) {
  const p = player, c = CHARS[p.ch];
  for (const pt of particles) {
    pt.life -= dt;
    if (pt.ring || pt.ghost) continue;
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vz -= (pt.grav || 0) * dt; pt.z += pt.vz * dt;
    if (pt.feather) { pt.vx *= Math.exp(-dt * 2); pt.vy *= Math.exp(-dt * 2); pt.vz = Math.max(pt.vz, -50); pt.rot += dt * 3; }
    if (pt.z < 0 && !pt.smoke) { pt.z = 0; pt.vz *= -0.3; pt.vx *= 0.6; pt.vy *= 0.6; }
  }
  particles = particles.filter(pt => pt.life > 0);
  if (particles.length > 900) particles.splice(0, particles.length - 900);
  for (const pu of puddles) pu.life -= dt;
  puddles = puddles.filter(pu => pu.life > 0);
  if (puddles.length > 40) puddles.shift();
  for (const f of floaters) { f.life -= dt; f.y -= dt * 40; }
  if (p.speech) { p.speech.t -= dt; if (p.speech.t <= 0) p.speech = null; }
  for (const w of webs) w.life -= dt;
  webs = webs.filter(w => w.life > 0);
  floaters = floaters.filter(f => f.life > 0);
  for (const it of pickups) {
    it.life -= dt; it.t += dt;
    it.vz -= 900 * dt; it.z = Math.max(0, it.z + it.vz * dt); if (it.z === 0) it.vz = Math.abs(it.vz) > 60 ? -it.vz * 0.4 : 0;
    const d2 = dist2(it, p);
    if (d2 < 130 ** 2) { const d = Math.sqrt(d2) || 1; it.x += (p.x - it.x) / d * 380 * dt; it.y += (p.y - it.y) / d * 380 * dt; }
    if (d2 < 34 ** 2) {
      it.life = 0;
      if (it.kind === 'slice') { const h = 25 * (c.healMul || 1); p.hp = Math.min(p.maxHp, p.hp + h); floatText(p.x, p.y - 110, `+${h} HP`, '#7dff8a'); Sfx.heal(); }
      else if (it.kind === 'bomb') { p.bombs += 2; floatText(p.x, p.y - 110, '+2 Stuffing Bombs', '#ffc53d'); Sfx.pickup(); }
      else if (it.kind === 'scrap') {
        if (p.macT > 0) { score += 25; }
        else {
          p.scraps++;
          Sfx.clank();
          if (p.scraps >= 5) assembleMac();
          else floatText(p.x, p.y - 110, `Scrap ${p.scraps}/5`, '#cfd8dc', 0.9, 17);
        }
      }
      else if (it.kind === 'weapon') {
        const w = WEAPONS[it.weapon]; const had = p.ammo[it.weapon] > 0;
        p.ammo[it.weapon] += w.pickup;
        if (!had) p.cur = it.weapon;
        floatText(p.x, p.y - 110, had ? `+${w.pickup} ${w.name}` : w.name + '!', '#ffc53d');
        Sfx.pickup();
      }
    }
  }
  pickups = pickups.filter(it => it.life > 0);
  enemies = enemies.filter(e => !e.dead);
  updateCorpses(dt);
}

function floatText(x, y, text, color, life = 0.9, size = 18) { floaters.push({ x, y, text: String(text), color, life, max: life, size }); }


// ---------- animation & body-dynamics helpers ----------
const angDiff = (a, b) => ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
const angLerp = (a, b, t) => a + angDiff(a, b) * t;

// draw one frame from a generated animation atlas; feet anchored at (x, y)
function drawAnim(name, row, frame, x, y, h, flip, o = {}) {
  const A = AN[name], im = IMG['anim_' + name];
  if (!A || !im || A.rows[row] === undefined) return false;
  const n = A.n[row], f = (((frame | 0) % n) + n) % n, r = A.rows[row];
  const s = h / A.ref;
  ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot);
  ctx.scale((flip ? -1 : 1) * (o.sx || 1), o.sy || 1);
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  const dx = -A.ax * s, dy = -(A.ch - 2) * s, dw = A.cw * s, dh = A.ch * s;
  ctx.drawImage(im, f * A.cw, r * A.ch, A.cw, A.ch, dx, dy, dw, dh);
  if (o.flash > 0) { const wi = whiteOf('anim_' + name); if (wi) { ctx.globalAlpha = Math.min(1, o.flash * 12) * 0.85; ctx.drawImage(wi, f * A.cw, r * A.ch, A.cw, A.ch, dx, dy, dw, dh); } }
  ctx.restore();
  return true;
}

// choose front / side / back sprite rows from a direction, with hysteresis so it doesn't flicker
function facing(o, dx, dy, dt, sideOnly) {
  const l = Math.hypot(dx, dy); if (l < 1e-4) return;
  const nx = dx / l, ny = dy / l;
  let want = sideOnly ? 'side' : ny > 0.62 ? 'front' : ny < -0.62 ? 'back' : 'side';
  if (!sideOnly && o.dir !== want) {
    if (o.dir === 'front' && ny > 0.45) want = 'front';
    else if (o.dir === 'back' && ny < -0.45) want = 'back';
    else if (o.dir === 'side' && Math.abs(ny) < 0.75) want = 'side';
  }
  if (want !== o.dir) { o.dirHold += dt; if (o.dirHold > 0.07 || sideOnly) { o.dir = want; o.dirHold = 0; } }
  else o.dirHold = 0;
  if (Math.abs(nx) > 0.15) o.flipX = nx < 0;
}

// damped springs for squash/stretch and lean (secondary motion)
function springs(o, dt) {
  o.sqV += (-o.sq * 260 - o.sqV * 15) * dt; o.sq = clamp(o.sq + o.sqV * dt, -0.4, 0.4);
  const lt = o.leanTarget || 0;
  o.leanV = (o.leanV || 0) + ((lt - o.lean) * 170 - (o.leanV || 0) * 13) * dt;
  o.lean = clamp(o.lean + o.leanV * dt, -0.45, 0.45);
}

function dustBurst(x, y, n, scale = 1) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(30, 110) * scale;
    particles.push({ x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 3, z: 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5, vz: rand(20, 70) * scale, life: rand(0.3, 0.55), max: 0.55, color: 'rgba(214,196,156,.85)', size: rand(4, 8) * scale, grav: 120 });
  }
}

function footstep(x, y, k) {
  for (let i = 0; i < 2; i++) particles.push({ x: x + rand(-8, 8), y: y + rand(-2, 2), z: 1, vx: rand(-25, 25), vy: rand(-10, 10), vz: rand(15, 40), life: 0.3, max: 0.3, color: 'rgba(214,196,156,.7)', size: rand(3, 6) * (0.6 + k * 0.4), grav: 100 });
}

function updateCorpses(dt) {
  for (const c of corpses) {
    c.life -= dt;
    c.vz -= 1300 * dt; c.z += c.vz * dt;
    if (c.z <= 0) {
      c.z = 0;
      if (c.vz < -180) { c.vz = -c.vz * 0.32; c.vrot *= 0.5; dustBurst(c.x, c.y, 4, 0.7 + c.mass * 0.15); }
      else c.vz = 0;
    }
    const fr = Math.exp(-dt * (c.z > 0 ? 0.3 : 7));
    c.vx *= fr; c.vy *= fr;
    c.x = clamp(c.x + c.vx * dt, 10, ARENA.w - 10); c.y = clamp(c.y + c.vy * dt, 30, ARENA.h - 10);
    if (c.z > 0) c.rot += c.vrot * dt; else c.rot = angLerp(c.rot, 0, 1 - Math.exp(-dt * 12));
  }
  corpses = corpses.filter(c => c.life > 0);
  if (corpses.length > 40) corpses.splice(0, corpses.length - 40);
}

function drawCorpse(c) {
  const fade = Math.min(1, c.life / 0.7);
  const sink = (1 - fade) * 10;
  const ok = drawAnim(c.name, c.row, c.frame, c.x, c.y - c.z + sink, c.h, c.flip, { rot: c.rot, alpha: fade });
  if (!ok) drawSprite(c.name, c.x, c.y - c.z + sink, c.h, c.flip, { rot: c.rot + Math.PI / 2 * (c.flip ? -1 : 1), alpha: fade });
}

function drawGroundWeb(w) {
  const a = Math.min(1, w.life / 0.8);
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(255,182,39,.55)';
  ctx.beginPath();
  for (let i = 0; i <= 14; i++) { const an = i / 14 * Math.PI * 2, rr = w.r * (0.75 + 0.25 * Math.sin(an * 4 + w.seed)); const px = w.x + Math.cos(an) * rr, py = w.y + Math.sin(an) * rr * 0.55; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,236,150,.85)'; ctx.lineWidth = 2.5;
  for (let i = 0; i < 8; i++) { const an = i / 8 * Math.PI * 2 + w.seed; ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.lineTo(w.x + Math.cos(an) * w.r * 1.05, w.y + Math.sin(an) * w.r * 0.58); ctx.stroke(); }
  for (const k of [0.4, 0.75]) { ctx.beginPath(); ctx.ellipse(w.x, w.y, w.r * k, w.r * k * 0.55, 0, 0, Math.PI * 2); ctx.stroke(); }
  // macaroni bits
  ctx.strokeStyle = '#e8a020'; ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) { const an = w.seed * 3 + i * 1.7, rr = w.r * 0.5 * ((i * 0.37 + w.seed) % 1); ctx.beginPath(); ctx.arc(w.x + Math.cos(an) * rr, w.y + Math.sin(an) * rr * 0.55, 4, 0.3, Math.PI - 0.3); ctx.stroke(); }
  ctx.restore();
}

function drawCheeseWeb(e) {
  const cx = e.x, cy = e.y - e.z - e.h * 0.45, r = e.h * 0.55;
  ctx.save();
  ctx.globalAlpha = Math.min(1, e.stuckT * 2) * 0.9;
  ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = Math.max(2, e.h / 35); ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const a1 = i * 0.9 + e.seed, a2 = a1 + 2.4;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a1) * r * 0.8, cy + Math.sin(a1) * r);
    ctx.quadraticCurveTo(cx, cy + Math.sin(e.t * 3 + i) * 4, cx + Math.cos(a2) * r * 0.8, cy + Math.sin(a2) * r); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,182,39,.35)'; ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.75, r, 0, 0, Math.PI * 2); ctx.fill();
  // drips
  ctx.fillStyle = '#ffb627';
  for (let i = 0; i < 3; i++) { const dx = (i - 1) * r * 0.4, dl = 6 + ((e.t * 20 + i * 7) % 14); ctx.beginPath(); ctx.ellipse(cx + dx, cy + r * 0.85 + dl * 0.5, 3, dl * 0.5, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function drawSpeech(p) {
  const sp = p.speech; if (!sp || sp.t <= 0) return;
  const age = sp.max - sp.t;
  const pop = age < 0.12 ? 0.6 + age / 0.12 * 0.5 : age < 0.2 ? 1.1 - (age - 0.12) / 0.08 * 0.1 : 1;
  const a = Math.min(1, sp.t / 0.25);
  ctx.save();
  ctx.translate(p.x, p.y - p.z - p.h - 26); ctx.scale(pop, pop); ctx.globalAlpha = a;
  ctx.font = "17px 'Lilita One', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const words = sp.text.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > 170 && cur) { lines.push(cur); cur = w; } else cur = t; }
  lines.push(cur);
  const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 22, h = lines.length * 20 + 12;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2b1a10'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h, w, h, 12); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-8, -1.5); ctx.lineTo(0, 12); ctx.lineTo(8, -1.5); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(0, 12); ctx.lineTo(8, 0); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillRect(-7, -4, 14, 4);
  ctx.fillStyle = '#c0392b';
  lines.forEach((l, i) => ctx.fillText(l, 0, -h + 16 + i * 20));
  ctx.restore();
}

// ---------- rendering ----------
let floorPattern = null;
function buildFloor() {
  const im = IMG.floor; if (!im) return;
  // mirror-tile so it's perfectly seamless
  const s = 512, c = document.createElement('canvas'); c.width = c.height = s * 2;
  const x = c.getContext('2d');
  for (let i = 0; i < 4; i++) {
    x.save(); x.translate((i & 1) ? s * 2 : 0, (i & 2) ? s * 2 : 0); x.scale((i & 1) ? -1 : 1, (i & 2) ? -1 : 1);
    x.drawImage(im, 0, 0, s, s); x.restore();
  }
  floorPattern = ctx.createPattern(c, 'repeat');
}

function screenToWorld(sx, sy) {
  return { x: (sx - VW / 2) / ZOOM + cam.x, y: (sy - VH / 2) / ZOOM + cam.y };
}

function drawSprite(name, x, y, h, flip, o = {}) {
  const im = IMG[name]; if (!im) return;
  const w = h * im.width / im.height;
  ctx.save();
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale((flip ? -1 : 1) * (o.sx || 1), o.sy || 1);
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  const wk = o.walk && o.walk.amt > 0.02 ? o.walk : null;
  const blit = src => {
    if (!wk) { ctx.drawImage(src, -w / 2, -h, w, h); return; }
    // procedural walk: split sprite at the hips, legs step alternately, body bobs on top
    const hip = wk.hip || 0.7, iw = src.width, ih = src.height, sy = ih * hip, lh = ih - sy;
    const lift = h * 0.075 * wk.amt, stride = w * 0.07 * wk.amt;
    for (let i = 0; i < 2; i++) {
      const ph = wk.phase + i * Math.PI;
      const up = Math.max(0, Math.sin(ph)) * lift, dx = Math.cos(ph) * stride;
      ctx.drawImage(src, i * iw / 2, sy, iw / 2, lh, -w / 2 + i * w / 2 + dx, -h + h * hip - up, w / 2 + 0.5, h * (1 - hip));
    }
    const bob = Math.abs(Math.cos(wk.phase)) * h * 0.03 * wk.amt; // body dips as each foot lands
    ctx.drawImage(src, 0, 0, iw, sy + 2, -w / 2, -h + bob, w, h * hip + 2 * h / ih);
  };
  blit(im);
  if (o.flash > 0) { const wi = whiteOf(name); ctx.globalAlpha = Math.min(1, o.flash * 12) * 0.85; blit(wi); }
  ctx.restore();
}

function shadow(x, y, r, a = 0.28) {
  ctx.fillStyle = `rgba(30,15,5,${a})`;
  ctx.beginPath(); ctx.ellipse(x, y, r * 1.15, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
}

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#2b1a10'; ctx.fillRect(0, 0, VW, VH);
  if (!player) return;
  const sx = shake ? rand(-shake, shake) * 0.5 : 0, sy = shake ? rand(-shake, shake) * 0.5 : 0;
  ctx.setTransform(DPR * ZOOM, 0, 0, DPR * ZOOM, DPR * (VW / 2 - (cam.x + sx) * ZOOM), DPR * (VH / 2 - (cam.y + sy) * ZOOM));

  // outside the yard
  ctx.fillStyle = '#4a3020'; ctx.fillRect(-1200, -1200, ARENA.w + 2400, ARENA.h + 2400);
  // lawn
  if (floorPattern) { ctx.fillStyle = floorPattern; } else ctx.fillStyle = '#6b7a2a';
  ctx.fillRect(0, 0, ARENA.w, ARENA.h);
  drawFence();

  // puddles
  for (const pu of puddles) {
    const a = Math.min(1, pu.life / 1) * 0.85;
    ctx.fillStyle = `rgba(110,62,22,${a})`;
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) { const an = i / 12 * Math.PI * 2, rr = pu.r * (0.85 + 0.15 * Math.sin(an * 3 + pu.seed)); const px = pu.x + Math.cos(an) * rr, py = pu.y + Math.sin(an) * rr * 0.55; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.fill();
    ctx.fillStyle = `rgba(200,140,80,${a * 0.5})`; ctx.beginPath(); ctx.ellipse(pu.x - pu.r * 0.3, pu.y - pu.r * 0.15, pu.r * 0.25, pu.r * 0.08, 0, 0, Math.PI * 2); ctx.fill();
  }
  for (const w of webs) drawGroundWeb(w);
  // telegraph rings for charging enemies & bombs
  for (const b of bombs) {
    const tx = b.x + b.vx * b.t, ty = b.y + b.vy * b.t;
    ctx.strokeStyle = 'rgba(255,200,80,.5)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.ellipse(tx, ty, b.radius, b.radius * 0.6, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }

  // shadows
  for (const pr of props) shadow(pr.x, pr.y + pr.d * 0.2, pr.w * 0.5, 0.3);
  for (const e of enemies) shadow(e.x, e.y, e.r * (1 - Math.min(e.z, 200) / 330), 0.28 * (1 - Math.min(e.z, 200) / 400));
  shadow(player.x, player.y, player.r * (player.dead && player.z <= 0 ? 1.9 : 1.1) * (1 - Math.min(player.z, 200) / 400));
  for (const c of corpses) shadow(c.x, c.y, c.r * 1.3 * (1 - Math.min(c.z, 200) / 400), 0.22 * Math.min(1, c.life / 0.7));
  for (const it of pickups) shadow(it.x, it.y, 14);
  for (const b of bombs) shadow(b.x, b.y, 14 * (1 - Math.min(b.z, 300) / 500), 0.25);
  for (const b of bullets) shadow(b.x, b.y, b.r * 0.8, 0.18);
  for (const b of ebullets) shadow(b.x, b.y, b.r * 0.8, 0.18);

  // depth-sorted drawables
  const list = [];
  for (const pr of props) list.push([pr.y, () => drawSprite(pr.img, pr.x, pr.y + pr.d * 0.45, pr.h, false)]);
  for (const c of corpses) list.push([c.y - 2, () => drawCorpse(c)]);
  for (const e of enemies) list.push([e.y, () => drawEnemy(e)]);
  list.push([player.y, drawPlayer]);
  for (const it of pickups) list.push([it.y, () => drawPickup(it)]);
  for (const b of bullets) list.push([b.y, () => drawBullet(b)]);
  for (const b of ebullets) list.push([b.y, () => drawEBullet(b)]);
  for (const b of bombs) list.push([b.y, () => drawSprite('w_bomb', b.x, b.y - b.z + 18, 38, false, { rot: b.rot })]);
  for (const pt of particles) if (!pt.smoke && !pt.ring) list.push([pt.y, () => drawParticle(pt)]);
  list.sort((a, b) => a[0] - b[0]);
  for (const [, fn] of list) fn();

  // smoke & rings above
  for (const pt of particles) if (pt.smoke || pt.ring) drawParticle(pt);

  drawSpeech(player);
  // floaters
  ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  for (const f of floaters) {
    const a = Math.min(1, f.life / f.max * 2);
    ctx.globalAlpha = a; ctx.font = `${f.size}px 'Lilita One', sans-serif`;
    ctx.lineWidth = 4; ctx.strokeStyle = '#2b1a10'; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // offscreen enemy indicators + HUD in screen space
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawIndicators();
  drawHUD();
  drawSticks();
}

function drawFence() {
  // wooden fence along the top edge and posts along the sides
  ctx.fillStyle = '#6b4424';
  ctx.fillRect(-20, -70, ARENA.w + 40, 16);
  ctx.fillRect(-20, -40, ARENA.w + 40, 16);
  for (let x = -10; x <= ARENA.w + 10; x += 60) {
    ctx.fillStyle = '#8a5a30'; ctx.fillRect(x - 10, -100, 20, 100);
    ctx.fillStyle = '#5a3a1c'; ctx.fillRect(x - 10, -100, 20, 6);
  }
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(0, 0, ARENA.w, 26);
  ctx.strokeStyle = '#5a3a1c'; ctx.lineWidth = 14;
  ctx.strokeRect(-7, -7, ARENA.w + 14, ARENA.h + 14);
}

function drawEnemy(e) {
  const d = e.d, name = d.img, A = AN[name];
  let alpha = 1;
  if (e.spawnT > 0 && !e.leap) alpha = 1 - e.spawnT / e.spawnMax;
  const sx = 1 - e.sq * 0.7, sy = 1 + e.sq * -1 + 0; // sq>0 squash (wide/short), sq<0 stretch (tall/thin)
  const ssy = 1 - e.sq, ssx = 1 + e.sq * 0.8;
  let row = e.dir, frame = e.frame;
  if (d.ai === 'hop') { row = 'hop'; frame = e.act ?? 0; }
  else if (e.act !== null && e.act !== undefined && A && A.rows.act !== undefined) { row = 'act'; frame = e.act; }
  // charging wind-up shiver
  const shiver = (e.st === 'wind' || e.st === 'aim') ? Math.sin(e.t * 70) * 2 : e.stuckT > 0 ? Math.sin(e.t * 40) * 2.5 : 0;
  const ok = drawAnim(name, row, frame, e.x + shiver, e.y - e.z, e.h, e.flipX, { sx: ssx, sy: ssy, rot: e.lean, flash: e.flash, alpha });
  if (!ok) drawSprite(name, e.x, e.y - e.z, e.h, e.face !== d.face, { sx: ssx, sy: ssy, rot: e.lean, flash: e.flash, alpha });
  if (e.stuckT > 0) drawCheeseWeb(e);
  if (e.hp < e.maxHp && e.type !== 'boss') {
    const w = Math.max(30, e.r * 2), y = e.y - e.h - 12 - e.z;
    ctx.fillStyle = '#2b1a10'; ctx.fillRect(e.x - w / 2 - 1, y - 1, w + 2, 7);
    ctx.fillStyle = '#e8742a'; ctx.fillRect(e.x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 5);
  }
  if (e.st === 'wind' || e.st === 'aim') {
    ctx.fillStyle = '#ff3b3b'; ctx.font = `28px 'Lilita One'`; ctx.textAlign = 'center';
    ctx.fillText('!', e.x, e.y - e.h - 20 - e.z);
  }
}

function drawPlayer() {
  const p = player, A = AN[p.ch];
  const blink = p.inv > 0 && !p.dead && p.dashT <= 0 && Math.floor(time * 20) % 2 === 0;
  let row = p.dir, frame = p.frame, flip = p.flipX, showGun = true;
  if (p.dead) { row = 'act'; frame = 2; showGun = false; flip = p.vx > 0 ? false : p.vx < 0 ? true : flip; }
  else if (p.chargeT > 0) { row = 'act'; frame = 1; flip = p.chargeDir[0] < 0; showGun = false; }
  else if (p.chargeWind > 0) { row = 'act'; frame = 1; showGun = false; }
  else if (p.dashT > 0) { row = 'act'; frame = 1; flip = p.dashDir[0] < 0; showGun = false; }
  else if (p.hurtT > 0) { row = 'act'; frame = 0; showGun = false; }
  else if (p.victoryT > 0 && Math.hypot(p.vx, p.vy) < 30 && p.lastFire > 0.5) { row = 'act'; frame = 3; showGun = false; flip = false; }
  const breathe = row !== 'act' && Math.hypot(p.vx, p.vy) < 25 ? Math.sin(time * 3) * 0.015 : 0;
  const sx = 1 + p.sq * 0.8 - breathe * 0.5, sy = 1 - p.sq + breathe;
  // gun: in front of the body unless facing away; bounces with the stride
  const stepBob = row !== 'act' && Math.hypot(p.vx, p.vy) > 25 ? (p.frame % 2 === 0 ? 2.5 : -1) : 0;
  const behind = row === 'back';
  const drawGun = () => {
    if (!showGun) return;
    const w = WEAPONS[p.cur], im = IMG[w.img]; if (!im) return;
    const a = p.gunAng, fl = Math.cos(a) < 0;
    // held at the hand: side view -> front hand; front view -> off to the right hip; back view -> behind
    const hx = row === 'side' ? (flip ? -12 : 12) : row === 'front' ? 17 : -14;
    const gx = p.x + hx + Math.cos(a) * 6, gy = p.y - p.z - p.h * (row === 'back' ? 0.4 : 0.32) + stepBob + Math.sin(a) * 6;
    ctx.save(); ctx.translate(gx, gy); ctx.rotate(a + p.lean * 0.5); if (fl) ctx.scale(1, -1);
    const gw = p.cur === 'pie' ? 34 : 50, gh = gw * im.height / im.width;
    const kick = p.fireCd > 0 ? Math.max(0, p.fireCd / (w.rate || 1)) * (p.cur === 'cran' ? 12 : 5) : 0;
    ctx.drawImage(im, -gw * 0.3 - kick, -gh / 2, gw, gh);
    ctx.restore();
  };
  if (behind) drawGun();
  if (!blink) {
    const rot = p.dead ? 0 : p.chargeT > 0 ? (p.chargeDir[0] < 0 ? -0.18 : 0.18) : p.lean;
    const wob = p.chargeWind > 0 ? Math.sin(time * 90) * 2 : 0;
    const ok = drawAnim(p.ch, row, frame, p.x + wob, p.y - p.z, p.h, flip, { sx, sy, rot, flash: p.flash });
    if (!ok) drawSprite(p.ch, p.x, p.y - p.z, p.h, p.face < 0, { sx, sy, rot, flash: p.flash });
  }
  if (!behind) drawGun();
}

function drawPickup(it) {
  const y = it.y - it.z - 6 - Math.sin(it.t * 4) * 4;
  if (it.life < 3 && Math.floor(it.t * 10) % 2 === 0) return;
  // glow
  const g = ctx.createRadialGradient(it.x, y - 16, 2, it.x, y - 16, 34);
  g.addColorStop(0, 'rgba(255,220,120,.55)'); g.addColorStop(1, 'rgba(255,220,120,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(it.x, y - 16, 34, 0, Math.PI * 2); ctx.fill();
  if (it.kind === 'slice') drawSprite('slice', it.x, y, 34, false);
  else if (it.kind === 'bomb') drawSprite('w_bomb', it.x, y, 34, false);
  else if (it.kind === 'scrap') drawSprite('scrap', it.x, y, 30, false, { rot: Math.sin(it.t * 3) * 0.15 });
  else {
    // crate with weapon icon
    ctx.fillStyle = '#9a6a3a'; ctx.strokeStyle = '#3b2414'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(it.x - 24, y - 34, 48, 34, 5); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#6b4424'; ctx.beginPath(); ctx.moveTo(it.x - 24, y - 17); ctx.lineTo(it.x + 24, y - 17); ctx.stroke();
    const im = IMG[WEAPONS[it.weapon].img];
    if (im) { const w = 50, h = w * im.height / im.width; ctx.drawImage(im, it.x - w / 2, y - 40 - h / 2, w, h); }
  }
}

function drawBullet(b) {
  const y = b.y - b.z;
  if (b.w === 'pie') { drawSprite('w_pie', b.x, y + 16, 34, false, { rot: b.rot }); return; }
  const w = WEAPONS[b.w];
  const a = Math.atan2(b.vy, b.vx);
  ctx.save(); ctx.translate(b.x, y); ctx.rotate(a);
  const len = b.w === 'corn' ? 1.6 : b.w === 'gravy' ? 1.5 : 1;
  ctx.fillStyle = w.color; ctx.strokeStyle = '#2b1a10'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, b.r * len, b.r, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = w.hi; ctx.beginPath(); ctx.ellipse(b.r * 0.2, -b.r * 0.35, b.r * 0.45, b.r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  if (b.w === 'gravy') { ctx.globalAlpha = 0.5; ctx.fillStyle = w.color; ctx.beginPath(); ctx.ellipse(-b.r * 1.8, 0, b.r * 1.2, b.r * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function drawEBullet(b) {
  const y = b.y - b.z;
  ctx.save(); ctx.translate(b.x, y);
  if (b.kind === 'feather') {
    ctx.rotate(b.rot);
    ctx.fillStyle = '#c8752d'; ctx.strokeStyle = '#3b2414'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#fff3'; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke();
  } else {
    ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = '#7a4a10'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, b.r, b.r * 1.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,60,40,.35)'; ctx.beginPath(); ctx.arc(0, 0, b.r + 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawParticle(pt) {
  const a = Math.max(0, pt.life / pt.max);
  if (pt.ring) {
    const t = 1 - a;
    ctx.strokeStyle = `rgba(255,230,160,${a})`; ctx.lineWidth = 10 * a + 2;
    ctx.beginPath(); ctx.ellipse(pt.x, pt.y, pt.r * (0.4 + t * 0.8), pt.r * 0.6 * (0.4 + t * 0.8), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = `rgba(255,240,200,${a * 0.5})`; ctx.beginPath(); ctx.ellipse(pt.x, pt.y, pt.r * 0.6 * a, pt.r * 0.35 * a, 0, 0, Math.PI * 2); ctx.fill();
    return;
  }
  if (pt.ghost) { if (!(pt.anim && drawAnim(pt.anim, pt.row, pt.frame, pt.x, pt.y, pt.h, pt.flip, { alpha: a * 0.35 }))) drawSprite(pt.img, pt.x, pt.y, pt.h, pt.face < 0, { alpha: a * 0.4 }); return; }
  if (pt.smoke) {
    ctx.fillStyle = `rgba(230,215,190,${a * 0.45})`;
    ctx.beginPath(); ctx.arc(pt.x, pt.y - pt.z, pt.size * (1.5 - a * 0.5), 0, Math.PI * 2); ctx.fill(); return;
  }
  ctx.globalAlpha = Math.min(1, a * 2);
  ctx.fillStyle = pt.color;
  if (pt.feather) {
    ctx.save(); ctx.translate(pt.x, pt.y - pt.z); ctx.rotate(pt.rot);
    ctx.beginPath(); ctx.ellipse(0, 0, pt.size * 1.4, pt.size * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  } else {
    ctx.beginPath(); ctx.arc(pt.x, pt.y - pt.z, pt.size * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawIndicators() {
  const m = 26;
  for (const e of enemies) {
    const s = { x: (e.x - cam.x) * ZOOM + VW / 2, y: (e.y - e.h / 2 - cam.y) * ZOOM + VH / 2 };
    if (s.x > -10 && s.x < VW + 10 && s.y > -10 && s.y < VH + 10) continue;
    const cx = clamp(s.x, m, VW - m), cy = clamp(s.y, m + 60, VH - m);
    const a = Math.atan2(s.y - VH / 2, s.x - VW / 2);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    ctx.fillStyle = e.type === 'boss' ? '#ff3b3b' : 'rgba(255,140,60,.8)';
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

function hudText(t, x, y, size, color = '#fff4dc', align = 'left') {
  ctx.font = `${size}px 'Lilita One', sans-serif`; ctx.textAlign = align; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = '#2b1a10'; ctx.strokeText(t, x, y);
  ctx.fillStyle = color; ctx.fillText(t, x, y);
}

function drawHUD() {
  const p = player, c = CHARS[p.ch];
  const top = 12 + (window.visualViewport ? 0 : 0);
  // portrait
  const pr = 30, px = 14 + pr, py = top + pr;
  ctx.save();
  ctx.fillStyle = '#fff4dc'; ctx.strokeStyle = '#2b1a10'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.clip();
  const im = IMG[p.ch]; if (im) { const h = pr * 4.2, w = h * im.width / im.height; ctx.drawImage(im, px - w / 2, py - pr * 1.05, w, h); }
  ctx.restore();
  ctx.strokeStyle = '#2b1a10'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.stroke();
  // name + hp bar
  const bx = px + pr + 10, bw = Math.min(220, VW * 0.35);
  hudText(names[p.ch], bx, top + 20, 18);
  ctx.fillStyle = '#2b1a10'; ctx.beginPath(); ctx.roundRect(bx - 2, top + 28, bw + 4, 18, 9); ctx.fill();
  const f = p.hp / p.maxHp;
  ctx.fillStyle = f > 0.5 ? '#6fd36f' : f > 0.25 ? '#ffc53d' : '#ff5a4a';
  ctx.beginPath(); ctx.roundRect(bx, top + 30, Math.max(0, bw * f), 14, 7); ctx.fill();
  hudText(`${Math.ceil(p.hp)} / ${p.maxHp}`, bx + bw / 2, top + 42, 12, '#fff', 'center');

  // score / wave (top right, below buttons)
  hudText(`${score.toLocaleString()}`, VW - 14, top + 76, 26, '#ffc53d', 'right');
  hudText(`WAVE ${wave}`, VW - 14, top + 98, 16, '#fff4dc', 'right');

  // weapons bar (bottom center)
  // phones: compact row at the top-left (keeps the bottom-left free for the move stick)
  const slots = WEAPON_ORDER, sw = isTouch ? 46 : 58, gap = isTouch ? 6 : 8, total = slots.length * (sw + gap) + sw + gap;
  let x = isTouch ? 14 : VW / 2 - total / 2;
  const y = isTouch ? top + 70 : VH - sw - 14;
  hudSlots = [];
  slots.forEach((k, i) => {
    hudSlots.push({ k, x, y, w: sw });
    const w = WEAPONS[k], have = p.ammo[k] > 0, cur = p.cur === k;
    ctx.globalAlpha = have ? 1 : 0.35;
    ctx.fillStyle = cur ? '#ffc53d' : '#3b2414cc'; ctx.strokeStyle = cur ? '#fff4dc' : '#2b1a10'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x, y, sw, sw, 12); ctx.fill(); ctx.stroke();
    const im = IMG[w.img]; if (im) { const iw = sw - 12, ih = iw * im.height / im.width; ctx.drawImage(im, x + 6, y + sw / 2 - ih / 2 - 4, iw, ih); }
    hudText(k === 'gravy' ? '∞' : String(p.ammo[k]), x + sw / 2, y + sw - 5, 13, '#fff', 'center');
    if (!isTouch) hudText(String(i + 1), x + 9, y + 15, 11, '#fff4dc', 'center');
    ctx.globalAlpha = 1;
    x += sw + gap;
  });
  // bombs
  hudSlots.push({ k: 'bomb', x, y, w: sw });
  ctx.fillStyle = '#3b2414cc'; ctx.strokeStyle = '#2b1a10'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(x, y, sw, sw, 12); ctx.fill(); ctx.stroke();
  if (IMG.w_bomb) ctx.drawImage(IMG.w_bomb, x + 10, y + 4, sw - 20, (sw - 20) * IMG.w_bomb.height / IMG.w_bomb.width);
  hudText(`x${p.bombs}`, x + sw / 2, y + sw - 5, 13, '#fff', 'center');
  if (!isTouch) hudText('SPC', x + sw / 2, y - 4, 10, '#fff4dc', 'center');
  x += sw + gap;
  // character specials
  if (c.special === 'scrap') {
    hudSlots.push({ k: 'info', x, y, w: sw });
    ctx.fillStyle = p.macT > 0 ? '#ffb627' : '#3b2414cc'; ctx.strokeStyle = '#2b1a10'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x, y, sw, sw, 12); ctx.fill(); ctx.stroke();
    const icon = p.macT > 0 ? IMG.w_mac : IMG.scrap;
    if (icon) { const iw = sw - 12, ih = Math.min(sw - 16, iw * icon.height / icon.width); ctx.drawImage(icon, x + 6, y + 4, iw, ih); }
    if (p.macT > 0) {
      hudText(`${Math.ceil(p.macT)}s`, x + sw / 2, y + sw - 5, 13, '#fff', 'center');
      ctx.fillStyle = '#2b1a10'; ctx.fillRect(x, y + sw + 3, sw, 6); ctx.fillStyle = '#ffd84a'; ctx.fillRect(x, y + sw + 3, sw * p.macT / 10, 6);
    } else {
      hudText(`${p.scraps}/5`, x + sw / 2, y + sw - 5, 13, '#fff', 'center');
      for (let i = 0; i < 5; i++) { ctx.fillStyle = i < p.scraps ? '#cfd8dc' : '#2b1a10aa'; ctx.fillRect(x + 4 + i * (sw - 8) / 5, y + sw + 3, (sw - 8) / 5 - 2, 5); }
    }
  } else if (c.special === 'charge') {
    hudSlots.push({ k: 'special', x, y, w: sw });
    const ready = p.chargeCd <= 0 && p.chargeT <= 0 && p.chargeWind <= 0;
    ctx.fillStyle = ready ? '#e8742a' : '#3b2414cc'; ctx.strokeStyle = ready ? '#fff4dc' : '#2b1a10'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x, y, sw, sw, 12); ctx.fill(); ctx.stroke();
    if (!ready && p.chargeT <= 0 && p.chargeWind <= 0) { ctx.fillStyle = 'rgba(255,140,60,.55)'; const f = 1 - clamp(p.chargeCd / 6, 0, 1); ctx.fillRect(x + 3, y + sw - 3 - (sw - 6) * f, sw - 6, (sw - 6) * f); }
    hudText('CHARGE', x + sw / 2, y + sw / 2 + 2, isTouch ? 10 : 12, '#fff', 'center');
    if (!isTouch) hudText('F', x + 9, y + 15, 11, '#fff4dc', 'center');
    const tb = $('tSpecial'); if (tb) tb.style.opacity = ready ? '1' : '0.45';
  }
  // weapon name
  if (isTouch) hudText(WEAPONS[p.cur].name, 14, y + sw + 16, 13, '#fff4dc', 'left');
  else hudText(WEAPONS[p.cur].name, VW / 2, y - 10, 15, '#fff4dc', 'center');

  // boss bar
  if (boss) {
    const w = Math.min(520, VW - 40), bx2 = VW / 2 - w / 2, by = top + (isTouch ? 158 : 82);
    hudText('GOBBLEZILLA', VW / 2, by - 6, 18, '#ff6b4a', 'center');
    ctx.fillStyle = '#2b1a10'; ctx.beginPath(); ctx.roundRect(bx2 - 3, by, w + 6, 18, 9); ctx.fill();
    ctx.fillStyle = '#d6332a'; ctx.beginPath(); ctx.roundRect(bx2, by + 3, Math.max(0, w * boss.hp / boss.maxHp), 12, 6); ctx.fill();
  }

  // banner
  if (banner) {
    const t = banner.t, a = Math.min(1, t * 3, (2.4 - t) * 4 + 0.2);
    ctx.globalAlpha = clamp(a, 0, 1);
    const sc = 1 + Math.max(0, (t - 1.9)) * 1.5;
    const size = Math.min(64, VW / 11) * sc;
    hudText(banner.text, VW / 2, VH * 0.36, size, '#ffc53d', 'center');
    if (banner.sub) hudText(banner.sub, VW / 2, VH * 0.36 + size * 0.7, size * 0.38, '#fff4dc', 'center');
    ctx.globalAlpha = 1;
  }
}

function drawSticks() {
  if (!isTouch) return;
  if (!sticks.move && state === 'play') {
    // idle hint showing where the move stick lives
    const hx = Math.min(110, VW * 0.22), hy = VH - 150;
    ctx.strokeStyle = 'rgba(255,244,220,.25)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(hx, hy, 56, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,244,220,.18)'; ctx.beginPath(); ctx.arc(hx, hy, 24, 0, Math.PI * 2); ctx.fill();
  }
  for (const k of ['move', 'aim']) {
    const s = sticks[k]; if (!s) continue;
    ctx.fillStyle = 'rgba(255,244,220,.15)'; ctx.strokeStyle = 'rgba(255,244,220,.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(s.ox, s.oy, 64, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = k === 'aim' ? 'rgba(232,116,42,.8)' : 'rgba(255,244,220,.7)';
    ctx.beginPath(); ctx.arc(s.x, s.y, 28, 0, Math.PI * 2); ctx.fill();
  }
  if (state === 'play' && time < 8) {
    ctx.globalAlpha = Math.min(1, (8 - time) / 2) * 0.8;
    hudText('LEFT thumb: drag to move', VW / 2, VH * 0.62, 17, '#fff4dc', 'center');
    hudText('RIGHT thumb: drag to aim (or just let it auto-fire)', VW / 2, VH * 0.62 + 24, 13, '#fff4dc', 'center');
    ctx.globalAlpha = 1;
  }
}

// ---------- screens / flow ----------
function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('show', s.id === id);
  $('touch').classList.toggle('show', isTouch && id === null && state === 'play');
  if (player) $('tSpecial').style.display = CHARS[player.ch].special === 'charge' ? 'flex' : 'none';
  $('pauseBtn').style.display = state === 'play' ? 'flex' : 'none';
}

function buildCards() {
  const wrap = $('cards'); wrap.innerHTML = '';
  for (const k of CHAR_ORDER) {
    const c = CHARS[k];
    const el = document.createElement('div');
    el.className = 'card' + (k === selected ? ' sel' : '');
    el.innerHTML = `<img src="assets/${k}.png" alt=""><input maxlength="16" aria-label="Name"><div class="role"></div><div class="perk"></div>
      <div class="stats"><span>❤ ${c.hp}</span><span>⚡ ${c.speed}</span></div>`;
    const inp = el.querySelector('input'); inp.value = names[k];
    el.querySelector('.role').textContent = c.role;
    el.querySelector('.perk').textContent = c.perk;
    inp.addEventListener('input', () => { names[k] = inp.value.trim() || CHARS[k].name; store.set('tg_names', names); });
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') inp.blur(); });
    el.addEventListener('click', () => { selected = k; store.set('tg_char', k); for (const c2 of wrap.children) c2.classList.remove('sel'); el.classList.add('sel'); });
    el.addEventListener('dblclick', e => { if (e.target !== inp) startGame(); });
    wrap.appendChild(el);
  }
}

function startGame() {
  Sfx.unlock();
  document.activeElement && document.activeElement.blur && document.activeElement.blur();
  sticks.move = sticks.aim = null;
  newGame();
  state = 'play';
  show(null);
}

function togglePause() {
  if (state === 'play') { state = 'paused'; show('pause'); }
  else if (state === 'paused') { state = 'play'; show(null); last = performance.now(); }
}

function toggleMute() { const m = Sfx.toggle(); $('muteBtn').textContent = m ? '🔇' : '🔊'; }

function gameOver() {
  state = 'over';
  const hi = store.get('tg_hi', 0);
  const isHi = score > hi; if (isHi) store.set('tg_hi', score);
  $('overTitle').textContent = pick(['STUFFED!', 'GOBBLED UP!', 'YOU GOT BASTED!', 'TOAST!']);
  $('overStats').innerHTML = '';
  const lines = [`${names[player.ch]} survived to wave ${wave}`, `Score: ${score.toLocaleString()}${isHi ? '  🏆 NEW BEST!' : ''}`, `Foes defeated: ${kills}`, `Best: ${Math.max(hi, score).toLocaleString()}`];
  for (const l of lines) { const d = document.createElement('div'); d.textContent = l; $('overStats').appendChild(d); }
  setTimeout(() => show('over'), 250);
}

$('playBtn').addEventListener('click', () => { Sfx.unlock(); state = 'select'; buildCards(); show('select'); });
$('goBtn').addEventListener('click', startGame);
$('againBtn').addEventListener('click', startGame);
$('charBtn').addEventListener('click', () => { state = 'select'; buildCards(); show('select'); });
$('resumeBtn').addEventListener('click', togglePause);
$('quitBtn').addEventListener('click', () => { state = 'title'; player = null; show('title'); refreshTitle(); });
$('muteBtn').addEventListener('click', toggleMute);
$('pauseBtn').addEventListener('click', togglePause);
$('muteBtn').textContent = Sfx.muted ? '🔇' : '🔊';

function refreshTitle() {
  const hi = store.get('tg_hi', 0);
  $('hiScore').textContent = hi ? `Best score: ${hi.toLocaleString()}` : '';
}
$('ctrlHint').textContent = isTouch
  ? 'Left thumb moves · Right thumb aims & fires (or let it auto-fire) · Tap the bomb to throw stuffing'
  : 'WASD move · Mouse aim · Click fire · Space stuffing bomb · Shift dash · Q/E or 1–4 swap weapons · F special';
$('title').style.backgroundImage = "url('assets/title.jpg')";
refreshTitle();

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state === 'play' || state === 'over') {
    if (state === 'play') update(dt);
    else { // keep particles alive under the game over screen
      time += dt; updateMisc(dt);
    }
  }
  render();
  requestAnimationFrame(frame);
}

if (new URLSearchParams(location.search).has('debug')) window.__tg = { fn: { assembleMac: () => assembleMac(), spawn: (t, x, y) => spawnEnemy(t, x, y), drop: (x, y, k) => dropPickup(x, y, k) }, get s() { return { state, wave, score, kills, player, cam, ZOOM, enemies: enemies && enemies.map(e => [e.type, Math.round(e.x), Math.round(e.y), e.spawnT]), bullets: bullets && bullets.length }; } };
loadAssets().then(() => { buildFloor(); requestAnimationFrame(frame); });
})();
