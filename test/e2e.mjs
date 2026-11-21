// Two players + a spectator in one room. Usage: node test/e2e.mjs [base]
const base = process.argv[2] || 'http://localhost:8791';
const wsBase = base.replace(/^http/, 'ws');
const { code } = await (await fetch(base + '/api/room')).json();
const sq = s => (8 - +s[1]) * 8 + 'abcdefgh'.indexOf(s[0]);
const open = token => new Promise(res => {
  const ws = new WebSocket(`${wsBase}/ws/${code}`); const msgs = [];
  ws.onmessage = e => msgs.push(JSON.parse(e.data));
  ws.onopen = () => { ws.send(JSON.stringify({ type: 'join', token })); res({ ws, msgs }); };
});
const wait = ms => new Promise(r => setTimeout(r, ms));
const mv = (p, a, b) => p.ws.send(JSON.stringify({ type: 'move', from: sq(a), to: sq(b) }));
const a = await open('alice'); await wait(300);
const b = await open('bob'); await wait(300);
const c = await open('carol'); await wait(300);
const last = x => x.msgs.filter(m => m.type === 'state').at(-1);
console.log('room', code, 'colors', last(a).you, last(b).you, last(c).you);
mv(a, 'f2', 'f3'); await wait(300);
mv(b, 'e7', 'e4'); await wait(300); // illegal
mv(b, 'e7', 'e5'); await wait(300);
mv(c, 'g2', 'g4'); await wait(300); // spectator
mv(a, 'g2', 'g4'); await wait(300);
mv(b, 'd8', 'h4'); await wait(400);
console.log('errors b:', b.msgs.filter(m => m.type === 'error').map(m => m.message), 'c:', c.msgs.filter(m => m.type === 'error').map(m => m.message));
const g = last(c).game;
console.log('moves', g.moves.join(' '), '|', g.result && g.result.text);
a.ws.close(); await wait(300);
const a2 = await open('alice'); await wait(300);
console.log('alice reconnect color', last(a2).you);
for (const x of [a2, b, c]) x.ws.close();
const ok = last(a2).you === 'w' && g.moves.join(' ') === 'f3 e5 g4 Qh4#' && g.over;
console.log(ok ? 'E2E OK' : 'E2E FAIL'); process.exit(ok ? 0 : 1);
