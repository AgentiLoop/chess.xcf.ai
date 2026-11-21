// Chess rules engine shared by the browser and the Durable Object.
// Board: 64 strings, index = row*8 + file, row 0 = rank 8. Uppercase = White, '' = empty.

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const KN = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const KG = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const RK = [[-1,0],[1,0],[0,-1],[0,1]], BS = [[-1,-1],[-1,1],[1,-1],[1,1]];
export const side = p => (p ? (p === p.toUpperCase() ? 'w' : 'b') : null);
export const opp = c => (c === 'w' ? 'b' : 'w');
export const sqName = i => 'abcdefgh'[i % 8] + (8 - ((i / 8) | 0));
export const sqIndex = s => (8 - +s[1]) * 8 + 'abcdefgh'.indexOf(s[0]);

export function fromFEN(fen) {
  const [pos, turn, castle, ep, half] = fen.split(' ');
  const board = [];
  for (const ch of pos.replace(/\//g, '')) {
    if (/\d/.test(ch)) for (let k = 0; k < +ch; k++) board.push('');
    else board.push(ch);
  }
  return { board, turn, castle: castle === '-' ? '' : castle, ep: ep && ep !== '-' ? sqIndex(ep) : -1, half: +(half || 0) };
}

export function newGame(fen = START_FEN) {
  const s = fromFEN(fen);
  return { ...s, moves: [], over: false, result: null, reps: { [key(s)]: 1 }, last: null };
}

const key = s => s.board.map(p => p || '.').join('') + s.turn + s.castle + s.ep;

export function attacked(board, sq, by) {
  const r = (sq / 8) | 0, f = sq % 8;
  const at = (rr, ff) => (rr >= 0 && rr < 8 && ff >= 0 && ff < 8 ? board[rr * 8 + ff] : null);
  const P = by === 'w' ? 'P' : 'p', N = by === 'w' ? 'N' : 'n', K = by === 'w' ? 'K' : 'k';
  const B = by === 'w' ? 'B' : 'b', R = by === 'w' ? 'R' : 'r', Q = by === 'w' ? 'Q' : 'q';
  const pr = by === 'w' ? r + 1 : r - 1;
  if (at(pr, f - 1) === P || at(pr, f + 1) === P) return true;
  for (const [dr, df] of KN) if (at(r + dr, f + df) === N) return true;
  for (const [dr, df] of KG) if (at(r + dr, f + df) === K) return true;
  for (const [dirs, a, b] of [[RK, R, Q], [BS, B, Q]]) for (const [dr, df] of dirs) {
    let rr = r + dr, ff = f + df;
    while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
      const p = board[rr * 8 + ff];
      if (p) { if (p === a || p === b) return true; break; }
      rr += dr; ff += df;
    }
  }
  return false;
}

export const kingSq = (board, c) => board.indexOf(c === 'w' ? 'K' : 'k');
export const inCheck = (s, c = s.turn) => attacked(s.board, kingSq(s.board, c), opp(c));

function pseudo(s) {
  const { board, turn } = s, out = [];
  const push = (from, to, extra) => out.push({ from, to, piece: board[from], captured: board[to], ...extra });
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || side(p) !== turn) continue;
    const t = p.toLowerCase(), r = (i / 8) | 0, f = i % 8;
    if (t === 'p') {
      const dir = turn === 'w' ? -1 : 1, startRow = turn === 'w' ? 6 : 1, lastRow = turn === 'w' ? 0 : 7;
      const addPawn = (to, extra = {}) => {
        if (((to / 8) | 0) === lastRow) for (const pr of 'qrbn') push(i, to, { ...extra, promo: turn === 'w' ? pr.toUpperCase() : pr });
        else push(i, to, extra);
      };
      const one = i + dir * 8;
      if (!board[one]) {
        addPawn(one);
        const two = i + dir * 16;
        if (r === startRow && !board[two]) push(i, two, { double: true });
      }
      for (const df of [-1, 1]) {
        const ff = f + df; if (ff < 0 || ff > 7) continue;
        const to = (r + dir) * 8 + ff;
        if (board[to] && side(board[to]) !== turn) addPawn(to);
        else if (to === s.ep) push(i, to, { epCapture: true, captured: turn === 'w' ? 'p' : 'P' });
      }
    } else if (t === 'n' || t === 'k') {
      for (const [dr, df] of t === 'n' ? KN : KG) {
        const rr = r + dr, ff = f + df;
        if (rr < 0 || rr > 7 || ff < 0 || ff > 7) continue;
        const to = rr * 8 + ff;
        if (!board[to] || side(board[to]) !== turn) push(i, to);
      }
      if (t === 'k') {
        const them = opp(turn), home = turn === 'w' ? 60 : 4;
        const [kc, qc] = turn === 'w' ? ['K', 'Q'] : ['k', 'q'];
        if (i === home && !attacked(board, home, them)) {
          if (s.castle.includes(kc) && !board[home + 1] && !board[home + 2] && !attacked(board, home + 1, them) && !attacked(board, home + 2, them))
            push(i, home + 2, { castle: 'K' });
          if (s.castle.includes(qc) && !board[home - 1] && !board[home - 2] && !board[home - 3] && !attacked(board, home - 1, them) && !attacked(board, home - 2, them))
            push(i, home - 2, { castle: 'Q' });
        }
      }
    } else {
      const dirs = t === 'r' ? RK : t === 'b' ? BS : RK.concat(BS);
      for (const [dr, df] of dirs) {
        let rr = r + dr, ff = f + df;
        while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
          const to = rr * 8 + ff;
          if (board[to]) { if (side(board[to]) !== turn) push(i, to); break; }
          push(i, to);
          rr += dr; ff += df;
        }
      }
    }
  }
  return out;
}

export function apply(s, m) {
  const b = s.board.slice(), turn = s.turn;
  b[m.to] = m.promo || b[m.from]; b[m.from] = '';
  if (m.epCapture) b[m.to + (turn === 'w' ? 8 : -8)] = '';
  if (m.castle === 'K') { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = ''; }
  if (m.castle === 'Q') { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = ''; }
  let castle = s.castle;
  const strip = (sq, chars) => { if (m.from === sq || m.to === sq) castle = castle.replace(new RegExp('[' + chars + ']', 'g'), ''); };
  strip(60, 'KQ'); strip(4, 'kq'); strip(63, 'K'); strip(56, 'Q'); strip(7, 'k'); strip(0, 'q');
  const pawn = m.piece.toLowerCase() === 'p';
  return { board: b, turn: opp(turn), castle, ep: m.double ? (m.from + m.to) / 2 : -1, half: pawn || m.captured ? 0 : s.half + 1 };
}

export function legalMoves(s) {
  return pseudo(s).filter(m => !attacked(apply(s, m).board, kingSq(apply(s, m).board, s.turn), opp(s.turn)));
}

export function perft(s, depth) {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of legalMoves(s)) n += depth === 1 ? 1 : perft(apply(s, m), depth - 1);
  return n;
}

function san(s, m, legal) {
  let out;
  if (m.castle) out = m.castle === 'K' ? 'O-O' : 'O-O-O';
  else {
    const t = m.piece.toUpperCase(), cap = m.captured ? 'x' : '';
    if (t === 'P') out = (cap ? sqName(m.from)[0] : '') + cap + sqName(m.to) + (m.promo ? '=' + m.promo.toUpperCase() : '');
    else {
      const twins = legal.filter(o => o.to === m.to && o.from !== m.from && o.piece === m.piece);
      let dis = '';
      if (twins.length) dis = twins.some(o => o.from % 8 === m.from % 8) ? (twins.some(o => ((o.from / 8) | 0) === ((m.from / 8) | 0)) ? sqName(m.from) : sqName(m.from)[1]) : sqName(m.from)[0];
      out = t + dis + cap + sqName(m.to);
    }
  }
  const next = apply(s, m);
  if (inCheck(next)) out += legalMoves(next).length ? '+' : '#';
  return out;
}

function insufficient(board) {
  const rest = board.filter(p => p && p.toLowerCase() !== 'k');
  return rest.length === 0 || (rest.length === 1 && /[nbNB]/.test(rest[0]));
}

// Mutates game g. Returns { ok, reason, san }.
export function play(g, from, to, promo = 'q') {
  if (g.over) return { ok: false, reason: 'Game over' };
  const legal = legalMoves(g);
  const m = legal.find(x => x.from === from && x.to === to && (!x.promo || x.promo.toLowerCase() === promo.toLowerCase()));
  if (!m) return { ok: false, reason: side(g.board[from]) === g.turn ? 'Illegal move' : 'Not your piece' };
  const text = san(g, m, legal);
  Object.assign(g, apply(g, m));
  g.moves.push(text); g.last = { from, to };
  const k = key(g); g.reps[k] = (g.reps[k] || 0) + 1;
  const nextLegal = legalMoves(g);
  const name = c => (c === 'w' ? 'White' : 'Black');
  if (!nextLegal.length) {
    g.over = true;
    g.result = inCheck(g) ? { winner: opp(g.turn), text: `Checkmate — ${name(opp(g.turn))} wins` } : { winner: null, text: 'Draw by stalemate' };
  } else if (g.half >= 100) { g.over = true; g.result = { winner: null, text: 'Draw by the 50-move rule' }; }
  else if (g.reps[k] >= 3) { g.over = true; g.result = { winner: null, text: 'Draw by threefold repetition' }; }
  else if (insufficient(g.board)) { g.over = true; g.result = { winner: null, text: 'Draw — insufficient material' }; }
  return { ok: true, san: text };
}

export function resign(g, color) {
  if (g.over) return;
  g.over = true;
  g.result = { winner: opp(color), text: `${color === 'w' ? 'White' : 'Black'} resigns — ${color === 'w' ? 'Black' : 'White'} wins` };
}

// ---------- computer player: alpha-beta with material + piece-square tables ----------
const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const CENTER = Array.from({ length: 64 }, (_, i) => { const r = (i / 8) | 0, f = i % 8; return 3.5 - Math.max(Math.abs(r - 3.5), Math.abs(f - 3.5)); });
function evaluate(s) { // from White's point of view
  let v = 0;
  for (let i = 0; i < 64; i++) {
    const p = s.board[i]; if (!p) continue;
    const t = p.toLowerCase(), w = p !== t, r = (i / 8) | 0;
    let x = VAL[t];
    if (t === 'n' || t === 'b') x += CENTER[i] * 8;
    else if (t === 'p') x += (w ? 6 - r : r - 1) * 6 + (CENTER[i] > 1.5 ? 10 : 0);
    else if (t === 'q') x += CENTER[i] * 2;
    else if (t === 'k') x += (w ? r === 7 : r === 0) ? 15 : -10;
    v += w ? x : -x;
  }
  return v;
}
function search(s, depth, alpha, beta) {
  const moves = legalMoves(s);
  if (!moves.length) return inCheck(s) ? -100000 - depth : 0;
  if (depth === 0) return (s.turn === 'w' ? 1 : -1) * evaluate(s);
  moves.sort((a, b) => (b.captured ? VAL[b.captured.toLowerCase()] * 10 - VAL[b.piece.toLowerCase()] : 0) - (a.captured ? VAL[a.captured.toLowerCase()] * 10 - VAL[a.piece.toLowerCase()] : 0) + (b.promo ? 800 : 0) - (a.promo ? 800 : 0));
  for (const m of moves) {
    const v = -search(apply(s, m), depth - 1, -beta, -alpha);
    if (v >= beta) return beta;
    if (v > alpha) alpha = v;
  }
  return alpha;
}
// level 1 easy, 2 medium, 3 hard. Returns {from,to,promo} or null.
export function aiMove(g, level = 2) {
  const moves = legalMoves(g);
  if (!moves.length) return null;
  const depth = level >= 3 ? 4 : level === 2 ? 3 : 1, noise = level === 1 ? 120 : level === 2 ? 25 : 8;
  let best = null, bestV = -Infinity;
  for (const m of moves) {
    const v = -search(apply(g, m), depth - 1, -Infinity, Infinity) + Math.random() * noise;
    if (v > bestV) { bestV = v; best = m; }
  }
  return { from: best.from, to: best.to, promo: best.promo };
}
