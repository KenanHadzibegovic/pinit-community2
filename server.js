/* ══════════════════════════════════════════════════════════════
   PINIT ZAJEDNICA — server
   Komsiluk na okupu. Besplatno i neprofitno.
   Ciste Node.js biblioteke, bez ijedne instalacije (npm install nije potreban).

   Pokretanje:  node server.js
   Adresa:      http://localhost:3000
   ══════════════════════════════════════════════════════════════ */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = process.env.PORT || 3000;

/* DATA_DIR: ako se doda trajni disk (Render → Disk → mount npr. /data),
   postavi env DATA_DIR=/data i podaci prezivljavaju restart i deploy. */
const DATA = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'data.json')
  : path.join(__dirname, 'data.json');

const PUB = path.join(__dirname, 'public');

let DB = { users: [], communities: [], events: [] };

/* ── ucitavanje / snimanje ── */
try {
  if (fs.existsSync(DATA)) {
    const raw = JSON.parse(fs.readFileSync(DATA, 'utf8'));
    DB.users = raw.users || [];
    DB.communities = raw.communities || [];
    DB.events = raw.events || [];
  }
} catch (e) {
  console.log('Ne mogu procitati data.json, krecem od nule.');
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(DATA), { recursive: true });
      fs.writeFileSync(DATA, JSON.stringify(DB));
    } catch (e) {
      console.log('Greska pri snimanju:', e.message);
    }
  }, 400);
}

function log(msg) {
  const t = new Date().toTimeString().slice(0, 8);
  console.log(t + ' · ' + msg);
}

/* ── pomocne ── */
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

function readBody(req, cb) {
  let data = '';
  req.on('data', c => {
    data += c;
    if (data.length > 2e6) req.destroy();
  });
  req.on('end', () => {
    try { cb(JSON.parse(data || '{}')); }
    catch (e) { cb(null); }
  });
}

/* udaljenost u metrima */
function dist(aLat, aLng, bLat, bLng) {
  const R = 6371000, toR = x => x * Math.PI / 180;
  const dLat = toR(bLat - aLat), dLng = toR(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(aLat)) * Math.cos(toR(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

function userBy(tok) { return DB.users.find(x => x.token === tok) || null; }

function pubCom(c, me) {
  return {
    id: c.id, name: c.name, type: c.type, desc: c.desc,
    lat: c.lat, lng: c.lng, radius: c.radius, streets: c.streets,
    founderName: c.founderName, created: c.created,
    memberCount: c.members.length,
    isMember: me ? c.members.some(m => m.id === me.id) : false,
    isFounder: me ? c.founder === me.id : false
  };
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

/* ══════════════════ SERVER ══════════════════ */
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const p = u.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  /* ── nalog ── */
  if (p === '/api/register' && req.method === 'POST') {
    return readBody(req, b => {
      if (!b || !b.name || !String(b.name).trim())
        return json(res, 400, { error: 'ime je obavezno' });
      const user = {
        id: 'u_' + crypto.randomBytes(5).toString('hex'),
        token: crypto.randomBytes(16).toString('hex'),
        name: String(b.name).trim().slice(0, 60),
        created: Date.now()
      };
      DB.users.push(user); save();
      log('Novi nalog: ' + user.name);
      json(res, 200, { userId: user.id, token: user.token, name: user.name });
    });
  }

  /* ── zajednice ── */
  if (p === '/api/communities' && req.method === 'GET') {
    const me = userBy(u.searchParams.get('token'));
    const lat = parseFloat(u.searchParams.get('lat'));
    const lng = parseFloat(u.searchParams.get('lng'));
    let list = DB.communities.map(c => {
      const o = pubCom(c, me);
      if (!isNaN(lat) && !isNaN(lng)) {
        o.dist = dist(lat, lng, c.lat, c.lng);
        o.inZone = o.dist <= c.radius;
      }
      return o;
    });
    if (!isNaN(lat) && !isNaN(lng)) list.sort((a, b) => a.dist - b.dist);
    else list.sort((a, b) => b.memberCount - a.memberCount);
    return json(res, 200, list);
  }

  if (p === '/api/communities' && req.method === 'POST') {
    return readBody(req, b => {
      const me = userBy(b && b.token);
      if (!me) return json(res, 401, { error: 'prijavi se prvo' });
      if (!b.name || !String(b.name).trim()) return json(res, 400, { error: 'naziv je obavezan' });
      if (typeof b.lat !== 'number' || typeof b.lng !== 'number')
        return json(res, 400, { error: 'odredi centar zajednice na karti' });
      const radius = Math.min(20000, Math.max(150, parseInt(b.radius, 10) || 800));
      const name = String(b.name).trim().slice(0, 60);
      const dup = DB.communities.find(c =>
        c.name.toLowerCase() === name.toLowerCase() && dist(c.lat, c.lng, b.lat, b.lng) < 1000);
      if (dup) return json(res, 409, { error: 'Zajednica "' + name + '" vec postoji tu blizu.', id: dup.id });
      const c = {
        id: 'c_' + crypto.randomBytes(5).toString('hex'),
        name: name,
        type: ['ulica', 'kvart', 'naselje', 'selo', 'opstina'].includes(b.type) ? b.type : 'kvart',
        desc: String(b.desc || '').slice(0, 500),
        lat: b.lat, lng: b.lng, radius: radius,
        streets: Array.isArray(b.streets)
          ? b.streets.map(s => String(s).trim().slice(0, 60)).filter(Boolean).slice(0, 40) : [],
        founder: me.id, founderName: me.name,
        members: [{ id: me.id, name: me.name, joined: Date.now() }],
        created: Date.now()
      };
      DB.communities.push(c); save();
      log('Nova zajednica: ' + c.name + ' (' + c.type + ', r=' + c.radius + 'm) · ' + me.name);
      json(res, 200, { ok: true, community: pubCom(c, me) });
    });
  }

  let m = p.match(/^\/api\/communities\/(c_[a-f0-9]+)$/);
  if (m && req.method === 'GET') {
    const c = DB.communities.find(x => x.id === m[1]);
    if (!c) return json(res, 404, { error: 'nema zajednice' });
    const me = userBy(u.searchParams.get('token'));
    const o = pubCom(c, me);
    o.members = c.members.map(x => ({ name: x.name, joined: x.joined }));
    return json(res, 200, o);
  }

  m = p.match(/^\/api\/communities\/(c_[a-f0-9]+)\/(join|leave)$/);
  if (m && req.method === 'POST') {
    const act = m[2];
    return readBody(req, b => {
      const c = DB.communities.find(x => x.id === m[1]);
      if (!c) return json(res, 404, { error: 'nema zajednice' });
      const me = userBy(b && b.token);
      if (!me) return json(res, 401, { error: 'prijavi se prvo' });
      if (act === 'join') {
        if (!c.members.some(x => x.id === me.id)) {
          c.members.push({ id: me.id, name: me.name, joined: Date.now() });
          log(me.name + ' je postao/la clan: ' + c.name);
        }
      } else {
        if (c.founder === me.id && c.members.length > 1)
          return json(res, 400, { error: 'Osnivac ne moze istupiti dok ima drugih clanova.' });
        c.members = c.members.filter(x => x.id !== me.id);
      }
      save();
      json(res, 200, { ok: true, community: pubCom(c, me) });
    });
  }

  /* ── desavanja ── */
  if (p === '/api/events' && req.method === 'GET') {
    const cid = u.searchParams.get('cid');
    const me = userBy(u.searchParams.get('token'));
    let list = DB.events;
    if (cid) list = list.filter(e => e.cid === cid);
    return json(res, 200, list.slice(-300).map(e => Object.assign({}, e, {
      joined: me ? e.goers.some(g => g.id === me.id) : false,
      mine: me ? e.userId === me.id : false,
      count: e.goers.length
    })));
  }

  if (p === '/api/events' && req.method === 'POST') {
    return readBody(req, b => {
      const me = userBy(b && b.token);
      if (!me) return json(res, 401, { error: 'prijavi se prvo' });
      const c = DB.communities.find(x => x.id === (b && b.cid));
      if (!c) return json(res, 404, { error: 'nema zajednice' });
      if (!c.members.some(x => x.id === me.id))
        return json(res, 403, { error: 'Postani clan zajednice da bi objavljivao.' });
      if (!b.title || !String(b.title).trim()) return json(res, 400, { error: 'naziv je obavezan' });
      const e = {
        id: 'e_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
        cid: c.id, userId: me.id, name: me.name,
        cat: String(b.cat || 'ostalo').slice(0, 20),
        title: String(b.title).trim().slice(0, 120),
        day: String(b.day || '').slice(0, 40),
        time: String(b.time || '').slice(0, 20),
        place: String(b.place || '').slice(0, 80),
        note: String(b.note || '').slice(0, 600),
        lat: (typeof b.lat === 'number') ? b.lat : c.lat,
        lng: (typeof b.lng === 'number') ? b.lng : c.lng,
        goers: [{ id: me.id, name: me.name }],
        comments: [], ts: Date.now()
      };
      DB.events.push(e); save();
      log('Desavanje: ' + e.title + ' · ' + c.name + ' · ' + me.name);
      json(res, 200, { ok: true, event: e });
    });
  }

  m = p.match(/^\/api\/events\/(e_[a-z0-9]+)\/join$/);
  if (m && req.method === 'POST') {
    return readBody(req, b => {
      const e = DB.events.find(x => x.id === m[1]);
      if (!e) return json(res, 404, { error: 'nema desavanja' });
      const me = userBy(b && b.token);
      if (!me) return json(res, 401, { error: 'prijavi se prvo' });
      const i = e.goers.findIndex(g => g.id === me.id);
      if (i >= 0) e.goers.splice(i, 1);
      else e.goers.push({ id: me.id, name: me.name });
      save();
      json(res, 200, { ok: true, count: e.goers.length, joined: i < 0 });
    });
  }

  m = p.match(/^\/api\/events\/(e_[a-z0-9]+)\/comment$/);
  if (m && req.method === 'POST') {
    return readBody(req, b => {
      const e = DB.events.find(x => x.id === m[1]);
      if (!e) return json(res, 404, { error: 'nema desavanja' });
      const me = userBy(b && b.token);
      if (!me) return json(res, 401, { error: 'prijavi se prvo' });
      if (!b.txt || !String(b.txt).trim()) return json(res, 400, { error: 'prazna poruka' });
      e.comments.push({ name: me.name, txt: String(b.txt).trim().slice(0, 400), t: Date.now() });
      save();
      json(res, 200, { ok: true, comments: e.comments });
    });
  }

  m = p.match(/^\/api\/events\/(e_[a-z0-9]+)$/);
  if (m && req.method === 'DELETE') {
    return readBody(req, b => {
      const i = DB.events.findIndex(x => x.id === m[1]);
      if (i < 0) return json(res, 404, { error: 'nema desavanja' });
      const me = userBy(b && b.token);
      const e = DB.events[i];
      const c = DB.communities.find(x => x.id === e.cid);
      const boss = me && (e.userId === me.id || (c && c.founder === me.id));
      if (!boss) return json(res, 403, { error: 'samo autor ili osnivac moze obrisati' });
      DB.events.splice(i, 1); save();
      json(res, 200, { ok: true });
    });
  }

  /* ── pretraga mjesta (OpenStreetMap Nominatim, besplatno, bez kljuca) ── */
  if (p === '/api/geo' && req.method === 'GET') {
    const q = (u.searchParams.get('q') || '').trim();
    if (q.length < 2) return json(res, 200, []);
    const gurl = 'https://nominatim.openstreetmap.org/search?format=json&limit=6&accept-language=bs&q=' +
      encodeURIComponent(q);
    if (typeof fetch !== 'function') return json(res, 200, []);
    fetch(gurl, { headers: { 'User-Agent': 'PINIT-Zajednica/1.0 (community app)' } })
      .then(r => r.json())
      .then(arr => json(res, 200, (arr || []).map(x => ({
        name: x.display_name, lat: parseFloat(x.lat), lng: parseFloat(x.lon)
      }))))
      .catch(() => json(res, 200, []));
    return;
  }

  /* ── statika ── */
  let file = (p === '/' || p === '/zajednica' || p === '/kvart')
    ? 'index.html'
    : p.replace(/^\//, '');

  if (file.indexOf('..') >= 0) { res.writeHead(400); return res.end('ne'); }

  const full = path.join(PUB, file);
  fs.readFile(full, (err, data) => {
    if (err) {
      /* nepoznata adresa -> vrati aplikaciju (jednostavan SPA fallback) */
      return fs.readFile(path.join(PUB, 'index.html'), (e2, d2) => {
        if (e2) { res.writeHead(404); return res.end('404'); }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(d2);
      });
    }
    const ext = path.extname(full).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400'
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  let lan = 'localhost';
  try {
    const ifs = os.networkInterfaces();
    for (const k in ifs)
      for (const i of ifs[k])
        if (i.family === 'IPv4' && !i.internal) { lan = i.address; break; }
  } catch (e) { }
  console.log('════════════════════════════════════════════════');
  console.log(' PINIT ZAJEDNICA radi.');
  console.log('   Na ovom racunaru:  http://localhost:' + PORT);
  console.log('   Sa telefona (ista Wi-Fi):  http://' + lan + ':' + PORT);
  console.log('   Podaci: ' + DATA);
  console.log('════════════════════════════════════════════════');
});
