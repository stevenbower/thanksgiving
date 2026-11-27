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
const ASSET_NAMES = ['grandpa','grandma','teen','kidred','kidstripe','mama','pops','michelle','arthur','turkey','potato','corn','pumpkin','cranberry','boss',
  'w_gravy','w_cran','w_corn','w_bomb','w_pie','hay','table','gravyboat','slice','w_mac','scrap','w_can','w_slime','w_chili',
  'mashboss','gourdboss','cornboss','medkit','d_firepit','d_blanket','d_flowerbed','d_patch','d_pond','d_mush','y_rocks','y_leaves','y_pumpkins','y_mums','y_lily'];
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
  kidstripe: { name:'Benny',        role:'Trash Talker',    hp:90,  speed:290, perk:'Bigger Stuffing Bombs and a big mouth. SPECIAL: hurls insults so mean they hurt, and enemies run away crying!', bombs:6, bombMul:1.5, special:'taunt' },
  mama:      { name:'Mama',         role:'Caffeine Queen',  hp:105, speed:280, perk:'SPECIAL: hurls fizzing energy drink cans. Anything splashed goes bonkers and attacks the other enemies!', special:'can' },
  pops:      { name:'Pops',         role:'The Big Stomp',   hp:140, speed:250, perk:'Tough as a turkey leg. SPECIAL: a giant jump that lands with a shockwave, knocking every enemy flat on their backs!', special:'stomp' },
  michelle:  { name:'Aunty Michelle', role:'Slime Slinger', hp:100, speed:275, perk:'SPECIAL: lobs balls of acid slime that melt enemies into gooey, harmless puddles of themselves!', special:'slime' },
  arthur:    { name:'Arthur',       role:'Hot Mouth',       hp:115, speed:265, perk:'SPECIAL: pops a chili pepper and breathes a roaring blast of fire for 5 seconds!', special:'chili' },
};
const CHAR_ORDER = ['grandpa','grandma','pops','mama','michelle','arthur','teen','kidred','kidstripe'];

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
  boss:      { img:'boss',      hp:2400,speed:95,  r:85, h:270, dmg:25, score:5000,ai:'boss',   face:-1, heavy:true, gobble:true, hip:0.78, mass:6, stride:0.26,
               boss:true, lvl:5,  bname:'GOBBLEZILLA',      moves:['charge','burst','summon'],          shot:'feather', summon:['turkey','turkey','cranberry','potato'] },
  mashboss:  { img:'mashboss',    hp:3000,speed:85,  r:88, h:250, dmg:24, score:7000,ai:'boss',   face:1,  heavy:true, hip:0.8,  mass:6, stride:0.22,
               boss:true, lvl:10, bname:'THE MASH MONSTER', moves:['slam','volley','summon','slam'],   shot:'gravy',   summon:['potato','tot','tot','potato'], aura:'rgba(150,90,30,' },
  gourdboss: { img:'gourdboss',   hp:3800,speed:80,  r:98, h:285, dmg:28, score:9000,ai:'boss',   face:1,  heavy:true, hip:0.8,  mass:7, stride:0.24,
               boss:true, lvl:15, bname:'THE GREAT GOURD',  moves:['roll','spiral','summon','roll'],   shot:'seed',    summon:['pumpkin','cranberry','cranberry'], aura:'rgba(255,120,20,' },
  cornboss:  { img:'cornboss',      hp:4600,speed:105, r:80, h:300, dmg:28, score:12000,ai:'boss',  face:1,  heavy:true, hip:0.8,  mass:6, stride:0.26,
               boss:true, lvl:20, bname:'GENERAL COB',      moves:['volley','spiral','charge','summon'], shot:'kernel', summon:['corn','turkey','corn'], aura:'rgba(255,230,80,' },
};

const ARENA = { w: 2400, h: 1600 };
const ROAST_CD = 4.5, CAN_CD = 5, STOMP_CD = 6, SLIME_CD = 5, CHILI_CD = 10;

// Benny's trash talk: rude, but kid-friendly
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
  mashboss: ['Mashed you, lumpy!', 'Back in the bowl, butterface!'], gourdboss: ['Bow down? NO, fall down!', 'Who\'s the king now, squash-head?!'], cornboss: ['Kernel PANIC, General!', 'Shucked ya, General Goofball!'],
  boss: ['WHO\'S THE TURKEY NOW, BIG BABY?!', 'Gobble-ZILLA? More like Gobble-LOSER!', 'Bye-bye, giant butterball!'],
};
// insults Benny physically hurls: short enough to fly as a word
const INSULTS = {
  any: ['LOSER!', 'DORK!', 'DWEEB!', 'NERD!', 'STINKY!', 'DUMMY!', 'GOOBER!', 'LAME-O!', 'BUTT-FACE!', 'WIMP!', 'DOOFUS!', 'BOZO!', 'SLOWPOKE!', 'POOPHEAD!', 'NINCOMPOOP!', 'BIG BABY!', 'SMELLY!'],
  turkey: ['BIRDBRAIN!', 'FEATHERBUTT!', 'BUTTERBALL!'], potato: ['SPUD-FACE!', 'TATER BRAIN!', 'COUCH POTATO!'], tot: ['TINY TOT!', 'BABY SPUD!'],
  corn: ['CORN-HEAD!', 'COB-LOSER!'], pumpkin: ['PUMPKIN BUTT!', 'BIG HEAD!'], cranberry: ['JELLY BELLY!', 'WOBBLE-BUTT!'], boss: ['GOBBLE-LOSER!', 'GIANT DORK!', 'MEGA BABY!'],
};
const ROAST_SHOUTS = ['Hey losers, CATCH!', 'Roast time, nerds!', 'Take THIS, dorks!', 'Say it to my FACE!', 'Words HURT, dummies!', 'Incoming insults!', 'You\'re all LAME!'];
const MAMA_SHOUTS = ['Drink up, turkeys!', 'Who needs a nap?!', 'Caffeine TIME!', 'Mama needs her space!', 'Here, have some energy!', 'Go bug each other!'];
const POPS_SHOUTS = ['Dad STOMP!', 'Ground pound!', 'Watch THIS!', 'Timber!', 'Everybody DOWN!'];
const MICHELLE_SHOUTS = ['Eww, have some slime!', 'Melt, you weirdos!', 'Goo-bye!', 'Slime TIME!', 'Ooh, that looks gross!'];
const ARTHUR_SHOUTS = ['Ooh, SPICY!', 'HOT HOT HOT!', 'Who ordered it extra crispy?!', 'Turkey roast, coming up!'];
const MELT = ['MELTED!', 'GOOEY!', 'Ew!', 'SPLORT!', 'Gross!'];
const SPAZ = ['SPAZZ!', 'ZOOM!', 'BZZZT!', 'HYPER!', 'WHEEE!'];
const CRY = ['WAAAH!', 'Mommy!', '*sniff*', 'So mean!', 'Rude!!', 'WAH!'];
const POW = ['POW!', 'BAM!', 'WHAM!', 'KAPOW!', 'BONK!', 'SMACK!', 'BOOM!'];


// ---------- canvas ----------
const cv = $('game');
const ctx = cv.getContext('2d');
let VW = 0, VH = 0, DPR = 1, ZOOM = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  // measure the canvas itself (it's pinned to the viewport edges) so iOS toolbar changes never leave a gap
  const r = cv.getBoundingClientRect();
  VW = Math.round(r.width) || window.innerWidth; VH = Math.round(r.height) || window.innerHeight;
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  ZOOM = clamp(Math.sqrt(VW * VH) / 880, 0.55, 2.2);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.visualViewport) visualViewport.addEventListener('resize', resize);
resize();
setInterval(() => { const r = cv.getBoundingClientRect(); if (Math.round(r.width) !== VW || Math.round(r.height) !== VH) resize(); }, 400);

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
    roast() { tone({ f: 220, f2: 520, type: 'sawtooth', dur: 0.18, vol: 0.09 }); [0, 1, 2, 3].forEach(i => tone({ f: rand(600, 1000), f2: rand(300, 1400), type: 'square', dur: 0.07, vol: 0.06, delay: 0.08 + i * 0.06 })); tone({ f: 900, f2: 200, type: 'triangle', dur: 0.3, vol: 0.08, delay: 0.1 }); },
    fizz() { burst({ dur: 0.5, vol: 0.35, freq: 6000, type: 'highpass' }); tone({ f: 400, f2: 1600, type: 'sine', dur: 0.2, vol: 0.08 }); },
    chomp() { [0, 1, 2].forEach(i => tone({ f: 180, f2: 90, type: 'square', dur: 0.06, vol: 0.1, delay: i * 0.16 })); tone({ f: 400, f2: 1400, type: 'sawtooth', dur: 0.35, vol: 0.06, delay: 0.45 }); },
    flame() { if (throttle('flame', 90)) return; burst({ dur: 0.18, vol: 0.22, freq: 900, type: 'lowpass' }); },
    roar(t) { if (throttle('roar', 400)) return; const f = t === 'mashboss' ? 70 : t === 'gourdboss' ? 55 : 95; tone({ f, f2: f * 0.5, type: 'sawtooth', dur: 0.6, vol: 0.22 }); tone({ f: f * 1.5, f2: f * 0.7, type: 'square', dur: 0.5, vol: 0.06 }); burst({ dur: 0.4, vol: 0.15, freq: 500 }); },
    rustle(n) { if (throttle('rustle', 120)) return; burst({ dur: 0.18, vol: Math.min(0.22, 0.05 + n * 0.01), freq: 5000, type: 'highpass' }); },
    splash() { if (throttle('splash', 140)) return; burst({ dur: 0.22, vol: 0.16, freq: 1800, type: 'bandpass', q: 1.5 }); tone({ f: 600, f2: 200, type: 'sine', dur: 0.12, vol: 0.05 }); },
    thump() { if (throttle('thump', 90)) return; tone({ f: 140, f2: 70, type: 'sine', dur: 0.12, vol: 0.2 }); burst({ dur: 0.06, vol: 0.08, freq: 700 }); },
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
  if (k === 't' && state === 'play') setAuto(!autoAim, autoFire);
  if (k === 'r' && state === 'play') setAuto(autoAim, !autoFire);
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
  if (e.touches.length === 0) { sticks.move = sticks.aim = null; fireHeld = false; fireTouch = null; $('tFire').classList.remove('down'); }
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
// FIRE button (shown when auto-fire is off): hold to shoot wherever you're aiming
let fireHeld = false, fireTouch = null;
{ const el = $('tFire');
  el.addEventListener('touchstart', e => { e.stopPropagation(); e.preventDefault(); Sfx.unlock(); fireHeld = true; fireTouch = e.changedTouches[0].identifier; el.classList.add('down'); }, { passive: false });
  const up = e => { for (const t of e.changedTouches) if (t.identifier === fireTouch) { fireHeld = false; fireTouch = null; el.classList.remove('down'); } };
  window.addEventListener('touchend', up); window.addEventListener('touchcancel', up);
  el.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); fireHeld = true; el.classList.add('down'); });
  window.addEventListener('mouseup', () => { if (fireTouch === null) { fireHeld = false; el.classList.remove('down'); } }); }

// ---------- game state ----------
let state = 'title';
let selected = store.get('tg_char', 'grandpa');
const names = Object.fromEntries(CHAR_ORDER.map(k => [k, CHARS[k].name])); // fixed names (renaming was removed)
let tableT = 8, corpses = [], webs = [], roasts = [], cans = [], acids = [], flames = [];
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
    scraps: 0, macT: 0, prevWeapon: 'gravy', chargeCd: 0, chargeWind: 0, chargeT: 0, chargeDir: [1, 0], chargeTarget: null, lastTaunt: -9, speech: null, roastCd: 0, roastFlash: 0, canCd: 0, stompCd: 0, stompWind: 0, jumpT: 0, slimeCd: 0, chiliCd: 0, chewT: 0, breathT: 0,
  };
  enemies = []; bullets = []; ebullets = []; bombs = []; particles = []; puddles = []; pickups = []; floaters = []; corpses = []; webs = []; roasts = []; cans = []; acids = []; flames = []; tableT = 8;
  initYard();
  spawnQueue = []; wave = Math.max(0, (testLevel || parseInt(new URLSearchParams(location.search).get('wave')) || 1) - 1); score = 0; kills = 0; shake = 0; time = 0; banner = null; boss = null; hitStop = 0;
  props = makeProps();
  cam.x = player.x; cam.y = player.y;
  startWave();
}

// ---------- the yard: a hand-laid map with unique features ----------
const MAP = {
  tables: [[1200, 640], [430, 1060], [1980, 1030]],
  hay: [[400, 380], [2010, 390], [780, 1330], [1660, 1360]],
  barrels: [[820, 560], [1580, 560], [2230, 1250]],
  rocks: [[950, 1080, 1.1], [2140, 640, 1.3], [250, 1380, 1], [1460, 980, 0.8], [640, 200, 0.9]],
  pond: [1760, 250, 150, 70],
  firepit: [1200, 1250],
  path: [[-40, 1500], [380, 1250], [800, 980], [1200, 900], [1640, 760], [2000, 560], [2450, 380]],
  blankets: [[1500, 1170, 0.2], [660, 760, -0.15]],
  leafpiles: [[300, 230], [2160, 1460], [1080, 380], [1900, 1250]],
  flowers: [[930, 230], [2230, 860], [130, 820]],
  patches: [[300, 1480], [1960, 730], [1400, 1460]],
  mushrooms: [[720, 1440], [2280, 150], [1330, 260]],
};

function makeProps() {
  const P = [];
  const add = (img, x, y, h, w, d, extra) => P.push({ img, x, y, h, w, d, ...extra });
  for (const [x, y] of MAP.tables) add('table', x, y, 170, 170, 60, { table: true });
  for (const [x, y] of MAP.hay) add('hay', x, y, 110, 100, 44);
  for (const [x, y] of MAP.barrels) add('gravyboat', x, y, 96, 60, 36);
  for (const [x, y, k] of MAP.rocks) add(null, x, y, 46 * k, 78 * k, 40 * k, { rock: true, k, seed: x * 0.37 + y });
  const [fx, fy] = MAP.firepit; add(null, fx, fy, 0, 86, 46, { flat: true, fire: true });
  return P;
}


// ---------- the living yard: leaves, pumpkins, flowers, water and footprints all react to you ----------
let leaves = [], gourds = [], blooms = [], prints = [], ripples = [], cattails = [], yardSpr = null;
const inPond = (x, y) => { const [px, py, rx, ry] = MAP.pond; return ((x - px) / rx) ** 2 + ((y - py) / ry) ** 2 < 0.9; };

function makeYardSprites() {
  const mk = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; };
  const LEAF_COL = [['#a82a1e', '#e2553a'], ['#d4741e', '#f6b04a'], ['#d9a52a', '#ffe08a'], ['#7a3416', '#b8622a'], ['#c4501e', '#f08a40'], ['#9c2f2a', '#d8783a']];
  const leafs = [];
  for (let v = 0; v < 12; v++) {
    const [c1, c2] = LEAF_COL[v % LEAF_COL.length], maple = v % 3 !== 2;
    leafs.push(mk(32, 32, (g, w, h) => {
      g.translate(16, 17);
      const gr = g.createLinearGradient(-10, -10, 10, 10); gr.addColorStop(0, c2); gr.addColorStop(1, c1);
      g.fillStyle = gr; g.strokeStyle = 'rgba(50,20,8,.75)'; g.lineWidth = 1;
      g.beginPath();
      if (maple) {
        // five pointed lobes with little teeth between them
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.95, a0 = a - 0.47, a1 = a + 0.47, R = i === 2 ? 13 : i === 0 || i === 4 ? 9 : 12;
          const vx0 = Math.cos(a0) * 4.5, vy0 = Math.sin(a0) * 4.5;
          if (i === 0) g.moveTo(vx0, vy0);
          g.lineTo(Math.cos(a - 0.22) * R * 0.72, Math.sin(a - 0.22) * R * 0.72);
          g.lineTo(Math.cos(a - 0.12) * R * 0.66, Math.sin(a - 0.12) * R * 0.66);
          g.lineTo(Math.cos(a) * R, Math.sin(a) * R);
          g.lineTo(Math.cos(a + 0.12) * R * 0.66, Math.sin(a + 0.12) * R * 0.66);
          g.lineTo(Math.cos(a + 0.22) * R * 0.72, Math.sin(a + 0.22) * R * 0.72);
          g.lineTo(Math.cos(a1) * 4.5, Math.sin(a1) * 4.5);
        }
        g.lineTo(2, 6); g.lineTo(-2, 6);
      } else {
        g.moveTo(0, -13); g.bezierCurveTo(8, -8, 8, 6, 0, 11); g.bezierCurveTo(-8, 6, -8, -8, 0, -13);
      }
      g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(70,25,10,.55)'; g.lineWidth = 0.8; g.beginPath();
      if (maple) for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.95, R = i === 2 ? 12 : 9; g.moveTo(0, 3); g.lineTo(Math.cos(a) * R * 0.85, Math.sin(a) * R * 0.85); }
      else { g.moveTo(0, -11); g.lineTo(0, 10); for (let k = -2; k <= 2; k++) { g.moveTo(0, k * 4); g.lineTo(5, k * 4 - 3); g.moveTo(0, k * 4); g.lineTo(-5, k * 4 - 3); } }
      g.stroke();
      g.strokeStyle = '#5a2a10'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, 5); g.lineTo(1, 13); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(-3, -4, 4, 2, -0.6, 0, Math.PI * 2); g.fill();
    }));
  }
  const pumps = [];
  for (let v = 0; v < 4; v++) pumps.push(mk(80, 80, (g) => {
    g.translate(40, 44);
    const R = 26, H = 22, hue = ['#e8742a', '#f08a2a', '#de6a24', '#f29a3a'][v];
    // ribs: overlapping lobes, darker toward the edges
    for (const [ox, sc, l] of [[-0.72, 0.42, 0.75], [0.72, 0.42, 0.75], [-0.4, 0.5, 0.88], [0.4, 0.5, 0.88], [0, 0.55, 1]]) {
      const gr = g.createRadialGradient(ox * R - 5, -8, 2, ox * R, 0, R * 0.8);
      gr.addColorStop(0, '#ffc070'); gr.addColorStop(0.45, hue); gr.addColorStop(1, `rgba(150,60,10,${1 - l * 0.3})`);
      g.fillStyle = gr; g.strokeStyle = 'rgba(110,40,8,.7)'; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(ox * R, 0, R * sc, H, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    g.fillStyle = 'rgba(255,240,210,.35)'; g.beginPath(); g.ellipse(-6, -11, 7, 3.5, -0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5a7a2a'; g.strokeStyle = '#2f4214'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-3, -H + 3); g.quadraticCurveTo(-4, -H - 8, 2, -H - 12); g.lineTo(5, -H - 10); g.quadraticCurveTo(2, -H - 6, 3, -H + 3); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = '#4f8a22'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(3, -H - 4); g.bezierCurveTo(12, -H - 10, 14, -H, 9, -H - 2); g.stroke();
    g.fillStyle = '#4f9a2a'; g.beginPath(); g.ellipse(-12, -H + 1, 7, 4, -0.5, 0, Math.PI * 2); g.fill();
  }));
  const heads = [];
  for (const [c1, c2, mid] of [['#e8742a', '#ffb347', '#7a3a10'], ['#f2b81e', '#ffe680', '#8a5a10'], ['#b8401e', '#e8783a', '#5a2210'], ['#f6efe0', '#ffffff', '#c8a040'], ['#d9542a', '#ff9a4a', '#6a2a10']]) {
    heads.push(mk(32, 32, (g) => {
      g.translate(16, 16);
      for (const [n, R, w, col, off] of [[14, 13, 3.2, c1, 0], [12, 10, 2.8, c2, 0.26], [9, 6.5, 2.4, c1, 0.1]]) {
        for (let i = 0; i < n; i++) { const a = off + i / n * Math.PI * 2; g.save(); g.rotate(a); g.fillStyle = col; g.strokeStyle = 'rgba(80,30,8,.35)'; g.lineWidth = 0.6; g.beginPath(); g.ellipse(R * 0.55, 0, R * 0.55, w, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore(); }
      }
      g.fillStyle = mid; g.beginPath(); g.arc(0, 0, 3.4, 0, Math.PI * 2); g.fill();
    }));
  }
  // generated art strips (square cells) replace the hand-drawn fallbacks when they loaded
  const cells = name => { const im = IMG[name]; if (!im) return null; const c = im.height, out = [];
    for (let i = 0; i < Math.round(im.width / c); i++) out.push(mk(c, c, g => g.drawImage(im, i * c, 0, c, c, 0, 0, c, c))); return out; };
  const gl = cells('y_leaves'), gp = cells('y_pumpkins'), gm = cells('y_mums');
  yardSpr = { leafs: gl ? gl.concat(gl).slice(0, 12) : leafs, pumps: gp || pumps, heads: gm || heads, lily: cells('y_lily'), rocks: cells('y_rocks'), gen: !!gp };
}

function initYard() {
  leaves = []; gourds = []; blooms = []; prints = []; ripples = []; cattails = [];
  for (const [x, y] of MAP.leafpiles) {
    const pile = [];
    for (let i = 0; i < 260; i++) {
      const a = rand(0, Math.PI * 2), d = Math.pow(Math.random(), 0.7);
      pile.push({ x: x + Math.cos(a) * d * 70, y: y + Math.sin(a) * d * 38, z: (1 - d * d) * 26 + rand(0, 3), vx: 0, vy: 0, vz: 0, rot: rand(0, 6.3), vrot: 0, s: randi(0, 11), sc: rand(0.9, 1.35), rest: true, flip: rand(0.55, 1), ph: rand(0, 6) });
    }
    pile.sort((a, b) => a.z - b.z); // bottom of the pile first
    leaves.push(...pile);
  }
  for (const [x, y] of MAP.patches) for (let i = 0; i < 5; i++) {
    const hx = x + rand(-75, 75), hy = y + rand(-28, 30), r = rand(14, 22);
    gourds.push({ hx, hy, x: hx, y: hy, z: 0, vx: 0, vy: 0, vz: 0, r, spin: rand(-0.3, 0.3), s: randi(0, 3), dead: false, regrow: 1, ft: 0 });
  }
  for (const [x, y] of MAP.flowers) for (let i = 0; i < 30; i++) {
    const a = rand(0, Math.PI * 2), d = Math.sqrt(Math.random());
    blooms.push({ x: x + Math.cos(a) * d * 52, y: y + Math.sin(a) * d * 26, h: rand(20, 34), bx: 0, vb: 0, s: randi(0, 4), ph: rand(0, 6), sc: rand(0.75, 1.05) });
  }
  const [px, py, rx, ry] = MAP.pond;
  for (let i = 0; i < 8; i++) cattails.push({ x: px + rx * 0.75 + rand(-14, 26), y: py - ry * 0.55 + rand(-10, 16), h: rand(34, 50), bx: 0, vb: 0, ph: rand(0, 6) });
  for (let i = 0; i < 6; i++) cattails.push({ x: px - rx * 0.85 + rand(-16, 10), y: py + ry * 0.2 + rand(-12, 12), h: rand(28, 42), bx: 0, vb: 0, ph: rand(0, 6) });
}

function movers() {
  const m = [];
  if (player && !player.dead && player.z < 8) m.push(player);
  for (const e of enemies) if (!e.dead && e.spawnT <= 0 && e.z < 8 && !e.d.boss) m.push(e); else if (e.d.boss && !e.dead && e.z < 8) m.push(e);
  return m;
}

function updateYard(dt) {
  const M = movers();
  // --- leaves
  let rustle = 0;
  for (const l of leaves) {
    if (l.rest) {
      for (const m of M) {
        const sp = Math.hypot(m.vx, m.vy); if (sp < 50) continue;
        const dx = l.x - m.x, dy = (l.y - m.y) * 1.4, rr = m.r + 12;
        if (dx * dx + dy * dy < rr * rr) {
          const k = Math.min(1.6, sp / 260);
          l.vx = m.vx * rand(0.35, 0.8) + dx * rand(2, 5); l.vy = m.vy * rand(0.35, 0.8) + dy * rand(1.5, 4);
          l.vz = rand(90, 230) * k + l.z * 4; l.vrot = rand(-9, 9); l.rest = false; rustle++;
          break;
        }
      }
    } else {
      // flutter: strong air drag, gentle fall, sideways sway
      l.vx *= Math.exp(-dt * 2.2); l.vy *= Math.exp(-dt * 2.2);
      l.vz = Math.max(l.vz - 520 * dt, -55);
      l.x += (l.vx + Math.sin(time * 5 + l.ph) * 22) * dt; l.y += l.vy * dt; l.z += l.vz * dt; l.rot += l.vrot * dt;
      l.flip = Math.cos(time * 7 + l.ph);
      if (l.z <= 0) { l.z = 0; l.rest = true; l.vx = l.vy = 0; l.flip = rand(0.5, 1); if (inPond(l.x, l.y)) l.float = true; }
    }
  }
  if (rustle) Sfx.rustle(rustle);
  // --- pumpkins
  for (const g of gourds) {
    if (g.dead) { g.ft -= dt; if (g.ft <= 0) { g.dead = false; g.x = g.hx; g.y = g.hy; g.z = 0; g.vx = g.vy = g.vz = 0; g.regrow = 0; } continue; }
    g.regrow = Math.min(1, g.regrow + dt * 0.8);
    for (const m of M) {
      const dx = g.x - m.x, dy = (g.y - m.y) * 1.3, d = Math.hypot(dx, dy) || 1, rr = g.r * g.regrow + m.r;
      if (d < rr) {
        const msp = Math.hypot(m.vx, m.vy), nx = dx / d, ny = dy / d;
        g.x = m.x + nx * rr; g.y = m.y + ny * rr / 1.3;
        if (msp > 40 && g.regrow > 0.6) {
          const kick = m === player ? 1.6 : (m.mass || 1) * 0.6;
          g.vx = m.vx * kick + nx * 140; g.vy = m.vy * kick + ny * 100; g.vz = 120 + msp * 0.45; Sfx.thump();
          particles.push({ x: g.x, y: g.y, z: 2, vx: rand(-40, 40), vy: rand(-20, 20), vz: rand(30, 80), life: 0.4, max: 0.4, color: 'rgba(120,90,50,.8)', size: rand(4, 7), grav: 300 });
        }
      }
    }
    g.x += g.vx * dt; g.y += g.vy * dt;
    if (g.z > 0 || g.vz > 0) { g.vz -= 1200 * dt; g.z += g.vz * dt; if (g.z <= 0) { g.z = 0; if (g.vz < -120) { g.vz = -g.vz * 0.4; Sfx.thump(); } else g.vz = 0; } }
    const fr = Math.exp(-dt * (g.z > 0 ? 0.3 : 1.8)); g.vx *= fr; g.vy *= fr;
    const sp = Math.hypot(g.vx, g.vy);
    g.spin = clamp(g.vx / 600, -0.35, 0.35) + Math.sin(time * 18 + g.hx) * Math.min(0.25, sp / 900);
    if (g.x < g.r || g.x > ARENA.w - g.r) { g.vx *= -0.6; g.x = clamp(g.x, g.r, ARENA.w - g.r); }
    if (g.y < g.r + 20 || g.y > ARENA.h - g.r) { g.vy *= -0.6; g.y = clamp(g.y, g.r + 20, ARENA.h - g.r); }
    const ox = g.x, oy = g.y; collideProps(g); if (g.x !== ox || g.y !== oy) { g.vx *= -0.5; g.vy *= -0.5; }
    // a hard-kicked pumpkin SMASHES into enemies
    if (sp > 230) for (const e of enemies) {
      if (e.dead || e.spawnT > 0) continue;
      if ((e.x - g.x) ** 2 + ((e.y - g.y) * 1.3) ** 2 < (e.r + g.r) ** 2) { damageEnemy(e, 22 + wave * 2, g.vx / sp, g.vy / sp, 320); smashGourd(g); floatText(e.x, e.y - e.h - 20, 'SQUASH!', '#ff9a3a', 0.8, 22); break; }
    }
    if (!g.dead && inPond(g.x, g.y) && sp > 30) splashAt(g.x, g.y, 0.5);
  }
  // --- flowers and cattails: a breeze + springy bending away from anyone pushing through
  const bend = (f, reach, str) => {
    const wind = Math.sin(time * 1.4 + f.x * 0.013 + f.ph) * 3 + Math.sin(time * 3.1 + f.ph) * 1.2;
    let push = 0;
    for (const m of M) {
      const dx = f.x - m.x, dy = (f.y - m.y) * 1.5, d = Math.hypot(dx, dy);
      if (d < m.r + reach) { const sp = Math.hypot(m.vx, m.vy); push += Math.sign(dx || m.vx || 1) * (1 - d / (m.r + reach)) * (str + sp * 0.12); if (sp > 220 && Math.random() < dt * 3 && f.s !== undefined) petal(f); }
    }
    f.vb += (-(f.bx - wind) * 70 + push * 30 - f.vb * 7) * dt;
    f.bx = clamp(f.bx + f.vb * dt, -22, 22);
  };
  for (const f of blooms) bend(f, 26, 10);
  for (const c of cattails) bend(c, 22, 6);
  // --- wading: splashes, ripples and slowdown are applied where things move
  for (const m of M) {
    if (!inPond(m.x, m.y)) { if (m === player && player.wetT > 0) player.wetT -= dt; continue; }
    if (m === player) player.wetT = 3;
    const sp = Math.hypot(m.vx, m.vy);
    m.splashT = (m.splashT || 0) - dt;
    if (sp > 30 && m.splashT <= 0) { m.splashT = 0.16; splashAt(m.x, m.y, Math.min(1.4, sp / 220) * (m.r / 22)); }
    else if (m.splashT <= -0.6) { m.splashT = 0; ripples.push({ x: m.x, y: m.y, r: m.r * 0.8, life: 1, max: 1 }); }
  }
  for (const r of ripples) r.life -= dt;
  ripples = ripples.filter(r => r.life > 0);
  if (ripples.length > 60) ripples.splice(0, ripples.length - 60);
  for (const f of prints) f.life -= dt;
  prints = prints.filter(f => f.life > 0);
}

function splashAt(x, y, k) {
  ripples.push({ x, y, r: 10 + k * 8, life: 0.9, max: 0.9 });
  for (let i = 0; i < 5 + k * 6; i++) particles.push({ x: x + rand(-8, 8), y: y + rand(-3, 3), z: 2, vx: rand(-90, 90) * k, vy: rand(-50, 50) * k, vz: rand(120, 260) * (0.6 + k * 0.4), life: 0.5, max: 0.5, color: pick(['rgba(200,235,255,.9)', 'rgba(130,190,230,.85)', '#ffffff']), size: rand(2, 5), grav: 900 });
  Sfx.splash();
}

function smashGourd(g) {
  g.dead = true; g.ft = 18;
  Sfx.splat();
  for (let i = 0; i < 16; i++) particles.push({ x: g.x, y: g.y, z: g.z + g.r, vx: rand(-200, 200), vy: rand(-130, 130), vz: rand(100, 320), life: rand(0.5, 1), max: 1, color: pick(['#e8742a', '#ffb347', '#c45a1a', '#fff1c9', '#4f8a22']), size: rand(3, 8), grav: 900 });
}

function petal(f) {
  particles.push({ x: f.x + f.bx, y: f.y, z: f.h, vx: rand(-60, 60), vy: rand(-30, 30), vz: rand(40, 120), life: 1.2, max: 1.2, color: pick(['#e8742a', '#ffd23f', '#f6efe0', '#e2552a']), size: rand(3, 5), grav: 260, feather: true, rot: rand(0, 6) });
}

function addFootprint(p, k) {
  // alternate left/right, oriented along the direction of travel
  const a = Math.atan2(p.vy, p.vx), side = (p.printSide = -(p.printSide || 1));
  if (inPond(p.x, p.y)) return;
  const wet = p.wetT > 0;
  prints.push({ x: p.x - Math.sin(a) * 6 * side, y: p.y + Math.cos(a) * 3.5 * side, a, life: wet ? 2.8 : 1.6, max: wet ? 2.8 : 1.6, wet, sc: p.h / 96 });
}

function drawPrints() {
  for (const f of prints) {
    const a = Math.min(1, f.life / f.max * 1.6) * (f.wet ? 0.65 : 0.5);
    ctx.save(); ctx.translate(f.x, f.y); ctx.scale(1, 0.62); ctx.rotate(f.a); ctx.scale(f.sc * 1.7, f.sc * 1.7);
    ctx.fillStyle = f.wet ? `rgba(30,40,55,${a})` : `rgba(55,35,18,${a})`;
    ctx.beginPath(); ctx.ellipse(2.5, 0, 4.6, 3.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-4.6, 0, 2.6, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawPondWater() {
  const [x, y, rx, ry] = MAP.pond;
  ctx.save();
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
  const g = ctx.createLinearGradient(0, y - ry, 0, y + ry);
  g.addColorStop(0, '#5fb0d6'); g.addColorStop(0.35, '#2f84b4'); g.addColorStop(1, '#174f78');
  ctx.fillStyle = g; ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2);
  // darker depth toward the middle, sky reflection near the far bank
  const dg = ctx.createRadialGradient(x, y + ry * 0.2, 5, x, y, rx); dg.addColorStop(0, 'rgba(10,40,70,.35)'); dg.addColorStop(1, 'rgba(10,40,70,0)');
  ctx.fillStyle = dg; ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2);
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.ellipse(x - rx * 0.1, y - ry * 0.72, rx * 0.8, ry * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  // drifting glints
  ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const t = time * 0.25 + i * 0.61, gx = x - rx + ((t * 60 + i * 47) % (rx * 2)), gy = y - ry * 0.7 + (i % 5) * ry * 0.34 + Math.sin(t * 3 + i) * 3, w = 8 + (i % 3) * 5;
    ctx.globalAlpha = 0.4 + Math.sin(time * 2 + i) * 0.25; ctx.beginPath(); ctx.moveTo(gx - w, gy); ctx.quadraticCurveTo(gx, gy - 2, gx + w, gy); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // ripples
  for (const r of ripples) {
    const t = 1 - r.life / r.max;
    ctx.strokeStyle = `rgba(230,245,255,${(1 - t) * 0.7})`; ctx.lineWidth = 2 * (1 - t) + 0.6;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r * (1 + t * 2.4), r.r * 0.45 * (1 + t * 2.4), 0, 0, Math.PI * 2); ctx.stroke();
  }
  // lily pads bobbing (with a flower)
  for (let i = 0; i < 5; i++) {
    const lx = x + Math.cos(i * 2.3 + 1) * rx * 0.55 + Math.sin(time * 0.6 + i) * 3, ly = y + Math.sin(i * 2.3 + 1) * ry * 0.5 + Math.cos(time * 0.8 + i) * 1.5, lr = 11 + (i % 3) * 3;
    ctx.fillStyle = 'rgba(0,30,40,.25)'; ctx.beginPath(); ctx.ellipse(lx + 2, ly + 2, lr, lr * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    if (yardSpr && yardSpr.lily) { const sp = yardSpr.lily[i === 1 ? 3 : i % 3], s2 = lr * 2.4; ctx.save(); ctx.translate(lx, ly); ctx.scale(1, 0.6); ctx.rotate(i * 1.7 + Math.sin(time * 0.5 + i) * 0.1); ctx.drawImage(sp, -s2 / 2, -s2 / 2, s2, s2); ctx.restore(); continue; }
    ctx.fillStyle = i % 2 ? '#4f9a2a' : '#5fae34'; ctx.beginPath(); ctx.ellipse(lx, ly, lr, lr * 0.55, 0, 0.35, Math.PI * 2 - 0.1); ctx.lineTo(lx, ly); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(30,70,15,.6)'; ctx.lineWidth = 1; ctx.stroke();
    if (i === 1) { ctx.fillStyle = '#ffb6cf'; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; ctx.beginPath(); ctx.ellipse(lx + Math.cos(a) * 3, ly - 3 + Math.sin(a) * 1.6, 3.5, 2, a, 0, Math.PI * 2); ctx.fill(); } ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(lx, ly - 3, 1.8, 0, Math.PI * 2); ctx.fill(); }
  }
  // floating leaves
  for (const l of leaves) if (l.float) drawLeaf(l, 0.85);
  // shoreline shading
  ctx.strokeStyle = 'rgba(20,40,30,.35)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawLeaf(l, alpha = 1) {
  const sp = yardSpr.leafs[l.s], sz = 19 * l.sc;
  ctx.save(); ctx.translate(l.x, l.y - l.z); ctx.rotate(l.rot); ctx.scale(1, Math.max(0.15, Math.abs(l.flip)) * 0.75);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(sp, -sz / 2, -sz / 2, sz, sz);
  if (l.rest && l.z < 8 && !l.float) { ctx.globalAlpha = 0.22 * (1 - l.z / 8); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = '#1a0e04'; ctx.fillRect(-sz / 2, -sz / 2, sz, sz); }
  ctx.restore();
}

function drawRestingLeaves() {
  if (!yardSpr) return;
  for (const l of leaves) if (l.rest && !l.float) drawLeaf(l);
}

function drawGourd(g) {
  if (g.dead) return;
  const sp = yardSpr.pumps[g.s], k = g.regrow, sz = g.r * 2.9 * k;
  ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(g.x, g.y, g.r * k, g.r * 0.45 * k, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  const sq = g.z <= 0 && Math.abs(g.vz) < 1 ? 1 : 1 + Math.min(0.15, Math.abs(g.vz) / 2500);
  ctx.save(); ctx.translate(g.x, g.y - g.z); ctx.rotate(g.spin); ctx.scale(1 / sq, sq);
  ctx.drawImage(sp, -sz / 2, -sz * (yardSpr.gen ? 0.94 : 0.86), sz, sz);
  ctx.restore();
}

function drawBloom(f) {
  const sp = yardSpr.heads[f.s], tipx = f.x + f.bx, tipy = f.y - f.h + Math.abs(f.bx) * 0.35;
  ctx.strokeStyle = '#3f6b22'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.quadraticCurveTo(f.x + f.bx * 0.2, f.y - f.h * 0.55, tipx, tipy); ctx.stroke();
  ctx.fillStyle = '#4f8a2a';
  const mx = f.x + f.bx * 0.15, my = f.y - f.h * 0.4;
  ctx.beginPath(); ctx.ellipse(mx - 5, my, 6, 2.5, -0.5 + f.bx * 0.02, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(mx + 5, my + 4, 6, 2.5, 0.5 + f.bx * 0.02, 0, Math.PI * 2); ctx.fill();
  const sz = 27 * f.sc;
  ctx.save(); ctx.translate(tipx, tipy); ctx.rotate(f.bx * 0.03); ctx.scale(1, 0.8);
  ctx.drawImage(sp, -sz / 2, -sz / 2, sz, sz); ctx.restore();
}

function drawCattail(c) {
  const tx = c.x + c.bx, ty = c.y - c.h + Math.abs(c.bx) * 0.3;
  ctx.strokeStyle = '#4a7a22'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.quadraticCurveTo(c.x + c.bx * 0.25, c.y - c.h * 0.6, tx, ty); ctx.stroke();
  ctx.strokeStyle = '#5f9a2a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(c.x + 2, c.y); ctx.quadraticCurveTo(c.x + 8 + c.bx * 0.4, c.y - c.h * 0.5, c.x + 12 + c.bx * 0.6, c.y - c.h * 0.65); ctx.stroke();
  ctx.save(); ctx.translate(tx, ty + 8); ctx.rotate(c.bx * 0.025);
  ctx.fillStyle = '#6b3d1a'; ctx.beginPath(); ctx.roundRect(-3.5, -10, 7, 18, 3.5); ctx.fill();
  ctx.fillStyle = 'rgba(255,220,180,.25)'; ctx.fillRect(-2, -8, 2, 13);
  ctx.restore();
}

function drawRock(pr) {
  const k = pr.k, x = pr.x, y = pr.y + pr.d * 0.25;
  if (yardSpr && yardSpr.rocks) { const sp = yardSpr.rocks[Math.floor(pr.seed) % yardSpr.rocks.length], w = 108 * k; ctx.drawImage(sp, x - w / 2, pr.y + pr.d * 0.5 - w, w, w); return; }
  ctx.save();
  ctx.fillStyle = '#7d7a72'; ctx.strokeStyle = '#3a3630'; ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 9; i++) { const a = Math.PI + (i / 9) * Math.PI, r = 1 + Math.sin(i * 2.7 + pr.seed) * 0.12; ctx.lineTo(x + Math.cos(a) * 40 * k * r, y + Math.sin(a) * 46 * k * r); }
  ctx.quadraticCurveTo(x, y + 14 * k, x - 40 * k, y); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#a6a297'; ctx.beginPath(); ctx.ellipse(x - 10 * k, y - 26 * k, 16 * k, 9 * k, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5f7a2a'; ctx.beginPath(); ctx.ellipse(x + 14 * k, y - 8 * k, 12 * k, 5 * k, 0.2, 0, Math.PI * 2); ctx.fill(); // moss
  ctx.restore();
}

function drawFirepitFlames() {
  const [x, y] = MAP.firepit;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const fx = x + (i - 3) * 7, fl = (Math.sin(time * 13 + i * 2.1) + 1) / 2, fh = 26 + fl * 22 - Math.abs(i - 3) * 5;
    for (const [col, sc] of [['rgba(255,90,20,.5)', 1], ['rgba(255,190,50,.55)', 0.6], ['rgba(255,250,200,.6)', 0.28]]) {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(fx - 9 * sc, y - 4);
      ctx.quadraticCurveTo(fx - 6 * sc, y - 4 - fh * sc * 0.6, fx + Math.sin(time * 7 + i) * 3, y - 4 - fh * sc);
      ctx.quadraticCurveTo(fx + 6 * sc, y - 4 - fh * sc * 0.6, fx + 9 * sc, y - 4); ctx.closePath(); ctx.fill();
    }
  }
  const g = ctx.createRadialGradient(x, y, 5, x, y, 120); g.addColorStop(0, 'rgba(255,150,60,.18)'); g.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 120, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (Math.random() < 0.25) particles.push({ x: x + rand(-12, 12), y, z: 40, vx: rand(-10, 10), vy: rand(-5, 5), vz: rand(30, 60), life: 1.2, max: 1.2, smoke: true, size: rand(8, 14), grav: -20 });
}

// ---------- the campaign: 20 hand-made levels, a boss every 5, then an endless feast ----------
const BASE = [['turkey', 3], ['potato', 3]];
const ALL = [['turkey', 3], ['potato', 3], ['cranberry', 2], ['corn', 4], ['pumpkin', 8]];
const LEVELS = [null,
  { name: 'The Front Yard',     sub: 'Here come the leftovers!',          pool: BASE, budget: 13 },
  { name: 'Cranberry Hop',      sub: 'Something is wobbling...',         pool: [...BASE, ['cranberry', 2], ['cranberry', 2]], budget: 18 },
  { name: 'Corn Ambush',        sub: 'They brought popcorn.',            pool: [...BASE, ['cranberry', 2], ['corn', 4], ['corn', 4]], budget: 23 },
  { name: 'Pumpkin Patch',      sub: 'Big ones incoming!',               pool: [...ALL, ['pumpkin', 8]], budget: 28 },
  { boss: 'boss',      sub: 'The Turkey King approaches...', escorts: ['turkey', 'potato', 'cranberry'] },
  { name: 'Leftover Rush',      sub: 'They want seconds...',             pool: ALL, budget: 38, fast: true },
  { name: 'Tater Tsunami',      sub: 'So. Many. Potatoes.',               pool: [['potato', 2], ['potato', 2], ['potato', 2], ['turkey', 3]], budget: 42 },
  { name: 'Cornfield Snipers',  sub: 'Keep moving!',                      pool: [['corn', 3], ['corn', 3], ['turkey', 3], ['cranberry', 2]], budget: 46 },
  { name: 'Gourd Squad',        sub: 'Heavy hitters on the lawn.',        pool: [['pumpkin', 6], ['pumpkin', 6], ['potato', 3], ['turkey', 3]], budget: 52 },
  { boss: 'mashboss',  sub: 'Lumpy, buttery, and VERY angry.', escorts: ['potato', 'tot', 'tot'] },
  { name: 'Jelly Flood',        sub: 'Can-shaped trouble.',               pool: [['cranberry', 1], ['cranberry', 1], ['cranberry', 1], ['turkey', 3]], budget: 58, fast: true },
  { name: 'Turkey Stampede',    sub: 'GOBBLE GOBBLE GOBBLE',              pool: [['turkey', 2], ['turkey', 2], ['turkey', 2], ['corn', 4]], budget: 62, fast: true },
  { name: 'The Whole Buffet',   sub: 'A little of everything.',           pool: ALL, budget: 68 },
  { name: 'Night of the Gourds', sub: 'The pumpkins are restless.',       pool: [['pumpkin', 6], ['pumpkin', 6], ['corn', 4], ['cranberry', 2]], budget: 72 },
  { boss: 'gourdboss', sub: 'All hail the pumpkin king.',       escorts: ['pumpkin', 'cranberry', 'cranberry'] },
  { name: 'Popcorn Barrage',    sub: 'Duck!',                             pool: [['corn', 3], ['corn', 3], ['corn', 3], ['turkey', 3]], budget: 80 },
  { name: 'Mashed Mayhem',      sub: 'Heavy and lumpy.',                  pool: [['potato', 2], ['potato', 2], ['pumpkin', 6], ['pumpkin', 6]], budget: 85 },
  { name: 'Gobble Gauntlet',    sub: 'Run, dodge, repeat.',               pool: [['turkey', 2], ['turkey', 2], ['corn', 3], ['cranberry', 2]], budget: 90, fast: true },
  { name: 'Last Call',          sub: 'Everyone wants a piece of the pie.', pool: ALL, budget: 100, fast: true },
  { boss: 'cornboss',  sub: 'The final course.',                escorts: ['corn', 'turkey', 'corn'] },
];
const BOSS_CYCLE = ['boss', 'mashboss', 'gourdboss', 'cornboss'];
function levelOf(n) {
  if (n < LEVELS.length) return LEVELS[n];
  if (n % 5 === 0) { const b = BOSS_CYCLE[(n / 5 - 1) % 4]; return { boss: b, sub: 'Back for seconds!', escorts: ['turkey', 'potato', 'corn', 'cranberry'] }; }
  return { name: 'Endless Feast', sub: pick(['They keep coming!', 'Pass the gravy!', 'How much turkey IS there?']), pool: ALL, budget: 100 + (n - 20) * 6, fast: true };
}

function startWave() {
  wave++;
  waveState = 'intro'; waveTimer = 2.2;
  const L = levelOf(wave);
  banner = L.boss ? { text: `LEVEL ${wave}: ${ENEMIES[L.boss].bname}!`, sub: L.sub, t: 2.6 } : { text: `LEVEL ${wave}`, sub: `${L.name} — ${L.sub}`, t: 2.4 };
  waveTimer = banner.t;
  Sfx.wave();
  spawnQueue = buildWave(wave);
  if (player && CHARS[player.ch].special === 'scrap' && player.macT <= 0) {
    for (let i = 0; i < 2; i++) { const a = rand(0, Math.PI * 2), d = rand(250, 600); dropPickup(clamp(player.x + Math.cos(a) * d, 80, ARENA.w - 80), clamp(player.y + Math.sin(a) * d, 100, ARENA.h - 80), 'scrap'); }
  }
}

function buildWave(n) {
  const q = [], L = levelOf(n);
  if (L.boss) {
    q.push({ type: L.boss, delay: 2.0 });
    for (let i = 0; i < 4 + Math.floor(n / 2); i++) q.push({ type: pick(L.escorts), delay: 1.3 });
    return q;
  }
  let budget = L.budget;
  const gap = Math.max(0.22, (L.fast ? 0.8 : 1.1) - n * 0.035);
  while (budget > 0) {
    const [t, cost] = pick(L.pool);
    if (t === 'cranberry') { for (let i = 0; i < 3; i++) q.push({ type: t, delay: 0.15 }); }
    else q.push({ type: t, delay: gap });
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
  if (d.boss) { e.hp = e.maxHp = d.hp * (1 + Math.max(0, wave - d.lvl) / 5 * 0.45); boss = e; e.phase = 0; e.cd = 2; Sfx.gobble(0.5); shake = 20; e.spawnT = e.spawnMax = 1.2; }
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
  updateRoasts(dt);
  updateCans(dt);
  updateFlames(dt);
  if (yardSpr) updateYard(dt);
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
      banner = wave === LEVELS.length - 1 ? { text: 'THANKSGIVING IS SAVED!', sub: `+${bonus} bonus — the Endless Feast begins...`, t: 4 } : { text: `LEVEL ${wave} CLEARED!`, sub: `+${bonus} bonus`, t: 2.5 };
      if (wave === LEVELS.length - 1) waveTimer = 5;
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

// auto-aim and auto-fire are separate toggles (on-screen buttons, or T / R). Both default on for touch, off for mouse.
const oldAuto = store.get('tg_auto', null);
let autoAim = store.get('tg_autoaim', null) ?? oldAuto ?? isTouch, autoFire = store.get('tg_autofire', null) ?? oldAuto ?? isTouch;
function setAuto(aim, fireOn) {
  autoAim = aim; autoFire = fireOn; store.set('tg_autoaim', aim); store.set('tg_autofire', fireOn);
  const a = $('aimBtn'), f = $('fireBtn');
  a.textContent = aim ? '🎯 AIM ON' : '🎯 AIM OFF'; a.classList.toggle('off', !aim);
  f.textContent = fireOn ? '🔥 FIRE ON' : '🔥 FIRE OFF'; f.classList.toggle('off', !fireOn);
  $('tFire').style.display = fireOn ? 'none' : 'flex'; if (fireOn) fireHeld = false;
}
function aimInput() {
  // returns {a, fire} in world-direction terms
  if (sticks.aim) {
    const dx = sticks.aim.x - sticks.aim.ox, dy = sticks.aim.y - sticks.aim.oy;
    if (Math.hypot(dx, dy) > 12) return { a: Math.atan2(dy, dx), fire: true };
    return { a: player.aim, fire: false };
  }
  const touchOnly = isTouch && !mouse.active;
  if (!touchOnly && mouse.down) { const w = screenToWorld(mouse.x, mouse.y); return { a: Math.atan2(w.y - (player.y - 40), w.x - player.x), fire: true }; }
  // nearest enemy on screen: the auto-aim target, and what auto-fire waits for
  let best = null, bd = Infinity;
  for (const e of enemies) {
    if (e.spawnT > 0 || !onScreen(e)) continue;
    const d = dist2(e, player); if (d < bd) { bd = d; best = e; }
  }
  let a;
  if (autoAim && best) a = Math.atan2(best.y - best.h * 0.35 - (player.y - 40), best.x - player.x);
  else if (!touchOnly) { const w = screenToWorld(mouse.x, mouse.y); a = Math.atan2(w.y - (player.y - 40), w.x - player.x); }
  else { const sp = Math.hypot(player.vx, player.vy); a = sp > 40 ? Math.atan2(player.vy, player.vx) : player.aim; } // gun follows travel direction
  return { a, fire: (autoFire && !!best) || fireHeld, target: autoAim ? best : null };
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
  // ----- Benny: hurl insults so mean they physically hurt -----
  if (wantSpecial && c.special === 'taunt' && p.roastCd <= 0 && !p.dead) hurlInsults(p);
  // ----- Mama: energy drink cans -----
  if (wantSpecial && c.special === 'can' && p.canCd <= 0 && !p.dead) hurlCans(p);
  p.canCd -= dt;
  // ----- Aunty Michelle: acid slime balls -----
  if (wantSpecial && c.special === 'slime' && p.slimeCd <= 0 && !p.dead) hurlCans(p, 'slime');
  p.slimeCd -= dt;
  // ----- Arthur: chili pepper -> fire breath -----
  if (wantSpecial && c.special === 'chili' && p.chiliCd <= 0 && p.chewT <= 0 && p.breathT <= 0) { p.chewT = 0.6; p.speech = { text: pick(ARTHUR_SHOUTS), t: 1.4, max: 1.4 }; Sfx.chomp(); }
  p.chiliCd -= dt;
  if (p.chewT > 0) {
    p.chewT -= dt; p.sq = Math.sin(time * 40) * 0.08; p.sqV = 0;
    if (Math.random() < 0.6) particles.push({ x: p.x + rand(-14, 14), y: p.y, z: p.h * 0.9, vx: rand(-40, 40), vy: 0, vz: rand(60, 120), life: 0.5, max: 0.5, smoke: true, size: rand(6, 10), grav: -40 });
    if (p.chewT <= 0) { p.breathT = 5; shake = Math.max(shake, 6); }
  }  // ----- Pops: crouch -> giant jump -> shockwave -----
  if (wantSpecial && c.special === 'stomp' && p.stompCd <= 0 && p.stompWind <= 0 && p.jumpT <= 0) { p.stompWind = 0.28; p.speech = { text: pick(POPS_SHOUTS), t: 1.3, max: 1.3 }; Sfx.windup(); }
  p.stompCd -= dt;
  if (p.stompWind > 0) {
    p.stompWind -= dt; p.vx *= Math.exp(-dt * 10); p.vy *= Math.exp(-dt * 10);
    p.sq = 0.3; p.sqV = 0;
    if (p.stompWind <= 0) { p.jumpT = 0.95; p.vz = 1350 * 0.95 / 2; p.z = 0.1; p.sq = -0.35; p.sqV = 0; p.inv = Math.max(p.inv, 1.1); dustBurst(p.x, p.y, 12, 1.3); Sfx.dash(); }
  }
  if (p.jumpT > 0) {
    p.jumpT -= dt; p.vz -= 1350 * dt; p.z = Math.max(0, p.z + p.vz * dt);
    if (p.jumpT <= 0 || p.z <= 0) { p.z = 0; p.jumpT = 0; p.vz = 0; stompLand(p); }
  }
  p.roastCd -= dt; p.roastFlash -= dt;
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

  const sp = p.speed * (inPond(p.x, p.y) ? 0.6 : 1);
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
  const busyMouth = p.breathT > 0 || p.chewT > 0;
  if (p.breathT > 0) breatheFire(p, dt);
  if (ai.fire && p.fireCd <= 0 && !charging && !busyMouth) { fire(ai); p.lastFire = 0; }
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
    if (spd > 60 && p.frame % 2 === 0) { if (!inPond(p.x, p.y)) footstep(p.x, p.y, spd / sp); addFootprint(p, spd / sp); }
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
    if (inPond(e.x, e.y)) slow *= d.boss ? 0.8 : 0.55;
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
      act = ['wind', 'burst', 'crouch', 'rollwind', 'volley', 'spiral'].includes(e.st) ? 1 : ['dash', 'summon', 'roll', 'leap'].includes(e.st) ? 2 : null;
      if (e.st === 'dash' || e.st === 'roll') accel = 3000;
    }

    // --- obstacle avoidance: steer around hay bales / barrels / the table instead of grinding into them
    if (!e.d.boss && ai !== 'hop') {
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
    // roasted by Benny: too upset to fight, runs away bawling
    if (e.sulkT > 0) {
      e.sulkT -= dt;
      dvx = -nx * sp * 0.85; dvy = -ny * sp * 0.85; act = null;
      if (e.st !== 'move' && e.st !== 'land') e.st = 'move';
      if (Math.random() < dt * 14) for (const sd of [-1, 1]) particles.push({ x: e.x + sd * e.r * 0.35, y: e.y, z: e.h * 0.72, vx: sd * rand(40, 90), vy: rand(-10, 10), vz: rand(80, 160), life: 0.6, max: 0.6, color: '#7fd4ff', size: rand(3, 5), grav: 700 });
    }
    // sticky cheese webs: walking into one glues you in place for a bit
    if ((e.stuckT || 0) <= 0 && (e.webCd || 0) < time && e.z < 10) {
      for (const w of webs) if ((e.x - w.x) ** 2 + ((e.y - w.y) * 1.6) ** 2 < w.r * w.r) { webEnemy(e, e.d.boss ? 0.5 : e.d.heavy ? 1 : 1.6); break; }
    }
    if (e.stuckT > 0) {
      e.stuckT -= dt; dvx = 0; dvy = 0; accel = 6000; act = 0;
      if (e.st !== 'move' && e.st !== 'land') e.st = 'move';
      if (e.stuckT <= 0) { e.webCd = time + 1.2; snapCheese(e); }
    }
    // Michelle's acid: half-melted, oozing along slowly and unable to attack
    if (e.meltT > 0) {
      e.meltT -= dt; dvx *= 0.3; dvy *= 0.3; act = null;
      if (e.st !== 'move' && e.st !== 'land') e.st = 'move';
      e.meltDmg = (e.meltDmg || 0) + dt * (5 + wave * 0.6);
      if (e.meltDmg >= 3) { const dmg = Math.floor(e.meltDmg); e.meltDmg -= dmg; damageEnemy(e, dmg, 0, 0, 0); if (e.dead) continue; }
      if (Math.random() < dt * 8) particles.push({ x: e.x + rand(-e.r, e.r) * 0.7, y: e.y, z: e.h * rand(0.2, 0.5), vx: rand(-20, 20), vy: rand(-10, 10), vz: rand(-20, 20), life: 0.6, max: 0.6, color: pick(['#7dff3a', '#5fd02a']), size: rand(3, 6), grav: 500 });
    }
    // on fire: running around in a panic, scorching, and spreading it to anyone they bump
    if (e.burnT > 0) {
      e.burnT -= dt;
      e.burnDmg = (e.burnDmg || 0) + dt * (7 + wave * 0.7);
      if (e.burnDmg >= 3) { const dmg = Math.floor(e.burnDmg); e.burnDmg -= dmg; damageEnemy(e, dmg, 0, 0, 0); e.flash = 0; if (e.dead) continue; }
      if (!(e.meltT > 0) && !(e.downT > 0) && !(e.stuckT > 0) && !e.d.boss) {
        e.panicA += (Math.sin(e.t * 3 + e.seed) * 4 + rand(-2, 2)) * dt;
        if (e.x < 80 || e.x > ARENA.w - 80 || e.y < 80 || e.y > ARENA.h - 80) e.panicA = Math.atan2(ARENA.h / 2 - e.y, ARENA.w / 2 - e.x);
        dvx = Math.cos(e.panicA) * sp * 1.35; dvy = Math.sin(e.panicA) * sp * 1.35; act = null;
        if (e.st !== 'move' && e.st !== 'land') e.st = 'move';
      }
      for (const o of enemies) {
        if (o === e || o.dead || o.spawnT > 0 || o.burnT > 0) continue;
        if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 < (o.r + e.r + 6) ** 2 && Math.random() < dt * 3) igniteEnemy(o, o.d.boss ? 1 : 2.2);
      }
      if (Math.random() < dt * 22) particles.push({ x: e.x + rand(-e.r, e.r) * 0.6, y: e.y, z: e.h * rand(0.4, 1), vx: rand(-20, 20), vy: rand(-10, 10), vz: rand(80, 160), life: 0.45, max: 0.45, color: pick(['#ffb03a', '#ff6a1a', '#ffe14d']), size: rand(3, 7), grav: -120 });
      if (Math.random() < dt * 6) particles.push({ x: e.x + rand(-10, 10), y: e.y - 2, z: e.h * 0.9, vx: rand(-15, 15), vy: rand(-8, 8), vz: rand(40, 80), life: 0.9, max: 0.9, smoke: true, size: rand(10, 18), grav: -30 });
    }
    // Pops' shockwave: flat on their back, flailing, trying (and failing) to get up
    if (e.downT > 0) {
      e.downT -= dt; dvx = 0; dvy = 0; accel = 900; act = null;
      if (e.st !== 'move' && e.st !== 'land') e.st = 'move';
      const ph = (e.downMax - e.downT) % 0.9;
      if (e.downT > 0.35 && ph < dt && e.downMax - e.downT > 0.6) { e.sq = -0.2; e.sqV = 0; } // a failed attempt to sit up
      if (e.downT <= 0) { e.sq = -0.25; e.sqV = 0; dustBurst(e.x, e.y, 5, 0.7); }
    }
    // Mama's energy drink: bouncing off the walls and picking fights with its friends
    else if (e.hypeT > 0) {
      e.hypeT -= dt; act = null;
      if (e.st !== 'move' && e.st !== 'land') e.st = 'move';
      let v = e.victim;
      if (!v || v.dead || v.spawnT > 0) {
        v = null; let bd = 1e12;
        for (const o of enemies) { if (o === e || o.dead || o.spawnT > 0) continue; const dd = (o.x - e.x) ** 2 + (o.y - e.y) ** 2; if (dd < bd) { bd = dd; v = o; } }
        e.victim = v;
      }
      const jit = Math.sin(e.t * 23 + e.seed * 7) * 0.9;
      if (v) {
        const vx = v.x - e.x, vy = v.y - e.y, vd = Math.hypot(vx, vy) || 1, a = Math.atan2(vy, vx) + jit * clamp(vd / 200, 0, 1);
        dvx = Math.cos(a) * e.speed * 2.1; dvy = Math.sin(a) * e.speed * 2.1;
        if (vd < e.r + v.r + 10) {
          act = 2;
          if ((e.biteCd || 0) < time) {
            e.biteCd = time + 0.35;
            damageEnemy(v, Math.round(d.dmg * 1.6 + 6 + wave), vx / vd, vy / vd, 300);
            floatText(v.x, v.y - v.h - 20, pick(POW), '#ffe14d', 0.6, 22);
          }
        }
      } else { const a = e.t * 9 + e.seed; dvx = Math.cos(a) * e.speed * 1.8; dvy = Math.sin(a) * e.speed * 1.8; }
      accel *= 2.5;
      if (Math.random() < dt * 25) particles.push({ x: e.x + rand(-e.r, e.r), y: e.y, z: rand(10, e.h), vx: rand(-60, 60), vy: rand(-40, 40), vz: rand(40, 140), life: 0.3, max: 0.3, color: pick(['#ffe14d', '#ffffff', '#5ab4ff']), size: rand(2, 5), grav: 300 });
    }
    if (airborne) accel *= 0.05;

    // integrate with an acceleration limit (mass => momentum)
    const pvx = e.vx;
    let ddx = dvx - e.vx, ddy = dvy - e.vy; const dl = Math.hypot(ddx, ddy), amax = accel * dt;
    if (dl > amax) { ddx *= amax / dl; ddy *= amax / dl; }
    e.vx += ddx; e.vy += ddy;
    e.x += e.vx * dt; e.y += e.vy * dt;
    if (!e.d.boss) collideProps(e);
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
    if (dist < e.r + p.r && e.z < 30 && p.inv <= 0 && !p.dead && !(e.sulkT > 0) && !(e.hypeT > 0) && !(e.downT > 0) && !(e.meltT > 0)) {
      hurtPlayer(d.dmg * (e.st === 'dash' || e.st === 'lunge' || e.st === 'roll' ? 1.4 : 1), nx, ny);
    }
  }
}

function bossShot(e, a, sp, z = 80) {
  const k = e.d.shot;
  ebullets.push({ x: e.x + Math.cos(a) * e.r * 0.5, y: e.y + Math.sin(a) * e.r * 0.3 - 10, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: k === 'gravy' ? 12 : k === 'seed' ? 8 : 9, dmg: k === 'gravy' ? 11 : 9, life: 3.2, kind: k, rot: a });
}
function bossVoice(e, p = 0.6) { if (e.d.gobble) Sfx.gobble(p); else Sfx.roar(e.type); }

function updateBoss(e, dt, nx, ny, d) {
  // every boss cycles through its own list of signature moves
  const D = e.d;
  e.tvx = nx * e.speed; e.tvy = ny * e.speed;
  if (e.st === 'move') {
    if (e.cd <= 0) {
      const m = D.moves[e.phase % D.moves.length]; e.phase++;
      if (m === 'charge') { e.st = 'wind'; e.stT = 0.7; e.charges = 3; bossVoice(e, 0.5); }
      else if (m === 'burst') { e.st = 'burst'; e.stT = 2.0; e.burstCd = 0; }
      else if (m === 'summon') { e.st = 'summon'; e.stT = 1.0; }
      else if (m === 'slam') { e.st = 'crouch'; e.stT = 0.65; bossVoice(e); }
      else if (m === 'volley') { e.st = 'volley'; e.stT = 1.25; e.burstCd = 0; }
      else if (m === 'spiral') { e.st = 'spiral'; e.stT = 2.6; e.burstCd = 0; e.spA = rand(0, 6); }
      else if (m === 'roll') { e.st = 'rollwind'; e.stT = 0.7; bossVoice(e); }
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
      for (let i = 0; i < n; i++) bossShot(e, off + i / n * Math.PI * 2, 260);
      bossVoice(e, 0.7);
    }
    if (e.stT <= 0) { e.st = 'move'; e.cd = 2.5; }
  } else if (e.st === 'summon') {
    e.tvx = 0; e.tvy = 0;
    if (e.stT <= 0) {
      for (let i = 0; i < 3 + Math.floor(wave / 5); i++) { const a = rand(0, Math.PI * 2); const m = spawnEnemy(pick(D.summon), clamp(e.x + Math.cos(a) * 160, 40, ARENA.w - 40), clamp(e.y + Math.sin(a) * 110, 60, ARENA.h - 40)); m.spawnT = m.spawnMax = 0.5; }
      bossVoice(e); e.st = 'move'; e.cd = 3;
    }
  } else if (e.st === 'crouch') {
    // MASH: squat... then a huge belly-flop leap at you
    e.tvx = 0; e.tvy = 0; e.sq = 0.25; e.sqV = 0;
    if (e.stT <= 0) {
      const p = player, T = 0.95;
      e.st = 'leap'; e.stT = T + 0.4; e.vz = 1300 * T / 2; e.z = 1;
      e.vx = (p.x - e.x) / T; e.vy = (p.y - e.y) / T;
      e.slamX = p.x; e.slamY = p.y;
      dustBurst(e.x, e.y, 16, 1.8);
    }
  } else if (e.st === 'leap') {
    e.tvx = e.vx; e.tvy = e.vy;
    if (e.z <= 0 && e.vz <= 0) {
      e.st = 'move'; e.cd = 2; e.vx *= 0.1; e.vy *= 0.1; e.sq = 0.4; e.sqV = 0;
      shake = Math.max(shake, 24); Sfx.boom();
      dustBurst(e.x, e.y, 30, 2.6);
      particles.push({ x: e.x, y: e.y, z: 0, ring: true, r: 200, life: 0.45, max: 0.45 });
      for (let i = 0; i < 20; i++) bossShot(e, i / 20 * Math.PI * 2, 230, 20);
      const p = player;
      if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + 90 && p.inv <= 0 && p.z <= 0) hurtPlayer(e.d.dmg, Math.sign(p.x - e.x) || 1, 0);
    }
  } else if (e.st === 'volley') {
    // aimed fans of shots
    e.tvx *= 0.3; e.tvy *= 0.3; e.burstCd -= dt;
    if (e.burstCd <= 0) {
      e.burstCd = 0.38;
      const a0 = Math.atan2(ny, nx);
      for (let i = -2; i <= 2; i++) bossShot(e, a0 + i * 0.17, 340);
      bossVoice(e, 0.8);
    }
    if (e.stT <= 0) { e.st = 'move'; e.cd = 2; }
  } else if (e.st === 'spiral') {
    // a spinning two-armed stream
    e.tvx = 0; e.tvy = 0; e.burstCd -= dt;
    if (e.burstCd <= 0) {
      e.burstCd = 0.085; e.spA += 0.33;
      for (let k = 0; k < 2; k++) bossShot(e, e.spA + k * Math.PI, 230);
    }
    if (e.stT <= 0) { e.st = 'move'; e.cd = 2.4; }
  } else if (e.st === 'rollwind') {
    e.tvx = 0; e.tvy = 0; e.sq = 0.2 + Math.sin(e.t * 60) * 0.04; e.sqV = 0;
    if (e.stT <= 0) { e.st = 'roll'; e.stT = 2.6; e.cdir = [nx, ny]; shake = Math.max(shake, 10); }
  } else if (e.st === 'roll') {
    // GOURD: a homing, wall-bouncing bowling-ball charge
    let a = Math.atan2(e.cdir[1], e.cdir[0]);
    a += clamp(angDiff(a, Math.atan2(ny, nx)), -1.6 * dt, 1.6 * dt);
    e.cdir = [Math.cos(a), Math.sin(a)];
    if ((e.x < e.r + 12 && e.cdir[0] < 0) || (e.x > ARENA.w - e.r - 12 && e.cdir[0] > 0)) { e.cdir[0] *= -1; shake = Math.max(shake, 8); }
    if ((e.y < e.r + 32 && e.cdir[1] < 0) || (e.y > ARENA.h - e.r - 12 && e.cdir[1] > 0)) { e.cdir[1] *= -1; shake = Math.max(shake, 8); }
    e.tvx = e.cdir[0] * e.speed * 4.3; e.tvy = e.cdir[1] * e.speed * 4.3;
    e.lean = Math.sin(e.t * 18) * 0.25;
    if (Math.random() < 0.7) particles.push({ x: e.x + rand(-40, 40), y: e.y, z: 5, vx: rand(-60, 60), vy: rand(-40, 40), vz: rand(50, 150), life: 0.5, max: 0.5, color: pick(['#8a6a3a', '#3d6b22']), size: rand(5, 10), grav: 400 });
    if (e.stT <= 0) { e.st = 'move'; e.cd = 2.2; e.sq = 0.25; e.sqV = 0; }
  }
}

function hurtPlayer(dmg, nx, ny) {
  const p = player;
  if (p.dead) return;
  if (testLevel && testGod) { p.flash = 0.1; return; }
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
    cranberry: ['#b0102a', '#ff5a6e', '#6e0a1a'], corn: ['#f4c430', '#fff2a0', '#4a8a2a'], pumpkin: ['#e8742a', '#ffb347', '#3d6b22'], boss: ['#7a4a22', '#c8752d', '#e8b05a', '#c0392b', '#222'],
    mashboss: ['#c9a463', '#f2d16b', '#8a5a2a', '#fff2c0'], gourdboss: ['#e8742a', '#ffb347', '#3d6b22', '#ffd36a'], cornboss: ['#f4c430', '#fff2a0', '#4a8a2a', '#ffe14d'] }[e.type] || ['#c8752d', '#e8b05a'];
  const n = e.d.boss ? 120 : 14;
  for (let i = 0; i < n; i++) {
    const feather = (e.type === 'turkey' || e.d.boss) && i % 3 === 0;
    particles.push({ x: e.x, y: e.y, z: e.h * 0.4, vx: rand(-220, 220), vy: rand(-160, 160), vz: rand(100, 420), life: rand(0.6, 1.4), max: 1.4, color: pick(colors), size: rand(4, 10) * (e.d.boss ? 1.8 : 1), grav: feather ? 120 : 900, feather, rot: rand(0, 6) });
  }
  // the body: flung along the killing blow, tumbles, bounces, settles, then fades into the lawn
  const [hx, hy, kb] = e.lastHit || [Math.sign(e.x - player.x) || 1, 0, 120];
  const fling = clamp(kb * 2.2, 160, 900) / Math.sqrt(e.mass);
  corpses.push({
    name: e.d.img, row: AN[e.d.img] && AN[e.d.img].rows.act !== undefined ? 'act' : 'hop', frame: 3, h: e.h, x: e.x, y: e.y, z: e.z,
    vx: e.vx * 0.4 + hx * fling, vy: e.vy * 0.4 + hy * fling * 0.7, vz: clamp(kb, 150, 600) / Math.sqrt(e.mass),
    rot: 0, vrot: (hx >= 0 ? 1 : -1) * rand(6, 12) / e.mass, flip: hx < 0, life: e.d.boss ? 4 : 2.4, max: e.d.boss ? 4 : 2.4, mass: e.mass, r: e.r,
  });
  if (e.d.boss) {
    boss = null; shake = 30; hitStop = 0.25; Sfx.boom();
    for (let i = 0; i < 6; i++) dropPickup(e.x + rand(-120, 120), e.y + rand(-80, 80), i < 2 ? 'slice' : i < 4 ? 'weapon' : 'bomb', pick(['cran', 'corn', 'pie']));
    floatText(e.x, e.y - 200, e.d.bname + ' DEFEATED!', '#ffc53d', 2.5, 34);
  }
  if (e.d.split) {
    for (let i = 0; i < 2; i++) {
      const t = spawnEnemy('tot', e.x + rand(-20, 20), e.y + rand(-20, 20));
      t.spawnT = 0; const a = rand(0, Math.PI * 2); t.vx = Math.cos(a) * 260; t.vy = Math.sin(a) * 180; t.vz = 320; t.z = 10; t.hurtT = 0.4;
    }
  }
  const r = Math.random();
  if (!e.d.boss) {
    if (r < 0.06) dropPickup(e.x, e.y, 'slice');
    else if (r < 0.13) dropPickup(e.x, e.y, 'weapon', pick(['cran', 'corn', 'pie']));
    else if (r < 0.17) dropPickup(e.x, e.y, 'bomb');
  }
  if (e.type === 'pumpkin' && Math.random() < 0.5) dropPickup(e.x, e.y, 'weapon', pick(['cran', 'corn', 'pie']));
  const pc = CHARS[player.ch];
  if (pc.special === 'scrap' && player.macT <= 0) {
    if (e.d.boss) for (let i = 0; i < 3; i++) dropPickup(e.x + rand(-80, 80), e.y + rand(-60, 60), 'scrap');
    else if (Math.random() < 0.38) dropPickup(e.x + rand(-10, 10), e.y + rand(-10, 10), 'scrap');
  }
  if (pc.special === 'taunt' && !player.dead && (e.d.boss || (time - player.lastTaunt > 1.0 && Math.random() < 0.8))) {
    const pool = TAUNTS[e.type] && Math.random() < 0.55 ? TAUNTS[e.type] : TAUNTS.any;
    let line = pick(pool);
    if (player.speech && player.speech.text === line) line = pick(TAUNTS.any);
    player.speech = { text: line, t: 1.9, max: 1.9 }; player.lastTaunt = time;
    Sfx.taunt();
  }
}

function hurlInsults(p) {
  p.roastCd = ROAST_CD; p.roastFlash = 0.35;
  const vis = enemies.filter(e => !e.dead && e.spawnT <= 0 && onScreen(e, 0)).sort((a, b) => ((a.x - p.x) ** 2 + (a.y - p.y) ** 2) - ((b.x - p.x) ** 2 + (b.y - p.y) ** 2));
  const targets = vis.slice(0, 4);
  const n = Math.max(3, targets.length);
  for (let i = 0; i < n; i++) {
    const t = targets.length ? targets[i % targets.length] : null;
    const base = t ? Math.atan2(t.y - p.y, t.x - p.x) : p.aim;
    const a = base + (i - (n - 1) / 2) * 0.35;
    const pool = t && INSULTS[t.type] && Math.random() < 0.5 ? INSULTS[t.type] : INSULTS.any;
    roasts.push({ x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 12, z: p.h * 0.75, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, target: t, text: pick(pool),
      life: 3.6, max: 3.6, delay: i * 0.28, rot: rand(-0.12, 0.12), vrot: 0, wob: rand(0, 6) });
  }
  p.speech = { text: pick(ROAST_SHOUTS), t: 1.4, max: 1.4 }; p.lastTaunt = time;
  p.sq = -0.25; p.sqV = 0; // rears back to yell
  p.vx -= Math.cos(p.aim) * 60; p.vy -= Math.sin(p.aim) * 60;
  shake = Math.max(shake, 4);
  Sfx.roast();
}

function breatheFire(p, dt) {
  p.breathT -= dt; p.lastFire = 0;
  const a = p.aim, RANGE = 300, HALF = 0.36;
  // emit from the mouth for whichever way the body sprite is facing
  const side = p.dir === 'side', back = p.dir === 'back';
  const mx = p.x + (side ? (p.flipX ? -1 : 1) * p.h * 0.13 : 0), my = p.y + (back ? -6 : side ? 1 : 6), mz = p.h * (back ? 0.66 : 0.63);
  for (let i = 0; i < 4; i++) {
    const aa = a + rand(-HALF, HALF) * 0.8, sp = rand(420, 620);
    flames.push({ x: mx, y: my, z: mz, vx: Math.cos(aa) * sp + p.vx * 0.5, vy: Math.sin(aa) * sp + p.vy * 0.5, life: RANGE / sp, max: RANGE / sp, size: rand(10, 16) });
  }
  Sfx.flame();
  // damage everything inside the cone
  p.flameTick = (p.flameTick || 0) - dt;
  if (p.flameTick <= 0) {
    p.flameTick = 0.1;
    for (const e of enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      if (d > RANGE + e.r || Math.abs(angDiff(a, Math.atan2(dy, dx))) > HALF + e.r / Math.max(d, 1)) continue;
      damageEnemy(e, 6 + wave * 0.8, Math.cos(a), Math.sin(a), 60); e.flash = 0;
      if (!e.dead) igniteEnemy(e, e.d.boss ? 1.5 : 3.5);
    }
    if (p.breathT <= 0) { p.chiliCd = CHILI_CD; p.sq = 0.2; p.sqV = 0; }
  }
}

const BURN_YELL = ['AAAH!', 'HOT HOT!', 'OW OW OW!', 'YEOWCH!', 'I\'M ON FIRE!'];
function igniteEnemy(e, t) {
  if (!(e.burnT > 0)) floatText(e.x, e.y - e.h - 34, pick(BURN_YELL), '#ff8a2a', 0.9, 20);
  e.burnT = Math.max(e.burnT || 0, t);
  e.panicA = rand(0, Math.PI * 2);
}

function drawBurning(e) {
  const k = Math.min(1, e.burnT / 0.6), base = e.y - e.z, w = e.r * 0.9;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const fx = e.x + Math.sin(i * 2.4 + e.seed) * w * 0.8;
    const fl = (Math.sin(e.t * 17 + i * 1.9) + 1) * 0.5;
    const fh = (14 + fl * 18) * k * (0.7 + (i % 3) * 0.25), fw = 7 + (i % 2) * 3;
    const fy = base - e.h * (0.25 + (i % 3) * 0.22);
    for (const [col, sc] of [['rgba(255,90,20,.55)', 1], ['rgba(255,190,50,.6)', 0.65], ['rgba(255,250,200,.6)', 0.3]]) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(fx - fw * sc, fy);
      ctx.quadraticCurveTo(fx - fw * sc * 0.6, fy - fh * sc * 0.6, fx + Math.sin(e.t * 9 + i) * 3, fy - fh * sc);
      ctx.quadraticCurveTo(fx + fw * sc * 0.6, fy - fh * sc * 0.6, fx + fw * sc, fy);
      ctx.quadraticCurveTo(fx, fy + fw * sc * 0.8, fx - fw * sc, fy);
      ctx.fill();
    }
  }
  ctx.restore();
}

function updateFlames(dt) {
  for (const f of flames) { f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= Math.exp(-dt * 1.5); f.vy *= Math.exp(-dt * 1.5); f.z += dt * 12; }
  flames = flames.filter(f => f.life > 0);
  if (flames.length > 400) flames.splice(0, flames.length - 400);
  for (const a of acids) {
    a.life -= dt;
    for (const e of enemies) if (!e.dead && e.spawnT <= 0 && e.z < 10 && (e.x - a.x) ** 2 + ((e.y - a.y) * 1.6) ** 2 < a.r * a.r && !(e.meltT > 0.5)) meltEnemy(e, e.d.boss ? 1 : 2.5);
  }
  acids = acids.filter(a => a.life > 0);
}

function drawFlame(f) {
  const t = 1 - f.life / f.max, r = f.size * (0.35 + t * 2.4);
  const col = t < 0.25 ? '255,245,180' : t < 0.55 ? '255,170,40' : t < 0.8 ? '240,80,20' : '120,40,20';
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = `rgba(${col},${(1 - t) * 0.3})`;
  ctx.beginPath(); ctx.arc(f.x, f.y - f.z, r, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

function hurlCans(p, kind = 'can') {
  if (kind === 'slime') p.slimeCd = SLIME_CD; else p.canCd = CAN_CD;
  const vis = enemies.filter(e => !e.dead && e.spawnT <= 0 && onScreen(e, 0)).sort((a, b) => ((a.x - p.x) ** 2 + (a.y - p.y) ** 2) - ((b.x - p.x) ** 2 + (b.y - p.y) ** 2));
  const n = 3;
  for (let i = 0; i < n; i++) {
    const t = vis.length ? vis[i % vis.length] : null;
    let tx, ty;
    if (t && i < vis.length) { tx = t.x + t.vx * 0.3; ty = t.y + t.vy * 0.3; }
    else { const a = (t ? Math.atan2(t.y - p.y, t.x - p.x) : p.aim) + (i - 1) * 0.5, d = t ? Math.hypot(t.x - p.x, t.y - p.y) : 300; tx = p.x + Math.cos(a) * d; ty = p.y + Math.sin(a) * d; }
    const T = clamp(Math.hypot(tx - p.x, ty - p.y) / 650, 0.35, 0.8), g = 1500;
    cans.push({ kind, x: p.x, y: p.y, z: p.h * 0.6, vx: (tx - p.x) / T, vy: (ty - p.y) / T, vz: g * T / 2 - p.h * 0.6 / T, g, rot: rand(0, 6), vrot: rand(10, 16) * (Math.random() < 0.5 ? -1 : 1), delay: i * 0.1 });
  }
  p.speech = { text: pick(kind === 'slime' ? MICHELLE_SHOUTS : MAMA_SHOUTS), t: 1.4, max: 1.4 };
  p.sq = -0.2; p.sqV = 0;
  Sfx.throw();
}

function updateCans(dt) {
  for (const c of cans) {
    if (c.delay > 0) { c.delay -= dt; if (c.delay <= 0) Sfx.throw(); continue; }
    c.x += c.vx * dt; c.y += c.vy * dt; c.vz -= c.g * dt; c.z += c.vz * dt; c.rot += c.vrot * dt;
    const sl = c.kind === 'slime';
    if (Math.random() < 0.5) particles.push({ x: c.x, y: c.y, z: c.z, vx: rand(-30, 30), vy: rand(-30, 30), vz: sl ? rand(-60, 0) : rand(0, 40), life: 0.3, max: 0.3, color: pick(sl ? ['#7dff3a', '#c6ff8a', '#3fbf1a'] : ['#bfefff', '#ffffff', '#5ab4ff']), size: rand(2, 5), grav: sl ? 600 : 200 });
    if (c.z <= 0) { c.done = true; if (sl) slimeBurst(c.x, c.y); else canBurst(c.x, c.y); }
  }
  cans = cans.filter(c => !c.done);
}

function canBurst(x, y) {
  const R = 105;
  Sfx.fizz();
  particles.push({ x, y, z: 0, ring: true, r: R, life: 0.3, max: 0.3 });
  for (let i = 0; i < 26; i++) { const a = rand(0, Math.PI * 2); particles.push({ x, y, z: 6, vx: Math.cos(a) * rand(60, 260), vy: Math.sin(a) * rand(40, 180), vz: rand(150, 420), life: rand(0.4, 0.8), max: 0.8, color: pick(['#ffe14d', '#ffffff', '#5ab4ff', '#d8f6ff']), size: rand(3, 7), grav: 900 }); }
  for (const e of enemies) {
    if (e.dead || e.spawnT > 0) continue;
    if ((e.x - x) ** 2 + ((e.y - y) * 1.3) ** 2 < (R + e.r) ** 2) {
      damageEnemy(e, 8 + wave, 0, 0, 0);
      if (e.dead) continue;
      e.hypeT = Math.max(e.hypeT || 0, e.d.boss ? 1 : 2); e.victim = null; e.st = 'move'; e.sulkT = 0;
      floatText(e.x, e.y - e.h - 30, pick(SPAZ), '#ffe14d', 0.9, 22);
    }
  }
}

function slimeBurst(x, y) {
  const R = 85;
  Sfx.splat(); Sfx.fizz();
  for (let i = 0; i < 22; i++) { const a = rand(0, Math.PI * 2); particles.push({ x, y, z: 6, vx: Math.cos(a) * rand(60, 220), vy: Math.sin(a) * rand(40, 150), vz: rand(120, 340), life: rand(0.4, 0.8), max: 0.8, color: pick(['#7dff3a', '#c6ff8a', '#3fbf1a', '#a8ff5a']), size: rand(4, 9), grav: 900 }); }
  acids.push({ x, y, r: R * 0.7, life: 3, max: 3, seed: Math.random() * 10 });
  for (const e of enemies) {
    if (e.dead || e.spawnT > 0) continue;
    if ((e.x - x) ** 2 + ((e.y - y) * 1.3) ** 2 < (R + e.r) ** 2) meltEnemy(e, e.d.boss ? 1.8 : 4.5);
  }
}

function meltEnemy(e, t) {
  const fresh = !(e.meltT > 0);
  e.meltT = Math.max(e.meltT || 0, t); e.meltMax = Math.max(e.meltMax || 0, e.meltT);
  e.st = 'move'; e.hypeT = 0;
  damageEnemy(e, 10 + wave, 0, 0, 0);
  if (fresh && !e.dead) {
    floatText(e.x, e.y - e.h - 30, pick(MELT), '#8dff4a', 0.9, 22);
    // a gooey chunk sloughs off
    for (let i = 0; i < 6; i++) particles.push({ x: e.x + rand(-e.r, e.r) * 0.6, y: e.y, z: e.h * rand(0.4, 0.9), vx: rand(-120, 120), vy: rand(-60, 60), vz: rand(60, 200), life: 0.9, max: 0.9, color: pick(['#7dff3a', '#5fd02a', '#c6ff8a']), size: rand(5, 10), grav: 900 });
  }
}

function drawMelt(e) {
  // body is dissolving: bubbling goo crust over the lower body + drips + bubbles
  const k = Math.min(1, e.meltT / 0.5), base = e.y - e.z, w = e.r * 1.25;
  ctx.save(); ctx.globalAlpha = 0.78 * k;
  ctx.fillStyle = '#5fd02a'; ctx.strokeStyle = '#2a6a12'; ctx.lineWidth = 2;
  const top = base - e.h * 0.36;
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) {
    const t = Math.PI + (i / 16) * Math.PI, wob = Math.sin(e.t * 4 + i * 1.9) * 3 + (i % 3 === 1 ? 5 : 0);
    ctx.lineTo(e.x + Math.cos(t) * w, base + Math.sin(t) * (base - top) + wob);
  }
  ctx.ellipse(e.x, base, w, w * 0.35, 0, 0, Math.PI, false);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // drips running down
  for (let i = 0; i < 3; i++) { const xx = e.x + (i - 1) * w * 0.55, dl = 5 + ((e.t * 18 + i * 9) % 12); ctx.beginPath(); ctx.ellipse(xx, base - (base - top) * 0.5 + dl, 3.5, dl * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#9dff5a';
  for (let i = 0; i < 4; i++) { const ph = (e.t * 1.6 + i * 0.37) % 1, xx = e.x + Math.sin(i * 2.3 + e.seed) * w * 0.7; ctx.beginPath(); ctx.ellipse(xx, top + 6 - ph * e.h * 0.35, 3.5, 2 + ph * 5, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#c6ff8a';
  for (let i = 0; i < 3; i++) { const ph = (e.t * 1.3 + i * 0.33) % 1; ctx.globalAlpha = 0.85 * k * (1 - ph); ctx.beginPath(); ctx.arc(e.x + Math.cos(i * 2.1 + e.seed) * w * 0.5, top - ph * 30, 3 + ph * 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function drawAcid(a) {
  const f = Math.min(1, a.life / 0.6);
  ctx.save(); ctx.globalAlpha = 0.55 * f;
  ctx.fillStyle = '#5fd02a';
  ctx.beginPath();
  for (let i = 0; i <= 14; i++) { const t = i / 14 * Math.PI * 2, rr = a.r * (0.85 + Math.sin(t * 3 + a.seed) * 0.12); ctx.lineTo(a.x + Math.cos(t) * rr, a.y + Math.sin(t) * rr * 0.55); }
  ctx.fill();
  ctx.globalAlpha = 0.6 * f; ctx.fillStyle = '#b6ff7a';
  for (let i = 0; i < 3; i++) { const ph = (time * 1.5 + i * 0.33 + a.seed) % 1; ctx.beginPath(); ctx.arc(a.x + Math.cos(i * 2 + a.seed) * a.r * 0.5, a.y + Math.sin(i * 2 + a.seed) * a.r * 0.25, 2 + ph * 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function drawCan(c) {
  if (c.delay > 0) return;
  ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 10, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  if (c.kind === 'slime') drawSprite('w_slime', c.x, c.y - c.z + 16, 34, false, { rot: c.rot * 0.3 });
  else drawSprite('w_can', c.x, c.y - c.z + 14, 30, false, { rot: c.rot });
}

function stompLand(p) {
  const R = 330;
  shake = Math.max(shake, 22); hitStop = Math.max(hitStop, 0.08);
  p.sq = 0.4; p.sqV = 0;
  Sfx.boom();
  dustBurst(p.x, p.y, 30, 2.4);
  particles.push({ x: p.x, y: p.y, z: 0, ring: true, r: R * 0.55, life: 0.35, max: 0.35 });
  particles.push({ x: p.x, y: p.y, z: 0, ring: true, r: R, life: 0.55, max: 0.55 });
  for (let i = 0; i < 20; i++) { const a = rand(0, Math.PI * 2); particles.push({ x: p.x + Math.cos(a) * 30, y: p.y + Math.sin(a) * 20, z: 2, vx: Math.cos(a) * rand(200, 420), vy: Math.sin(a) * rand(140, 300), vz: rand(150, 380), life: 0.7, max: 0.7, color: pick(['#6b4a2a', '#8a6a3a', '#4a8a2a', '#c8752d']), size: rand(4, 9), grav: 900 }); }
  for (const e of enemies) {
    if (e.dead || e.spawnT > 0) continue;
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy * 1.3) || 1;
    if (d < R + e.r) {
      const k = 1 - d / (R + e.r);
      damageEnemy(e, Math.round((18 + wave * 2) * (0.6 + k * 0.6)), dx / d, dy / d, 110 + 130 * k);
      if (e.dead) continue;
      e.downT = e.d.boss ? 1.2 : 3; e.downMax = e.downT; e.st = 'move'; e.hypeT = 0;
      e.vz = Math.max(e.vz || 0, (220 + 200 * k) / Math.sqrt(e.mass)); e.z = Math.max(e.z, 1);
    }
  }
}

function updateRoasts(dt) {
  for (const r of roasts) {
    if (r.delay > 0) { r.delay -= dt; continue; }
    r.life -= dt; r.rot += r.vrot * dt; r.vrot *= Math.exp(-dt * 2);
    let t = r.target;
    if (!t || t.dead) t = r.target = nearestEnemy(r.x, r.y, 600, null);
    const sp = Math.hypot(r.vx, r.vy) || 1, nsp = Math.min(330, sp + 200 * dt);
    let a = Math.atan2(r.vy, r.vx);
    if (t) a += clamp(angDiff(a, Math.atan2(t.y - r.y, t.x - r.x)), -8 * dt, 8 * dt);
    r.vx = Math.cos(a) * nsp; r.vy = Math.sin(a) * nsp;
    r.x += r.vx * dt; r.y += r.vy * dt;
    r.z = lerp(r.z, t ? t.h * 0.55 : 30, 1 - Math.exp(-dt * 4));
    if (r.x < 0 || r.x > ARENA.w || r.y < 0 || r.y > ARENA.h) { r.life = 0; continue; }
    for (const e of enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const rr = e.r + 22;
      if ((e.x - r.x) ** 2 + ((e.y - r.y) * 1.2) ** 2 < rr * rr) {
        r.life = 0;
        const k = Math.hypot(r.vx, r.vy) || 1;
        damageEnemy(e, 28 + wave * 3, r.vx / k, r.vy / k, 320);
        if (!e.dead) {
          e.sulkT = Math.max(e.sulkT || 0, e.d.boss ? 0.9 : e.d.heavy ? 1.8 : 2.8);
          e.st = 'move';
          floatText(e.x, e.y - e.h - 30, pick(CRY), '#7fd4ff', 1.0, 20);
        }
        hitStop = Math.max(hitStop, 0.02); shake = Math.max(shake, 5);
        for (let i = 0; i < 10; i++) particles.push({ x: r.x, y: r.y, z: r.z, vx: rand(-220, 220), vy: rand(-150, 150), vz: rand(80, 280), life: 0.45, max: 0.45, color: pick(['#c0392b', '#ffffff', '#ffd84a']), size: rand(3, 7), grav: 600 });
        Sfx.hit();
        break;
      }
    }
  }
  roasts = roasts.filter(r => r.life > 0);
}

function drawRoast(r) {
  if (r.delay > 0) return;
  const age = r.max - r.life, pop = age < 0.12 ? 0.5 + age / 0.12 * 0.7 : 1.2 - Math.min(0.2, (age - 0.12));
  ctx.font = "28px 'Lilita One', sans-serif";
  const w = ctx.measureText(r.text).width * pop;
  // speed streaks behind the word
  const k = Math.hypot(r.vx, r.vy) || 1, ux = -r.vx / k, uy = -r.vy / k;
  ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) { const ox = -uy * i * 9, oy = ux * i * 9; ctx.beginPath(); ctx.moveTo(r.x + ux * (w * 0.4) + ox, r.y - r.z + uy * (w * 0.4) + oy); ctx.lineTo(r.x + ux * (w * 0.4 + 26 - Math.abs(i) * 8) + ox, r.y - r.z + uy * (w * 0.4 + 26 - Math.abs(i) * 8) + oy); ctx.stroke(); }
  ctx.restore();
  ctx.save();
  ctx.translate(r.x, r.y - r.z);
  ctx.rotate(r.rot + Math.sin(age * 8 + r.wob) * 0.05);
  ctx.scale(pop, pop);
  ctx.font = "28px 'Lilita One', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = 7; ctx.strokeStyle = '#2b1a10'; ctx.strokeText(r.text, 0, 0);
  ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.strokeText(r.text, 0, 0);
  ctx.fillStyle = '#e8322a'; ctx.fillText(r.text, 0, 0);
  ctx.restore();
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
    if (b.w === 'mac') { b.seed = b.seed || rand(0, 10); if (Math.random() < dt * 22) particles.push({ x: b.x, y: b.y, z: b.z, vx: b.vx * 0.1, vy: b.vy * 0.1, vz: rand(-20, 20), life: 0.5, max: 0.5, color: pick(['#ffbe2e', '#f5a823']), size: rand(3, 6), grav: 800 }); }
    if (b.w !== 'pie' && hitProp(b)) { b.life = 0; impact(b); continue; }
    if (b.x < 0 || b.x > ARENA.w || b.y < 0 || b.y > ARENA.h) { b.life = 0; continue; }
    for (const e of enemies) {
      if (e.dead || e.spawnT > 0 || b.hits.has(e)) continue;
      const rr = e.r + b.r;
      if ((e.x - b.x) ** 2 + ((e.y - b.y) * 1.2) ** 2 < rr * rr) {
        const sp = Math.hypot(b.vx, b.vy) || 1;
        damageEnemy(e, b.dmg, b.vx / sp, b.vy / sp, b.w === 'cran' ? 260 : b.w === 'pie' ? 200 : b.w === 'mac' ? 40 : 90);
        if (b.w === 'mac' && !e.dead) webEnemy(e, e.d.boss ? 0.9 : e.d.heavy ? 1.8 : 3.2);
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
    for (let i = 0; i < 12; i++) { const an = rand(0, Math.PI * 2); particles.push({ x: b.x, y: b.y, z: b.z, vx: Math.cos(an) * rand(80, 220), vy: Math.sin(an) * rand(50, 140), vz: rand(60, 220), life: 0.55, max: 0.55, color: pick(['#ffbe2e', '#ffe07a', '#e8961a']), size: rand(4, 8), grav: 900 }); }
    webs.push({ x: b.x, y: b.y, r: rand(42, 54), life: 4.5, max: 4.5, seed: Math.random() * 10 });
    if (webs.length > 24) webs.shift();
    Sfx.splat();
  }
  if (b.w === 'gravy') {
    const c = CHARS[player.ch];
    if (Math.random() < 0.22 * (c.puddleMul || 1)) puddles.push({ x: b.x, y: b.y, r: rand(34, 52), life: 5, max: 5, seed: Math.random() * 10 });
  }
}

function webEnemy(e, t) {
  if (!(e.stuckT > 0)) {
    const n = 4 + (e.r > 40 ? 2 : 0), anch = [], globs = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.3, 0.3), d = e.r * rand(1.5, 2.3);
      anch.push({ x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d * 0.55, ox: Math.cos(a) * rand(0.3, 0.7), oy: rand(0.25, 0.7), s: rand(0, 10) });
    }
    for (let i = 0; i < 4; i++) globs.push({ ox: rand(-0.6, 0.6), oy: rand(0.35, 0.85), r: rand(6, 11), s: rand(0, 10), mac: i < 2 });
    e.cheese = { anch, globs };
    for (let i = 0; i < 10; i++) particles.push({ x: e.x, y: e.y, z: e.h * 0.5, vx: rand(-160, 160), vy: rand(-90, 90), vz: rand(60, 220), life: 0.5, max: 0.5, color: pick(['#ffbe2e', '#ffe07a', '#e8961a']), size: rand(4, 8), grav: 900 });
  }
  if ((e.stuckT || 0) < t) e.stuckT = t;
  e.st = 'move';
}

function snapCheese(e) {
  // the strings SNAP as it breaks free
  const ch = e.cheese; if (!ch) return;
  for (const an of ch.anch) for (let i = 0; i < 4; i++) { const t = i / 3; particles.push({ x: lerp(e.x, an.x, t), y: lerp(e.y, an.y, t), z: lerp(e.h * an.oy, 2, t), vx: rand(-80, 80), vy: rand(-50, 50), vz: rand(40, 160), life: 0.45, max: 0.45, color: pick(['#ffbe2e', '#ffe07a']), size: rand(3, 6), grav: 900 }); }
  e.cheese = null;
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
  // the feast tables restock a health pack every so often
  tableT -= dt;
  if (tableT <= 0 && state === 'play') {
    tableT = 15;
    const free = props.filter(pr => pr.table && !pickups.some(it => it.table === pr));
    if (free.length) {
      const t = pick(free);
      pickups.push({ x: t.x + rand(-40, 40), y: t.y + t.d / 2 + 6, z: 62, vz: 0, kind: 'medkit', life: Infinity, t: 0, perch: true, table: t });
      floatText(t.x, t.y - 120, 'HEALTH PACK!', '#7dff8a', 1.6, 20);
    }
  }
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
    if (!it.perch) { it.vz -= 900 * dt; it.z = Math.max(0, it.z + it.vz * dt); if (it.z === 0) it.vz = Math.abs(it.vz) > 60 ? -it.vz * 0.4 : 0; }
    const d2 = dist2(it, p);
    if (d2 < 130 ** 2) { if (it.perch) { it.perch = false; it.vz = 60; } const d = Math.sqrt(d2) || 1; it.x += (p.x - it.x) / d * 380 * dt; it.y += (p.y - it.y) / d * 380 * dt; }
    if (d2 < 34 ** 2) {
      it.life = 0;
      if (it.kind === 'medkit') { const h = Math.round(45 * (c.healMul || 1)); p.hp = Math.min(p.maxHp, p.hp + h); floatText(p.x, p.y - 110, `+${h} HP`, '#7dff8a', 1.1, 22); Sfx.heal(); }
      else if (it.kind === 'slice') { const h = 25 * (c.healMul || 1); p.hp = Math.min(p.maxHp, p.hp + h); floatText(p.x, p.y - 110, `+${h} HP`, '#7dff8a'); Sfx.heal(); }
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

function macaroni(x, y, rot, sc = 1) {
  // a little elbow noodle
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#a8620a'; ctx.lineWidth = 6.5; ctx.beginPath(); ctx.arc(0, 0, 5, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.strokeStyle = '#f6c74a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 5, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,220,.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, 4, 0.5, 1.6); ctx.stroke();
  ctx.restore();
}

function gooBlob(x, y, rx, ry, seed, wob, t) {
  // an irregular, wobbling glossy blob of melted cheese
  ctx.beginPath();
  for (let i = 0; i <= 18; i++) {
    const an = i / 18 * Math.PI * 2, k = 0.82 + 0.13 * Math.sin(an * 3 + seed) + 0.07 * Math.sin(an * 5 + seed * 2.3 + t * wob);
    const px = x + Math.cos(an) * rx * k, py = y + Math.sin(an) * ry * k;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}

function drawGroundWeb(w) {
  const a = Math.min(1, w.life / 0.8), t = time, grow = Math.min(1, (w.max - w.life) / 0.15);
  const r = w.r * (0.6 + 0.4 * grow);
  ctx.save(); ctx.globalAlpha = a;
  // rim + body with a glossy gradient
  ctx.fillStyle = 'rgba(160,90,10,.45)'; gooBlob(w.x, w.y + 3, r * 1.04, r * 0.6, w.seed, 2, t); ctx.fill();
  const g = ctx.createRadialGradient(w.x - r * 0.25, w.y - r * 0.2, 2, w.x, w.y, r);
  g.addColorStop(0, '#ffe58a'); g.addColorStop(0.55, '#ffbe2e'); g.addColorStop(1, '#e8961a');
  ctx.fillStyle = g; gooBlob(w.x, w.y, r, r * 0.55, w.seed, 2, t); ctx.fill();
  ctx.strokeStyle = '#c47a0e'; ctx.lineWidth = 2.5; ctx.stroke();
  // drippy lobes around the edge
  for (let i = 0; i < 6; i++) { const an = w.seed * 2 + i * 1.05, lx = w.x + Math.cos(an) * r * 0.95, ly = w.y + Math.sin(an) * r * 0.52; ctx.fillStyle = '#f5a823'; ctx.beginPath(); ctx.ellipse(lx, ly, 7 + (i % 3) * 3, 5 + (i % 2) * 2, an, 0, Math.PI * 2); ctx.fill(); }
  // glossy highlights
  ctx.fillStyle = 'rgba(255,255,230,.7)'; ctx.beginPath(); ctx.ellipse(w.x - r * 0.3, w.y - r * 0.18, r * 0.28, r * 0.07, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(w.x + r * 0.25, w.y + r * 0.12, r * 0.12, r * 0.04, 0.1, 0, Math.PI * 2); ctx.fill();
  // slow bubbles that swell and pop
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.7 + i * 0.37 + w.seed) % 1, bx = w.x + Math.cos(w.seed * 5 + i * 2.1) * r * 0.5, by = w.y + Math.sin(w.seed * 5 + i * 2.1) * r * 0.26;
    if (ph < 0.85) { ctx.strokeStyle = 'rgba(200,120,10,.7)'; ctx.fillStyle = 'rgba(255,230,140,.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(bx, by, 2 + ph * 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  }
  // noodles
  for (let i = 0; i < 6; i++) { const an = w.seed * 3 + i * 1.7, rr = r * 0.7 * ((i * 0.37 + w.seed) % 1); macaroni(w.x + Math.cos(an) * rr, w.y + Math.sin(an) * rr * 0.5, an * 2, 0.9); }
  // stretchy strands arching over the puddle
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a1 = w.seed + i * 2.1, a2 = a1 + 2.6 + Math.sin(w.seed + i) * 0.4;
    const x1 = w.x + Math.cos(a1) * r * 0.85, y1 = w.y + Math.sin(a1) * r * 0.47, x2 = w.x + Math.cos(a2) * r * 0.85, y2 = w.y + Math.sin(a2) * r * 0.47;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - 10 - Math.sin(t * 2 + i) * 3;
    ctx.strokeStyle = '#e39418'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
    ctx.strokeStyle = '#ffdc6a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x1, y1 - 1); ctx.quadraticCurveTo(mx, my - 1, x2, y2 - 1); ctx.stroke();
  }
  ctx.restore();
}

function cheeseString(x1, y1, x2, y2, sag, w) {
  // a gooey strand: fat at both ends, thin and saggy in the middle
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + sag;
  ctx.strokeStyle = '#d98a10'; ctx.lineWidth = w + 1.5; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
  ctx.strokeStyle = '#ffc634'; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,245,200,.8)'; ctx.lineWidth = Math.max(1, w * 0.35); ctx.beginPath(); ctx.moveTo(x1, y1 - w * 0.2); ctx.quadraticCurveTo(mx, my - w * 0.3, x2, y2 - w * 0.2); ctx.stroke();
  ctx.fillStyle = '#ffbe2e';
  ctx.beginPath(); ctx.ellipse(x1, y1, w * 1.3, w * 1.0, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x2, y2, w * 1.6, w * 0.9, 0, 0, Math.PI * 2); ctx.fill();
}

function drawStuckPuddle(e) {
  // drawn under the enemy: its feet are glued into a puddle of goo
  const k = Math.min(1, e.stuckT * 2), r = e.r * 1.35;
  ctx.save(); ctx.globalAlpha = k;
  const g = ctx.createRadialGradient(e.x - r * 0.2, e.y - r * 0.1, 2, e.x, e.y, r);
  g.addColorStop(0, '#ffe07a'); g.addColorStop(1, '#eb9c1c');
  ctx.fillStyle = g; gooBlob(e.x, e.y + 2, r, r * 0.5, e.seed, 3, time); ctx.fill();
  ctx.strokeStyle = '#c47a0e'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,230,.6)'; ctx.beginPath(); ctx.ellipse(e.x - r * 0.35, e.y - r * 0.12, r * 0.22, r * 0.05, 0, 0, Math.PI * 2); ctx.fill();
  const ch = e.cheese;
  if (ch) for (const an of ch.anch) { ctx.fillStyle = '#f5a823'; gooBlob(an.x, an.y, 12, 6, an.s, 3, time); ctx.fill(); }
  ctx.restore();
}

function drawCheeseWeb(e) {
  const k = Math.min(1, e.stuckT * 2), base = e.y - e.z, h = e.h, ch = e.cheese;
  ctx.save(); ctx.globalAlpha = k; ctx.lineCap = 'round';
  const wig = Math.sin(e.t * 40) * 2.5; // they're straining against it
  // strings from the body down to anchor blobs on the ground (they stretch as it struggles)
  if (ch) for (const an of ch.anch) {
    const bx = e.x + an.ox * e.r + wig, by = base - h * an.oy;
    cheeseString(bx, by, an.x, an.y, 8 + Math.sin(e.t * 3 + an.s) * 5, Math.max(2.2, h / 34));
  }
  // goo climbing up the legs from the puddle
  const g = ctx.createLinearGradient(0, base - h * 0.42, 0, base);
  g.addColorStop(0, 'rgba(255,200,60,.85)'); g.addColorStop(1, 'rgba(240,160,30,.95)');
  ctx.fillStyle = g;
  const gw = e.r * 0.85, gh = h * 0.22;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const an = Math.PI + (i / 20) * Math.PI, wob = Math.sin(an * 4 + e.seed + e.t * 2) * 0.06;
    ctx.lineTo(e.x + wig * 0.4 + Math.cos(an) * gw * (1 + wob), base + Math.sin(an) * gh * (1 + wob));
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#c47a0e'; ctx.lineWidth = 2; ctx.stroke();
  // goo sagging down off the mound
  ctx.fillStyle = '#ffb21f';
  for (let i = 0; i < 3; i++) { const xx = e.x + (i - 1) * gw * 0.6, dl = 4 + ((e.t * 10 + i * 5 + e.seed) % 10); ctx.beginPath(); ctx.ellipse(xx, base - gh * 0.55 + dl * 0.5, 3.5, dl * 0.5 + 2, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,230,.6)'; ctx.beginPath(); ctx.ellipse(e.x - gw * 0.35, base - gh * 0.7, gw * 0.3, gh * 0.12, -0.2, 0, Math.PI * 2); ctx.fill();
  // globs splattered on the body, each with a dangling drip
  if (ch) for (const gb of ch.globs) {
    const gx = e.x + gb.ox * e.r + wig, gy = base - h * gb.oy, rr = gb.r * Math.max(0.7, h / 90);
    ctx.fillStyle = '#ffbe2e'; gooBlob(gx, gy, rr, rr * 0.8, gb.s, 4, time); ctx.fill();
    ctx.strokeStyle = '#c47a0e'; ctx.lineWidth = 1.8; ctx.stroke();
    const dl = 5 + ((e.t * 14 + gb.s * 9) % 16);
    ctx.fillStyle = '#ffb21f'; ctx.beginPath(); ctx.ellipse(gx + rr * 0.2, gy + rr * 0.6 + dl * 0.5, rr * 0.28, dl * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,230,.75)'; ctx.beginPath(); ctx.ellipse(gx - rr * 0.3, gy - rr * 0.3, rr * 0.3, rr * 0.15, -0.4, 0, Math.PI * 2); ctx.fill();
    if (gb.mac) macaroni(gx, gy, gb.s * 3, Math.max(0.7, h / 100));
  }
  ctx.restore();
}

function drawDizzy(e) {
  const cx = e.x, cy = e.y - e.z - e.h * 0.45 - 10;
  for (let i = 0; i < 3; i++) {
    const a = e.t * 5 + i * Math.PI * 2 / 3;
    const x = cx + Math.cos(a) * (e.r * 0.8 + 6), y = cy + Math.sin(a) * 7;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = '#2b1a10'; ctx.lineWidth = 1.5;
    ctx.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? 3 : 7, aa = k * Math.PI / 5; ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

function drawZaps(e) {
  ctx.save(); ctx.strokeStyle = Math.random() < 0.5 ? '#ffe14d' : '#9fe3ff'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  for (let i = 0; i < 2; i++) {
    const a = rand(0, Math.PI * 2), r0 = e.r * 0.9, cx = e.x, cy = e.y - e.z - e.h * 0.5;
    let x = cx + Math.cos(a) * r0, y = cy + Math.sin(a) * e.h * 0.45;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 3; k++) { x += Math.cos(a) * 8 + rand(-6, 6); y += Math.sin(a) * 8 + rand(-6, 6); ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.font = "16px 'Lilita One', sans-serif"; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = '#2b1a10'; ctx.lineWidth = 3;
  const t = Math.floor(e.t * 6) % 2 ? '!!' : '!?';
  ctx.strokeText(t, e.x + 12, e.y - e.z - e.h - 14); ctx.fillText(t, e.x + 12, e.y - e.z - e.h - 14);
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
let floorPattern = null, worldFloor = null;
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
  buildWorldFloor(c);
  makeYardSprites();
}

// Bake the whole lawn once: textured base + big soft colour variation + paths + unique ground features.
function buildWorldFloor(tile) {
  const S = 1.25, W = ARENA.w, H = ARENA.h;
  const cvs = document.createElement('canvas'); cvs.width = Math.round(W * S); cvs.height = Math.round(H * S);
  const g = cvs.getContext('2d'); g.scale(S, S);
  let seed = 1337; const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); const RR = (a, b) => a + R() * (b - a);
  // base: the mirrored texture, laid in two offset layers so the repeat breaks up
  g.fillStyle = g.createPattern(tile, 'repeat'); g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = 0.35; g.translate(311, 187); g.rotate(0.5); g.fillStyle = g.createPattern(tile, 'repeat'); g.fillRect(-W, -H, W * 3, H * 3); g.restore();
  // big soft colour patches
  for (let i = 0; i < 70; i++) {
    const x = RR(0, W), y = RR(0, H), r = RR(120, 420), c = pick3(R(), ['40,28,10,', '255,214,120,', '70,110,30,', '120,60,20,']);
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${c}${RR(0.08, 0.2)})`); gr.addColorStop(1, `rgba(${c}0)`);
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2); g.fill();
  }
  // a winding dirt path through the yard
  const pts = MAP.path;
  const stroke = (w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); } g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); g.stroke(); };
  stroke(96, 'rgba(90,60,30,.35)'); stroke(76, 'rgba(140,100,60,.75)'); stroke(44, 'rgba(170,128,80,.5)');
  for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 40; k++) { const t = R(), x = lerp(pts[i][0], pts[i + 1][0], t) + RR(-34, 34), y = lerp(pts[i][1], pts[i + 1][1], t) + RR(-26, 26); g.fillStyle = pick3(R(), ['#8a7a66', '#a89880', '#6e5e4a']); g.beginPath(); g.ellipse(x, y, RR(2, 6), RR(1.5, 4), 0, 0, Math.PI * 2); g.fill(); }
  // scattered fallen leaves
  for (let c = 0; c < 90; c++) { const cx = RR(0, W), cy = RR(0, H); for (let i = 0; i < 14; i++) { const x = cx + RR(-60, 60), y = cy + RR(-40, 40); g.save(); g.translate(x, y); g.rotate(RR(0, 6.3)); g.fillStyle = pick3(R(), ['#c0392b', '#e8892a', '#f2c14e', '#8a3a1a', '#d4622a']); g.globalAlpha = RR(0.5, 0.95); g.beginPath(); g.ellipse(0, 0, RR(4, 8), RR(2, 4), 0, 0, Math.PI * 2); g.fill(); g.restore(); } }
  g.globalAlpha = 1;
  // generated ground decals, centred on a spot; procedural fallbacks below run only if an image is missing
  const decal = (name, x, y, w, rot = 0) => { const im = IMG[name]; if (!im) return false; const h = w * im.height / im.width; g.save(); g.translate(x, y); g.rotate(rot); g.drawImage(im, -w / 2, -h / 2, w, h); g.restore(); return true; };
  // pond bed: stone rim + bank (the water itself is drawn live, lined up with the decal's own water)
  if (IMG.d_pond) { const [x, y, rx, ry] = MAP.pond, im = IMG.d_pond, sx = rx * 2 / 363 * 1.04, sy = ry * 2 / 191 * 1.06; g.drawImage(im, x - 261.5 * sx, y - 166.5 * sy, im.width * sx, im.height * sy); }
  else { const [x, y, rx, ry] = MAP.pond;
    g.fillStyle = '#5a4630'; g.beginPath(); g.ellipse(x, y + 6, rx + 18, ry + 14, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2, sx = x + Math.cos(a) * (rx + 12), sy = y + Math.sin(a) * (ry + 9); const sg = g.createLinearGradient(sx, sy - 8, sx, sy + 8); sg.addColorStop(0, '#b4b0a4'); sg.addColorStop(1, '#6a665e'); g.fillStyle = sg; g.strokeStyle = '#3a3630'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(sx, sy, RR(9, 14), RR(6, 9), RR(-0.3, 0.3), 0, Math.PI * 2); g.fill(); g.stroke(); } }
  // fire pit stones + ash
  if (!decal('d_firepit', MAP.firepit[0], MAP.firepit[1] - 4, 150)) { const [x, y] = MAP.firepit; g.fillStyle = '#3a2a20'; g.beginPath(); g.ellipse(x, y, 40, 22, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillStyle = pick3(R(), ['#8d8a80', '#a6a297', '#6f6c64']); g.strokeStyle = '#2a2622'; g.lineWidth = 2; g.beginPath(); g.ellipse(x + Math.cos(a) * 46, y + Math.sin(a) * 26, 12, 8, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
    g.strokeStyle = '#5a3a1c'; g.lineWidth = 9; g.beginPath(); g.moveTo(x - 24, y + 6); g.lineTo(x + 22, y - 6); g.moveTo(x - 20, y - 6); g.lineTo(x + 24, y + 6); g.stroke(); }
  // picnic blankets
  for (const [x, y, rot] of MAP.blankets) { if (decal('d_blanket', x, y, 230, rot * 0.5)) continue; g.save(); g.translate(x, y); g.rotate(rot); g.scale(1, 0.62); const n = 6, sz = 26; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? '#f4efe4' : '#c63b2e'; g.fillRect((i - n / 2) * sz, (j - n / 2) * sz, sz, sz); } g.strokeStyle = 'rgba(60,20,10,.5)'; g.lineWidth = 3; g.strokeRect(-n / 2 * sz, -n / 2 * sz, n * sz, n * sz); g.restore();
    g.fillStyle = '#e8a03a'; g.strokeStyle = '#6b3d1a'; g.lineWidth = 2; g.beginPath(); g.ellipse(x + 20, y - 6, 20, 11, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x + 20, y - 9, 6, 3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8e2d4'; g.beginPath(); g.ellipse(x - 30, y + 8, 9, 6, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
  // leaf piles are live now: just a slightly flattened, darker patch of grass under each
  for (const [x, y] of MAP.leafpiles) { const gr = g.createRadialGradient(x, y, 5, x, y, 80); gr.addColorStop(0, 'rgba(60,40,15,.3)'); gr.addColorStop(1, 'rgba(60,40,15,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, 85, 48, 0, 0, Math.PI * 2); g.fill(); }
  // flower beds of autumn mums
  for (const [x, y] of MAP.flowers) { if (decal('d_flowerbed', x, y + 2, 150)) continue; g.fillStyle = '#4a3020'; g.beginPath(); g.ellipse(x, y, 62, 34, 0, 0, Math.PI * 2); g.fill(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.fillStyle = '#9a968c'; g.beginPath(); g.ellipse(x + Math.cos(a) * 64, y + Math.sin(a) * 36, 8, 5, 0, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 40; i++) { const a = R() * 6.3, d = Math.sqrt(R()), fx = x + Math.cos(a) * d * 52, fy = y + Math.sin(a) * d * 27; g.fillStyle = pick3(R(), ['#2f5a1a', '#3f6b22', '#4f7a2a']); g.beginPath(); g.ellipse(fx, fy, RR(5, 9), RR(3, 5), RR(0, 3), 0, Math.PI * 2); g.fill(); } }
  // little pumpkin patches
  for (const [x, y] of MAP.patches) { if (decal('d_patch', x, y, 250)) continue; g.fillStyle = 'rgba(60,40,20,.55)'; g.beginPath(); g.ellipse(x, y, 110, 52, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3f7a22'; g.lineWidth = 4; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(x + RR(-90, 90), y + RR(-40, 40)); g.bezierCurveTo(x + RR(-90, 90), y + RR(-40, 40), x + RR(-90, 90), y + RR(-40, 40), x + RR(-90, 90), y + RR(-40, 40)); g.stroke(); }
    for (let i = 0; i < 9; i++) { const lx = x + RR(-90, 90), ly = y + RR(-38, 38); g.fillStyle = '#4f9a2a'; g.beginPath(); g.ellipse(lx, ly, 12, 8, RR(0, 3), 0, Math.PI * 2); g.fill(); }
  }
  // fairy rings of mushrooms
  for (const [x, y] of MAP.mushrooms) if (!decal('d_mush', x, y - 4, 150)) for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2, mx = x + Math.cos(a) * 54, my = y + Math.sin(a) * 30; g.fillStyle = '#efe6d2'; g.fillRect(mx - 2.5, my - 6, 5, 8); g.fillStyle = i % 3 ? '#c0392b' : '#d9a066'; g.beginPath(); g.ellipse(mx, my - 7, 9, 6, 0, Math.PI, 0); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(mx - 3, my - 9, 1.6, 0, Math.PI * 2); g.fill(); }
  // tufts of grass everywhere
  for (let i = 0; i < 900; i++) { const x = RR(0, W), y = RR(0, H); g.strokeStyle = pick3(R(), ['rgba(60,90,25,.6)', 'rgba(120,140,40,.55)', 'rgba(40,60,20,.5)']); g.lineWidth = 1.6; g.beginPath(); for (let k = -2; k <= 2; k++) { g.moveTo(x + k * 2, y); g.lineTo(x + k * 3 + RR(-1, 1), y - RR(5, 11)); } g.stroke(); }
  worldFloor = cvs;
}
function pick3(r, arr) { return arr[Math.floor(r * arr.length) % arr.length]; }

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
  if (worldFloor) ctx.drawImage(worldFloor, 0, 0, ARENA.w, ARENA.h);
  else { ctx.fillStyle = floorPattern || '#6b7a2a'; ctx.fillRect(0, 0, ARENA.w, ARENA.h); }
  drawFirepitFlames();
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
  if (yardSpr) { drawPondWater(); drawPrints(); drawRestingLeaves(); }
  for (const w of webs) drawGroundWeb(w);
  for (const a of acids) drawAcid(a);
  // telegraph rings for charging enemies & bombs
  for (const b of bombs) {
    const tx = b.x + b.vx * b.t, ty = b.y + b.vy * b.t;
    ctx.strokeStyle = 'rgba(255,200,80,.5)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.ellipse(tx, ty, b.radius, b.radius * 0.6, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }

  // shadows
  for (const pr of props) if (!pr.flat) shadow(pr.x, pr.y + pr.d * 0.2, pr.w * 0.5, 0.3);
  for (const e of enemies) shadow(e.x, e.y, e.r * (1 - Math.min(e.z, 200) / 330), 0.28 * (1 - Math.min(e.z, 200) / 400));
  for (const e of enemies) if (e.stuckT > 0) drawStuckPuddle(e);
  for (const e of enemies) if (e.d.aura) { const g = ctx.createRadialGradient(e.x, e.y, 10, e.x, e.y, e.r * 1.8); const a = 0.25 + Math.sin(time * 4) * 0.08; g.addColorStop(0, e.d.aura + a + ')'); g.addColorStop(1, e.d.aura + '0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r * 1.8, e.r * 1.0, 0, 0, Math.PI * 2); ctx.fill(); }
  shadow(player.x, player.y, player.r * (player.dead && player.z <= 0 ? 1.9 : 1.1) * (1 - Math.min(player.z, 200) / 400));
  for (const c of corpses) shadow(c.x, c.y, c.r * 1.3 * (1 - Math.min(c.z, 200) / 400), 0.22 * Math.min(1, c.life / 0.7));
  for (const it of pickups) shadow(it.x, it.y, 14);
  for (const b of bombs) shadow(b.x, b.y, 14 * (1 - Math.min(b.z, 300) / 500), 0.25);
  for (const b of bullets) shadow(b.x, b.y, b.r * 0.8, 0.18);
  for (const b of ebullets) shadow(b.x, b.y, b.r * 0.8, 0.18);

  // depth-sorted drawables
  const list = [];
  for (const pr of props) if (!pr.flat) list.push([pr.y, () => pr.rock ? drawRock(pr) : drawSprite(pr.img, pr.x, pr.y + pr.d * 0.45, pr.h, false)]);
  for (const c of corpses) list.push([c.y - 2, () => drawCorpse(c)]);
  for (const e of enemies) list.push([e.y, () => drawEnemy(e)]);
  list.push([player.y, drawPlayer]);
  for (const it of pickups) list.push([it.y, () => drawPickup(it)]);
  for (const b of bullets) list.push([b.y, () => drawBullet(b)]);
  for (const r of roasts) list.push([r.y, () => drawRoast(r)]);
  for (const c of cans) list.push([c.y, () => drawCan(c)]);
  for (const f of flames) list.push([f.y, () => drawFlame(f)]);
  if (yardSpr) {
    for (const l of leaves) if (!l.rest) list.push([l.y, () => drawLeaf(l)]);
    for (const g of gourds) if (!g.dead) list.push([g.y, () => drawGourd(g)]);
    for (const f of blooms) list.push([f.y, () => drawBloom(f)]);
    for (const c of cattails) list.push([c.y, () => drawCattail(c)]);
  }
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
  const wade = e.spawnT <= 0 && e.z <= 1 && inPond(e.x, e.y);
  if (!wade) { drawEnemyBody(e); return; }
  const sink = Math.min(16, e.h * 0.14);
  ctx.save(); ctx.beginPath(); ctx.rect(e.x - 400, e.y - 800, 800, 800 - 2); ctx.clip(); ctx.translate(0, sink);
  drawEnemyBody(e); ctx.restore();
  waterline(e.x, e.y - 2, e.r * 1.1);
}
function drawEnemyBody(e) {
  const d = e.d, name = d.img, A = AN[name];
  let alpha = 1;
  if (e.spawnT > 0 && !e.leap) alpha = 1 - e.spawnT / e.spawnMax;
  const sx = 1 - e.sq * 0.7, sy = 1 + e.sq * -1 + 0; // sq>0 squash (wide/short), sq<0 stretch (tall/thin)
  const ssy = 1 - e.sq, ssx = 1 + e.sq * 0.8;
  let row = e.dir, frame = e.frame;
  if (d.ai === 'hop') { row = 'hop'; frame = e.act ?? 0; }
  else if (e.act !== null && e.act !== undefined && A && A.rows.act !== undefined) { row = 'act'; frame = e.act; }
  // charging wind-up shiver
  let shiver = (e.st === 'wind' || e.st === 'aim') ? Math.sin(e.t * 70) * 2 : e.stuckT > 0 ? Math.sin(e.t * 40) * 2.5 : e.sulkT > 0 ? Math.sin(e.t * 30) * 1.5 : 0;
  let rot = e.lean, ey = e.y - e.z;
  if (e.hypeT > 0) { shiver = rand(-3.5, 3.5); ey += rand(-2, 2); rot += Math.sin(e.t * 40) * 0.12; }
  if (e.downT > 0) {
    // knocked flat: tipped over on its back, legs kicking, with periodic failed attempts to sit up
    const el = e.downMax - e.downT, ph = el % 0.9;
    const tryUp = el > 0.6 && e.downT > 0.35 ? Math.max(0, Math.sin(Math.min(1, ph / 0.45) * Math.PI)) : 0;
    const rise = e.downT < 0.35 ? 1 - e.downT / 0.35 : 0;
    const side = e.flipX ? -1 : 1;
    rot = side * (Math.PI / 2) * (1 - Math.max(tryUp * 0.45, rise)) + Math.sin(e.t * 26) * 0.06;
    shiver = Math.sin(e.t * 30) * 1.5;
    if (A && A.rows.act !== undefined && rise < 0.5) { row = 'act'; frame = tryUp > 0.3 ? 0 : 3; if (frame === 3) rot *= 0.15; }
  }
  let msx = ssx, msy = ssy;
  if (e.meltT > 0) { const k = Math.min(1, e.meltT / 0.5); msy *= 1 - 0.22 * k + Math.sin(e.t * 5) * 0.03 * k; msx *= 1 + 0.14 * k; }
  const ok = drawAnim(name, row, frame, e.x + shiver, ey, e.h, e.flipX, { sx: msx, sy: msy, rot, flash: e.flash, alpha });
  if (!ok) drawSprite(name, e.x, e.y - e.z, e.h, e.face !== d.face, { sx: ssx, sy: ssy, rot: e.lean, flash: e.flash, alpha });
  if (e.stuckT > 0) drawCheeseWeb(e);
  if (e.downT > 0) drawDizzy(e);
  if (e.hypeT > 0) drawZaps(e);
  if (e.meltT > 0) drawMelt(e);
  if (e.burnT > 0) drawBurning(e);
  if (e.hp < e.maxHp && !e.d.boss) {
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
  const p = player, wade = !p.dead && p.z <= 1 && inPond(p.x, p.y);
  if (!wade) { drawPlayerBody(); return; }
  ctx.save(); ctx.beginPath(); ctx.rect(p.x - 300, p.y - 600, 600, 600 - 2); ctx.clip(); ctx.translate(0, 11);
  drawPlayerBody(); ctx.restore();
  waterline(p.x, p.y - 2, p.r * 1.3);
}
function waterline(x, y, r) {
  ctx.strokeStyle = 'rgba(230,245,255,.75)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x, y, r + Math.sin(time * 6) * 1.5, r * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(230,245,255,.35)'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.5, r * 0.48, 0, 0, Math.PI * 2); ctx.stroke();
}
function drawPlayerBody() {
  const p = player, A = AN[p.ch];
  const blink = p.inv > 0 && !p.dead && p.dashT <= 0 && p.jumpT <= 0 && Math.floor(time * 20) % 2 === 0;
  let row = p.dir, frame = p.frame, flip = p.flipX, showGun = true;
  if (p.dead) { row = 'act'; frame = 2; showGun = false; flip = p.vx > 0 ? false : p.vx < 0 ? true : flip; }
  else if (p.chargeT > 0) { row = 'act'; frame = 1; flip = p.chargeDir[0] < 0; showGun = false; }
  else if (p.chargeWind > 0) { row = 'act'; frame = 1; showGun = false; }
  else if (p.jumpT > 0) { row = 'act'; frame = 3; showGun = false; flip = false; }
  else if (p.chewT > 0 || p.breathT > 0) showGun = false;
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
  if (p.chewT > 0 && IMG.w_chili) { const k = p.chewT / 0.6; drawSprite('w_chili', p.x + 6, p.y - p.z - p.h * (0.62 + (1 - k) * 0.12) + 10, 26 * Math.max(0.2, k), false, { rot: -0.6 }); }
}

function drawMedkit(x, y, t) {
  ctx.save();
  const pulse = 1 + Math.sin(t * 5) * 0.06; ctx.translate(x, y - 14); ctx.scale(pulse, pulse);
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 40); g.addColorStop(0, 'rgba(120,255,140,.55)'); g.addColorStop(1, 'rgba(120,255,140,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill();
  if (IMG.medkit) { const im = IMG.medkit, h = 46, w = h * im.width / im.height; ctx.drawImage(im, -w / 2, -h * 0.62, w, h); ctx.restore(); return; }
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2b1a10'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-17, -13, 34, 26, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#9a6a3a'; ctx.fillRect(-7, -18, 14, 5); ctx.strokeRect(-7, -18, 14, 5);
  ctx.fillStyle = '#e53935'; ctx.fillRect(-3.5, -9, 7, 18); ctx.fillRect(-9, -3.5, 18, 7);
  ctx.restore();
}

function drawPickup(it) {
  const y = it.y - it.z - 6 - Math.sin(it.t * 4) * 4;
  if (it.life < 3 && Math.floor(it.t * 10) % 2 === 0) return;
  // glow
  const g = ctx.createRadialGradient(it.x, y - 16, 2, it.x, y - 16, 34);
  g.addColorStop(0, 'rgba(255,220,120,.55)'); g.addColorStop(1, 'rgba(255,220,120,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(it.x, y - 16, 34, 0, Math.PI * 2); ctx.fill();
  if (it.kind === 'medkit') drawMedkit(it.x, y, it.t);
  else if (it.kind === 'slice') drawSprite('slice', it.x, y, 34, false);
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

function drawMacShot(b) {
  const y = b.y - b.z, a = Math.atan2(b.vy, b.vx), r = b.r, t = time * 18 + (b.seed || 0);
  ctx.save(); ctx.translate(b.x, y); ctx.rotate(a);
  // a stretchy tail of goo trailing behind
  ctx.fillStyle = '#f5a823';
  ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.55); ctx.quadraticCurveTo(-r * 2.2, -r * 0.1 + Math.sin(t) * 2, -r * 3.2, Math.sin(t * 0.7) * 3); ctx.quadraticCurveTo(-r * 2.2, r * 0.2 + Math.sin(t) * 2, -r * 0.4, r * 0.55); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(-r * 3.2, Math.sin(t * 0.7) * 3, r * 0.3, 0, Math.PI * 2); ctx.fill();
  // the wobbling blob
  const sx = 1.25 + Math.sin(t) * 0.12, sy = 1 - Math.sin(t) * 0.1;
  const g = ctx.createRadialGradient(-r * 0.2, -r * 0.35, 1, 0, 0, r * 1.3);
  g.addColorStop(0, '#fff0a0'); g.addColorStop(0.5, '#ffbe2e'); g.addColorStop(1, '#e08a12');
  ctx.fillStyle = g; gooBlob(0, 0, r * sx, r * sy, b.seed || 1, 9, time); ctx.fill();
  ctx.strokeStyle = '#a8620a'; ctx.lineWidth = 2; ctx.stroke();
  macaroni(r * 0.25, r * 0.15, t * 0.2, 0.75); macaroni(-r * 0.45, -r * 0.2, 2 + t * 0.15, 0.6);
  ctx.fillStyle = 'rgba(255,255,235,.85)'; ctx.beginPath(); ctx.ellipse(r * 0.1, -r * 0.5, r * 0.45, r * 0.16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBullet(b) {
  const y = b.y - b.z;
  if (b.w === 'mac') { drawMacShot(b); return; }
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
  if (b.kind === 'gravy') {
    ctx.fillStyle = '#7a4416'; ctx.strokeStyle = '#3b2010'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, b.r * 1.1, b.r, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,150,.5)'; ctx.beginPath(); ctx.ellipse(-b.r * 0.3, -b.r * 0.35, b.r * 0.4, b.r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  } else if (b.kind === 'seed') {
    ctx.rotate(b.rot);
    ctx.fillStyle = '#fff1c9'; ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, b.r * 1.5, b.r * 0.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,120,30,.35)'; ctx.beginPath(); ctx.arc(0, 0, b.r + 5, 0, Math.PI * 2); ctx.fill();
  } else if (b.kind === 'feather') {
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
    ctx.fillStyle = e.d.boss ? '#ff3b3b' : 'rgba(255,140,60,.8)';
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
  hudText(`LEVEL ${wave}`, VW - 14, top + 98, 16, '#fff4dc', 'right');

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
  } else if (c.special === 'taunt' || c.special === 'can' || c.special === 'stomp' || c.special === 'slime' || c.special === 'chili') {
    hudSlots.push({ k: 'special', x, y, w: sw });
    const S = { taunt: ['ROAST', p.roastCd, ROAST_CD, '#c0392b', 'rgba(230,70,50,.55)'], can: ['CANS', p.canCd, CAN_CD, '#2f7fd6', 'rgba(90,180,255,.55)'], slime: ['SLIME', p.slimeCd, SLIME_CD, '#3f9f1a', 'rgba(125,255,58,.5)'], chili: [p.breathT > 0 ? Math.ceil(p.breathT) + 's' : 'CHILI', p.chiliCd, CHILI_CD, '#d63a1a', 'rgba(255,110,40,.55)'], stomp: ['STOMP', p.stompCd, STOMP_CD, '#7a5230', 'rgba(200,140,80,.55)'] }[c.special];
    const busy = p.jumpT > 0 || p.stompWind > 0 || p.chewT > 0 || p.breathT > 0, ready = S[1] <= 0 && !busy;
    ctx.fillStyle = ready ? S[3] : '#3b2414cc'; ctx.strokeStyle = ready ? '#fff4dc' : '#2b1a10'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x, y, sw, sw, 12); ctx.fill(); ctx.stroke();
    if (!ready && !busy) { ctx.fillStyle = S[4]; const f = 1 - clamp(S[1] / S[2], 0, 1); ctx.fillRect(x + 3, y + sw - 3 - (sw - 6) * f, sw - 6, (sw - 6) * f); }
    hudText(S[0], x + sw / 2, y + sw / 2 + 2, isTouch ? 11 : 13, '#fff', 'center');
    if (!isTouch) hudText('F', x + 9, y + 15, 11, '#fff4dc', 'center');
    const tb = $('tSpecial'); if (tb) tb.style.opacity = ready ? '1' : '0.45';
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
    hudText(boss.d.bname, VW / 2, by - 6, 18, '#ff6b4a', 'center');
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
  if (player) {
    const spc = CHARS[player.ch].special, tb = $('tSpecial');
    const B = { charge: ['CHARGE', '#c9541acc'], taunt: ['ROAST', '#c0392bcc'], can: ['CANS', '#2f7fd6cc'], stomp: ['STOMP', '#7a5230cc'], slime: ['SLIME', '#3f9f1acc'], chili: ['CHILI', '#d63a1acc'] }[spc];
    tb.style.display = B ? 'flex' : 'none';
    if (B) { tb.textContent = B[0]; tb.style.background = B[1]; }
  }
  $('pauseBtn').style.display = state === 'play' ? 'flex' : 'none';
  for (const id of ['aimBtn', 'fireBtn']) $(id).style.display = state === 'play' || state === 'paused' ? 'flex' : 'none';
}

function buildCards() {
  const wrap = $('cards'); wrap.innerHTML = '';
  for (const k of CHAR_ORDER) {
    const c = CHARS[k];
    const el = document.createElement('div');
    el.className = 'card' + (k === selected ? ' sel' : '');
    el.innerHTML = `<img src="assets/${k}.png" alt=""><div class="cname"></div><div class="role"></div><div class="perk"></div>
      <div class="stats"><span>❤ ${c.hp}</span><span>⚡ ${c.speed}</span></div>`;
    el.querySelector('.cname').textContent = names[k];
    el.querySelector('.role').textContent = c.role;
    el.querySelector('.perk').textContent = c.perk;
    el.addEventListener('click', () => { selected = k; store.set('tg_char', k); for (const c2 of wrap.children) c2.classList.remove('sel'); el.classList.add('sel'); });
    el.addEventListener('dblclick', startGame);
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
  const lines = [`${names[player.ch]} made it to level ${wave}`, `Score: ${score.toLocaleString()}${isHi ? '  🏆 NEW BEST!' : ''}`, `Foes defeated: ${kills}`, `Best: ${Math.max(hi, score).toLocaleString()}`];
  for (const l of lines) { const d = document.createElement('div'); d.textContent = l; $('overStats').appendChild(d); }
  setTimeout(() => show('over'), 250);
}

$('playBtn').addEventListener('click', () => { Sfx.unlock(); testLevel = 0; state = 'select'; buildCards(); show('select'); });
// ---------- test mode: jump straight to any level (optionally invincible) ----------
let testLevel = 0, testGod = store.get('tg_god', false);
function buildLevels() {
  const wrap = $('lvlGrid'); wrap.innerHTML = '';
  for (let n = 1; n <= 25; n++) {
    const L = levelOf(n), b = document.createElement('button');
    b.className = 'lvl' + (L.boss ? ' boss' : '');
    b.innerHTML = `<b>${n}</b><span></span>`;
    b.querySelector('span').textContent = L.boss ? ENEMIES[L.boss].bname : L.name;
    b.addEventListener('click', () => { testLevel = n; state = 'select'; buildCards(); show('select'); });
    wrap.appendChild(b);
  }
  $('godChk').checked = testGod;
}
$('testBtn').addEventListener('click', () => { Sfx.unlock(); buildLevels(); show('levels'); });
$('lvlBack').addEventListener('click', () => show('title'));
$('godChk').addEventListener('change', e => { testGod = e.target.checked; store.set('tg_god', testGod); });
$('aimBtn').addEventListener('click', e => { e.currentTarget.blur(); setAuto(!autoAim, autoFire); });
$('fireBtn').addEventListener('click', e => { e.currentTarget.blur(); setAuto(autoAim, !autoFire); });
setAuto(autoAim, autoFire);
$('goBtn').addEventListener('click', startGame);
$('againBtn').addEventListener('click', startGame);
$('charBtn').addEventListener('click', () => { state = 'select'; buildCards(); show('select'); });
$('resumeBtn').addEventListener('click', togglePause);
function quitToTitle() { state = 'title'; player = null; testLevel = 0; show('title'); refreshTitle(); }
$('quitBtn').addEventListener('click', quitToTitle);
$('overQuitBtn').addEventListener('click', quitToTitle);
$('muteBtn').addEventListener('click', toggleMute);
$('pauseBtn').addEventListener('click', togglePause);
$('muteBtn').textContent = Sfx.muted ? '🔇' : '🔊';

function refreshTitle() {
  const hi = store.get('tg_hi', 0);
  $('hiScore').textContent = hi ? `Best score: ${hi.toLocaleString()}` : '';
}
$('ctrlHint').textContent = isTouch
  ? 'Left thumb moves · Right thumb aims & fires (or let it auto-fire) · Tap the bomb to throw stuffing'
  : 'WASD move · Mouse aim · Click fire · Space stuffing bomb · Shift dash · Q/E or 1–4 swap weapons · F special · T auto-aim · R auto-fire';
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

if (new URLSearchParams(location.search).has('debug')) window.__tg = { fp: () => prints.length, pk: () => pickups.filter(it => it.kind === 'medkit').map(it => ({ x: Math.round(it.x), y: Math.round(it.y), z: it.z })), fn: { assembleMac: () => assembleMac(), spawn: (t, x, y) => spawnEnemy(t, x, y), drop: (x, y, k) => dropPickup(x, y, k) }, get s() { return { state, wave, score, kills, player, cam, ZOOM, enemies: enemies && enemies.map(e => [e.type, Math.round(e.x), Math.round(e.y), e.spawnT, Math.round(e.hp), +(e.sulkT || 0).toFixed(1), +(e.hypeT || 0).toFixed(1), +(e.downT || 0).toFixed(1), +(e.meltT || 0).toFixed(1), +(e.burnT || 0).toFixed(1)]), bullets: bullets && bullets.length }; } };
loadAssets().then(() => { buildFloor(); requestAnimationFrame(frame); });
})();
