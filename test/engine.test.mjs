import test from 'node:test';
import assert from 'node:assert/strict';
import { fromFEN, perft, newGame, play, aiMove, sqIndex as q } from '../public/engine.js';
test('perft start position', () => {
  const s = fromFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  assert.deepEqual([1, 2, 3].map(d => perft(s, d)), [20, 400, 8902]);
});
test('perft kiwipete (castling, ep, promotion)', () => {
  const s = fromFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
  assert.deepEqual([1, 2, 3].map(d => perft(s, d)), [48, 2039, 97862]);
});
test('perft position 3 (pins, ep)', () => {
  const s = fromFEN('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1');
  assert.deepEqual([1, 2, 3, 4].map(d => perft(s, d)), [14, 191, 2812, 43238]);
});
test('fool\'s mate is checkmate with SAN', () => {
  const g = newGame();
  for (const [a, b] of [['f2','f3'],['e7','e5'],['g2','g4'],['d8','h4']]) assert.ok(play(g, q(a), q(b)).ok);
  assert.equal(g.moves.at(-1), 'Qh4#'); assert.ok(g.over); assert.equal(g.result.winner, 'b');
});
test('computer finds mate in one and plays legal games', () => {
  const g = newGame('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
  const m = aiMove(g, 2); assert.ok(play(g, m.from, m.to, m.promo).ok); assert.equal(g.moves[0], 'Ra8#');
  const h = newGame();
  for (let k = 0; k < 30 && !h.over; k++) { const x = aiMove(h, 1); assert.ok(play(h, x.from, x.to, x.promo).ok); }
});
