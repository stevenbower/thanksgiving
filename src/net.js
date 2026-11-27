// Multiplayer + high-score backend for Turkey Day Takedown.
//
// Topology: a star around the host. The host's device runs the whole game; each other player
// streams their inputs to it and gets snapshots back. Devices first try a direct WebRTC data
// channel (fast, free); if that can't connect (strict NATs, some cellular networks) the pair
// falls back to relaying through the AppSync real-time channel.
//
// The same AppSync channel carries lobby discovery and WebRTC signalling. With ?net=local the
// channel is a BroadcastChannel and games live in localStorage, so several tabs on one machine
// can play together with no backend at all (used for development and tests).

const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
const DIRECT_TIMEOUT = 7000;
const DROP_AFTER = 30000;   // no word from a peer for this long -> they're gone
// one id per browser tab that survives reloads and reconnects, so a player can never show up twice
const tabId = () => { try { let v = sessionStorage.getItem('tg_cid'); if (!v) { v = uid(); sessionStorage.setItem('tg_cid', v); } return v; } catch { return uid(); } };
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// ---------- backends ----------
function localBackend() {
  const KEY = 'tg_local_games';
  const games = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  const save = g => localStorage.setItem(KEY, JSON.stringify(g));
  return {
    kind: 'local',
    async createGame(code, rec) { const g = games(); if (g[code]) return false; g[code] = rec; save(g); return true; },
    async getGame(code) { return games()[code] || null; },
    async updateGame(code, patch) { const g = games(); if (g[code]) { Object.assign(g[code], patch); save(g); } },
    channel(code, onMsg) {
      const bc = new BroadcastChannel('tg-' + code);
      bc.onmessage = ev => onMsg(ev.data);
      return { publish: async m => bc.postMessage(m), close: () => bc.close(), ready: Promise.resolve() };
    },
    async submitScore(s) { const k = 'tg_local_scores'; const a = JSON.parse(localStorage.getItem(k) || '[]'); a.push({ ...s, createdAt: new Date().toISOString() }); localStorage.setItem(k, JSON.stringify(a)); },
    async topScores(mode, limit) { const a = JSON.parse(localStorage.getItem('tg_local_scores') || '[]'); return a.filter(s => s.mode === mode).sort((x, y) => y.score - x.score).slice(0, limit); },
  };
}

function amplifyBackend(client) {
  return {
    kind: 'aws',
    async createGame(code, rec) {
      const { data, errors } = await client.models.Game.create({ code, ...rec });
      if (errors && errors.length) { if (/conditional/i.test(JSON.stringify(errors))) return false; throw new Error(errors[0].message); }
      return !!data;
    },
    async getGame(code) { const { data } = await client.models.Game.get({ code }); return data || null; },
    async updateGame(code, patch) { await client.models.Game.update({ code, ...patch }); },
    channel(code, onMsg) {
      let resolveReady; const ready = new Promise(r => (resolveReady = r));
      let sub = null, closed = false;
      // (re)subscribe; if the socket drops (network change, phone sleeping) come right back
      const connect = () => {
        if (closed) return;
        sub = client.subscriptions.receive({ code }, { authMode: 'apiKey' }).subscribe({
          next: m => onMsg({ from: m.from, to: m.to, kind: m.kind, data: m.data ? JSON.parse(m.data) : null }),
          error: e => { console.warn('channel error, reconnecting', e); setTimeout(connect, 1500); },
        });
      };
      connect();
      // AppSync needs a moment after subscribing before it delivers; give it a beat
      setTimeout(resolveReady, 1200);
      return {
        ready,
        publish: m => client.mutations.publish({ code, from: m.from, to: m.to || null, kind: m.kind, data: m.data == null ? null : JSON.stringify(m.data) }, { authMode: 'apiKey' }).catch(e => console.warn('publish failed', e)),
        close: () => { closed = true; try { sub && sub.unsubscribe(); } catch {} },
      };
    },
    async submitScore(s) { await client.models.Score.create(s); },
    async topScores(mode, limit) {
      const { data } = await client.models.Score.scoresByMode({ mode }, { sortDirection: 'DESC', limit });
      return data || [];
    },
  };
}

// ---------- a room: the connection between this device and the others in one game ----------
class Room {
  constructor(backend, code, isHost, name) {
    this.backend = backend; this.code = code; this.isHost = isHost; this.name = name;
    this.id = tabId(); this.hostId = isHost ? this.id : null;
    this.peers = new Map(); // id -> { pc, r, u, relay, open, lastSeen }
    this.handlers = []; this.leaveHandlers = []; this.joinHandlers = [];
    this.forceRelay = new URLSearchParams(location.search).has('relay');
    this.closed = false;
    this.chan = backend.channel(code, m => this._onChan(m));
    this.lastBeat = Date.now();
    this.heart = setInterval(() => this._heartbeat(), 2000);
    // back from the lock screen / another app: don't count the time away against anyone, and say hi
    this.onVis = () => { if (document.visibilityState === 'visible') this._resume(); };
    document.addEventListener('visibilitychange', this.onVis);
  }
  on(fn) { this.handlers.push(fn); }
  onLeave(fn) { this.leaveHandlers.push(fn); }
  onJoin(fn) { this.joinHandlers.push(fn); }
  peerIds() { return [...this.peers.keys()]; }
  isRelay(id) { const p = this.peers.get(id); return !p || !p.open || p.relay; }
  linkInfo() { return [...this.peers.entries()].map(([id, p]) => ({ id, direct: p.open && !p.relay })); }

  // send a game message to one peer (or everyone when to is null). unreliable=true for snapshots/inputs.
  send(msg, to = null, unreliable = false) {
    const targets = to ? [to] : this.peerIds();
    for (const id of targets) {
      const p = this.peers.get(id);
      if (!p) continue;
      const dc = unreliable ? p.u : p.r;
      if (p.open && !p.relay && dc && dc.readyState === 'open') { try { dc.send(JSON.stringify(msg)); continue; } catch {} }
      this.chan.publish({ from: this.id, to: id, kind: 'msg', data: msg });
    }
  }

  async start() {
    await this.chan.ready;
    if (!this.isHost) this._hello();
  }
  // keep knocking until the host lets us in (a single hello can get lost while the channel connects)
  _hello() {
    clearInterval(this.knock);
    let tries = 0;
    const knock = () => { if (this.closed || this.welcomed || tries++ > 8) return clearInterval(this.knock); this.chan.publish({ from: this.id, kind: 'hello', data: { name: this.name } }); };
    knock(); this.knock = setInterval(knock, 2500);
  }
  _resume() {
    const now = Date.now();
    for (const p of this.peers.values()) p.lastSeen = now;
    this.lastBeat = now;
    this._heartbeat();
  }

  close() {
    if (this.closed) return; this.closed = true;
    try { this.chan.publish({ from: this.id, kind: 'bye' }); } catch {}
    clearInterval(this.heart); clearInterval(this.knock);
    document.removeEventListener('visibilitychange', this.onVis);
    for (const p of this.peers.values()) { try { p.pc && p.pc.close(); } catch {} }
    this.peers.clear();
    setTimeout(() => this.chan.close(), 300);
  }

  _emit(msg, from) { for (const h of this.handlers) h(msg, from); }

  _heartbeat() {
    const now = Date.now();
    // timers were frozen (phone asleep / app in the background): forgive the gap instead of dropping everyone
    if (now - this.lastBeat > 6000) for (const p of this.peers.values()) p.lastSeen = now;
    this.lastBeat = now;
    for (const [id, p] of this.peers) {
      // everyone pings everyone they're linked to, over the direct link when it's up, else the channel
      if (p.open && !p.relay && p.r && p.r.readyState === 'open') { try { p.r.send('{"k":"__ping"}'); } catch {} }
      else this.chan.publish({ from: this.id, to: id, kind: 'ping' });
      if (now - p.lastSeen > DROP_AFTER) this._dropPeer(id);
    }
  }

  _dropPeer(id) {
    const p = this.peers.get(id); if (!p) return;
    try { p.pc && p.pc.close(); } catch {}
    this.peers.delete(id);
    for (const h of this.leaveHandlers) h(id);
  }

  _onChan(m) {
    if (this.closed || !m || m.from === this.id) return;
    if (m.to && m.to !== this.id) return;
    const p = this.peers.get(m.from);
    if (p) p.lastSeen = Date.now();
    switch (m.kind) {
      case 'hello': // a player wants in, or is coming back after a hiccup (only the host answers)
        if (!this.isHost) return;
        if (p && p.helloAt && Date.now() - p.helloAt < 4000) return; // repeat knock we're already handling
        if (p) { try { p.pc && p.pc.close(); } catch {} this.peers.delete(m.from); } // reconnecting: start the link fresh
        this._addPeer(m.from, true);
        this.peers.get(m.from).helloAt = Date.now();
        for (const h of this.joinHandlers) h(m.from, m.data || {});
        break;
      case 'welcome': // the host accepted us
        if (this.isHost) return;
        this.hostId = m.from; this.welcomed = true; clearInterval(this.knock);
        if (p) { try { p.pc && p.pc.close(); } catch {} this.peers.delete(m.from); }
        this._addPeer(m.from, false);
        break;
      case 'sig': this._onSignal(m.from, m.data); break;
      case 'msg': if (p) this._emit(m.data, m.from); else if (this.isHost) this.chan.publish({ from: this.id, to: m.from, kind: 'rehello' }); break;
      case 'ping': if (!p && this.isHost) this.chan.publish({ from: this.id, to: m.from, kind: 'rehello' }); break;
      case 'rehello': if (!this.isHost) { this.welcomed = false; this._hello(); } break; // the host lost track of us: knock again
      case 'bye': this._dropPeer(m.from); break;
    }
  }

  _addPeer(id, initiator) {
    const peer = { pc: null, r: null, u: null, relay: this.forceRelay || typeof RTCPeerConnection === 'undefined', open: false, lastSeen: Date.now() };
    this.peers.set(id, peer);
    if (initiator) this.chan.publish({ from: this.id, to: id, kind: 'welcome' });
    if (peer.relay) { peer.open = true; return; }
    const pc = new RTCPeerConnection({ iceServers: ICE });
    peer.pc = pc;
    pc.onicecandidate = ev => { if (ev.candidate) this.chan.publish({ from: this.id, to: id, kind: 'sig', data: { ice: ev.candidate.toJSON() } }); };
    const wire = (dc) => {
      if (dc.label === 'u') peer.u = dc; else peer.r = dc;
      dc.onopen = () => { if (peer.r && peer.r.readyState === 'open') { peer.open = true; peer.relay = false; } };
      dc.onmessage = ev => { peer.lastSeen = Date.now(); let msg; try { msg = JSON.parse(ev.data); } catch { return; } if (msg.k !== '__ping') this._emit(msg, id); };
      dc.onclose = () => { if (this.peers.get(id) === peer && !this.closed) { peer.relay = true; peer.open = true; } }; // keep going over the relay
    };
    pc.ondatachannel = ev => wire(ev.channel);
    if (initiator) {
      wire(pc.createDataChannel('r', { ordered: true }));
      wire(pc.createDataChannel('u', { ordered: false, maxRetransmits: 0 }));
      pc.createOffer().then(o => pc.setLocalDescription(o)).then(() => this.chan.publish({ from: this.id, to: id, kind: 'sig', data: { sdp: pc.localDescription.toJSON() } }));
    }
    // no direct link in time -> relay through the backend for this peer
    setTimeout(() => { if (this.peers.get(id) === peer && !(peer.r && peer.r.readyState === 'open')) { peer.relay = true; peer.open = true; console.info('[net] relaying to', id); } }, DIRECT_TIMEOUT);
  }

  async _onSignal(from, data) {
    let peer = this.peers.get(from);
    if (!peer && !this.isHost && data.sdp) { this.hostId = from; this._addPeer(from, false); peer = this.peers.get(from); }
    if (!peer || !peer.pc) return;
    const pc = peer.pc;
    try {
      if (data.sdp) {
        await pc.setRemoteDescription(data.sdp);
        if (data.sdp.type === 'offer') {
          await pc.setLocalDescription(await pc.createAnswer());
          this.chan.publish({ from: this.id, to: from, kind: 'sig', data: { sdp: pc.localDescription.toJSON() } });
        }
        for (const c of peer.pendingIce || []) await pc.addIceCandidate(c).catch(() => {});
        peer.pendingIce = [];
      } else if (data.ice) {
        if (!pc.remoteDescription) (peer.pendingIce = peer.pendingIce || []).push(data.ice);
        else await pc.addIceCandidate(data.ice).catch(() => {});
      }
    } catch (e) { console.warn('[net] signal error', e); }
  }
}

// ---------- public API ----------
let backend = null, configured = null;
export function setupNet(client) {
  const local = new URLSearchParams(location.search).get('net') === 'local';
  backend = local ? localBackend() : client ? amplifyBackend(client) : null;
  configured = !!backend;
}

const makeCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export const TGNet = {
  get available() { return !!configured; },
  get kind() { return backend && backend.kind; },
  async createGame(name) {
    if (!backend) throw new Error('Multiplayer is not available right now.');
    for (let i = 0; i < 8; i++) {
      const code = makeCode();
      const room = new Room(backend, code, true, name);
      const ok = await backend.createGame(code, { hostId: room.id, hostName: name, status: 'lobby', players: 1, expiresAt: Math.floor(Date.now() / 1000) + 6 * 3600 }).catch(e => { room.close(); throw e; });
      if (ok) { await room.start(); return room; }
      room.close();
    }
    throw new Error('Could not make a game code, try again.');
  },
  async joinGame(code, name) {
    if (!backend) throw new Error('Multiplayer is not available right now.');
    code = String(code || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (code.length !== 4) throw new Error('Game codes are 4 letters.');
    const g = await backend.getGame(code);
    if (!g) throw new Error(`No game with code ${code}.`);
    if (g.status === 'ended') throw new Error('That game has ended.');
    const room = new Room(backend, code, false, name);
    await room.start();
    return room;
  },
  setStatus(code, status, players) { return backend && backend.updateGame(code, { status, ...(players ? { players } : {}) }).catch(() => {}); },
  submitScore(s) { return backend ? backend.submitScore(s).catch(e => console.warn('score failed', e)) : Promise.resolve(); },
  topScores(mode, limit = 10) { return backend ? backend.topScores(mode, limit) : Promise.resolve([]); },
};
