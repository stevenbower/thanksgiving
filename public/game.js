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
  'mashboss','gourdboss','cornboss','medkit','d_firepit','d_blanket','d_flowerbed','d_patch','d_pond','d_mush','y_rocks','y_leaves','y_pumpkins','y_mums','y_lily',
  'david','peter','eric','robyn','madison','taylor','zoe','jay','sarah','izzy','w_guitar','w_pillow','w_ball','w_blower','w_call','w_hug','w_rainbow','w_wave','y_puppies','w_splash','d_gravy','w_sign','w_megaphone','w_frame','w_paint','w_palette'];
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
  grandpa:   { name:'Jan',          role:'Poet & Painter',  hp:130, speed:245, perk:'Gravy Gun hits 40% harder. SPECIAL: flings a paint splash that freezes enemies into framed masterpieces. Hit them to shatter the art!', gravyMul:1.4, puddleMul:2, special:'paint' },
  grandma:   { name:'Paula',        role:'Protest Leader',  hp:120, speed:250, perk:'Starts with Pie Frisbees and pie heals double. SPECIAL: grabs her megaphone and nearby enemies drop everything to march in her picket line!', startPie:20, healMul:2, special:'protest' },
  teen:      { name:'Eli',          role:'Junkyard Inventor', hp:100, speed:265, perk:'Picks up junk scraps. Collect 3 and he builds a Mac & Cheese Blaster that traps enemies in sticky cheese webs for 10s!', rateMul:0.85, startCorn:250, special:'scrap' },
  kidred:    { name:'Issac',        role:'Human Cannonball', hp:85,  speed:315, perk:'Super speedy. SPECIAL: winds up, then charges like crazy, smashing through enemy after enemy!', dashCd:0.45, special:'charge' },
  kidstripe: { name:'Benny',        role:'Trash Talker',    hp:90,  speed:290, perk:'Bigger Stuffing Bombs and a big mouth. SPECIAL: hurls insults so mean they hurt, and enemies run away crying!', bombs:6, bombMul:1.5, special:'taunt' },
  mama:      { name:'Raquel',       role:'Caffeine Queen',  hp:105, speed:280, perk:'SPECIAL: hurls fizzing energy drink cans. Anything splashed goes bonkers and attacks the other enemies!', special:'can' },
  pops:      { name:'Steve',        role:'The Big Stomp',   hp:140, speed:250, perk:'Tough as a turkey leg. SPECIAL: a giant jump that lands with a shockwave, knocking every enemy flat on their backs!', special:'stomp' },
  michelle:  { name:'Michelle',       role:'Slime Slinger', hp:100, speed:275, perk:'SPECIAL: lobs balls of acid slime that melt enemies into gooey, harmless puddles of themselves!', special:'slime' },
  arthur:    { name:'Arthur',       role:'Hot Mouth',       hp:115, speed:265, perk:'SPECIAL: pops a chili pepper and breathes a roaring blast of fire for 5 seconds!', special:'chili' },
};
Object.assign(CHARS, {
  david:   { name:'David',   role:'Groovy Guitar Guy', hp:125, speed:250, perk:'SPECIAL: strums his guitar and nearby enemies start a hippie dance party, hugging each other instead of fighting!', special:'guitar' },
  peter:   { name:'Peter',   role:'Napmaster General', hp:120, speed:245, perk:'SPECIAL: one huge yawn puts every enemy nearby to sleep. Sleeping enemies take extra damage!', special:'nap' },
  eric:    { name:'Eric',    role:'Belly Flop Champ',  hp:135, speed:255, perk:'SPECIAL: a running belly flop that slides on gravy, bowling enemies over and sending out a gravy wave!', special:'flop' },
  robyn:   { name:'Robyn',   role:'Leaf Blower Queen', hp:110, speed:270, perk:'SPECIAL: fires up the leaf blower and blasts enemies (and their shots) clear across the yard!', special:'blower' },
  madison: { name:'Madison', role:'Soccer Star',       hp:95,  speed:300, perk:'SPECIAL: kicks a soccer ball that ricochets from enemy to enemy!', special:'ball' },
  taylor:  { name:'Taylor',  role:'Goalie',            hp:100, speed:290, perk:'SPECIAL: a goalie shield that bounces enemy shots back and protects teammates inside it!', special:'goalie' },
  zoe:     { name:'Zoe',     role:'Puppy Wrangler',    hp:95,  speed:295, perk:'SPECIAL: tosses out puppies that zoom around, and enemies chase them instead of you!', special:'puppy' },
  jay:     { name:'Jay',     role:'El Luchador',       hp:120, speed:260, perk:'SPECIAL: transforms into a masked luchador, grabs the closest enemy, swings them around smashing everyone, then flings them into the crowd!', special:'luchador' },
  sarah:   { name:'Sarah',   role:'Hug Healer',        hp:115, speed:265, perk:'SPECIAL: a big group hug that heals everyone nearby and even gets fallen teammates back up!', special:'hug' },
  izzy:    { name:'Izzy',    role:'Rainbow Blaster',   hp:90,  speed:300, perk:'SPECIAL: fires a rainbow laser that makes enemies explode into confetti and flowers!', special:'rainbow' },
});
const CHAR_ORDER = ['grandma','pops','mama','michelle','arthur','teen','kidred','kidstripe','david','peter','eric','robyn','madison','taylor','zoe','jay','sarah','izzy','grandpa'];

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
// every special's cooldown is scaled by this (0.6 = 40% faster than the original tuning)
const CD_MUL = 0.6;
const SCRAPS_NEEDED = 3; // junk scraps Eli needs to build the Mac & Cheese Blaster
const ROAST_CD = 4.5 * CD_MUL, CAN_CD = 5 * CD_MUL, STOMP_CD = 6 * CD_MUL, SLIME_CD = 5 * CD_MUL, CHILI_CD = 10 * CD_MUL, CHARGE_CD = 6 * CD_MUL;

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
    strum() { [196, 247, 294, 392, 494].forEach((f, i) => { tone({ f, type: 'triangle', dur: 0.9, vol: 0.09, delay: i * 0.035 }); tone({ f: f * 2, type: 'sine', dur: 0.6, vol: 0.03, delay: i * 0.035 }); }); },
    yawn() { tone({ f: 260, f2: 520, type: 'sine', dur: 0.35, vol: 0.12 }); tone({ f: 520, f2: 140, type: 'sine', dur: 0.6, vol: 0.12, delay: 0.35 }); },
    wind() { if (throttle('wind', 250)) return; burst({ dur: 0.5, vol: 0.18, freq: 1400, type: 'bandpass', q: 0.5 }); tone({ f: 90, f2: 110, type: 'sawtooth', dur: 0.5, vol: 0.04 }); },
    kick() { if (throttle('kick', 80)) return; tone({ f: 160, f2: 60, type: 'sine', dur: 0.12, vol: 0.25 }); burst({ dur: 0.05, vol: 0.12, freq: 1200 }); },
    shield() { tone({ f: 300, f2: 1200, type: 'sine', dur: 0.35, vol: 0.12 }); tone({ f: 600, f2: 1800, type: 'triangle', dur: 0.35, vol: 0.05 }); },
    bark() { if (throttle('bark', 160)) return; tone({ f: rand(500, 700), f2: rand(250, 350), type: 'square', dur: 0.07, vol: 0.08 }); tone({ f: rand(500, 700), f2: 300, type: 'square', dur: 0.07, vol: 0.07, delay: 0.12 }); },
    call() { [0, 1, 2, 3, 4].forEach(i => tone({ f: 700 + (i % 2) * 300, f2: 500, type: 'sawtooth', dur: 0.08, vol: 0.07, delay: i * 0.09 })); },
    megaphone() { burst({ dur: 0.08, vol: 0.12, freq: 3000, type: 'highpass' }); [0, 1, 2].forEach(i => tone({ f: 330 + i * 40, f2: 300, type: 'square', dur: 0.14, vol: 0.07, delay: 0.08 + i * 0.15 })); },
    beam() { tone({ f: 400, f2: 1600, type: 'sawtooth', dur: 0.4, vol: 0.07 }); [523, 659, 784, 988, 1175].forEach((f, i) => tone({ f, type: 'sine', dur: 0.15, vol: 0.06, delay: i * 0.05 })); },
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
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; if (state === 'play' && !NET) togglePause(); });

cv.addEventListener('contextmenu', e => e.preventDefault());
let hudSlots = []; // tappable weapon/bomb slots, filled by drawHUD
function hudSlotAt(x, y) { return hudSlots.find(r => x >= r.x - 4 && x <= r.x + r.w + 4 && y >= r.y - 4 && y <= r.y + r.w + 4); }
// --- mouse (pointer events) ---
cv.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse') return;
  Sfx.unlock();
  if (state === 'play') {
    const slot = hudSlotAt(e.clientX, e.clientY);
    if (slot) { if (slot.k === 'bomb') wantBomb = true; else if (slot.k === 'special') wantSpecial = true; else if (slot.k !== 'info') wantWeapon = slot.k; return; }
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
      if (slot) { if (slot.k === 'bomb') wantBomb = true; else if (slot.k === 'special') wantSpecial = true; else if (slot.k !== 'info') wantWeapon = slot.k; continue; }
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
let selected = store.get('tg_char', 'pops'); // first-time default: Steve
// the character lists put whoever you played most recently first, pushing the rest down
function charOrder() { const mru = store.get('tg_mru', []).filter(k => CHARS[k]); return [...mru, ...CHAR_ORDER.filter(k => !mru.includes(k))]; }
function bumpChar(k) { if (!CHARS[k]) return; const mru = store.get('tg_mru', []).filter(x => x !== k && CHARS[x]); mru.unshift(k); store.set('tg_mru', mru); }
const names = Object.fromEntries(CHAR_ORDER.map(k => [k, CHARS[k].name])); // fixed names (renaming was removed)
let tableT = 8, corpses = [], webs = [], roasts = [], cans = [], acids = [], flames = [];
// player = the player currently being simulated/drawn (the "actor"); me = this device's player; players = everyone
let player, me, players = [], enemies, bullets, ebullets, bombs, particles, puddles, pickups, floaters, props, spawnQueue;
let NET = null; // null = single player; otherwise { room, host: bool, roster, ... } (see the multiplayer section)
let nextId = 1;
const NP = () => Math.max(1, players.length);
let wave, waveState, waveTimer, score, kills, shake, time, banner, boss, hitStop;
const cam = { x: ARENA.w / 2, y: ARENA.h / 2 };

function makePlayer(ch, id, pname, idx, n) {
  const c = CHARS[ch], a = n > 1 ? -Math.PI / 2 + (idx - (n - 1) / 2) * 0.7 : Math.PI / 2;
  return {
    id, pname, isPlayer: true, input: blankInput(),
    x: ARENA.w / 2 + (n > 1 ? Math.cos(a) * 130 : 0), y: ARENA.h / 2 + 120 + (n > 1 ? Math.sin(a) * 60 + 60 : 0), vx: 0, vy: 0, z: 0, vz: 0, r: 20, h: 96,
    hp: c.hp, maxHp: c.hp, speed: c.speed, ch,
    ammo: { gravy: Infinity, cran: 20, corn: c.startCorn || 0, pie: c.startPie || 0 },
    cur: c.startCorn ? 'corn' : c.startPie ? 'pie' : 'gravy',
    bombs: c.bombs || 3, fireCd: 0, dashCd: 0, dashT: 0, dashDir: [0, 0], inv: 0,
    face: 1, aim: 0, moving: false, flash: 0, bombCd: 0,
    // animation / body dynamics
    dir: 'front', flipX: false, dirHold: 0, stride: 0, frame: 1, lastFrame: 1, bodyAng: Math.PI / 2,
    lastFire: 9, lean: 0, leanV: 0, sq: 0, sqV: 0, hurtT: 0, victoryT: 0, dead: false, deadT: 0, gunAng: Math.PI / 2,
    scraps: 0, macT: 0, prevWeapon: 'gravy', chargeCd: 0, chargeWind: 0, chargeT: 0, chargeDir: [1, 0], chargeTarget: null, lastTaunt: -9, speech: null, roastCd: 0, roastFlash: 0, canCd: 0, stompCd: 0, stompWind: 0, jumpT: 0, slimeCd: 0, chiliCd: 0, chewT: 0, breathT: 0, spCd: 0, spT: 0, spA: 0,
  };
}
// roster: [{ id, name, ch }] (single player: just this device)
function newGame(roster, myId) {
  roster = roster || [{ id: 'me', name: playerName(), ch: selected }];
  players = roster.map((r, i) => makePlayer(r.ch, r.id, r.name, i, roster.length));
  me = players.find(p => p.id === (myId || 'me')) || players[0];
  player = me;
  nextId = 1;
  enemies = []; bullets = []; ebullets = []; bombs = []; particles = []; puddles = []; pickups = []; floaters = []; corpses = []; webs = []; roasts = []; cans = []; acids = []; flames = []; fireParts = []; smokeParts = []; gizmos = []; tableT = 8;
  initYard();
  spawnQueue = []; wave = Math.max(0, (testLevel || parseInt(new URLSearchParams(location.search).get('wave')) || 1) - 1); score = 0; kills = 0; shake = 0; time = 0; banner = null; boss = null; hitStop = 0;
  props = makeProps();
  cam.x = me.x; cam.y = me.y;
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
  for (const q of players) if (!q.dead && q.z < 8) m.push(q);
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
          const kick = m.isPlayer ? 1.6 : (m.mass || 1) * 0.6;
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
      if ((e.x - g.x) ** 2 + ((e.y - g.y) * 1.3) ** 2 < (e.r + g.r) ** 2) { if (!(NET && !NET.host)) damageEnemy(e, 22 + wave * 2, g.vx / sp, g.vy / sp, 320); smashGourd(g); floatText(e.x, e.y - e.h - 20, 'SQUASH!', '#ff9a3a', 0.8, 22); break; }
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
    if (!inPond(m.x, m.y)) { if (m.isPlayer && m.wetT > 0) m.wetT -= dt; continue; }
    if (m.isPlayer) m.wetT = 3;
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

// ---------- realistic fire: soft additive flame particles that rise, sway, shrink and cool white -> yellow -> orange -> red,
// with a glowing coal bed, popping embers, curling smoke and flickering light. Used by the fire pit and anything burning.
let fireParts = [], smokeParts = [], fireSpr = null, pitAcc = 0;
function makeFireSprites() {
  const ramp = [[255, 215, 120], [255, 190, 80], [255, 155, 45], [250, 115, 25], [225, 75, 15], [180, 45, 10], [120, 25, 8], [70, 14, 5]]; // little blue: overlaps saturate to yellow, never white
  const mk = (r, g, b, soft) => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(soft, `rgba(${r},${g},${b},.55)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return c; };
  const flame = [];
  for (let i = 0; i < 24; i++) { // smooth colour ramp, 24 steps
    const f = i / 23 * (ramp.length - 1), k = Math.floor(f), t = f - k, A = ramp[k], B = ramp[Math.min(ramp.length - 1, k + 1)];
    flame.push(mk(...A.map((v, j) => Math.round(v + (B[j] - v) * t)), 0.35));
  }
  const smoke = document.createElement('canvas'); smoke.width = smoke.height = 64;
  { const x = smoke.getContext('2d'); for (let i = 0; i < 5; i++) { const cx = 32 + Math.cos(i * 1.3) * 9, cy = 32 + Math.sin(i * 1.3) * 7, gr = x.createRadialGradient(cx, cy, 0, cx, cy, 22);
      gr.addColorStop(0, 'rgba(38,34,32,.6)'); gr.addColorStop(1, 'rgba(38,34,32,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); } }
  fireSpr = { flame, smoke, ember: mk(255, 200, 120, 0.2) };
}
// one tongue of flame. heat 0..1 picks how hot it starts; it cools as it rises
function emitFlame(x, y, z, size, o = {}) {
  if (fireParts.length > 900) return;
  const life = (o.life || 0.75) * rand(0.7, 1.15);
  fireParts.push({ x, y, z, vx: (o.vx || 0) + rand(-14, 14), vz: rand(50, 95) * (o.lift || 1), size, life, max: life, ph: rand(0, 6.3), heat: o.heat ?? rand(0, 0.18) });
}
function emitEmber(x, y, z, vx = 0) {
  if (fireParts.length > 900) return;
  const life = rand(0.8, 1.8);
  fireParts.push({ x, y, z, vx: vx + rand(-50, 50), vz: rand(90, 220), size: rand(1.6, 3), life, max: life, ph: rand(0, 6.3), ember: true });
}
function emitSmoke(x, y, z, size = 14, dark = 0.3) {
  if (smokeParts.length > 160) return;
  const life = rand(1.8, 3);
  smokeParts.push({ x, y, z, vx: rand(-8, 8), vz: rand(28, 50), size, life, max: life, a: dark, rot: rand(0, 6.3), vr: rand(-0.6, 0.6) });
}
function updateFire(dt) {
  if (!fireSpr) makeFireSprites();
  // the fire pit: a steady bed of flames, gusting
  const [px, py] = MAP.firepit, gust = 0.75 + 0.25 * Math.sin(time * 1.7) * Math.sin(time * 2.9 + 1);
  pitAcc += dt * 75 * gust;
  while (pitAcc > 1) { pitAcc--; const u = rand(-1, 1), edge = Math.abs(u); emitFlame(px + u * 26, py + rand(-5, 5), 4 + rand(0, 4), rand(22, 34) * (1 - edge * 0.4), { life: 1.15 * (1 - edge * 0.4), lift: 1.4, heat: rand(0, 0.25) + edge * 0.15 }); }
  if (Math.random() < dt * 3.5) emitEmber(px + rand(-20, 20), py, 20);
  if (Math.random() < dt * 5) emitSmoke(px + rand(-12, 12), py, rand(50, 70), rand(12, 18), 0.22);
  if (Math.random() < dt * 0.6) { for (let i = 0; i < 6; i++) emitEmber(px + rand(-10, 10), py, 14, rand(-40, 40)); } // a log pops
  // anything burning sheds flames from all over its body; they trail behind as it runs
  for (const e of enemies) {
    if (!(e.burnT > 0) || e.dead) continue;
    // how fast it's running (from its last position) so the flames stream out behind it
    const mvx = e.lfx === undefined ? 0 : clamp((e.x - e.lfx) / Math.max(dt, 1e-3), -600, 600); e.lfx = e.x; e.fvx = mvx;
    const k = Math.min(1, e.burnT / 0.6), area = e.r * e.h / 1800;
    e.fireAcc = (e.fireAcc || 0) + dt * 38 * k * Math.min(2.2, Math.max(0.8, area));
    while (e.fireAcc > 1) { e.fireAcc--;
      const a = rand(0, 6.3), rr = Math.sqrt(Math.random()), hz = Math.pow(Math.random(), 0.8);
      emitFlame(e.x + Math.cos(a) * e.r * 0.75 * rr, e.y + 2, e.z + e.h * (0.08 + hz * 0.72), rand(18, 28) * Math.min(1.6, 0.7 + e.r / 60), { vx: -mvx * 0.45, life: 0.6, heat: rand(0.05, 0.3) });
    }
    if (Math.random() < dt * 4 * k) emitEmber(e.x + rand(-e.r, e.r) * 0.5, e.y, e.z + e.h * 0.6, -mvx * 0.3);
    if (Math.random() < dt * 6 * k) emitSmoke(e.x + rand(-10, 10), e.y, e.z + e.h * 0.95, rand(10, 16), 0.32);
  }
  for (const p of fireParts) {
    p.life -= dt;
    const t = 1 - p.life / p.max;
    // buoyancy plus a turbulent sideways lick; flames speed up as they rise
    p.vz += (p.ember ? -60 : 160) * dt;
    p.vx += Math.sin(time * 7 + p.ph + p.z * 0.06) * (p.ember ? 260 : 120) * dt + 10 * dt;
    p.vx *= Math.exp(-dt * (p.ember ? 1 : 3));
    p.x += p.vx * dt; p.z += p.vz * dt;
  }
  fireParts = fireParts.filter(p => p.life > 0);
  for (const s of smokeParts) { s.life -= dt; s.x += (s.vx + 14) * dt; s.z += s.vz * dt; s.vz *= Math.exp(-dt * 0.4); s.rot += s.vr * dt; }
  smokeParts = smokeParts.filter(s => s.life > 0);
}
// ground layer: glowing coals and warm light that flickers on the grass
function drawFirepitFlames() {
  const [x, y] = MAP.firepit, fl = 0.8 + Math.sin(time * 11) * 0.08 + Math.sin(time * 23 + 1) * 0.06 + Math.sin(time * 3.1) * 0.06;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 5, x, y, 170 * fl); g.addColorStop(0, `rgba(255,140,50,${0.3 * fl})`); g.addColorStop(0.4, `rgba(255,110,30,${0.12 * fl})`); g.addColorStop(1, 'rgba(255,100,30,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 170 * fl, 110 * fl, 0, 0, Math.PI * 2); ctx.fill();
  // coal bed: pulsing hot spots
  for (let i = 0; i < 9; i++) {
    const cx = x + Math.cos(i * 2.39) * 22 * ((i % 3) / 2 + 0.3), cy = y - 2 + Math.sin(i * 2.39) * 8, p = 0.55 + 0.45 * Math.sin(time * (2 + i * 0.7) + i);
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12); cg.addColorStop(0, `rgba(255,${150 + p * 80 | 0},60,${0.55 * p})`); cg.addColorStop(1, 'rgba(255,60,10,0)');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(cx, cy, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
// the warm flicker a burning body casts on itself and the ground
function drawBurning(e) {
  const k = Math.min(1, e.burnT / 0.6), fl = 0.75 + Math.sin(e.t * 19) * 0.12 + Math.sin(e.t * 31 + e.seed) * 0.1;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const gx = e.x, gy = e.y - e.z - e.h * 0.45, R = Math.max(e.r * 1.6, e.h * 0.6);
  const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, R); g.addColorStop(0, `rgba(255,120,30,${0.32 * k * fl})`); g.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(gx, gy, R, 0, Math.PI * 2); ctx.fill();
  const gg = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 2.2); gg.addColorStop(0, `rgba(255,130,40,${0.28 * k * fl})`); gg.addColorStop(1, 'rgba(255,100,30,0)');
  ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r * 2.2, e.r * 1.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
// the body of a fire: layered, wavering flame tongues (red outside, orange, a white-yellow core) drawn additively;
// the particles add the flickering licks and sparks on top of this
function drawTongues(x, y, W, H, n, tt, seed, k = 1, alpha = 1) {
  const nz = (a) => Math.sin(a) * 0.6 + Math.sin(a * 2.3 + 1.7) * 0.3 + Math.sin(a * 5.1 + 0.4) * 0.1;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [wk, hk, c0, c1, c2, al] of [[1, 1, '255,120,30', '225,70,15', '140,30,8', 0.42], [0.66, 0.75, '255,180,70', '255,120,30', '210,60,15', 0.45], [0.34, 0.45, '255,235,160', '255,200,90', '255,150,50', 0.55]]) {
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0 : i / (n - 1) * 2 - 1, edge = Math.abs(u);
      const ph = tt * (5.5 + i * 0.9) + seed + i * 2.1;
      const rnd = (Math.sin(i * 12.9898 + seed * 7.1) * 43758.5453) % 1, base = 0.62 + 0.38 * Math.abs(rnd);
      const h = H * hk * base * (1 - edge * 0.45) * (0.75 + 0.35 * (nz(ph * 0.7) * 0.5 + 0.5)) * k;
      const bw = W / n * 1.9 * wk * (1 - edge * 0.3), bx = x + u * W * 0.36;
      const tipx = bx + nz(ph) * W * 0.22 + u * W * 0.08, midx = bx + nz(ph + 1.3) * W * 0.12;
      const g = ctx.createLinearGradient(0, y, 0, y - h);
      const A = al * alpha;
      g.addColorStop(0, `rgba(${c0},${A})`); g.addColorStop(0.55, `rgba(${c1},${A * 0.85})`); g.addColorStop(1, `rgba(${c2},0)`);
      ctx.fillStyle = g; ctx.beginPath();
      // narrow base, a bulge low down, then a long tapering, curling tip
      ctx.moveTo(bx - bw * 0.35, y);
      ctx.bezierCurveTo(bx - bw * 0.75, y - h * 0.22, midx - bw * 0.22, y - h * 0.6, tipx, y - h);
      ctx.bezierCurveTo(midx + bw * 0.12, y - h * 0.55, bx + bw * 0.75, y - h * 0.25, bx + bw * 0.35, y);
      ctx.quadraticCurveTo(bx, y + bw * 0.25, bx - bw / 2, y);
      ctx.fill();
    }
  }
  ctx.restore();
}
// fire is depth-sorted with everything else, so tables, props and characters in front of it hide it
function drawPitFire() {
  const [x, y] = MAP.firepit, gust = 0.85 + 0.15 * Math.sin(time * 1.7) * Math.sin(time * 2.9 + 1);
  drawTongues(x, y - 6, 70, 240 * gust, 5, time, 0);
}
function drawEnemyFire(e) {
  const k = Math.min(1, e.burnT / 0.6), lean = clamp(-(e.fvx || 0) / 400, -0.5, 0.5);
  ctx.save(); ctx.translate(e.x, e.y - e.z - e.h * 0.12); ctx.transform(1, 0, lean, 1, 0, 0);
  drawTongues(0, 0, Math.min(110, e.r * 1.3), Math.min(170, e.h * 0.6 + 24), e.d.boss ? 5 : 4, e.t, e.seed || 0, k, 0.7); ctx.restore();
}
function drawFirePart(p) {
  const t = 1 - p.life / p.max, F = fireSpr.flame, n = F.length;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (p.ember) {
    const fl = 0.6 + 0.4 * Math.sin(time * 30 + p.ph), sz = p.size * 3;
    ctx.globalAlpha = (1 - t) * fl; ctx.drawImage(fireSpr.ember, p.x - sz, p.y - p.z - sz, sz * 2, sz * 2);
  } else {
    // cooling: hot yellow at the base, deep red at the tips, fading out
    const ci = Math.min(n - 1, Math.floor((p.heat + t * 1.05) * n)), sz = p.size * (1 - t * 0.6) * (t < 0.1 ? 0.6 + t * 4 : 1);
    ctx.globalAlpha = Math.pow(1 - t, 0.8) * 0.3;
    ctx.drawImage(F[ci], p.x - sz * 0.5, p.y - p.z - sz * 1.2, sz, sz * 2.3); // much taller than wide: a licking tongue
  }
  ctx.restore();
}
function drawSmokePuff(s) {
  const t = 1 - s.life / s.max, sz = s.size * (1 + t * 3.2);
  ctx.save(); ctx.globalAlpha = s.a * Math.min(1, t * 5) * (1 - t);
  ctx.translate(s.x, s.y - s.z); ctx.rotate(s.rot); ctx.drawImage(fireSpr.smoke, -sz, -sz, sz * 2, sz * 2); ctx.restore();
}

// ======================================================================================
// ---------- the family powers (David, Peter, Eric, Robyn, Madison, Taylor, Zoe, Jay, Sarah, Izzy) ----------
// Each uses a shared cooldown (p.spCd) and active timer (p.spT). Things they leave in the world
// (soccer ball, puppies, brawl cloud, gravy wave, hearts) live in `gizmos` so they sync to other players.
// ======================================================================================
const SP = {
  guitar:  { label: 'STRUM', cd: 9,  dur: 0.9, color: '#8a4fd6', glow: 'rgba(190,140,255,.55)', held: 'w_guitar', busy: true, shouts: ['Peace, love and gravy!', 'Feel the groove, man!', 'Group hug, dudes!', 'Make love, not war!'] },
  nap:     { label: 'YAWN',  cd: 10, dur: 0.8, color: '#4a6fb0', glow: 'rgba(140,180,255,.55)', busy: true, shouts: ['*YAAAWN* Nap time...', "Shhh. Grandpa's resting.", 'Five more minutes...', 'Sleepy time, turkeys.'] },
  flop:    { label: 'FLOP',  cd: 7,  dur: 0.7, color: '#8a5a2a', glow: 'rgba(200,140,80,.55)', busy: true, shouts: ['CANNONBALL!', 'Belly flop!', 'Look out below!', 'Gravy slide!'] },
  blower:  { label: 'BLOW',  cd: 8,  dur: 2.5, color: '#e8742a', glow: 'rgba(255,170,80,.55)', held: 'w_blower', busy: true, slow: 0.55, shouts: ['Leaf it to me!', 'Gone with the wind!', 'Get off my lawn!', 'Blow-out sale!'] },
  ball:    { label: 'KICK',  cd: 6,  dur: 0.3, color: '#3a3a3a', glow: 'rgba(255,255,255,.5)', busy: true, shouts: ['GOOOAL!', 'Header!', 'Bend it!', 'Top corner!'] },
  goalie:  { label: 'BLOCK', cd: 12, dur: 4,   color: '#1fa3a3', glow: 'rgba(90,230,230,.5)', shouts: ['Not in my net!', 'Blocked!', 'Nothing gets past me!', 'Save!'] },
  puppy:   { label: 'PUPS',  cd: 11, dur: 0.4, color: '#c46aa8', glow: 'rgba(255,170,220,.55)', busy: true, shouts: ["Go get 'em, puppies!", 'Fetch!', "Who's a good boy?!", 'Puppy pile!'] },
  call:    { label: 'CALL',  cd: 10, dur: 0.6, color: '#7a5230', glow: 'rgba(200,150,90,.55)', held: 'w_call', busy: true, shouts: ['Gobble gobble, fools!', 'Here, turkey turkey!', 'Fight fight fight!', 'Dinner bell!'] },
  hug:     { label: 'HUG',   cd: 14, dur: 0.6, color: '#e04a8a', glow: 'rgba(255,140,190,.55)', busy: true, shouts: ['Bring it in, everybody!', 'Group hug!', 'Love you guys!', 'Hugs heal!'] },
  protest: { label: 'RALLY', cd: 11, dur: 0.9, color: '#c0392b', glow: 'rgba(255,120,100,.55)', held: 'w_megaphone', busy: true, shouts: ['What do we want?!', 'Everybody, signs UP!', 'Hey hey, ho ho!', 'Power to the pie!', 'Join the movement!'] },
  paint:   { label: 'ART',   cd: 9,  dur: 0.5, color: '#2f6fd6', glow: 'rgba(120,170,255,.55)', held: 'w_palette', busy: true, shouts: ['Behold... ART!', 'A masterpiece!', 'Hold still, darling.', 'Ode to a turkey...', 'Gravy is my medium!', 'I call this one "Dinner".'] },
  luchador:{ label: 'LUCHA', cd: 10, dur: 2.3, color: '#2f9e44', glow: 'rgba(120,230,140,.55)', busy: true, slow: 0.45, shouts: ['¡LUCHA LIBRE!', '¡EL PAVO LOCO!', 'Feel the MUSCLES!', '¡VÁMONOS!', 'Spin cycle!'] },
  rainbow: { label: 'LOVE',  cd: 10, dur: 2.5, color: '#d63ad6', glow: 'rgba(255,140,255,.5)', icon: 'w_rainbow', busy: true, slow: 0.5, shouts: ['RAINBOW POWER!', 'Taste the rainbow!', 'Sparkle time!', 'Pew pew pew!'] },
};
let gizmos = [];
const inRange = (e, x, y, r) => !e.dead && e.spawnT <= 0 && (e.x - x) ** 2 + (e.y - y) ** 2 < r * r;
const aimDir = p => [Math.cos(p.aim), Math.sin(p.aim)];

function startSpecial(p) {
  const kind = CHARS[p.ch].special, S = SP[kind];
  p.spT = S.dur; p.spCd = S.cd * CD_MUL; p.spA = p.aim;
  p.speech = { text: pick(S.shouts), t: 1.5, max: 1.5 };
  const [dx, dy] = aimDir(p);
  if (kind === 'guitar') {
    Sfx.strum();
    // three rippling waves of good vibes roll out from the guitar
    for (let i = 0; i < 3; i++) gizmos.push({ id: nextId++, kind: 'vibes', x: p.x, y: p.y, z: 0, vx: 0, vy: 0, vz: 0, a: 0, r: 0, life: 1.3 + i * 0.3, max: 1.3, f: i * 0.3, hits: new Set() });
  } else if (kind === 'nap') {
    Sfx.yawn();
  } else if (kind === 'flop') {
    p.flopDir = [dx, dy]; p.inv = Math.max(p.inv, S.dur + 0.15); p.sq = 0.3; p.sqV = 0; p.flopHit = new Set();
    Sfx.dash();
  } else if (kind === 'blower') {
    Sfx.wind();
  } else if (kind === 'ball') {
    gizmos.push({ id: nextId++, kind: 'ball', x: p.x + dx * 30, y: p.y + dy * 20, z: 20, vx: dx * 720, vy: dy * 720, vz: 0, a: 0, r: 16, life: 3.5, max: 3.5, f: 0, hits: new Set(), bounces: 0, oid: p.id });
    Sfx.kick();
  } else if (kind === 'goalie') {
    Sfx.shield();
  } else if (kind === 'puppy') {
    for (let i = 0; i < 3; i++) {
      const a = p.aim + (i - 1) * 0.45, d = rand(140, 220);
      gizmos.push({ id: nextId++, kind: 'pup', x: p.x, y: p.y, z: 30, vx: Math.cos(a) * d / 0.5, vy: Math.sin(a) * d / 0.5, vz: 260, a: a, r: 18, life: 6.5, max: 6.5, f: randi(0, 3), tx: 0, ty: 0, wt: 0, hop: 0 });
    }
    Sfx.bark();
  } else if (kind === 'call') {
    const sx = clamp(p.x + dx * 220, 100, ARENA.w - 100), sy = clamp(p.y + dy * 160, 120, ARENA.h - 80);
    gizmos.push({ id: nextId++, kind: 'brawl', x: sx, y: sy, z: 0, vx: 0, vy: 0, a: 0, r: 70, life: 3.8, max: 3.8, f: 0 });
    for (const e of enemies) if (inRange(e, sx, sy, 520) && !e.d.boss) { e.brawlT = 3.6; e.brawlX = sx; e.brawlY = sy; e.st = 'move'; e.hypeT = 0; e.danceT = 0; }
    Sfx.call();
  } else if (kind === 'hug') {
    let healed = 0;
    for (const q of players) {
      if ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 > 260 ** 2) continue;
      if (q.dead) { q.dead = false; q.hp = Math.round(q.maxHp * 0.4); q.vz = 0; q.z = 0; floatText(q.x, q.y - 120, `${q.pname || names[q.ch]} is back!`, '#ff8ac0', 1.8, 22); }
      else { const h = Math.round(q.maxHp * 0.35); q.hp = Math.min(q.maxHp, q.hp + h); floatText(q.x, q.y - 110, `+${h} HP`, '#7dff8a', 1.1, 22); }
      q.inv = Math.max(q.inv, 1); healed++;
    }
    gizmos.push({ id: nextId++, kind: 'hearts', x: p.x, y: p.y, z: 0, vx: 0, vy: 0, a: 0, r: 260, life: 0.9, max: 0.9, f: 0 });
    Sfx.heal();
  } else if (kind === 'rainbow') {
    Sfx.beam();
  } else if (kind === 'luchador') {
    // a puff of smoke and he's a luchador! grab whoever is closest
    dustBurst(p.x, p.y, 18, 1.6); shake = Math.max(shake, 8); Sfx.windup();
    floatText(p.x, p.y - p.h - 40, '¡LUCHA!', '#ffe14d', 1.2, 30);
    let best = null, bd = 300 ** 2;
    for (const e of enemies) { if (e.dead || e.spawnT > 0) continue; const dd = (e.x - p.x) ** 2 + (e.y - p.y) ** 2; if (dd < bd) { bd = dd; best = e; } }
    p.grabId = 0; p.thrown = false; p.spinA = p.aim;
    if (best && best.d.boss) { damageEnemy(best, 70 + wave * 6, Math.cos(p.aim), Math.sin(p.aim), 700); floatText(best.x, best.y - best.h - 30, 'BODY SLAM!', '#ffe14d', 1, 28); }
    else if (best) { p.grabId = best.id; best.held = true; best.st = 'move'; best.hypeT = 0; best.paintT = 0; best.pickT = 0; best.danceT = 0; best.sleepT = 0; p.spinA = Math.atan2(best.y - p.y, best.x - p.x); }
  } else if (kind === 'paint') {
    // a big wet splat of paint flies out and freezes whoever it hits into a work of art
    gizmos.push({ id: nextId++, kind: 'paint', x: p.x + dx * 30, y: p.y + dy * 20, z: 46, vx: dx * 620, vy: dy * 620, vz: 0, a: 0, r: 40, life: 0.65, max: 0.65, f: rand(0, 6), hits: new Set() });
    Sfx.throw(); Sfx.splat();
  } else if (kind === 'protest') {
    // everyone nearby joins a picket line a little way in front of her
    Sfx.megaphone();
    const lx = clamp(p.x + dx * 170, 160, ARENA.w - 160), ly = clamp(p.y + dy * 120, 160, ARENA.h - 90);
    const recruits = enemies.filter(e => inRange(e, p.x, p.y, 360) && !e.d.boss).sort((a, b) => a.x - b.x);
    recruits.forEach((e, i) => { const n = recruits.length; e.pickT = 5.5; e.pickX = lx + (i - (n - 1) / 2) * 84; e.pickY = ly + (i % 2) * 16; e.signI = randi(0, SIGNS.length - 1); e.st = 'move'; e.hypeT = 0; e.danceT = 0; e.brawlT = 0; });
    for (const e of enemies) if (e.d.boss && inRange(e, p.x, p.y, 360)) { e.pickT = 1.5; e.pickX = e.x; e.pickY = e.y; e.signI = randi(0, SIGNS.length - 1); }
    if (recruits.length) gizmos.push({ id: nextId++, kind: 'picket', x: lx, y: ly, z: 0, vx: 0, vy: 0, vz: 0, a: 0, r: recruits.length * 42 + 40, life: 5.5, max: 5.5, f: 0 });
  }
}
const ART_NAMES = { turkey: 'Turkey', potato: 'Potato', tot: 'Tater Tot', cranberry: 'Cranberry', corn: 'Corn', pumpkin: 'Pumpkin' };
const ART_TITLES = ['Still Life', 'in Blue', 'at Dusk', 'No. 5', 'Nocturne', 'Study in Gravy', 'Interrupted', 'with Pearl Earring', 'Screaming', 'Abstract', 'Melancholy', 'Before Dinner'];
const PAINTS = ['#e8312a', '#2f7fe8', '#ffd21f', '#3cc24a', '#9b4fe0', '#ff8a1f'];
function artLabel(e) { const nm = e.d.boss ? e.d.bname.replace(/^THE /, '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : ART_NAMES[e.type] || 'Untitled'; return `${nm}, ${ART_TITLES[(e.artI || 0) % ART_TITLES.length]} (2026)`; }
// shattered art: canvas shards and paint flying everywhere
function artShatter(x, y, h) {
  for (let i = 0; i < 26; i++) particles.push({ x, y, z: h * 0.5, vx: rand(-240, 240), vy: rand(-170, 170), vz: rand(150, 420), life: rand(0.8, 1.4), max: 1.4, color: pick(PAINTS.concat(['#f3e7c9', '#d9b44a'])), size: rand(5, 9), grav: 800, confetti: true, rot: rand(0, 6) });
  floatText(x, y - h - 20, pick(['CRASH!', 'SHATTER!', 'Art is dead!', 'Critics hated it!']), '#ffe14d', 0.8, 22);
}
const SIGNS = ['NO MORE GRAVY!', 'TURKEYS UNITE!', 'SAVE THE YAMS', 'STRIKE!', 'FAIR WAGES 4 POTATOES', 'HONK IF U HATE PIE', 'NOT YOUR DINNER', 'CRANBERRY RIGHTS', 'DOWN WITH FORKS', 'WE WANT NAPS', 'CORN IS PEOPLE TOO', 'STUFF THIS!'];
const CHANTS = ['What do we want?!', 'NO GRAVY!', 'When do we want it?!', 'NOW!', 'Hey hey! Ho ho!', 'This feast has got to go!', 'STRIKE! STRIKE!'];

// runs every frame while a power is active (p.spT > 0)
function tickSpecial(p, dt) {
  const kind = CHARS[p.ch].special, S = SP[kind];
  p.spT -= dt;
  const [dx, dy] = aimDir(p);
  if (kind === 'nap' && p.spT <= 0) {
    // the yawn lands: everyone nearby nods off
    for (const e of enemies) if (inRange(e, p.x, p.y, 360)) { e.sleepT = e.d.boss ? 1.4 : 4; e.st = 'move'; e.hypeT = 0; e.danceT = 0; }
    for (let i = 0; i < 6; i++) particles.push({ x: p.x + rand(-30, 30), y: p.y, z: p.h, vx: rand(-60, 60), vy: rand(-20, 20), vz: rand(40, 90), life: 1.2, max: 1.2, color: '#bcd6ff', size: rand(5, 9), grav: -20, smoke: true });
  } else if (kind === 'flop') {
    const sp = p.speed * 2.7;
    p.vx = p.flopDir[0] * sp; p.vy = p.flopDir[1] * sp;
    if (Math.random() < dt * 11) puddles.push({ x: p.x + rand(-10, 10), y: p.y + rand(-6, 6), r: rand(28, 38), life: 4, max: 4, seed: Math.random() * 10 });
    for (const e of enemies) {
      if (p.flopHit.has(e) || !inRange(e, p.x, p.y, e.r + p.r + 20)) continue;
      p.flopHit.add(e); damageEnemy(e, 35 + wave * 3, p.flopDir[0], p.flopDir[1], 560);
      floatText(e.x, e.y - e.h - 20, pick(POW), '#ffec3d', 0.7, 24); shake = Math.max(shake, 6);
    }
    if (p.spT <= 0) {
      p.vx *= 0.2; p.vy *= 0.2; p.sq = 0.35; p.sqV = 0; Sfx.splat(); shake = Math.max(shake, 10);
      // r carries the wave's heading
      gizmos.push({ id: nextId++, kind: 'gwave', x: p.x + p.flopDir[0] * 30, y: p.y + p.flopDir[1] * 20, z: 0, vx: 0, vy: 0, a: 0, r: Math.atan2(p.flopDir[1], p.flopDir[0]), life: 1.45, max: 1.45, f: 0, hits: new Set() });
    }
  } else if (kind === 'blower') {
    // a 70-degree cone of wind: shoves enemies, scatters their shots, blows the leaves around
    const R = 400, cosHalf = Math.cos(0.62);
    const inCone = (x, y) => { const ox = x - p.x, oy = y - p.y, d = Math.hypot(ox, oy); return d < R && d > 1 && (ox * dx + oy * dy) / d > cosHalf ? d : 0; };
    for (const e of enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const d = inCone(e.x, e.y); if (!d) continue;
      const k = (1 - d / R) * 0.6 + 0.4;
      e.vx += dx * 2400 * k * dt / e.mass; e.vy += dy * 2400 * k * dt / e.mass; e.hurtT = Math.max(e.hurtT, 0.1);
      e.blowDmg = (e.blowDmg || 0) + dt * (8 + wave * 0.8);
      if (e.blowDmg >= 4) { const dmg = Math.floor(e.blowDmg); e.blowDmg -= dmg; damageEnemy(e, dmg, 0, 0, 0); e.flash = 0; }
    }
    for (const b of ebullets) if (inCone(b.x, b.y)) b.life = 0;
    for (const l of leaves) if (inCone(l.x, l.y)) { l.rest = false; l.vx += dx * 900 * dt * 3; l.vy += dy * 600 * dt * 3; l.vz = Math.max(l.vz || 0, rand(60, 160)); l.vrot = rand(-12, 12); }
    if (Math.random() < dt * 6) Sfx.wind();
  } else if (kind === 'goalie') {
    const R = 100;
    for (const b of ebullets) {
      const ox = b.x - p.x, oy = b.y - p.y, d = Math.hypot(ox, oy);
      if (d < R && b.life > 0) { // SAVE! the shot flies back out as ours
        b.life = 0;
        const sp = Math.hypot(b.vx, b.vy) * 1.3 || 500, a = Math.atan2(oy, ox);
        p.saveT = time + 0.3; floatText(b.x, b.y - 60, pick(['SAVE!', 'BLOCKED!', 'NOPE!']), '#ffffff', 0.6, 20);
        bullets.push({ id: nextId++, owner: p, w: 'gravy', x: b.x, y: b.y, z: 40, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 10, dmg: 18 + wave * 2, life: 1.2, max: 1.2, hits: new Set(), rot: 0 });
        Sfx.thump();
      }
    }
    for (const e of enemies) {
      if (e.dead || e.spawnT > 0 || e.d.boss) continue;
      const ox = e.x - p.x, oy = e.y - p.y, d = Math.hypot(ox, oy) || 1;
      if (d < R + e.r) { e.vx += ox / d * 900 * dt * 4; e.vy += oy / d * 900 * dt * 4; }
    }
    for (const q of players) if (!q.dead && (q.x - p.x) ** 2 + (q.y - p.y) ** 2 < R * R) q.inv = Math.max(q.inv, 0.15);
  } else if (kind === 'rainbow') {
    // a long rainbow beam: anything on it takes a beating and is marked to burst into confetti
    const L = 680, W = 20, ox = p.x + dx * 14, oy = p.y - p.h * 0.52 + dy * 8; // from her heart
    for (const e of enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const rx = e.x - ox, ry = (e.y - e.h * 0.4) - oy, t = rx * dx + ry * dy;
      if (t < 0 || t > L) continue;
      if (Math.abs(rx * dy - ry * dx) > W + e.r * 0.8) continue;
      e.rainbowT = 0.6;
      e.beamDmg = (e.beamDmg || 0) + dt * (60 + wave * 5) * (e.d.boss ? 0.6 : 1);
      if (e.beamDmg >= 5) { const dmg = Math.floor(e.beamDmg); e.beamDmg -= dmg; damageEnemy(e, dmg, dx, dy, 30); }
    }
    if (Math.random() < dt * 30) particles.push({ x: ox + dx * rand(40, L), y: oy + p.h * 0.52 + dy * rand(40, L), z: p.h * 0.52, vx: rand(-40, 40), vy: rand(-40, 40), vz: rand(30, 90), life: 0.5, max: 0.5, color: pick(RAINBOW), size: rand(3, 6), grav: 200 });
  }
  if (kind === 'luchador') {
    const age = S.dur - p.spT, e = p.grabId ? enemies.find(x => x.id === p.grabId && !x.dead) : null;
    if (e && e.held) {
      if (age < 0.25) { // yank them in
        p.spinA = Math.atan2(e.y - p.y, e.x - p.x);
        e.x = lerp(e.x, p.x + Math.cos(p.spinA) * 72, 0.35); e.y = lerp(e.y, p.y + Math.sin(p.spinA) * 44, 0.35); e.z = 20;
      } else if (age < 1.85) { // the airplane spin: whatever they smash into gets wrecked
        p.spinA += dt * 11;
        e.x = p.x + Math.cos(p.spinA) * 74; e.y = p.y + Math.sin(p.spinA) * 46; e.z = 34;
        if (Math.random() < dt * 20) dustBurst(p.x + rand(-20, 20), p.y, 1, 0.8);
        for (const o of enemies) {
          if (o === e || o.dead || o.spawnT > 0 || (o.smashCd || 0) > time) continue;
          const ox = o.x - e.x, oy = o.y - e.y, od = Math.hypot(ox, oy);
          if (od > o.r + e.r + 12) continue;
          o.smashCd = time + 0.45;
          damageEnemy(o, 30 + wave * 3, ox / (od || 1), oy / (od || 1), 560); damageEnemy(e, 6 + wave, 0, 0, 0);
          floatText(o.x, o.y - o.h - 20, pick(POW), '#ffec3d', 0.6, 24); shake = Math.max(shake, 6);
        }
      } else if (!p.thrown) { // and LET GO
        p.thrown = true; e.held = false;
        const tx = -Math.sin(p.spinA), ty = Math.cos(p.spinA); // along the spin
        e.thrownT = 0.9; e.vx = tx * 980; e.vy = ty * 720; e.vz = 260; e.throwHits = new Set();
        floatText(e.x, e.y - e.h - 30, pick(['YEET!', '¡ADIÓS!', 'SUPLEX!', 'FLYING TURKEY!']), '#ffe14d', 0.9, 26); Sfx.throw(); shake = Math.max(shake, 10);
      }
    } else if (age > 0.25 && !p.thrown) p.thrown = true;
    if (p.spT <= 0) { if (e && e.held) e.held = false; dustBurst(p.x, p.y, 12, 1.3); }
  }
  if (kind === 'guitar' && Math.random() < dt * 10) particles.push({ x: p.x + rand(-20, 20), y: p.y, z: p.h * 0.8, vx: rand(-40, 40), vy: rand(-10, 10), vz: rand(60, 120), life: 1, max: 1, note: true, color: pick(['#ffd84a', '#ff8ac0', '#8affc0']), size: 14, grav: -10 });
}
const RAINBOW = ['#ff3b3b', '#ff9a2a', '#ffe14d', '#4fdc5a', '#3aa0ff', '#8a5aff'];

function updateGizmos(dt) {
  for (const g of gizmos) {
    g.life -= dt; g.a += dt;
    if (g.kind === 'ball') {
      g.vz -= 900 * dt; g.z += g.vz * dt; if (g.z <= 0) { g.z = 0; g.vz = Math.abs(g.vz) > 80 ? -g.vz * 0.5 : 0; }
      g.x += g.vx * dt; g.y += g.vy * dt; g.f += Math.hypot(g.vx, g.vy) * dt * 0.05;
      if (g.x < 30 || g.x > ARENA.w - 30) { g.vx *= -1; g.x = clamp(g.x, 30, ARENA.w - 30); }
      if (g.y < 50 || g.y > ARENA.h - 30) { g.vy *= -1; g.y = clamp(g.y, 50, ARENA.h - 30); }
      for (const e of enemies) {
        if (g.hits.has(e) || !inRange(e, g.x, g.y, e.r + g.r)) continue;
        g.hits.add(e); g.bounces++;
        const sp = Math.hypot(g.vx, g.vy) || 1;
        damageEnemy(e, 40 + wave * 3, g.vx / sp, g.vy / sp, 380);
        floatText(e.x, e.y - e.h - 20, pick(['GOAL!', 'BONK!', 'NUTMEG!', 'SCORE!']), '#ffffff', 0.7, 22); Sfx.kick();
        // ricochet to the next closest enemy it hasn't hit yet
        let nxt = null, bd = 480 ** 2;
        for (const o of enemies) { if (o.dead || o.spawnT > 0 || g.hits.has(o)) continue; const dd = (o.x - g.x) ** 2 + (o.y - g.y) ** 2; if (dd < bd) { bd = dd; nxt = o; } }
        if (nxt && g.bounces < 8) { const a = Math.atan2(nxt.y - g.y, nxt.x - g.x); g.vx = Math.cos(a) * 760; g.vy = Math.sin(a) * 760; g.vz = 160; g.life = Math.max(g.life, 1.2); }
        else { g.vx *= -0.5; g.vy *= -0.5; g.vz = 220; g.life = Math.min(g.life, 1.2); }
        break;
      }
      g.vx *= Math.exp(-dt * 0.4); g.vy *= Math.exp(-dt * 0.4);
    } else if (g.kind === 'pup') {
      if (g.z > 0 || g.vz > 0) { g.vz -= 900 * dt; g.z = Math.max(0, g.z + g.vz * dt); g.x += g.vx * dt; g.y += g.vy * dt; if (g.z === 0) { g.vz = 0; g.vx = 0; g.vy = 0; } }
      else {
        // run around the yard; dodge away from anything getting close
        g.wt -= dt;
        let threat = null, td = 70 ** 2;
        for (const e of enemies) { if (e.dead || e.spawnT > 0) continue; const dd = (e.x - g.x) ** 2 + (e.y - g.y) ** 2; if (dd < td) { td = dd; threat = e; } }
        if (threat) { const a = Math.atan2(g.y - threat.y, g.x - threat.x) + rand(-0.6, 0.6); g.tx = g.x + Math.cos(a) * 260; g.ty = g.y + Math.sin(a) * 200; g.wt = 1.2; g.hop = 0.25; if (Math.random() < 0.3) Sfx.bark(); }
        else if (g.wt <= 0) { const a = rand(0, Math.PI * 2); g.tx = g.x + Math.cos(a) * rand(120, 280); g.ty = g.y + Math.sin(a) * rand(90, 200); g.wt = rand(0.8, 1.6); }
        g.tx = clamp(g.tx, 60, ARENA.w - 60); g.ty = clamp(g.ty, 90, ARENA.h - 50);
        const ox = g.tx - g.x, oy = g.ty - g.y, d = Math.hypot(ox, oy);
        const sp = threat ? 340 : 230;
        if (d > 8) { g.vx = lerp(g.vx, ox / d * sp, 1 - Math.exp(-dt * 8)); g.vy = lerp(g.vy, oy / d * sp, 1 - Math.exp(-dt * 8)); } else { g.vx *= 0.8; g.vy *= 0.8; }
        g.x += g.vx * dt; g.y += g.vy * dt; collideProps(g);
        g.hop = Math.max(0, g.hop - dt);
      }
    } else if (g.kind === 'brawl') {
      // the brawl: everyone inside the dust cloud whales on each other
      for (const e of enemies) {
        if (!(e.brawlT > 0) || !inRange(e, g.x, g.y, g.r + 30)) continue;
        e.brawlDmg = (e.brawlDmg || 0) + dt * (14 + wave * 1.2);
        if (e.brawlDmg >= 5) { const dmg = Math.floor(e.brawlDmg); e.brawlDmg -= dmg; damageEnemy(e, dmg, rand(-1, 1), rand(-1, 1), 40); }
      }
      if (Math.random() < dt * 4) { floatText(g.x + rand(-60, 60), g.y - rand(60, 120), pick(POW), pick(['#ffec3d', '#ff9a3d', '#ffffff']), 0.6, 22); Sfx.hit(); }
    } else if (g.kind === 'paint') {
      g.x += g.vx * dt; g.y += g.vy * dt; g.vx *= Math.exp(-dt * 1.6); g.vy *= Math.exp(-dt * 1.6);
      g.r = 40 + (1 - g.life / g.max) * 90; // the splat spreads as it flies
      if (Math.random() < dt * 40) particles.push({ x: g.x + rand(-g.r, g.r) * 0.6, y: g.y + rand(-g.r, g.r) * 0.3, z: 40, vx: rand(-80, 80), vy: rand(-60, 60), vz: rand(40, 160), life: 0.6, max: 0.6, color: pick(PAINTS), size: rand(4, 8), grav: 700 });
      for (const e of enemies) {
        if (g.hits.has(e) || e.dead || e.spawnT > 0) continue;
        if (Math.hypot(e.x - g.x, (e.y - g.y) * 1.5) > g.r + e.r) continue;
        g.hits.add(e);
        e.paintT = e.d.boss ? 1.4 : 4.5; e.artI = randi(0, ART_TITLES.length - 1); e.paintC = randi(0, PAINTS.length - 1);
        e.st = 'move'; e.hypeT = 0; e.danceT = 0; e.brawlT = 0; e.pickT = 0; e.vx = 0; e.vy = 0;
        floatText(e.x, e.y - e.h - 30, pick(['Masterpiece!', 'Exquisite!', 'Magnifique!', 'Bravo!']), '#ffffff', 0.8, 20);
      }
    } else if (g.kind === 'picket') {
      g.f -= dt;
      if (g.f <= 0) { g.f = 1.3; g.chant = ((g.chant || 0) + 1) % CHANTS.length; floatText(g.x + rand(-g.r * 0.6, g.r * 0.6), g.y - 150, CHANTS[g.chant], '#ffffff', 1.2, 20); Sfx.taunt(); }
    } else if (g.kind === 'vibes') {
      const t = 1 - g.life / g.max; if (t < 0) continue;
      g.r = 30 + t * 380;
      for (const e of enemies) {
        if (g.hits.has(e) || e.dead || e.spawnT > 0) continue;
        const d = Math.hypot(e.x - g.x, (e.y - g.y) * 1.6);
        if (d < g.r + e.r && d > g.r - 70) { g.hits.add(e); e.danceT = Math.max(e.danceT || 0, e.d.boss ? 1.5 : 4.5); e.st = 'move'; e.hypeT = 0; e.sq = -0.2; e.sqV = 0; }
      }
    } else if (g.kind === 'gwave') {
      // rises, rolls forward over everything in its path, then crashes into a big splash
      const age = g.max - g.life, dx = Math.cos(g.r), dy = Math.sin(g.r), front = gwFront(age);
      const cx = g.x + dx * front, cy = g.y + dy * front / 1.4;
      if (age > 0.3 && age < GW_BREAK) for (const e of enemies) {
        if (e.dead || e.spawnT > 0) continue;
        const rx = e.x - g.x, ry = (e.y - g.y) * 1.4, along = rx * dx + ry * dy, side = Math.abs(rx * dy - ry * dx);
        if (side > 85 + e.r || Math.abs(along - front) > 55 + e.r) continue;
        e.vx += dx * 1300 * dt / e.mass; e.vy += dy * 950 * dt / e.mass; e.hurtT = Math.max(e.hurtT, 0.12); // carried along
        if (!g.hits.has(e)) { g.hits.add(e); damageEnemy(e, 40 + wave * 4, dx, dy, 450); floatText(e.x, e.y - e.h - 20, pick(['SPLOOSH!', 'GLORP!', 'WIPEOUT!', 'GRAVY!']), '#ffcf8a', 0.8, 24); }
      }
      if (age >= GW_BREAK && !g.crash) {
        g.crash = true; shake = Math.max(shake, 12); Sfx.boom(); Sfx.splash();
        for (const e of enemies) if (!e.dead && e.spawnT <= 0 && Math.hypot(e.x - cx, (e.y - cy) * 1.4) < 120 + e.r) damageEnemy(e, 30 + wave * 3, (e.x - cx) / 120, (e.y - cy) / 120, 500);
        for (let i = 0; i < 4; i++) puddles.push({ x: cx + rand(-70, 70) + dx * 30, y: cy + rand(-30, 30) + dy * 20, r: rand(42, 58), life: 6, max: 6, seed: Math.random() * 10 });
      }
    } else if (g.kind === 'wave') {
      const t = 1 - g.life / g.max; g.r = 40 + t * 200;
      for (const e of enemies) {
        if (g.hits.has(e) || e.dead || e.spawnT > 0) continue;
        const d = Math.hypot(e.x - g.x, (e.y - g.y) * 1.6);
        if (d < g.r + e.r && d > g.r - 60) { g.hits.add(e); damageEnemy(e, 25 + wave * 2, (e.x - g.x) / (d || 1), (e.y - g.y) / (d || 1), 420); }
      }
    }
  }
  gizmos = gizmos.filter(g => g.life > 0);
}
// puppies are irresistible: regular enemies nearby chase the closest one instead of a player
function pupTarget(e) {
  if (e.d.boss) return null;
  let best = null, bd = 480 ** 2;
  for (const g of gizmos) if (g.kind === 'pup' && g.z <= 0) { const dd = (g.x - e.x) ** 2 + (g.y - e.y) ** 2; if (dd < bd) { bd = dd; best = g; } }
  if (!best) return null;
  // stand-in "player" for the AI: can't be hurt
  if (!best.stand) best.stand = { x: 0, y: 0, z: 0, r: 16, h: 40, vx: 0, vy: 0, inv: 99, dead: false, hp: 1, maxHp: 1, isPup: true, ch: 'grandpa', aim: 0 };
  return Object.assign(best.stand, { x: best.x, y: best.y, vx: best.vx, vy: best.vy });
}

// ---------- drawing ----------
function drawGizmo(g) {
  if (g.kind === 'ball') {
    shadow(g.x, g.y, 12, 0.3);
    const im = IMG.w_ball; if (!im) return;
    ctx.save(); ctx.translate(g.x, g.y - g.z - 14); ctx.rotate(g.f); ctx.drawImage(im, -15, -15, 30, 30); ctx.restore();
  } else if (g.kind === 'pup') {
    const im = IMG.y_puppies; if (!im) return;
    shadow(g.x, g.y, 14, 0.25);
    const c = im.height, sz = 52, bob = g.z > 0 ? 0 : Math.abs(Math.sin(g.a * 14)) * 5;
    ctx.save(); ctx.translate(g.x, g.y - g.z - bob); if (g.vx < -5) ctx.scale(-1, 1);
    ctx.drawImage(im, (g.f % 4) * c, 0, c, c, -sz / 2, -sz + 4, sz, sz); ctx.restore();
    if (g.life < 1.2 && Math.floor(g.a * 10) % 2 === 0) return;
  } else if (g.kind === 'brawl') {
    const k = Math.min(1, (g.max - g.life) / 0.3) * Math.min(1, g.life / 0.4);
    ctx.save(); ctx.globalAlpha = 0.85 * k;
    for (let i = 0; i < 9; i++) {
      const a = g.a * (2 + i * 0.3) + i * 0.7, rx = Math.cos(a) * 40, ry = Math.sin(a * 1.3) * 18;
      ctx.fillStyle = i % 2 ? '#d9c8a8' : '#efe2c8';
      ctx.beginPath(); ctx.arc(g.x + rx, g.y - 40 + ry, 34 + Math.sin(g.a * 9 + i) * 6, 0, Math.PI * 2); ctx.fill();
    }
    // flailing fists, feet and stars poking out of the cloud
    ctx.globalAlpha = k;
    for (let i = 0; i < 5; i++) {
      const a = g.a * 6 + i * 1.26, x = g.x + Math.cos(a) * 62, y = g.y - 40 + Math.sin(a) * 30;
      if (i % 2) { ctx.fillStyle = '#ffe14d'; ctx.beginPath(); for (let s = 0; s < 10; s++) { const rr = s % 2 ? 5 : 11, aa = s * Math.PI / 5 + g.a * 5; ctx.lineTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr); } ctx.closePath(); ctx.fill(); }
      else { ctx.fillStyle = '#c8752d'; ctx.strokeStyle = '#2b1a10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    }
    ctx.restore();
  } else if (g.kind === 'wave') {
    const t = 1 - g.life / g.max;
    ctx.save(); ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = '#7a4416'; ctx.lineWidth = 22 * (1 - t) + 6; ctx.beginPath(); ctx.ellipse(g.x, g.y, g.r, g.r * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#b9772f'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(g.x, g.y - 4, g.r, g.r * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  } else if (g.kind === 'paint') {
    const im = IMG.w_paint; if (!im) return;
    const sz = g.r * 1.9;
    ctx.save(); ctx.translate(g.x, g.y - g.z); ctx.rotate(g.f + g.a * 4); ctx.scale(1, 0.75); ctx.globalAlpha = Math.min(1, g.life / 0.2);
    ctx.drawImage(im, -sz / 2, -sz / 2, sz, sz); ctx.restore();
  } else if (g.kind === 'vibes') {
    const t = 1 - g.life / g.max; if (t < 0) return;
    const R = 30 + t * 380, fade = Math.min(1, t * 4) * (1 - t);
    ctx.save(); ctx.globalAlpha = fade * 0.75; ctx.lineWidth = 5;
    RAINBOW.forEach((c, i) => { ctx.strokeStyle = c; const rr = R - i * 6; if (rr > 0) { ctx.beginPath(); ctx.ellipse(g.x, g.y - 20, rr, rr * 0.55, 0, 0, Math.PI * 2); ctx.stroke(); } });
    // notes, peace signs and hearts surfing the wave
    ctx.globalAlpha = fade; ctx.textAlign = 'center'; ctx.font = `20px 'Lilita One', sans-serif`; ctx.lineWidth = 3; ctx.strokeStyle = '#2b1a10';
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2 + g.f * 3 + t * 1.5, x = g.x + Math.cos(a) * R, y = g.y - 20 + Math.sin(a) * R * 0.55 - Math.sin(t * 12 + i) * 6;
      if (i % 3 === 2) drawHeart(x, y, 7, '#ff6fae');
      else { const ch = i % 3 ? '☮' : '♪'; ctx.fillStyle = i % 3 ? '#ffe14d' : '#9affc8'; ctx.strokeText(ch, x, y); ctx.fillText(ch, x, y); }
    }
    ctx.restore();
  } else if (g.kind === 'hearts') {
    const t = 1 - g.life / g.max;
    ctx.save(); ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = 'rgba(255,120,180,.7)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(g.x, g.y, g.r * t, g.r * t * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; drawHeart(g.x + Math.cos(a) * g.r * t, g.y + Math.sin(a) * g.r * t * 0.55 - 30 - t * 40, 9, '#ff6fae'); }
    ctx.restore();
  }
}
const GW_BREAK = 0.95;
// how far forward the wave crest has rolled
function gwFront(age) { return age < 0.3 ? 30 : 30 + Math.min(1, (age - 0.3) / (GW_BREAK - 0.3)) * 230; }
// the wave itself (generated art): rises, rolls forward, then crashes into the splash art
function drawGWaveCrest(g) {
  const age = g.max - g.life, dx = Math.cos(g.r), dy = Math.sin(g.r), front = gwFront(age);
  const x = g.x + dx * front, y = g.y + dy * front / 1.4;
  const wv = IMG.w_wave, sp = IMG.w_splash;
  if (wv && age < GW_BREAK + 0.12) {
    const k = Math.min(1, age / 0.3), H = (40 + 110 * (1 - (1 - k) * (1 - k))) * (1 + Math.sin(age * 14) * 0.03), W = H * 1.05;
    const alpha = age < GW_BREAK ? 1 : 1 - (age - GW_BREAK) / 0.12;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); if (dx > 0) ctx.scale(-1, 1); // the art curls to the left
    ctx.drawImage(wv, -W / 2, -H, W, H); ctx.restore();
    if (age > 0.25 && Math.random() < 0.4) particles.push({ x: x + rand(-W / 3, W / 3), y, z: H * rand(0.6, 0.9), vx: dx * rand(60, 160) + rand(-40, 40), vy: dy * rand(40, 120), vz: rand(80, 200), life: 0.5, max: 0.5, color: pick(['#7a4416', '#a8652c']), size: rand(3, 6), grav: 900 });
  }
  if (sp && age >= GW_BREAK) {
    const t = (age - GW_BREAK) / (g.max - GW_BREAK), W = 150 + 110 * Math.sqrt(t), H = W * sp.height / sp.width;
    ctx.save(); ctx.globalAlpha = Math.min(1, (1 - t) * 1.8); ctx.drawImage(sp, x - W / 2, y - H * 0.78, W, H); ctx.restore();
  }
}
function drawHeart(x, y, s, col) {
  ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9); ctx.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.3, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9); ctx.fill();
}
// effects attached to a player while their power runs (wind cone, goalie bubble, rainbow beam)
function drawPlayerPowerFx(q) {
  const kind = CHARS[q.ch].special; if (!SP[kind] || !(q.spT > 0)) return;
  const dx = Math.cos(q.aim), dy = Math.sin(q.aim), ox = q.x + dx * 40, oy = q.y - 38 + dy * 24;
  if (kind === 'blower') {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const s = ((time * 2.4 + i * 0.37) % 1), spread = (i / 8 - 0.5) * 1.1, a = q.aim + spread * 0.9;
      const d0 = 30 + s * 360, x = ox + Math.cos(a) * d0, y = oy + Math.sin(a) * d0 * 0.75;
      ctx.globalAlpha = (1 - s) * 0.8; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a + 0.4) * 14, y + Math.sin(a + 0.4) * 14, x + Math.cos(a) * 34, y + Math.sin(a) * 26); ctx.stroke();
    }
    ctx.restore();
  } else if (kind === 'goalie') {
    drawGoalNet(q, true);
  } else if (kind === 'rainbow') {
    const L = 680, hx = q.x + Math.cos(q.aim) * 14, hy = q.y - q.z - q.h * 0.52 + Math.sin(q.aim) * 8;
    const fadeIn = Math.min(1, (SP.rainbow.dur - q.spT) / 0.15), fadeOut = Math.min(1, q.spT / 0.25);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    ctx.translate(hx, hy); ctx.rotate(q.aim);
    const reach = L * fadeIn;
    // six thin stripes riding the same travelling sine wave (calm at her heart, rippling further out)
    const wy = (x, off) => off + Math.sin(x * 0.045 - time * 16) * Math.min(1, x / 120) * 11;
    RAINBOW.forEach((c, i) => {
      ctx.strokeStyle = c; ctx.globalAlpha = 0.85 * fadeOut; ctx.lineWidth = 3.4;
      ctx.beginPath(); for (let x = 0; x <= reach; x += 8) { const y = wy(x, (i - 2.5) * 3.2); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    });
    ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.55 * fadeOut; ctx.lineWidth = 2;
    ctx.beginPath(); for (let x = 0; x <= reach; x += 8) { const y = wy(x, 0); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    // little hearts surfing outward on the wave
    ctx.globalAlpha = 0.95 * fadeOut;
    for (let i = 0; i < 7; i++) { const x = (time * 520 + i * 97) % L; if (x > reach) continue; drawHeart(x, wy(x, 0), 4 + Math.min(1, x / 200) * 3, i % 2 ? '#ffffff' : '#ffb3d9'); }
    ctx.restore();
    // the glowing, beating heart on her chest
    const beat = 1 + Math.max(0, Math.sin(time * 14)) * 0.25;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fadeOut;
    const g = ctx.createRadialGradient(hx, hy, 2, hx, hy, 26 * beat); g.addColorStop(0, 'rgba(255,170,220,.9)'); g.addColorStop(1, 'rgba(255,120,200,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, hy, 26 * beat, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.globalAlpha = fadeOut; drawHeart(hx, hy + 2, 7 * beat, '#ff4f9a'); drawHeart(hx - 1.5, hy, 3 * beat, '#ffd0e6'); ctx.restore();
  }
}
// Taylor's goal: white posts around her joined by a crossbar rim, with net between them.
// The back half draws behind her, the front half in front, so she's standing inside the goal.
function drawGoalNet(q, front) {
  // a dome of goal netting over her: white post-style ribs, a mesh of strings, a soft bubble sheen.
  // The back half draws behind her, the front half in front.
  const R = 104, RY = 56, H = 130, fade = Math.min(1, q.spT / 0.35, (SP.goalie.dur - q.spT) / 0.2 + 0.2);
  const bob = 1 + Math.sin(time * 5) * 0.015;
  const P = (a, t) => { const hr = Math.cos(t * Math.PI / 2) * bob, vt = Math.sin(t * Math.PI / 2); return [q.x + Math.cos(a) * R * hr, q.y + Math.sin(a) * RY * hr - H * vt * bob]; };
  const isFront = a => Math.sin(a) > 0;
  const arc = (a, t0, t1, n) => { for (let i = 0; i <= n; i++) { const [x, y] = P(a, t0 + (t1 - t0) * i / n); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } };
  const ring = (t, n) => { let on = false; for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; if (isFront(a) !== front) { on = false; continue; } const [x, y] = P(a, t); if (!on) { ctx.moveTo(x, y); on = true; } else ctx.lineTo(x, y); } };
  ctx.save(); ctx.globalAlpha = fade; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (!front) { // bubble sheen inside the dome
    const g = ctx.createRadialGradient(q.x - R * 0.3, q.y - H * 0.75, 10, q.x, q.y - H * 0.45, R * 1.1);
    g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(0.7, 'rgba(200,240,255,.08)'); g.addColorStop(1, 'rgba(200,240,255,.2)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(q.x, q.y - H * 0.42, R * bob, H * 0.62 * bob, 0, 0, Math.PI * 2); ctx.fill();
  }
  // netting: meridians and rings
  ctx.strokeStyle = 'rgba(245,250,255,.6)'; ctx.lineWidth = 1.4; ctx.beginPath();
  const M = 28;
  for (let i = 0; i < M; i++) { const a = i / M * Math.PI * 2 + 0.06; if (isFront(a) === front) arc(a, 0, 1, 10); }
  for (let r = 1; r <= 6; r++) ring(r / 7, 48);
  ctx.stroke();
  // goalpost-white frame: base ring and four ribs over the top
  const white = (draw, w) => { ctx.strokeStyle = '#3a4048'; ctx.lineWidth = w + 3; ctx.beginPath(); draw(); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = w; ctx.beginPath(); draw(); ctx.stroke(); };
  white(() => ring(0, 64), 6);
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; if (isFront(a) === front) white(() => arc(a, 0, 1, 14), 5); }
  if (front && q.saveT > time) { // the net bulges when it stops a shot
    ctx.globalAlpha = fade * (q.saveT - time) / 0.3; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(q.x, q.y - H * 0.42, R * 1.08, H * 0.66, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}
// what a status effect looks like on an enemy
function drawEnemyStatus(e) {
  const top = e.y - e.z - e.h;
  if (e.paintT > 0 && IMG.w_frame) {
    const im = IMG.w_frame, fh = e.h * 1.3 + 20, fw = Math.max(fh * im.width / im.height, e.r * 2.6), cy = e.y - e.z - e.h * 0.5;
    const wob = e.paintT < 0.8 ? Math.sin(time * 40) * 2 : 0; // trembling before it breaks free
    // splashed with paint (the generated splat art, small and see-through)
    if (IMG.w_paint) { const ps = e.r * 1.4; ctx.save(); ctx.globalAlpha = 0.6; ctx.translate(e.x, cy); ctx.rotate((e.paintC || 0) * 1.1 + e.seed); ctx.drawImage(IMG.w_paint, -ps / 2, -ps / 2, ps, ps); ctx.restore(); }
    ctx.drawImage(im, e.x - fw / 2 + wob, cy - fh / 2, fw, fh);
    // the gallery placard
    const label = artLabel(e);
    ctx.font = `11px 'Nunito', sans-serif`; ctx.textAlign = 'center';
    const tw = ctx.measureText(label).width + 12, py = cy + fh / 2 + 6;
    ctx.fillStyle = '#f7f1e3'; ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(e.x - tw / 2, py, tw, 17, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3b2414'; ctx.fillText(label, e.x, py + 12.5);
    return;
  }
  if (e.pickT > 0 && IMG.w_sign) {
    const im = IMG.w_sign, w = Math.max(74, e.r * 2.4), h = w * im.height / im.width, bob = Math.abs(Math.sin(e.t * 6)) * 5;
    const sx = e.x + (e.flipX ? -8 : 8), sy = e.y - e.z - e.h * 0.45 - h - bob;
    ctx.save(); ctx.translate(sx, sy + h); ctx.rotate(Math.sin(e.t * 3 + e.seed) * 0.08); ctx.translate(0, -h);
    ctx.drawImage(im, -w / 2, 0, w, h);
    // the slogan, hand-lettered in marker on the cardboard
    const txt = SIGNS[(e.signI || 0) % SIGNS.length], words = txt.split(' '), lines = [];
    let cur = ''; for (const wd of words) { if ((cur + ' ' + wd).trim().length > 10 && cur) { lines.push(cur); cur = wd; } else cur = (cur + ' ' + wd).trim(); } if (cur) lines.push(cur);
    const fs = Math.min(15, (w * 0.86) / Math.max(...lines.map(l => l.length)) * 1.7);
    ctx.font = `${fs}px 'Lilita One', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = (e.signI || 0) % 3 === 0 ? '#b0201a' : '#1f2a44';
    const cy = h * 0.36; lines.forEach((l, i) => ctx.fillText(l, 0, cy + (i - (lines.length - 1) / 2) * fs * 1.05));
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }
  if (e.danceT > 0) {
    for (let i = 0; i < 2; i++) { const t = (time * 0.8 + i * 0.5 + e.seed) % 1; ctx.globalAlpha = 1 - t; drawHeart(e.x + Math.sin(t * 6 + i * 3) * 14, top - t * 40, 7, i ? '#ff6fae' : '#ff9ad0'); }
    ctx.globalAlpha = 1;
    ctx.font = `18px 'Lilita One', sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd84a'; ctx.fillText('☮', e.x + Math.sin(time * 3 + e.seed) * 16, top - 6);
  }
  if (e.sleepT > 0) {
    ctx.font = `bold 16px 'Lilita One', sans-serif`; ctx.textAlign = 'center';
    for (let i = 0; i < 3; i++) { const t = (time * 0.7 + i / 3 + e.seed) % 1; ctx.globalAlpha = Math.sin(t * Math.PI); ctx.fillStyle = '#d8e8ff'; ctx.strokeStyle = '#2b3a5a'; ctx.lineWidth = 3; const x = e.x + e.r * 0.4 + t * 26, y = top + 4 - t * 36; ctx.strokeText('z', x, y); ctx.fillText('z', x, y); }
    ctx.globalAlpha = 1;
  }
}
// confetti and flowers: how Izzy's rainbow finishes an enemy
function confettiBurst(x, y, h) {
  for (let i = 0; i < 46; i++) particles.push({ x, y, z: h * 0.5, vx: rand(-260, 260), vy: rand(-180, 180), vz: rand(160, 480), life: rand(1, 1.8), max: 1.8, color: pick(RAINBOW), size: rand(4, 7), grav: 420, feather: true, confetti: true, rot: rand(0, 6) });
  for (let i = 0; i < 12; i++) particles.push({ x, y, z: h * 0.5, vx: rand(-200, 200), vy: rand(-140, 140), vz: rand(120, 360), life: rand(1.4, 2.2), max: 2.2, color: pick(['#ff6fae', '#ffd84a', '#ffffff', '#b98aff']), size: rand(7, 11), grav: 500, flower: true, rot: rand(0, 6) });
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
  for (const q of players) if (CHARS[q.ch].special === 'scrap' && q.macT <= 0) {
    for (let i = 0; i < 2; i++) { const a = rand(0, Math.PI * 2), d = rand(250, 600); dropPickup(clamp(q.x + Math.cos(a) * d, 80, ARENA.w - 80), clamp(q.y + Math.sin(a) * d, 100, ARENA.h - 80), 'scrap'); }
  }
}

function buildWave(n) {
  const q = [], L = levelOf(n);
  if (L.boss) {
    q.push({ type: L.boss, delay: 2.0 });
    for (let i = 0; i < (4 + Math.floor(n / 2)) * (1 + 0.5 * (NP() - 1)); i++) q.push({ type: pick(L.escorts), delay: 1.3 });
    return q;
  }
  let budget = L.budget * (1 + 0.6 * (NP() - 1)); // more enemies, arriving faster, with more players
  const gap = Math.max(0.18, ((L.fast ? 0.8 : 1.1) - n * 0.035) / (1 + 0.25 * (NP() - 1)));
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
      if (players.every(q => (x - q.x) ** 2 + (y - q.y) ** 2 > 480 ** 2)) break;
    }
    leap = true;
  }
  const hpScale = (1 + (wave - 1) * 0.09) * (1 + 0.45 * (NP() - 1)); // tougher with more players
  const e = {
    id: nextId++, type, d, x, y, vx: 0, vy: 0, r: d.r, h: d.h, hp: d.hp * hpScale, maxHp: d.hp * hpScale,
    speed: d.speed * (1 + Math.min(wave, 15) * 0.015) * rand(0.9, 1.1), flash: 0, t: rand(0, 3), cd: rand(1, 2.5),
    st: 'move', stT: 0, z: 0, vz: 0, face: 1, kx: 0, ky: 0,
    mass: d.mass || 1, flank: rand(-0.9, 0.9), seed: rand(0, 100),
    dir: 'front', flipX: false, dirHold: 0, stride: rand(0, 100), frame: 1, act: null, hurtT: 0, sq: 0, sqV: 0, lean: 0,
    spawnT: leap ? 0.75 : 0.25, spawnMax: leap ? 0.75 : 0.25, leap, fromX, fromY, toX: x, toY: y,
  };
  if (leap) { e.x = fromX; e.y = fromY; }
  if (d.boss) { e.hp = e.maxHp = d.hp * (1 + Math.max(0, wave - d.lvl) / 5 * 0.45) * (1 + 0.75 * (NP() - 1)); boss = e; e.phase = 0; e.cd = 2; Sfx.gobble(0.5); shake = 20; e.spawnT = e.spawnMax = 1.2; }
  enemies.push(e);
  return e;
}

// ---------- update ----------
function update(dt) {
  time += dt;
  if (hitStop > 0) { hitStop -= dt; return; }
  updateWave(dt);
  for (const pl of players) { player = pl; pl.input = pl === me ? localInput() : takeRemoteInput(pl); updatePlayer(dt); }
  player = me;
  updateEnemies(dt);
  player = me;
  updateBullets(dt);
  updateRoasts(dt);
  updateCans(dt);
  updateFlames(dt);
  updateGizmos(dt);
  updateFire(dt);
  if (yardSpr) updateYard(dt);
  updateBombs(dt);
  updateMisc(dt);
  // camera
  const look = isTouch && !mouse.active ? 0 : 1;
  updateCamera(dt, look);
  shake = Math.max(0, shake - dt * 40);
}
function updateCamera(dt, look = 0) {
  const lookX = Math.cos(me.aim) * 60 * look, lookY = Math.sin(me.aim) * 40 * look;
  cam.x = lerp(cam.x, me.x + lookX, 1 - Math.exp(-dt * 6));
  cam.y = lerp(cam.y, me.y - 40 + lookY, 1 - Math.exp(-dt * 6));
  const hw = VW / ZOOM / 2, hh = VH / ZOOM / 2;
  cam.x = hw * 2 > ARENA.w + 200 ? ARENA.w / 2 : clamp(cam.x, hw - 100, ARENA.w + 100 - hw);
  cam.y = hh * 2 > ARENA.h + 260 ? ARENA.h / 2 : clamp(cam.y, hh - 180, ARENA.h + 80 - hh);
}
// who an enemy goes after: the nearest player still standing
function targetOf(e) {
  let best = null, bd = Infinity;
  for (const q of players) { if (q.dead || q.away) continue; const d = (q.x - e.x) ** 2 + (q.y - e.y) ** 2; if (d < bd) { bd = d; best = q; } }
  return best || me || players[0];
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
      Sfx.wave();
      for (const q of players) {
        // teammates who went down get back up for the next level
        if (q.dead) { q.dead = false; q.hp = Math.round(q.maxHp * 0.5); q.inv = 2; q.vz = 0; q.z = 0; floatText(q.x, q.y - 120, `${q.pname} is back!`, '#7dff8a', 1.8, 22); }
        q.victoryT = 2.0;
        // a reward crate for each player
        const w = pick(['cran', 'corn', 'pie']);
        dropPickup(clamp(q.x + rand(-120, 120), 80, ARENA.w - 80), clamp(q.y + rand(-120, 120), 80, ARENA.h - 80), 'weapon', w);
        if (wave % 2 === 0) dropPickup(clamp(q.x + rand(-150, 150), 80, ARENA.w - 80), clamp(q.y + rand(-150, 150), 80, ARENA.h - 80), 'slice');
      }
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

// ---------- input: one shape for local devices and remote players ----------
// mx,my move; a aim angle; fire held; aiming (face the aim even when not shooting); tid auto-aim target id;
// bx,by bomb target (or null); one-shots: dash, special, bomb, swap (-1/1), weapon (key)
function blankInput() { return { mx: 0, my: 0, a: Math.PI / 2, fire: false, aiming: false, tid: 0, bx: null, by: null, dash: false, special: false, bomb: false, swap: 0, weapon: null }; }
function localInput() {
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
  const ai = aimInput();
  let bx = null, by = null;
  if (!isTouch || mouse.active) { const w = screenToWorld(mouse.x, mouse.y); bx = w.x; by = w.y + 20; }
  const I = { mx, my, a: ai.a, fire: !!ai.fire, aiming: (mouse.active && !isTouch) || (mouse.active && mouse.down), tid: ai.target ? ai.target.id : 0, bx, by,
    dash: wantDash, special: wantSpecial, bomb: wantBomb, swap: wantSwap, weapon: wantWeapon };
  wantDash = wantSpecial = wantBomb = false; wantSwap = 0; wantWeapon = null;
  return I;
}
const enemyById = id => id ? enemies.find(e => e.id === id && !e.dead) : null;

function updatePlayer(dt) {
  const p = player, c = CHARS[p.ch], I = p.input || blankInput();
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
    // the game ends when everyone is down (single player: right away)
    if (p.deadT <= 0 && state === 'play' && !(NET && !NET.host) && players.every(q => q.dead && q.deadT <= 0)) gameOver();
    return;
  }

  // movement input
  const mx = I.mx, my = I.my, ml = Math.hypot(mx, my);
  p.moving = ml > 0.1;

  if (I.dash && p.dashCd <= 0) {
    const dir = p.moving ? [mx, my] : [Math.cos(p.bodyAng), Math.sin(p.bodyAng)];
    const dl = Math.hypot(dir[0], dir[1]) || 1;
    p.dashDir = [dir[0] / dl, dir[1] / dl]; p.dashT = 0.2; p.dashCd = c.dashCd || 0.9; p.inv = Math.max(p.inv, 0.3);
    p.sq = -0.22; p.sqV = 0; // stretch on launch
    Sfx.dash();
    dustBurst(p.x, p.y, 10, 1.4);
  }

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
  if (I.special && c.special === 'charge' && p.chargeCd <= 0 && p.chargeT <= 0 && p.chargeWind <= 0) {
    p.chargeWind = 0.55; Sfx.windup();
  }
  // ----- Benny: hurl insults so mean they physically hurt -----
  if (I.special && c.special === 'taunt' && p.roastCd <= 0 && !p.dead) hurlInsults(p);
  // ----- Mama: energy drink cans -----
  if (I.special && c.special === 'can' && p.canCd <= 0 && !p.dead) hurlCans(p);
  p.canCd -= dt;
  // ----- Michelle: acid slime balls -----
  if (I.special && c.special === 'slime' && p.slimeCd <= 0 && !p.dead) hurlCans(p, 'slime');
  p.slimeCd -= dt;
  // ----- Arthur: chili pepper -> fire breath -----
  if (I.special && c.special === 'chili' && p.chiliCd <= 0 && p.chewT <= 0 && p.breathT <= 0) { p.chewT = 0.6; p.speech = { text: pick(ARTHUR_SHOUTS), t: 1.4, max: 1.4 }; Sfx.chomp(); }
  p.chiliCd -= dt;
  if (p.chewT > 0) {
    p.chewT -= dt; p.sq = Math.sin(time * 40) * 0.08; p.sqV = 0;
    if (Math.random() < 0.6) particles.push({ x: p.x + rand(-14, 14), y: p.y, z: p.h * 0.9, vx: rand(-40, 40), vy: 0, vz: rand(60, 120), life: 0.5, max: 0.5, smoke: true, size: rand(6, 10), grav: -40 });
    if (p.chewT <= 0) { p.breathT = 5; shake = Math.max(shake, 6); }
  }  // ----- Pops: crouch -> giant jump -> shockwave -----
  if (I.special && c.special === 'stomp' && p.stompCd <= 0 && p.stompWind <= 0 && p.jumpT <= 0) { p.stompWind = 0.28; p.speech = { text: pick(POPS_SHOUTS), t: 1.3, max: 1.3 }; Sfx.windup(); }
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
  // ----- the family powers -----
  if (I.special && SP[c.special] && p.spCd <= 0 && p.spT <= 0 && !p.dead) startSpecial(p);
  p.spCd -= dt;
  if (p.spT > 0 && SP[c.special]) tickSpecial(p, dt);
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
    if (p.chargeT <= 0) { p.chargeCd = CHARGE_CD; p.vx *= 0.35; p.vy *= 0.35; p.sq = 0.25; p.sqV = 0; dustBurst(p.x, p.y, 10, 1.2); }
  }
  const charging = p.chargeT > 0 || p.chargeWind > 0 || (c.special === 'flop' && p.spT > 0);

  const sp = p.speed * (inPond(p.x, p.y) ? 0.6 : 1) * (p.spT > 0 && SP[c.special] && SP[c.special].slow || 1);
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
  const ai = { a: I.a, fire: I.fire, target: enemyById(I.tid), bx: I.bx, by: I.by };
  p.aim = ai.a;
  if (I.swap) cycleWeapon(I.swap);
  if (I.weapon) selectWeapon(I.weapon);
  const busyMouth = p.breathT > 0 || p.chewT > 0 || (p.spT > 0 && SP[c.special] && SP[c.special].busy);
  if (p.breathT > 0) breatheFire(p, dt);
  if (ai.fire && p.fireCd <= 0 && !charging && !busyMouth) { fire(ai); p.lastFire = 0; }
  if (I.bomb && p.bombs > 0 && p.bombCd <= 0 && !charging) { throwBomb(ai); p.lastFire = 0; }

  // which way the BODY faces: the aim while shooting (or when a mouse is aiming), otherwise travel direction
  const spd = Math.hypot(p.vx, p.vy);
  const aiming = p.lastFire < 0.7 || I.aiming;
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
    bullets.push({ id: nextId++, owner: p, w: p.cur, x: tip.x, y: tip.y, z: tip.z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: w.r, dmg, life: w.life * (w.count > 1 ? rand(0.8, 1.15) : 1), max: w.life, hits: new Set(), rot: 0 });
  }
  if (!w.special && p.ammo[p.cur] !== Infinity) {
    p.ammo[p.cur]--;
    if (p.ammo[p.cur] <= 0) { p.ammo[p.cur] = 0; floatText(p.x, p.y - 110, 'Out of ammo!', '#fff'); setTimeout(() => { if (p.ammo[p.cur] <= 0) p.cur = 'gravy'; }, 150); }
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
  if (ai.bx != null) { tx = ai.bx; ty = ai.by; }
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
  let p = player;
  for (const e of enemies) {
    p = player = pupTarget(e) || targetOf(e);
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
      // (flames, embers and smoke for burning bodies come from updateFire)
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
    // David's guitar: a hippie dance party. Partners pair up, sway and hug instead of fighting
    if (e.held) {
      // in a luchador's grip: no say in the matter
      dvx = 0; dvy = 0; e.vx = 0; e.vy = 0; accel = 0; act = 0; e.cd = Math.max(e.cd, 0.5);
      if (e.st !== 'move' && e.st !== 'land') e.st = 'move';
      if (!players.some(q => q.grabId === e.id && q.spT > 0)) e.held = false; // let go if the luchador stopped
    } else if (e.thrownT > 0) {
      // flung: a living cannonball that bowls over everyone it hits
      e.thrownT -= dt; dvx = e.vx; dvy = e.vy; accel = 0; act = 0;
      for (const o of enemies) {
        if (o === e || o.dead || o.spawnT > 0 || e.throwHits.has(o)) continue;
        const ox = o.x - e.x, oy = o.y - e.y, od = Math.hypot(ox, oy);
        if (od > o.r + e.r + 6) continue;
        e.throwHits.add(o);
        const sp = Math.hypot(e.vx, e.vy) || 1;
        damageEnemy(o, 40 + wave * 4, e.vx / sp, e.vy / sp, 650); damageEnemy(e, 12 + wave, 0, 0, 0);
        floatText(o.x, o.y - o.h - 20, pick(['STRIKE!', 'BOWLED!', 'KABOOM!', 'POW!']), '#ffec3d', 0.7, 24); shake = Math.max(shake, 8);
        e.vx *= 0.75; e.vy *= 0.75;
      }
      if (e.x < 40 || e.x > ARENA.w - 40 || e.y < 60 || e.y > ARENA.h - 40) { e.thrownT = 0; damageEnemy(e, 20 + wave * 2, 0, 0, 0); shake = Math.max(shake, 8); }
      if (e.dead) continue;
    } else if (e.paintT > 0) {
      // framed: a still life. Not moving, not attacking, until it wears off (or someone shatters it)
      e.paintT -= dt; dvx = 0; dvy = 0; e.vx = 0; e.vy = 0; act = null; e.cd = Math.max(e.cd, 0.4); accel = 99999;
      if (e.st !== 'move' && e.st !== 'land') e.st = 'move';
      if (e.paintT <= 0) { artShatter(e.x, e.y, e.h); netEvent('a', [Math.round(e.x), Math.round(e.y), e.h]); }
    } else if (e.sleepT > 0) {
      e.sleepT -= dt; dvx = 0; dvy = 0; act = null; e.cd = Math.max(e.cd, 0.4); accel = 2500;
      if (e.st !== 'move' && e.st !== 'land') e.st = 'move';
    } else if (e.danceT > 0) {
      e.danceT -= dt; act = null; e.cd = Math.max(e.cd, 0.4);
      if (e.st !== 'move' && e.st !== 'land') e.st = 'move';
      let mate = e.mate;
      if (!mate || mate.dead || !(mate.danceT > 0)) { mate = null; let bd = 400 ** 2; for (const o of enemies) { if (o === e || o.dead || !(o.danceT > 0)) continue; const dd = (o.x - e.x) ** 2 + (o.y - e.y) ** 2; if (dd < bd) { bd = dd; mate = o; } } e.mate = mate; }
      const sway = Math.sin(e.t * 6 + e.seed) * 60;
      if (mate) { const mx = mate.x - e.x, my = mate.y - e.y, md = Math.hypot(mx, my) || 1, close = md < e.r + mate.r + 6; dvx = close ? sway : mx / md * e.speed * 0.9 + sway; dvy = close ? Math.cos(e.t * 6) * 20 : my / md * e.speed * 0.9; }
      else { dvx = sway; dvy = Math.cos(e.t * 4 + e.seed) * 40; }
      accel *= 1.5;
    } else if (e.pickT > 0) {
      // on strike: walk to their spot in the picket line, then march back and forth with a sign
      e.pickT -= dt; act = null; e.cd = Math.max(e.cd, 0.4);
      if (e.st !== 'move' && e.st !== 'land') e.st = 'move';
      const march = Math.sin(e.t * 1.6 + e.pickX * 0.01) * 34, tx = e.pickX + march - e.x, ty = e.pickY - e.y, td = Math.hypot(tx, ty) || 1;
      const spd = td > 50 ? e.speed * 1.6 : Math.min(e.speed * 0.6, td * 3);
      dvx = tx / td * spd; dvy = ty / td * spd; accel *= 2;
    } else if (e.brawlT > 0) {
      // Jay's turkey call: everyone piles into the brawl cloud
      e.brawlT -= dt; act = null; e.cd = Math.max(e.cd, 0.4);
      if (e.st !== 'move' && e.st !== 'land') e.st = 'move';
      const bx = e.brawlX - e.x, by = e.brawlY - e.y, bd = Math.hypot(bx, by) || 1;
      if (bd > 40) { dvx = bx / bd * e.speed * 2.2; dvy = by / bd * e.speed * 2.2; } else { dvx = Math.sin(e.t * 20 + e.seed) * 120; dvy = Math.cos(e.t * 17 + e.seed) * 80; }
      accel *= 3;
    }
    if (e.rainbowT > 0) e.rainbowT -= dt;
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

    // contact damage (anyone touching it, not just its target)
    if (e.z < 30 && !(e.sulkT > 0) && !(e.hypeT > 0) && !(e.downT > 0) && !(e.meltT > 0) && !(e.sleepT > 0) && !(e.danceT > 0) && !(e.brawlT > 0) && !(e.pickT > 0) && !(e.paintT > 0) && !e.held && !(e.thrownT > 0)) for (const q of players) {
      if (q.inv > 0 || q.dead) continue;
      const qd = Math.hypot(q.x - e.x, q.y - e.y);
      if (qd < e.r + q.r) hurtPlayer(d.dmg * (e.st === 'dash' || e.st === 'lunge' || e.st === 'roll' ? 1.4 : 1), (q.x - e.x) / (qd || 1), (q.y - e.y) / (qd || 1), q);
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

function hurtPlayer(dmg, nx, ny, p = player) {
  if (p.dead) return;
  if (testLevel && testGod) { p.flash = 0.1; return; }
  p.hp -= dmg; p.inv = 0.9; p.flash = 0.15; p.hurtT = 0.28;
  p.vx += nx * 520; p.vy += ny * 520;
  p.sq = 0.18; p.sqV = 0; p.leanV += (nx >= 0 ? 1 : -1) * 6;
  if (p === me) { shake = Math.max(shake, 10); hitStop = 0.05; } else netFx(p, 'hurt');
  floatText(p.x, p.y - p.h - 10, `-${Math.round(dmg)}`, '#ff6b6b');
  if (p === me) Sfx.hurt();
  if (p.hp <= 0) {
    p.hp = 0; p.dead = true; p.deadT = 1.6; p.inv = 99;
    p.vx = nx * 600; p.vy = ny * 600; p.vz = 420;
    if (p === me) { hitStop = 0.18; shake = 18; Sfx.over(); } else netFx(p, 'down');
    if (NET && players.some(q => !q.dead)) floatText(p.x, p.y - p.h - 40, `${p.pname} is down!`, '#ff6b6b', 2.2, 22);
  }
}

function damageEnemy(e, dmg, kx, ky, kb = 120) {
  if (e.spawnT > 0) return;
  if (e.sleepT > 0 || e.danceT > 0 || e.pickT > 0) dmg *= 1.5;
  if (e.paintT > 0) dmg *= 2; // fragile art // napping and dancing enemies are easy pickings
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

function deathBurst(x, y, h, type, colors) {
  const boss = ENEMIES[type] && ENEMIES[type].boss, n = boss ? 120 : 14;
  colors = colors || DEATH_COLORS[type] || ['#c8752d', '#e8b05a'];
  for (let i = 0; i < n; i++) {
    const feather = (type === 'turkey' || boss) && i % 3 === 0;
    particles.push({ x, y, z: h * 0.4, vx: rand(-220, 220), vy: rand(-160, 160), vz: rand(100, 420), life: rand(0.6, 1.4), max: 1.4, color: pick(colors), size: rand(4, 10) * (boss ? 1.8 : 1), grav: feather ? 120 : 900, feather, rot: rand(0, 6) });
  }
}
const DEATH_COLORS = { turkey: ['#7a4a22', '#c8752d', '#e8b05a', '#c0392b'], potato: ['#c9a463', '#f2d16b', '#8a6a3a'], tot: ['#c9a463', '#f2d16b'],
  cranberry: ['#b0102a', '#ff5a6e', '#6e0a1a'], corn: ['#f4c430', '#fff2a0', '#4a8a2a'], pumpkin: ['#e8742a', '#ffb347', '#3d6b22'], boss: ['#7a4a22', '#c8752d', '#e8b05a', '#c0392b', '#222'],
  mashboss: ['#c9a463', '#f2d16b', '#8a5a2a', '#fff2c0'], gourdboss: ['#e8742a', '#ffb347', '#3d6b22', '#ffd36a'], cornboss: ['#f4c430', '#fff2a0', '#4a8a2a', '#ffe14d'] };
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  const mult = 1 + Math.floor(wave / 3) * 0.25;
  score += Math.round(e.d.score * mult); kills++;
  Sfx.splat();
  const colors = { turkey: ['#7a4a22', '#c8752d', '#e8b05a', '#c0392b'], potato: ['#c9a463', '#f2d16b', '#8a6a3a'], tot: ['#c9a463', '#f2d16b'],
    cranberry: ['#b0102a', '#ff5a6e', '#6e0a1a'], corn: ['#f4c430', '#fff2a0', '#4a8a2a'], pumpkin: ['#e8742a', '#ffb347', '#3d6b22'], boss: ['#7a4a22', '#c8752d', '#e8b05a', '#c0392b', '#222'],
    mashboss: ['#c9a463', '#f2d16b', '#8a5a2a', '#fff2c0'], gourdboss: ['#e8742a', '#ffb347', '#3d6b22', '#ffd36a'], cornboss: ['#f4c430', '#fff2a0', '#4a8a2a', '#ffe14d'] }[e.type] || ['#c8752d', '#e8b05a'];
  const party = e.rainbowT > 0, art = e.paintT > 0;
  if (party) confettiBurst(e.x, e.y, e.h); else if (art) { artShatter(e.x, e.y, e.h); deathBurst(e.x, e.y, e.h, e.type, colors); } else deathBurst(e.x, e.y, e.h, e.type, colors);
  netEvent('k', [Math.round(e.x), Math.round(e.y), e.h, e.type, party ? 1 : art ? 2 : 0]);
  // the body: flung along the killing blow, tumbles, bounces, settles, then fades into the lawn
  const [hx, hy, kb] = e.lastHit || [Math.sign(e.x - me.x) || 1, 0, 120];
  const fling = clamp(kb * 2.2, 160, 900) / Math.sqrt(e.mass);
  corpses.push({
    _net: true, name: e.d.img, row: AN[e.d.img] && AN[e.d.img].rows.act !== undefined ? 'act' : 'hop', frame: 3, h: e.h, x: e.x, y: e.y, z: e.z,
    vx: e.vx * 0.4 + hx * fling, vy: e.vy * 0.4 + hy * fling * 0.7, vz: clamp(kb, 150, 600) / Math.sqrt(e.mass),
    rot: 0, vrot: (hx >= 0 ? 1 : -1) * rand(6, 12) / e.mass, flip: hx < 0, life: e.d.boss ? 4 : 2.4, max: e.d.boss ? 4 : 2.4, mass: e.mass, r: e.r,
  });
  if (e.d.boss) {
    boss = null; shake = 30; hitStop = 0.25; Sfx.boom();
    for (let i = 0; i < 6 + 3 * (NP() - 1); i++) dropPickup(e.x + rand(-120, 120), e.y + rand(-80, 80), i % 3 === 0 ? 'slice' : i % 3 === 1 ? 'weapon' : 'bomb', pick(['cran', 'corn', 'pie']));
    floatText(e.x, e.y - 200, e.d.bname + ' DEFEATED!', '#ffc53d', 2.5, 34);
  }
  if (e.d.split) {
    for (let i = 0; i < 2; i++) {
      const t = spawnEnemy('tot', e.x + rand(-20, 20), e.y + rand(-20, 20));
      t.spawnT = 0; const a = rand(0, Math.PI * 2); t.vx = Math.cos(a) * 260; t.vy = Math.sin(a) * 180; t.vz = 320; t.z = 10; t.hurtT = 0.4;
    }
  }
  const r = Math.random() / (1 + 0.25 * (NP() - 1)); // more goodies with more players
  if (!e.d.boss) {
    if (r < 0.06) dropPickup(e.x, e.y, 'slice');
    else if (r < 0.13) dropPickup(e.x, e.y, 'weapon', pick(['cran', 'corn', 'pie']));
    else if (r < 0.17) dropPickup(e.x, e.y, 'bomb');
  }
  if (e.type === 'pumpkin' && Math.random() < 0.5) dropPickup(e.x, e.y, 'weapon', pick(['cran', 'corn', 'pie']));
  if (players.some(q => CHARS[q.ch].special === 'scrap' && q.macT <= 0)) {
    if (e.d.boss) for (let i = 0; i < 3; i++) dropPickup(e.x + rand(-80, 80), e.y + rand(-60, 60), 'scrap');
    else if (Math.random() < 0.38) dropPickup(e.x + rand(-10, 10), e.y + rand(-10, 10), 'scrap');
  }
  for (const q of players) if (CHARS[q.ch].special === 'taunt' && !q.dead && (e.d.boss || (time - q.lastTaunt > 1.0 && Math.random() < 0.8))) {
    const pool = TAUNTS[e.type] && Math.random() < 0.55 ? TAUNTS[e.type] : TAUNTS.any;
    let line = pick(pool);
    if (q.speech && q.speech.text === line) line = pick(TAUNTS.any);
    q.speech = { text: line, t: 1.9, max: 1.9 }; q.lastTaunt = time;
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
  p.stompCd = STOMP_CD;
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
  for (const b of bullets) {
    const p = b.owner || me;
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
    for (const q of players) if (!q.dead && q.inv <= 0 && (q.x - b.x) ** 2 + (q.y - b.y) ** 2 < (q.r + b.r) ** 2) {
      b.life = 0; const sp = Math.hypot(b.vx, b.vy) || 1; hurtPlayer(b.dmg, b.vx / sp * 0.4, b.vy / sp * 0.4, q); break;
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
    const c = CHARS[(b.owner || me).ch];
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
  // the feast tables restock a health pack every so often (faster with more players)
  tableT -= dt;
  if (tableT <= 0 && state === 'play') {
    tableT = 15 / Math.sqrt(NP());
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
  for (const q of players) if (q.speech) { q.speech.t -= dt; if (q.speech.t <= 0) q.speech = null; }
  for (const w of webs) w.life -= dt;
  webs = webs.filter(w => w.life > 0);
  floaters = floaters.filter(f => f.life > 0);
  for (const it of pickups) {
    it.life -= dt; it.t += dt;
    if (!it.perch) { it.vz -= 900 * dt; it.z = Math.max(0, it.z + it.vz * dt); if (it.z === 0) it.vz = Math.abs(it.vz) > 60 ? -it.vz * 0.4 : 0; }
    let p = null, d2 = Infinity;
    for (const q of players) { if (q.dead || (it.kind === 'scrap' && CHARS[q.ch].special !== 'scrap')) continue; const dd = dist2(it, q); if (dd < d2) { d2 = dd; p = q; } }
    if (!p) continue;
    const c = CHARS[p.ch];
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
          if (p.scraps >= SCRAPS_NEEDED) { player = p; assembleMac(); player = me; }
          else floatText(p.x, p.y - 110, `Scrap ${p.scraps}/${SCRAPS_NEEDED}`, '#cfd8dc', 0.9, 17);
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

function floatText(x, y, text, color, life = 0.9, size = 18) {
  floaters.push({ x, y, text: String(text), color, life, max: life, size });
  netEvent('f', [Math.round(x), Math.round(y), String(text), color, life, size]);
}


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
    if (IMG.d_gravy) { // generated gravy puddle art (mirrored for variety)
      const im = IMG.d_gravy, w = pu.r * 2.4, h = w * im.height / im.width;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(pu.x, pu.y); if ((pu.seed * 10 | 0) % 2) ctx.scale(-1, 1);
      ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore(); continue;
    }
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
  for (const q of players) shadow(q.x, q.y, q.r * (q.dead && q.z <= 0 ? 1.9 : 1.1) * (1 - Math.min(q.z, 200) / 400));
  // in multiplayer, a coloured ring under each player so you can tell who's who (yours is gold)
  if (NET) for (const q of players) { ctx.strokeStyle = q === me ? 'rgba(255,215,80,.8)' : 'rgba(120,200,255,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(q.x, q.y, q.r * 1.5, q.r * 0.6, 0, 0, Math.PI * 2); ctx.stroke(); }
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
  for (const q of players) list.push([q.y, () => { player = q; if (q.away) ctx.globalAlpha = 0.4; drawPlayer(); ctx.globalAlpha = 1; if (NET) drawNameTag(q); player = me; }]);
  for (const q of players) if (q.spT > 0 && SP[CHARS[q.ch].special]) {
    list.push([q.y + 1, () => drawPlayerPowerFx(q)]);
    if (CHARS[q.ch].special === 'goalie') list.push([q.y - 1, () => drawGoalNet(q, false)]);
  }
  for (const g of gizmos) list.push([g.kind === 'brawl' ? g.y + 60 : g.kind === 'vibes' ? g.y + 400 : g.kind === 'wave' || g.kind === 'hearts' ? g.y - 200 : g.y, () => drawGizmo(g)]);
  for (const g of gizmos) if (g.kind === 'gwave') list.push([g.y + Math.sin(g.r) * gwFront(g.max - g.life) / 1.4 + 2, () => drawGWaveCrest(g)]);
  for (const it of pickups) list.push([it.y, () => drawPickup(it)]);
  for (const b of bullets) list.push([b.y, () => drawBullet(b)]);
  for (const r of roasts) list.push([r.y, () => drawRoast(r)]);
  for (const c of cans) list.push([c.y, () => drawCan(c)]);
  for (const f of flames) list.push([f.y, () => drawFlame(f)]);
  if (fireSpr) {
    list.push([MAP.firepit[1] - 6, drawPitFire]);
    for (const p of fireParts) list.push([p.y, () => drawFirePart(p)]);
    for (const sm of smokeParts) list.push([sm.y, () => drawSmokePuff(sm)]);
  }
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

  // smoke & rings above, then all the live fire on top
  for (const pt of particles) if (pt.smoke || pt.ring) drawParticle(pt);

  for (const q of players) drawSpeech(q);
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
  if (e.sleepT > 0) { rot = (e.flipX ? -1 : 1) * 0.28 + Math.sin(e.t * 2) * 0.03; shiver = 0; }   // dozing, slumped over
  if (e.paintT > 0) { rot = 0; shiver = 0; } // a still life holds perfectly still
  if (e.held || e.thrownT > 0) { rot = e.t * 13; shiver = 0; } // spun round and round / tumbling through the air
  if (e.danceT > 0) { rot += Math.sin(e.t * 6 + e.seed) * 0.28; ey -= Math.abs(Math.sin(e.t * 6 + e.seed)) * 6; } // grooving
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
  if (e.danceT > 0 || e.sleepT > 0 || e.pickT > 0 || e.paintT > 0) drawEnemyStatus(e);
  if (e.meltT > 0) drawMelt(e);
  if (e.burnT > 0) { drawBurning(e); if (fireSpr) drawEnemyFire(e); }
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

// the player's own name over their head (multiplayer), so you know who's playing which character
function drawNameTag(q) {
  const y = q.y - q.z - q.h - 20;
  ctx.font = `15px 'Lilita One', sans-serif`; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  ctx.lineWidth = 4; ctx.strokeStyle = '#2b1a10'; ctx.strokeText(q.pname, q.x, y);
  ctx.fillStyle = q === me ? '#ffd84a' : '#bfe6ff'; ctx.fillText(q.away ? `${q.pname} (reconnecting…)` : q.pname, q.x, y);
  if (q !== me && !q.dead) { const w = 40; ctx.fillStyle = '#2b1a10'; ctx.fillRect(q.x - w / 2 - 1, y + 5, w + 2, 6); ctx.fillStyle = '#5fd06a'; ctx.fillRect(q.x - w / 2, y + 6, w * Math.max(0, q.hp / q.maxHp), 4); }
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
  // damage flicker (not while a power is running: the flop and the goalie shield also make you invulnerable)
  const blink = p.inv > 0.2 && !p.dead && p.dashT <= 0 && p.jumpT <= 0 && !(p.spT > 0) && Math.floor(time * 20) % 2 === 0;
  let row = p.dir, frame = p.frame, flip = p.flipX, showGun = true;
  if (p.dead) { row = 'act'; frame = 2; showGun = false; flip = p.vx > 0 ? false : p.vx < 0 ? true : flip; }
  else if (p.chargeT > 0) { row = 'act'; frame = 1; flip = p.chargeDir[0] < 0; showGun = false; }
  else if (p.chargeWind > 0) { row = 'act'; frame = 1; showGun = false; }
  else if (p.jumpT > 0) { row = 'act'; frame = 3; showGun = false; flip = false; }
  else if (p.chewT > 0 || p.breathT > 0) showGun = false;
  else if (p.dashT > 0) { row = 'act'; frame = 1; flip = p.dashDir[0] < 0; showGun = false; }
  else if (CHARS[p.ch].special === 'flop' && p.spT > 0) { row = 'act'; frame = 1; flip = p.vx < 0; showGun = false; }
  else if (CHARS[p.ch].special === 'luchador' && p.spT > 0 && AN.jaylucha) {
    // transformed: lunge, airplane spin, throw, then a big flex
    const age = SP.luchador.dur - p.spT, fr = age < 0.25 ? 0 : age < 1.85 ? 1 : age < 2.0 ? 2 : 3;
    const lf = fr === 3 ? false : Math.cos(p.spinA || 0) < 0;
    drawAnim('jaylucha', 'act', fr, p.x, p.y - p.z, p.h * 1.12, lf, { flash: p.flash });
    return;
  }
  else if (p.hurtT > 0) { row = 'act'; frame = 0; showGun = false; }
  else if (p.victoryT > 0 && Math.hypot(p.vx, p.vy) < 30 && p.lastFire > 0.5) { row = 'act'; frame = 3; showGun = false; flip = false; }
  const breathe = row !== 'act' && Math.hypot(p.vx, p.vy) < 25 ? Math.sin(time * 3) * 0.015 : 0;
  const sx = 1 + p.sq * 0.8 - breathe * 0.5, sy = 1 - p.sq + breathe;
  // gun: in front of the body unless facing away; bounces with the stride
  const stepBob = row !== 'act' && Math.hypot(p.vx, p.vy) > 25 ? (p.frame % 2 === 0 ? 2.5 : -1) : 0;
  const behind = row === 'back';
  const drawGun = () => {
    if (!showGun) return;
    const spk = SP[CHARS[p.ch].special], held = p.spT > 0 && spk && spk.held;
    const w = WEAPONS[p.cur], im = IMG[held || w.img]; if (!im) return;
    const a = p.gunAng, fl = Math.cos(a) < 0;
    // held at the hand: side view -> front hand; front view -> off to the right hip; back view -> behind
    const hx = row === 'side' ? (flip ? -12 : 12) : row === 'front' ? 17 : -14;
    const gx = p.x + hx + Math.cos(a) * 6, gy = p.y - p.z - p.h * (row === 'back' ? 0.4 : 0.32) + stepBob + Math.sin(a) * 6;
    ctx.save(); ctx.translate(gx, gy); ctx.rotate(a + p.lean * 0.5); if (fl) ctx.scale(1, -1);
    const gw = held ? (held === 'w_guitar' ? 40 : 46) : p.cur === 'pie' ? 34 : 50, gh = gw * im.height / im.width;
    const kick = p.fireCd > 0 ? Math.max(0, p.fireCd / (w.rate || 1)) * (p.cur === 'cran' ? 12 : 5) : 0;
    if (held === 'w_blower') { ctx.scale(-1, 1); ctx.drawImage(im, -gw * 0.7, -gh / 2, gw, gh); } // art faces left
    else ctx.drawImage(im, -gw * 0.3 - kick, -gh / 2, gw, gh);
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
  if (pt.note) { ctx.font = `${pt.size + 4}px 'Lilita One', sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#2b1a10'; ctx.strokeText('♪', pt.x, pt.y - pt.z); ctx.fillText('♪', pt.x, pt.y - pt.z); ctx.globalAlpha = 1; return; }
  if (pt.flower) {
    ctx.save(); ctx.translate(pt.x, pt.y - pt.z); ctx.rotate(pt.rot);
    for (let i = 0; i < 5; i++) { ctx.rotate(Math.PI * 2 / 5); ctx.beginPath(); ctx.ellipse(pt.size * 0.55, 0, pt.size * 0.55, pt.size * 0.32, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(0, 0, pt.size * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1; return;
  }
  if (pt.confetti) { ctx.save(); ctx.translate(pt.x, pt.y - pt.z); ctx.rotate(pt.rot); ctx.scale(1, Math.abs(Math.sin(pt.rot * 2)) + 0.2); ctx.fillRect(-pt.size / 2, -pt.size / 4, pt.size, pt.size / 2); ctx.restore(); ctx.globalAlpha = 1; return; }
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
  hudText(NET ? `${p.pname} · ${names[p.ch]}` : names[p.ch], bx, top + 20, 18);
  ctx.fillStyle = '#2b1a10'; ctx.beginPath(); ctx.roundRect(bx - 2, top + 28, bw + 4, 18, 9); ctx.fill();
  const f = p.hp / p.maxHp;
  ctx.fillStyle = f > 0.5 ? '#6fd36f' : f > 0.25 ? '#ffc53d' : '#ff5a4a';
  ctx.beginPath(); ctx.roundRect(bx, top + 30, Math.max(0, bw * f), 14, 7); ctx.fill();
  hudText(`${Math.ceil(p.hp)} / ${p.maxHp}`, bx + bw / 2, top + 42, 12, '#fff', 'center');

  // score / wave (top right, below buttons)
  hudText(`${score.toLocaleString()}`, VW - 14, top + 76, 26, '#ffc53d', 'right');
  hudText(`LEVEL ${wave}`, VW - 14, top + 98, 16, '#fff4dc', 'right');
  // teammates: name, character and health (top right)
  if (NET) {
    let ty = top + 122;
    for (const q of players) {
      if (q === me) continue;
      hudText(`${q.pname} · ${names[q.ch]}`, VW - 14, ty, 13, q.dead ? '#ff8a7a' : '#bfe6ff', 'right');
      const w = 110; ctx.fillStyle = '#2b1a10'; ctx.fillRect(VW - 14 - w - 1, ty + 4, w + 2, 7);
      ctx.fillStyle = q.dead ? '#7a3a30' : '#5fd06a'; ctx.fillRect(VW - 14 - w, ty + 5, w * Math.max(0, q.hp / q.maxHp), 5);
      ty += 28;
    }
  }

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
      hudText(`${p.scraps}/${SCRAPS_NEEDED}`, x + sw / 2, y + sw - 5, 13, '#fff', 'center');
      for (let i = 0; i < SCRAPS_NEEDED; i++) { ctx.fillStyle = i < p.scraps ? '#cfd8dc' : '#2b1a10aa'; ctx.fillRect(x + 4 + i * (sw - 8) / SCRAPS_NEEDED, y + sw + 3, (sw - 8) / SCRAPS_NEEDED - 2, 5); }
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
  } else if (SP[c.special]) {
    hudSlots.push({ k: 'special', x, y, w: sw });
    const S = SP[c.special], active = p.spT > 0, ready = p.spCd <= 0 && !active;
    ctx.fillStyle = ready ? S.color : '#3b2414cc'; ctx.strokeStyle = ready ? '#fff4dc' : '#2b1a10'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x, y, sw, sw, 12); ctx.fill(); ctx.stroke();
    if (!ready && !active) { ctx.fillStyle = S.glow; const f = 1 - clamp(p.spCd / (S.cd * CD_MUL), 0, 1); ctx.fillRect(x + 3, y + sw - 3 - (sw - 6) * f, sw - 6, (sw - 6) * f); }
    const icon = IMG[S.held || S.icon || { nap: 'w_pillow', ball: 'w_ball', hug: 'w_hug', flop: 'w_wave', puppy: null, goalie: 'w_ball' }[c.special]];
    if (icon) { ctx.globalAlpha = 0.35; const iw = sw - 14, ih = Math.min(sw - 14, iw * icon.height / icon.width); ctx.drawImage(icon, x + 7, y + 6, iw, ih); ctx.globalAlpha = 1; }
    hudText(active && S.dur > 1 ? Math.ceil(p.spT) + 's' : S.label, x + sw / 2, y + sw / 2 + 2, isTouch ? 11 : 13, '#fff', 'center');
    if (!isTouch) hudText('F', x + 9, y + 15, 11, '#fff4dc', 'center');
    const tb = $('tSpecial'); if (tb) tb.style.opacity = ready ? '1' : '0.45';
  } else if (c.special === 'charge') {
    hudSlots.push({ k: 'special', x, y, w: sw });
    const ready = p.chargeCd <= 0 && p.chargeT <= 0 && p.chargeWind <= 0;
    ctx.fillStyle = ready ? '#e8742a' : '#3b2414cc'; ctx.strokeStyle = ready ? '#fff4dc' : '#2b1a10'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x, y, sw, sw, 12); ctx.fill(); ctx.stroke();
    if (!ready && p.chargeT <= 0 && p.chargeWind <= 0) { ctx.fillStyle = 'rgba(255,140,60,.55)'; const f = 1 - clamp(p.chargeCd / CHARGE_CD, 0, 1); ctx.fillRect(x + 3, y + sw - 3 - (sw - 6) * f, sw - 6, (sw - 6) * f); }
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
    const B = { charge: ['CHARGE', '#c9541acc'], taunt: ['ROAST', '#c0392bcc'], can: ['CANS', '#2f7fd6cc'], stomp: ['STOMP', '#7a5230cc'], slime: ['SLIME', '#3f9f1acc'], chili: ['CHILI', '#d63a1acc'] }[spc] || (SP[spc] && [SP[spc].label, SP[spc].color + 'cc']);
    tb.style.display = B ? 'flex' : 'none';
    if (B) { tb.textContent = B[0]; tb.style.background = B[1]; }
  }
  $('pauseBtn').style.display = state === 'play' ? 'flex' : 'none';
  for (const id of ['aimBtn', 'fireBtn']) $(id).style.display = state === 'play' || state === 'paused' ? 'flex' : 'none';
}

function buildCards() {
  $('pnameSel').value = playerName();
  const wrap = $('cards'); wrap.innerHTML = '';
  for (const k of charOrder()) {
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
  const nm = $('pnameSel').value.trim(); if (nm) setPlayerName(nm);
  bumpChar(selected);
  Sfx.unlock();
  document.activeElement && document.activeElement.blur && document.activeElement.blur();
  sticks.move = sticks.aim = null;
  newGame();
  state = 'play';
  show(null);
}

function togglePause() {
  // in multiplayer the game keeps running for everyone; this is just a menu
  if (state === 'play') { state = 'paused'; show('pause'); $('pauseTitle').textContent = NET ? 'Menu' : 'Paused'; $('quitBtn').textContent = NET ? 'Leave Game' : 'Quit'; }
  else if (state === 'paused') { state = 'play'; show(null); last = performance.now(); }
}

function toggleMute() { const m = Sfx.toggle(); $('muteBtn').textContent = m ? '🔇' : '🔊'; }

function gameOver() {
  if (state === 'over') return;
  state = 'over';
  if (NET && NET.host) { NET.room.send({ k: 'over', score, kills, wave }); window.TGNet.setStatus(NET.room.code, 'lobby'); }
  submitScore();
  const hiKey = NET ? 'tg_hi_multi' : 'tg_hi';
  const hi = store.get(hiKey, 0);
  const isHi = score > hi; if (isHi) store.set(hiKey, score);
  $('overTitle').textContent = pick(['STUFFED!', 'GOBBLED UP!', 'YOU GOT BASTED!', 'TOAST!']);
  $('overStats').innerHTML = '';
  const who = NET ? players.map(q => q.pname).join(', ') : `${playerName() || names[me.ch]} (${names[me.ch]})`;
  const lines = [`${who} made it to level ${wave}`, `Score: ${score.toLocaleString()}${isHi ? '  🏆 NEW BEST!' : ''}`, `Foes defeated: ${kills}`, `Best: ${Math.max(hi, score).toLocaleString()}`];
  // multiplayer: the host can run it back with the same crew; everyone else waits or leaves
  $('againBtn').style.display = !NET || NET.host ? '' : 'none';
  $('againBtn').textContent = NET ? 'Back to Lobby' : 'Play Again';
  $('charBtn').style.display = NET ? 'none' : '';
  $('overQuitBtn').textContent = NET ? 'Leave' : 'Quit';
  for (const l of lines) { const d = document.createElement('div'); d.textContent = l; $('overStats').appendChild(d); }
  setTimeout(() => show('over'), 250);
}

$('playBtn').addEventListener('click', () => { Sfx.unlock(); testLevel = 0; state = 'select'; buildCards(); show('select'); });
$('multiBtn').addEventListener('click', () => { Sfx.unlock(); openMulti(); });
$('scoresBtn').addEventListener('click', () => showScores('single'));
for (const b of document.querySelectorAll('#scoreTabs button')) b.addEventListener('click', () => showScores(b.dataset.mode));
$('scoresBack').addEventListener('click', () => show('title'));
$('hostBtn').addEventListener('click', hostGame);
$('joinBtn').addEventListener('click', joinGame);
$('joinCode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
$('joinCode').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') joinGame(); });
$('pnameMulti').addEventListener('keydown', e => e.stopPropagation());
$('pnameSel').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') e.target.blur(); });
$('multiBack').addEventListener('click', () => show('title'));
$('lobbyStart').addEventListener('click', hostStart);
$('lobbyLeave').addEventListener('click', quitToTitle);
$('lobbyShare').addEventListener('click', async () => {
  const url = `${location.origin}${location.pathname}?join=${NET.room.code}${new URLSearchParams(location.search).get('net') === 'local' ? '&net=local' : ''}`;
  try { if (navigator.share) await navigator.share({ title: 'Turkey Day Takedown', text: `Join my game! Code ${NET.room.code}`, url }); else { await navigator.clipboard.writeText(url); $('lobbyShare').textContent = 'Link copied!'; setTimeout(() => ($('lobbyShare').textContent = 'Share invite'), 1500); } } catch {}
});
function openMulti(code) {
  $('pnameMulti').value = playerName();
  if (code) $('joinCode').value = code;
  $('multiMsg').textContent = window.TGNet && !window.TGNet.available ? 'Multiplayer needs the online version of the game.' : window.TGNetError ? 'Online features failed to load. Try reloading the page.' : '';
  show('multi');
}
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
$('againBtn').addEventListener('click', () => {
  if (NET && NET.host) { state = 'lobby'; for (const r of NET.roster) r.ch = r.ch; show('lobby'); lobbyBroadcast(); return; }
  startGame();
});
$('charBtn').addEventListener('click', () => { state = 'select'; buildCards(); show('select'); });
$('resumeBtn').addEventListener('click', togglePause);
function quitToTitle() { leaveNet(); state = 'title'; player = null; players = []; testLevel = 0; show('title'); refreshTitle(); }
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
refreshTitle();

// ======================================================================================
// ---------- multiplayer ----------
// The host's device runs the real game (everything above). Other players send it their input
// and draw what its snapshots say, predicting their own movement so controls feel instant.
// Transport (direct WebRTC with an AWS relay fallback) lives in src/net.js as window.TGNet.
// ======================================================================================
const MAX_PLAYERS = CHAR_ORDER.length;
const r2 = v => typeof v === 'number' ? (v === Infinity ? 1e9 : Math.round(v * 100) / 100) : v;
const unInf = v => v === 1e9 ? Infinity : v;
const K = {
  pl: ['id', 'ch', 'pname', 'x', 'y', 'z', 'vx', 'vy', 'hp', 'maxHp', 'dir', 'flipX', 'frame', 'face', 'aim', 'gunAng', 'bodyAng', 'cur', 'fireCd', 'lean', 'sq', 'inv', 'dead', 'deadT', 'dashT', 'dashDir', 'chargeT', 'chargeWind', 'chargeDir', 'jumpT', 'chewT', 'breathT', 'hurtT', 'victoryT', 'lastFire', 'flash', 'speech', 'macT', 'wetT', 'spT', 'spinA', 'away'],
  mine: ['ammo', 'bombs', 'scraps', 'canCd', 'chargeCd', 'chiliCd', 'roastCd', 'slimeCd', 'stompCd', 'stompWind', 'dashCd', 'bombCd', 'spCd'],
  en: ['id', 'type', 'x', 'y', 'z', 'vx', 'vy', 'hp', 'maxHp', 'dir', 'flipX', 'frame', 'act', 'face', 'sq', 'lean', 'flash', 'spawnT', 'spawnMax', 'leap', 'st', 'seed', 'sulkT', 'hypeT', 'downT', 'downMax', 'meltT', 'burnT', 'stuckT', 'cheese', 'fvx', 'danceT', 'sleepT', 'brawlT', 'rainbowT', 'pickT', 'signI', 'paintT', 'artI', 'paintC', 'held', 'thrownT'],
  bu: ['w', 'x', 'y', 'z', 'vx', 'vy', 'r', 'rot', 'seed', 'life', 'max'],
  eb: ['kind', 'x', 'y', 'z', 'vx', 'vy', 'r', 'rot', 'life'],
  pk: ['kind', 'x', 'y', 'z', 't', 'life', 'weapon', 'perch'],
  bo: ['x', 'y', 'z', 'vx', 'vy', 'vz', 'g', 'rot'],
  ro: ['text', 'x', 'y', 'z', 'vx', 'vy', 'rot', 'wob', 'delay', 'life', 'max'],
  ca: ['kind', 'x', 'y', 'z', 'vx', 'vy', 'vz', 'rot', 'delay'],
  ac: ['x', 'y', 'r', 'life', 'seed'],
  fl: ['x', 'y', 'z', 'vx', 'vy', 'size', 'life', 'max'],
  we: ['x', 'y', 'r', 'life', 'max', 'seed'],
  pu: ['x', 'y', 'r', 'life', 'max', 'seed'],
  gz: ['id', 'kind', 'x', 'y', 'z', 'vx', 'vy', 'vz', 'a', 'r', 'life', 'max', 'f'],
};
const pack = (arr, keys) => arr.map(o => keys.map(k => r2(o[k])));
const unpack = (rows, keys) => (rows || []).map(v => { const o = {}; keys.forEach((k, i) => (o[k] = unInf(v[i]))); return o; });

// events that clients replay themselves (floating text, sounds, death bursts, corpses, shakes)
function netEvent(type, data, only) {
  if (!NET || !NET.host) return;
  for (const [id, q] of NET.evq) if (!only || only === id) { q.push([type, data]); if (q.length > 400) q.splice(0, q.length - 400); }
}
function netFx(p, kind) { if (NET && NET.host && p.id) netEvent('x', kind, p.id); }
// record every sound the host plays so clients hear the same things
const SfxRaw = {};
for (const k of Object.keys(Sfx)) {
  const desc = Object.getOwnPropertyDescriptor(Sfx, k);
  if (!desc || typeof desc.value !== 'function' || ['unlock', 'toggle'].includes(k)) continue;
  const f = desc.value; SfxRaw[k] = f;
  Sfx[k] = (...a) => { netEvent('s', [k, ...a]); return f(...a); };
}
const playSfx = (k, a) => { const f = SfxRaw[k]; if (f) f(...a); };

// ---------- host side ----------
function takeRemoteInput(pl) {
  const box = NET && NET.inputs.get(pl.id);
  if (!box) return blankInput();
  const I = { ...box.cur, ...box.once };
  box.once = { dash: false, special: false, bomb: false, swap: 0, weapon: null };
  return I;
}
function hostOnInput(from, I) {
  let box = NET.inputs.get(from);
  if (!box) NET.inputs.set(from, box = { cur: blankInput(), once: { dash: false, special: false, bomb: false, swap: 0, weapon: null } });
  box.cur = { mx: I.mx || 0, my: I.my || 0, a: I.a || 0, fire: !!I.fire, aiming: !!I.aiming, tid: I.tid || 0, bx: I.bx ?? null, by: I.by ?? null };
  if (I.dash) box.once.dash = true;
  if (I.special) box.once.special = true;
  if (I.bomb) box.once.bomb = true;
  if (I.swap) box.once.swap = I.swap;
  if (I.weapon) box.once.weapon = I.weapon;
}
function buildBase() {
  return {
    t: r2(time), wave, ws: waveState, score, kills, boss: boss ? boss.id : 0, banner: banner ? { text: banner.text, sub: banner.sub, t: r2(banner.t) } : null,
    pl: pack(players, K.pl), en: pack(enemies, K.en), bu: pack(bullets, K.bu), eb: pack(ebullets, K.eb), pk: pack(pickups, K.pk), bo: pack(bombs, K.bo),
    ro: pack(roasts, K.ro), ca: pack(cans, K.ca), ac: pack(acids, K.ac), fl: pack(flames.slice(-120), K.fl), we: pack(webs, K.we), pu: pack(puddles, K.pu), gz: pack(gizmos, K.gz),
  };
}
function netHostTick(dt) {
  if (!NET || !NET.host || (state !== 'play' && state !== 'paused')) return;
  let base = null;
  for (const id of NET.room.peerIds()) {
    const relay = NET.room.isRelay(id), every = relay ? 1 / 8 : 1 / 20;
    let last = NET.lastSent.get(id) ?? -1; if (last > time) last = -1;
    if (time - last < every) continue;
    NET.lastSent.set(id, time);
    base = base || buildBase();
    const pl = players.find(q => q.id === id);
    const ev = NET.evq.get(id) || [];
    NET.evq.set(id, []);
    const msg = { k: 'snap', b: base, me: pl ? K.mine.map(k => r2(pl[k] && typeof pl[k] === 'object' ? { ...pl[k], gravy: 1e9 } : pl[k])) : null, ev };
    NET.room.send(msg, id, true);
  }
  // new corpses go out as events once
  for (const c of corpses) if (c._net) { c._net = false; netEvent('c', [c.name, c.row, c.frame, c.h, r2(c.x), r2(c.y), r2(c.z), r2(c.vx), r2(c.vy), r2(c.vz), r2(c.vrot), c.flip, c.life, c.mass, c.r]); }
}

// ---------- client side ----------
function clientApply(msg) {
  const b = msg.b; if (!b) return;
  NET.lastSnap = performance.now();
  wave = b.wave; waveState = b.ws; score = b.score; kills = b.kills;
  banner = b.banner;
  // players: others are smoothed toward the host; my own body is predicted locally and corrected
  const seen = new Set();
  for (const o of unpack(b.pl, K.pl)) {
    seen.add(o.id);
    let q = players.find(x => x.id === o.id);
    if (!q) { q = makePlayer(o.ch, o.id, o.pname, 0, 1); players.push(q); }
    if (q === me) {
      const keep = ['x', 'y', 'vx', 'vy', 'dir', 'flipX', 'frame', 'face', 'aim', 'gunAng', 'bodyAng', 'lean', 'sq', 'lastFire', 'wetT'];
      for (const k of K.pl) if (!keep.includes(k)) q[k] = o[k];
      q.hx = o.x; q.hy = o.y; q.hz = o.z;
      // the host is doing something that moves me (dash, charge, jump, knocked back, down) -> follow it closely
      q.follow = o.dashT > 0 || o.chargeT > 0 || o.chargeWind > 0 || o.jumpT > 0 || o.dead || o.hurtT > 0;
      if (o.lastFire < 0.1) q.lastFire = o.lastFire;
    } else {
      for (const k of K.pl) if (k !== 'x' && k !== 'y') q[k] = o[k];
      q.hx = o.x; q.hy = o.y;
      if (q.x === undefined || Math.hypot(q.x - o.x, q.y - o.y) > 300) { q.x = o.x; q.y = o.y; }
    }
  }
  players = players.filter(q => seen.has(q.id));
  if (msg.me && me) K.mine.forEach((k, i) => { let v = msg.me[i]; if (k === 'ammo' && v) v = { ...v, gravy: Infinity }; me[k] = v; });
  // enemies by id, smoothed
  const byId = new Map(enemies.map(e => [e.id, e]));
  const next = [];
  for (const o of unpack(b.en, K.en)) {
    let e = byId.get(o.id);
    const d = ENEMIES[o.type];
    if (!e) { e = { ...o, d, r: d.r, h: d.h, mass: d.mass || 1, t: rand(0, 3), stride: 0, lastFrame: 0, leanV: 0, sqV: 0 }; }
    else for (const k of K.en) if (k !== 'x' && k !== 'y' && k !== 'z') e[k] = o[k];
    e.hx = o.x; e.hy = o.y; e.hz = o.z;
    if (e.x === undefined || Math.hypot(e.x - o.x, e.y - o.y) > 250) { e.x = o.x; e.y = o.y; e.z = o.z; }
    next.push(e);
  }
  enemies = next;
  boss = b.boss ? enemies.find(e => e.id === b.boss) || null : null;
  bullets = unpack(b.bu, K.bu); ebullets = unpack(b.eb, K.eb); pickups = unpack(b.pk, K.pk); bombs = unpack(b.bo, K.bo);
  roasts = unpack(b.ro, K.ro); cans = unpack(b.ca, K.ca); acids = unpack(b.ac, K.ac); flames = unpack(b.fl, K.fl); webs = unpack(b.we, K.we); puddles = unpack(b.pu, K.pu); gizmos = unpack(b.gz, K.gz);
  for (const [type, d] of msg.ev || []) {
    if (type === 'f') floaters.push({ x: d[0], y: d[1], text: d[2], color: d[3], life: d[4], max: d[4], size: d[5] });
    else if (type === 's') playSfx(d[0], d.slice(1));
    else if (type === 'k') { if (d[4] === 1) confettiBurst(d[0], d[1], d[2]); else { if (d[4] === 2) artShatter(d[0], d[1], d[2]); deathBurst(d[0], d[1], d[2], d[3]); } }
    else if (type === 'a') artShatter(d[0], d[1], d[2]);
    else if (type === 'c') corpses.push({ name: d[0], row: d[1], frame: d[2], h: d[3], x: d[4], y: d[5], z: d[6], vx: d[7], vy: d[8], vz: d[9], rot: 0, vrot: d[10], flip: d[11], life: d[12], max: d[12], mass: d[13], r: d[14] });
    else if (type === 'x') { if (d === 'hurt') { shake = Math.max(shake, 10); SfxRaw.hurt(); } if (d === 'down') { shake = 18; SfxRaw.over(); } }
  }
}
// my own movement, predicted (same physics as updatePlayer's normal walking) so it responds instantly
function predictMe(dt, I) {
  const p = me;
  if (p.dead || p.follow) {
    p.x = lerp(p.x, p.hx ?? p.x, 1 - Math.exp(-dt * 18)); p.y = lerp(p.y, p.hy ?? p.y, 1 - Math.exp(-dt * 18));
  } else {
    const sp = p.speed * (inPond(p.x, p.y) ? 0.6 : 1), tvx = I.mx * sp, tvy = I.my * sp;
    let dvx = tvx - p.vx, dvy = tvy - p.vy; const dl = Math.hypot(dvx, dvy), a = 2300 * dt;
    if (dl > a) { dvx *= a / dl; dvy *= a / dl; }
    p.vx += dvx; p.vy += dvy;
    p.x += p.vx * dt; p.y += p.vy * dt;
    collideProps(p);
    p.x = clamp(p.x, p.r + 10, ARENA.w - p.r - 10); p.y = clamp(p.y, p.r + 30, ARENA.h - p.r - 10);
    // stay honest: drift toward where the host says I am, snapping if way off
    if (p.hx != null) { const ex = p.hx - p.x, ey = p.hy - p.y, ed = Math.hypot(ex, ey); if (ed > 160) { p.x = p.hx; p.y = p.hy; } else if (ed > 30) { p.x += ex * Math.min(1, dt * 3); p.y += ey * Math.min(1, dt * 3); } }
  }
  p.moving = Math.hypot(I.mx, I.my) > 0.1;
  p.aim = I.a;
  const spd = Math.hypot(p.vx, p.vy), aiming = p.lastFire < 0.7 || I.aiming || I.fire;
  if (I.fire) p.lastFire = 0; else p.lastFire += dt;
  const want = aiming ? p.aim : spd > 40 ? Math.atan2(p.vy, p.vx) : p.bodyAng;
  p.bodyAng = angLerp(p.bodyAng, want, 1 - Math.exp(-dt * (aiming ? 22 : 12)));
  p.gunAng = angLerp(p.gunAng, aiming ? p.aim : p.bodyAng + (Math.cos(p.bodyAng) >= 0 ? 0.35 : -0.35), 1 - Math.exp(-dt * 25));
  p.face = Math.cos(p.bodyAng) >= 0 ? 1 : -1;
  facing(p, Math.cos(p.bodyAng), Math.sin(p.bodyAng), dt);
  const strideLen = p.h * 0.27;
  p.stride += spd * dt;
  if (spd > 25) p.frame = Math.floor(p.stride / strideLen) % 4;
  else if (p.frame % 2 === 0) p.frame = (p.frame + 1) % 4;
  if (p.frame !== p.lastFrame) { if (spd > 60 && p.frame % 2 === 0) { if (!inPond(p.x, p.y)) footstep(p.x, p.y, spd / sp0(p)); addFootprint(p, spd / sp0(p)); } p.lastFrame = p.frame; }
}
const sp0 = p => p.speed || 250;
function clientUpdate(dt) {
  time += dt;
  // send my input ~30x a second (one-shot buttons go on the reliable channel so they're never lost)
  player = me;
  const I = localInput();
  const o = NET.out;
  Object.assign(o.cur, { mx: I.mx, my: I.my, a: r2(I.a), fire: I.fire, aiming: I.aiming, tid: I.tid, bx: I.bx == null ? null : Math.round(I.bx), by: I.by == null ? null : Math.round(I.by) });
  for (const k of ['dash', 'special', 'bomb']) if (I[k]) o.once[k] = true;
  if (I.swap) o.once.swap = I.swap; if (I.weapon) o.once.weapon = I.weapon;
  o.t -= dt;
  const hasOnce = o.once.dash || o.once.special || o.once.bomb || o.once.swap || o.once.weapon;
  if (o.t <= 0 || hasOnce) {
    o.t = NET.room.isRelay(NET.room.hostId) ? 1 / 12 : 1 / 30;
    NET.room.send({ k: 'in', i: { ...o.cur, ...o.once } }, NET.room.hostId, !hasOnce);
    o.once = { dash: false, special: false, bomb: false, swap: 0, weapon: null };
  }
  if (me) predictMe(dt, I);
  // everyone else glides toward their latest snapshot position; shots keep flying between snapshots
  const k = 1 - Math.exp(-dt * 14);
  for (const q of players) if (q !== me && q.hx != null) { q.x = lerp(q.x, q.hx, k); q.y = lerp(q.y, q.hy, k); q.stride = (q.stride || 0) + Math.hypot(q.vx, q.vy) * dt; }
  for (const e of enemies) { if (e.hx != null) { const kk = e.held || e.thrownT > 0 ? 1 : k; e.x = lerp(e.x, e.hx, kk); e.y = lerp(e.y, e.hy, kk); e.z = lerp(e.z, e.hz, kk); } e.t = (e.t || 0) + dt; }
  for (const b of bullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.rot += dt * 18; }
  for (const b of ebullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
  for (const b of bombs) { b.x += b.vx * dt; b.y += b.vy * dt; b.vz -= (b.g || 0) * dt; b.z = Math.max(0, b.z + b.vz * dt); }
  for (const it of pickups) it.t += dt;
  for (const g of gizmos) { g.a += dt; if (g.kind === 'ball' || g.kind === 'pup' || g.kind === 'paint') { g.x += (g.vx || 0) * dt; g.y += (g.vy || 0) * dt; } if (g.kind === 'wave') { g.life -= dt; g.r = 40 + (1 - g.life / g.max) * 200; } if (g.kind === 'vibes' || g.kind === 'gwave') g.life -= dt; }
  // purely cosmetic systems run locally
  updateFire(dt);
  if (yardSpr) updateYard(dt);
  for (const pt of particles) {
    pt.life -= dt; if (pt.ring || pt.ghost) continue;
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vz -= (pt.grav || 0) * dt; pt.z += pt.vz * dt;
    if (pt.feather) { pt.vx *= Math.exp(-dt * 2); pt.vy *= Math.exp(-dt * 2); pt.vz = Math.max(pt.vz, -50); pt.rot += dt * 3; }
    if (pt.z < 0 && !pt.smoke) { pt.z = 0; pt.vz *= -0.3; pt.vx *= 0.6; pt.vy *= 0.6; }
  }
  particles = particles.filter(pt => pt.life > 0);
  for (const f of floaters) { f.life -= dt; f.y -= dt * 40; }
  floaters = floaters.filter(f => f.life > 0);
  updateCorpses(dt);
  updateCamera(dt, isTouch && !mouse.active ? 0 : 1);
  shake = Math.max(0, shake - dt * 40);
  // the host went quiet: keep trying for a while (they may have locked their phone) before giving up
  if (state === 'play' && performance.now() - NET.lastSnap > 50000) netLost('Lost connection to the host.');
}

// ---------- lobby ----------
function playerName() { return (store.get('tg_pname', '') || '').trim(); }
function setPlayerName(v) { store.set('tg_pname', String(v || '').trim().slice(0, 14)); }
function lobbyBroadcast() {
  if (!NET || !NET.host) return;
  const msg = { k: 'lobby', code: NET.room.code, roster: NET.roster.filter(r => !r.away || Date.now() - r.away < 44000), hostId: NET.room.id, inGame: inNetGame() };
  NET.room.send(msg);
  renderLobby();
}
function netAttach(room) {
  NET = { room, host: room.isHost, roster: [], inputs: new Map(), evq: new Map(), lastSent: new Map(), out: { cur: blankInput(), once: { dash: false, special: false, bomb: false, swap: 0, weapon: null }, t: 0 }, lastSnap: performance.now(), sendT: 0 };
  if (room.isHost) {
    NET.roster = [{ id: room.id, name: room.name, ch: null }];
    room.onJoin((id, info) => {
      const old = NET.roster.find(x => x.id === id);
      NET.evq.set(id, []); NET.lastSent.delete(id);
      if (old) {
        // the same player coming back after a hiccup: pick up right where they were
        old.away = 0;
        const q = players && players.find(x => x.id === id); if (q) { q.away = false; q.inv = Math.max(q.inv, 1.5); }
        setTimeout(() => { if (inNetGame() && old.ch) sendStart(id); else lobbyBroadcast(); }, 400);
        return;
      }
      if (NET.roster.length >= MAX_PLAYERS) { room.send({ k: 'reject', why: 'That game is full.' }, id); return; }
      NET.roster.push({ id, name: String(info.name || 'Player').slice(0, 14), ch: null });
      window.TGNet.setStatus(room.code, inNetGame() ? 'playing' : 'lobby', NET.roster.length);
      setTimeout(lobbyBroadcast, 300); // (mid-game joiners get the lobby too, to pick a character)
    });
    room.onLeave(id => {
      // give them a while to come back (phone locked, switched apps, network blip) before freeing their spot
      const r = NET.roster.find(x => x.id === id); if (!r) return;
      r.away = Date.now();
      const q = players && players.find(x => x.id === id); if (q) { q.away = true; q.inv = 999; }
      if (state === 'lobby') lobbyBroadcast();
      setTimeout(() => {
        if (!NET || !r.away || Date.now() - r.away < 44000) return;
        NET.roster = NET.roster.filter(x => x !== r); NET.evq.delete(id); NET.inputs.delete(id);
        if (state === 'lobby') lobbyBroadcast();
        else if (players) { const pl = players.find(x => x.id === id); if (pl) { floatText(pl.x, pl.y - 120, `${pl.pname} left`, '#fff4dc', 2, 20); players = players.filter(x => x !== pl); } lobbyBroadcast(); }
      }, 45000);
    });
  } else {
    room.onLeave(id => { if (id === room.hostId) netLost('The host left the game.'); });
  }
  room.on((msg, from) => netMessage(msg, from));
}
const inNetGame = () => state === 'play' || state === 'paused' || state === 'over';
// bring a player into the running game (late joiner, or someone reconnecting)
function sendStart(id) { NET.room.send({ k: 'start', roster: NET.roster.filter(r => r.ch), level: wave }, id); }
function hostAddLate(r) {
  if (!players.find(q => q.id === r.id)) {
    const buddy = players.find(q => !q.dead) || players[0];
    const q = makePlayer(r.ch, r.id, r.name, 0, 1);
    if (buddy) { q.x = clamp(buddy.x + rand(-90, 90), 80, ARENA.w - 80); q.y = clamp(buddy.y + rand(40, 90), 100, ARENA.h - 80); }
    q.inv = 2.5; players.push(q);
    floatText(q.x, q.y - 120, `${r.name} joined!`, '#7dff8a', 2, 22); Sfx.pickup();
  }
  NET.evq.set(r.id, []);
  sendStart(r.id);
}
function netMessage(msg, from) {
  if (!NET) return;
  if (NET.host) {
    if (msg.k === 'in' && state !== 'lobby') hostOnInput(from, msg.i);
    else if (msg.k === 'pick' && state === 'lobby') { lobbyPick(from, msg.ch); }
    else if (msg.k === 'pick' && inNetGame()) { // joining a game in progress
      const r = NET.roster.find(x => x.id === from);
      if (r && !r.ch && lobbyPick(from, msg.ch)) hostAddLate(r);
    }
    else if (msg.k === 'hi') lobbyBroadcast();
    return;
  }
  if (from !== NET.room.hostId) return;
  if (msg.k === 'lobby') {
    NET.roster = msg.roster; NET.room.code = msg.code; NET.inGame = msg.inGame;
    const mine = msg.roster.find(r => r.id === NET.room.id);
    // mid-game: only someone still choosing sits in the lobby; everyone playing just keeps the roster
    if (state !== 'lobby' && state !== 'play' && state !== 'paused' && !(msg.inGame && mine && mine.ch)) { state = 'lobby'; show('lobby'); }
    renderLobby();
  }
  else if (msg.k === 'reject') netLost(msg.why);
  else if (msg.k === 'start') { NET.roster = msg.roster; beginNetGame(msg.level); }
  else if (msg.k === 'snap' && (state === 'play' || state === 'paused')) clientApply(msg);
  else if (msg.k === 'over') { score = msg.score; kills = msg.kills; wave = msg.wave; gameOver(); }
}
function lobbyPick(id, ch) {
  if (!CHARS[ch]) return;
  const r = NET.roster.find(x => x.id === id); if (!r) return;
  if (NET.roster.some(x => x.ch === ch && x.id !== id)) return false; // each character only once
  r.ch = ch; lobbyBroadcast(); return true;
}
function renderLobby() {
  if (!NET) return;
  $('lobbyCode').textContent = NET.room.code;
  const myId = NET.room.id, list = $('lobbyList'); list.innerHTML = '';
  for (const r of NET.roster) {
    const li = document.createElement('div'); li.className = 'lp' + (r.id === myId ? ' me' : '');
    li.innerHTML = `<span class="pn"></span><span class="pc"></span>`;
    li.querySelector('.pn').textContent = (r.id === (NET.host ? myId : NET.room.hostId) ? '👑 ' : '') + r.name + (r.id === myId ? ' (you)' : '');
    li.querySelector('.pc').textContent = r.ch ? CHARS[r.ch].name : 'choosing…';
    list.appendChild(li);
  }
  const wrap = $('lobbyCards'); wrap.innerHTML = '';
  for (const k of charOrder()) {
    const owner = NET.roster.find(x => x.ch === k), mine = owner && owner.id === myId;
    const el = document.createElement('div'); el.className = 'lcard' + (mine ? ' sel' : owner ? ' taken' : '');
    el.innerHTML = `<img src="assets/${k}.png" alt=""><div class="cn"></div><div class="by"></div>`;
    el.querySelector('.cn').textContent = CHARS[k].name;
    el.querySelector('.by').textContent = owner ? (mine ? 'You' : owner.name) : CHARS[k].role;
    if (!owner || mine) el.addEventListener('click', () => { if (NET.host) lobbyPick(myId, k); else NET.room.send({ k: 'pick', ch: k }, NET.room.hostId); });
    wrap.appendChild(el);
  }
  const ready = NET.roster.length >= 1 && NET.roster.every(r => r.ch);
  $('lobbyStart').style.display = NET.host ? '' : 'none';
  $('lobbyStart').disabled = !ready;
  $('lobbyMsg').textContent = NET.host
    ? (NET.roster.length < 2 ? 'Share the code — waiting for players to join…' : ready ? `${NET.roster.length} players ready!` : 'Waiting for everyone to pick a character…')
    : NET.inGame ? 'A game is already going. Pick a character to jump right in!' : 'Pick a character. The host starts the game.';
  $('lobbyLinks').textContent = NET.room.linkInfo().filter(l => !l.direct).length ? 'Some players are connected through the relay (a little more lag).' : '';
}
function beginNetGame(level) {
  testLevel = level || 0;
  const mine = NET.roster.find(r => r.id === NET.room.id); if (mine) bumpChar(mine.ch);
  const roster = NET.roster.map(r => ({ id: r.id, name: r.name, ch: r.ch }));
  Sfx.unlock();
  sticks.move = sticks.aim = null;
  newGame(roster, NET.room.id);
  NET.lastSnap = performance.now();
  state = 'play'; show(null);
}
function hostStart() {
  if (!NET || !NET.host || !NET.roster.every(r => r.ch)) return;
  NET.overSent = false;
  for (const r of NET.roster) if (r.id !== NET.room.id) NET.evq.set(r.id, []);
  NET.room.send({ k: 'start', roster: NET.roster, level: 0 });
  window.TGNet.setStatus(NET.room.code, 'playing', NET.roster.length);
  beginNetGame(0);
}
function netLost(why) {
  if (!NET) return;
  const room = NET.room; NET = null;
  try { room.close(); } catch {}
  state = 'title'; player = null; players = [];
  show('multi'); $('multiMsg').textContent = why || '';
}
function leaveNet() {
  if (!NET) return;
  const room = NET.room;
  if (NET.host) window.TGNet.setStatus(room.code, 'ended');
  NET = null; try { room.close(); } catch {}
}
// the online code loads in the background; wait for it (a slow phone may still be fetching it)
async function onlineNet() {
  if (window.TGNet) return window.TGNet;
  if (window.TGNetError) throw new Error('Online features failed to load: ' + window.TGNetError + '. Try reloading the page.');
  if (!window.TGNetLoad) throw new Error('Online features failed to load. Try reloading the page.');
  $('multiMsg').textContent = 'Loading online features…';
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('Still loading online features. Check your connection and try again.')), 60000));
  return Promise.race([window.TGNetLoad, timeout]);
}
let netBusy = false;
async function hostGame() {
  if (netBusy || NET) return;
  netBusy = true; try { await hostGameInner(); } finally { netBusy = false; }
}
async function hostGameInner() {
  const name = $('pnameMulti').value.trim(); if (!name) { $('multiMsg').textContent = 'Enter your name first.'; $('pnameMulti').focus(); return; }
  setPlayerName(name);
  $('multiMsg').textContent = 'Creating a game…';
  try {
    const TGNet = await onlineNet();
    $('multiMsg').textContent = 'Creating a game…';
    const room = await TGNet.createGame(name);
    netAttach(room); state = 'lobby'; show('lobby'); renderLobby(); $('multiMsg').textContent = '';
  } catch (e) { $('multiMsg').textContent = e.message || String(e); }
}
async function joinGame() {
  if (netBusy || NET) return;
  netBusy = true; try { await joinGameInner(); } finally { netBusy = false; }
}
async function joinGameInner() {
  const name = $('pnameMulti').value.trim(); if (!name) { $('multiMsg').textContent = 'Enter your name first.'; $('pnameMulti').focus(); return; }
  setPlayerName(name);
  const code = $('joinCode').value;
  $('multiMsg').textContent = 'Joining…';
  try {
    const TGNet = await onlineNet();
    $('multiMsg').textContent = 'Joining…';
    const room = await TGNet.joinGame(code, name);
    netAttach(room);
    // wait for the host to let us in
    const t0 = performance.now();
    const wait = setInterval(() => {
      if (!NET || NET.room !== room) return clearInterval(wait);
      if (state === 'lobby') { clearInterval(wait); $('multiMsg').textContent = ''; return; }
      if (performance.now() - t0 > 25000) { clearInterval(wait); netLost("Couldn't reach the host. Check the code and try again."); }
    }, 300);
  } catch (e) { $('multiMsg').textContent = e.message || String(e); }
}

// ---------- high scores ----------
function submitScore() {
  if (testLevel && !NET) return; // test mode runs don't count
  if (NET && !NET.host) return;  // the host posts the team's score
  if (score <= 0) return;
  const list = players.map(q => `${q.pname || 'Player'} (${CHARS[q.ch].name})`).join(', ');
  window.TGNet && window.TGNet.submitScore({ mode: NET ? 'multi' : 'single', score: Math.round(score), names: list, level: wave, kills, players: players.length });
}
async function showScores(mode) {
  show('scores');
  for (const b of document.querySelectorAll('#scoreTabs button')) b.classList.toggle('on', b.dataset.mode === mode);
  const box = $('scoreList'); box.innerHTML = '<div class="hint">Loading…</div>';
  try {
    const TGNet = await onlineNet();
    if (!TGNet.available) { box.innerHTML = '<div class="hint">High scores need the online version of the game.</div>'; return; }
    const rows = await TGNet.topScores(mode, 15);
    box.innerHTML = rows.length ? '' : '<div class="hint">No scores yet. Be the first!</div>';
    rows.forEach((r, i) => {
      const d = document.createElement('div'); d.className = 'srow';
      d.innerHTML = `<span class="rk">${i + 1}</span><span class="nm"></span><span class="lv"></span><span class="sc"></span>`;
      d.querySelector('.nm').textContent = r.names;
      d.querySelector('.lv').textContent = `Lvl ${r.level || 1}`;
      d.querySelector('.sc').textContent = Number(r.score).toLocaleString();
      box.appendChild(d);
    });
  } catch (e) { box.innerHTML = '<div class="hint">Could not load scores right now.</div>'; }
}

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  const gap = now - last;
  let dt = Math.min(0.05, gap / 1000); last = now;
  if (NET && gap > 1500) NET.lastSnap = performance.now(); // we were asleep in the background; that's not the host's fault
  if (NET && !NET.host && (state === 'play' || state === 'paused')) clientUpdate(dt);
  else if (state === 'play' || state === 'over' || (NET && state === 'paused')) {
    if (state === 'play' || state === 'paused') { update(dt); netHostTick(dt); }
    else { // keep particles alive under the game over screen
      time += dt; if (!(NET && !NET.host)) updateMisc(dt);
    }
  }
  render();
  // waiting on the host: say so instead of looking frozen
  if (NET && !NET.host && (state === 'play' || state === 'paused') && performance.now() - NET.lastSnap > 2500) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = 'rgba(20,10,5,.55)'; ctx.fillRect(0, VH / 2 - 34, VW, 68);
    hudText('Reconnecting to the host…', VW / 2, VH / 2 + 8, 22, '#ffd84a', 'center');
  }
  requestAnimationFrame(frame);
}
// opened from an invite link (?join=CODE)
{
  const jc = new URLSearchParams(location.search).get('join');
  if (jc) { const go = () => openMulti(jc.toUpperCase()); if (window.TGNet) go(); else window.addEventListener('tgnet-ready', go, { once: true }); }
}

if (new URLSearchParams(location.search).has('debug')) window.__tg = { fp: () => prints.length, pk: () => pickups.filter(it => it.kind === 'medkit').map(it => ({ x: Math.round(it.x), y: Math.round(it.y), z: it.z })), fn: { assembleMac: () => assembleMac(), spawn: (t, x, y) => spawnEnemy(t, x, y), drop: (x, y, k) => dropPickup(x, y, k), igniteAll: () => enemies.forEach(e => igniteEnemy(e, 6)), fire: () => [fireParts.length, Math.round(Math.max(0, ...fireParts.map(p => p.z)))] }, get s() { return { state, wave, score, kills, player: me, players, NET, cam, ZOOM, enemies: enemies && enemies.map(e => [e.type, Math.round(e.x), Math.round(e.y), e.spawnT, Math.round(e.hp), +(e.sulkT || 0).toFixed(1), +(e.hypeT || 0).toFixed(1), +(e.downT || 0).toFixed(1), +(e.meltT || 0).toFixed(1), +(e.burnT || 0).toFixed(1)]), bullets: bullets && bullets.length }; } };
loadAssets().then(() => { buildFloor(); requestAnimationFrame(frame); });
})();
