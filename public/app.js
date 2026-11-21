import { newGame, play, resign, aiMove, legalMoves, inCheck, kingSq, side } from '/engine.js';

const $ = id => document.getElementById(id);
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
let g = null, mode = null, humanColor = 'w', level = 2, undoStack = [], ws = null, you = null, online = { w: false, b: false }, sel = -1, flipped = false, thinking = false;
const token = localStorage.chessToken || (localStorage.chessToken = crypto.randomUUID());
const name = c => (c === 'w' ? 'White' : 'Black');

function seg(id, cb) {
  $(id).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    for (const x of $(id).children) x.classList.toggle('on', x === b);
    cb(b.dataset.v);
  });
}
seg('color', v => humanColor = v);
seg('level', v => level = +v);

const show = () => {};
let selMode = 'ai';
seg('modeSel', v => { selMode = v; $('aiOpts').hidden = v !== 'ai'; $('onlineOpts').hidden = v !== 'online'; });

function start(m) {
  mode = m; g = newGame(); undoStack = []; you = null; sel = -1;
  flipped = m === 'ai' && humanColor === 'b';
  if (ws) { const w = ws; ws = null; w.close(); history.replaceState(null, '', '/'); }
  $('shareLink').value = ''; $('copy').textContent = 'Copy';
  $('mode').textContent = m === 'ai' ? `vs Computer · ${['', 'Easy', 'Medium', 'Hard'][level]} · you play ${name(humanColor)}` : 'Same screen · 2 players';
  show(true); render();
  if (m === 'ai' && humanColor === 'b') computer();
}
$('newGame').onclick = async () => {
  if (selMode !== 'online') return start(selMode);
  const { code } = await (await fetch('/api/room')).json(); joinRoom(code);
};
$('joinForm').onsubmit = e => { e.preventDefault(); const c = $('joinCode').value.trim().toUpperCase(); if (c) joinRoom(c); };
$('copy').onclick = () => { navigator.clipboard.writeText($('shareLink').value); $('copy').textContent = 'Copied'; };
$('flip').onclick = () => { flipped = !flipped; render(); };

function joinRoom(code) {
  if (ws) { const w = ws; ws = null; w.close(); }
  mode = 'online'; g = null; sel = -1;
  history.replaceState(null, '', '/r/' + code);
  $('shareLink').value = location.origin + '/r/' + code; $('share').hidden = false; $('copy').textContent = 'Copy';
  $('mode').textContent = 'Online · room ' + code;
  show(true); setStatus('Connecting…');
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws/' + code);
  ws.onopen = () => ws.send(JSON.stringify({ type: 'join', token }));
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.type === 'error') return setStatus(m.message, true);
    const first = !g; g = m.game; you = m.you; online = m.online;
    if (first) flipped = you === 'b';
    render();
  };
  ws.onclose = () => { if (mode === 'online' && ws) setStatus('Disconnected — reload to reconnect', true); };
}
const r = location.pathname.match(/^\/r\/([A-Z0-9]{4,8})$/);
if (r) { joinRoom(r[1]); for (const b of $('modeSel').children) b.classList.toggle('on', b.dataset.v === 'online'); selMode = 'online'; $('aiOpts').hidden = true; $('onlineOpts').hidden = false; }
else start('ai');

function canMove() {
  if (!g || g.over || thinking) return false;
  if (mode === 'ai') return g.turn === humanColor;
  if (mode === 'online') return g.turn === you && online.w && online.b;
  return true;
}

function move(from, to) {
  const promo = $('promo').value;
  if (mode === 'online') return ws.send(JSON.stringify({ type: 'move', from, to, promo }));
  const snap = JSON.stringify(g);
  const res = play(g, from, to, promo);
  if (!res.ok) return setStatus(res.reason, true);
  undoStack.push(snap); render();
  if (mode === 'ai' && !g.over) computer();
}
function computer() {
  thinking = true; render();
  setTimeout(() => {
    const m = aiMove(g, level);
    if (m) play(g, m.from, m.to, m.promo);
    thinking = false; render();
  }, 200);
}
$('resign').onclick = () => {
  if (!g || g.over || !confirm('Resign this game?')) return;
  if (mode === 'online') return ws.send(JSON.stringify({ type: 'resign' }));
  resign(g, mode === 'ai' ? humanColor : g.turn); render();
};
$('undo').onclick = () => {
  if (mode === 'online' || thinking || !undoStack.length) return;
  g = JSON.parse(undoStack.pop()); sel = -1; render();
};
$('again').onclick = () => (mode === 'online' ? ws.send(JSON.stringify({ type: 'rematch' })) : start(mode));

function setTurnDot() { const d = $('turnDot'); if (d && g) d.className = 'turn-dot ' + (g.over ? 'over' : g.turn); }
function setStatus(t, err) { setTurnDot(); const s = $('status'); s.textContent = t; s.classList.toggle('err', !!err); }

function render() {
  if (!g) return;
  const board = $('board'), targets = sel >= 0 ? legalMoves(g).filter(m => m.from === sel) : [];
  const checkSq = inCheck(g) ? kingSq(g.board, g.turn) : -1;
  board.innerHTML = '';
  for (let k = 0; k < 64; k++) {
    const i = flipped ? 63 - k : k, rr = (i / 8) | 0, ff = i % 8, p = g.board[i];
    const d = document.createElement('div');
    d.className = 'sq ' + ((rr + ff) % 2 ? 'd' : 'l');
    if (g.last && (g.last.from === i || g.last.to === i)) d.classList.add('last');
    if (i === sel) d.classList.add('sel');
    if (i === checkSq) d.classList.add('check');
    const t = targets.find(m => m.to === i);
    if (t) d.classList.add(p || t.epCapture ? 'ring' : 'dot');
    if (p) d.innerHTML = `<span class="pc ${side(p)}">${GLYPH[p.toLowerCase()]}</span>`;
    if (k % 8 === 0) d.insertAdjacentHTML('beforeend', `<span class="coord r">${8 - rr}</span>`);
    if (k >= 56) d.insertAdjacentHTML('beforeend', `<span class="coord f">${'abcdefgh'[ff]}</span>`);
    d.onclick = () => clickSq(i);
    board.appendChild(d);
  }
  const list = $('moves'); list.innerHTML = '';
  for (let k = 0; k < g.moves.length; k += 2) list.insertAdjacentHTML('beforeend', `<li><span>${g.moves[k]}</span>${g.moves[k + 1] || ''}</li>`);
  list.scrollTop = list.scrollHeight;

  const bottom = flipped ? 'b' : 'w', top = flipped ? 'w' : 'b';
  const label = c => {
    if (mode === 'ai') return c === humanColor ? `${name(c)} · You` : `${name(c)} · Computer`;
    if (mode === 'online') return `${name(c)} ${online[c] ? '● online' : '○ waiting'}${you === c ? ' (you)' : ''}`;
    return name(c);
  };
  $('tagTop').textContent = label(top); $('tagBottom').textContent = label(bottom);
  $('undo').hidden = mode === 'online';
  $('again').hidden = !g.over;
  if (g.over) setStatus(g.result.text);
  else if (mode === 'online' && !(online.w && online.b)) setStatus(you ? 'Waiting for opponent — share the link' : 'Watching');
  else if (thinking) setStatus('Computer is thinking…');
  else if (mode === 'online') setStatus(g.turn === you ? `Your move (${name(you)})` : `${name(g.turn)} to play…`);
  else if (mode === 'ai') setStatus(g.turn === humanColor ? `Your move (${name(humanColor)})` : `${name(g.turn)} to play`);
  else setStatus(`${name(g.turn)} to play`);
  if (!g.over && inCheck(g)) $('status').textContent += ' · Check!';
}

function clickSq(i) {
  if (!canMove()) return;
  if (sel >= 0 && legalMoves(g).some(m => m.from === sel && m.to === i)) { const f = sel; sel = -1; return move(f, i); }
  sel = g.board[i] && side(g.board[i]) === g.turn && sel !== i ? i : -1;
  render();
}
