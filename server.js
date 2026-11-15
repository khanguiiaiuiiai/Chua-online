const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');

const server = http.createServer((q, r) => {
  if (q.url === '/health') return r.end('ok');
  r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  r.end(fs.readFileSync(path.join(__dirname, 'index.html')));
});
const wss = new WebSocketServer({ server });

// ---- Kiểm duyệt tự động: chửi bậy = khẩu nghiệp ----
const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const WORDS = ['dm', 'dmm', 'dcm', 'dkm', 'vcl', 'vl', 'cc', 'clgt', 'dit me', 'du ma', 'dume', 'cai lon', 'con cho',
  'do ngu', 'ngu vl', 'mat day', 'oc cho', 'thang ngu', 'con dien', 'do khon', 'cut di', 'dm may', 'fuck', 'shit', 'bitch', 'wtf'];
const COMPACT = ['ditme', 'dumemay', 'concho', 'dcm', 'dmm', 'vcl', 'thangngu', 'docho', 'fuck'];
function isBad(s) {
  const t = norm(s), p = ' ' + t + ' ', c = t.replace(/ /g, '');
  return WORDS.some(w => p.includes(' ' + w + ' ')) || COMPACT.some(w => c.includes(w));
}

let nextId = 1, total = 0;
const players = new Map(), incense = []; // incense: thời điểm hết hạn của từng nén hương
const activeIncense = () => { const n = Date.now(); while (incense.length && incense[0] < n) incense.shift(); return incense.length; };
const bcast = o => { const s = JSON.stringify(o); wss.clients.forEach(c => c.readyState === 1 && c.send(s)); };

wss.on('connection', ws => {
  const id = nextId++;
  const p = { id, name: 'Khách' + id, c: 0, x: 0, z: 24, r: 0, k: 0, last: 0 };
  players.set(id, p);
  ws.send(JSON.stringify({ t: 'init', id, total, n: activeIncense() }));
  ws.on('message', raw => {
    let d; try { d = JSON.parse(raw); } catch { return; }
    if (d.t === 'join') {
      const n = String(d.name || '').slice(0, 16).trim();
      if (n && !isBad(n)) p.name = n;
      p.c = (d.c | 0) % 7;
      bcast({ t: 'sys', text: `🙏 ${p.name} vừa vào chùa` });
    } else if (d.t === 'move') {
      p.x = +d.x || 0; p.z = +d.z || 0; p.r = +d.r || 0; p.k = d.k ? 1 : 0;
    } else if (d.t === 'chat') {
      const now = Date.now(); if (now - p.last < 700) return; p.last = now;
      const text = String(d.text || '').slice(0, 120).trim(); if (!text) return;
      if (isBad(text)) bcast({ t: 'smite', id, name: p.name });
      else bcast({ t: 'chat', id, name: p.name, text });
    } else if (d.t === 'incense') {
      if (activeIncense() < 15) incense.push(Date.now() + 90000);
      bcast({ t: 'incense', n: activeIncense(), name: p.name });
    } else if (d.t === 'donate') {
      const a = Math.min(Math.max(d.amount | 0, 1000), 1000000); total += a;
      bcast({ t: 'donate', name: p.name, amount: a, total });
    }
  });
  ws.on('close', () => { players.delete(id); bcast({ t: 'sys', text: `${p.name} đã rời chùa` }); });
});

setInterval(() => {
  bcast({ t: 'state', n: activeIncense(), p: [...players.values()].map(p => ({ id: p.id, n: p.name, c: p.c, x: p.x, z: p.z, r: p.r, k: p.k })) });
}, 100);

server.listen(process.env.PORT || 3000, () => console.log('Chùa online đang chạy'));
