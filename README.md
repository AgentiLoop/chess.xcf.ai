# ♞ chess.xcf.ai — online chess

🤖 **Made with [AgentiLoop Agent!](https://github.com/AgentiLoop/Agent)**, the autonomous AI agent for your Mac · 🌐 [agentiloop.ai](https://agentiloop.ai) · ▶️ **Play:** [chess.xcf.ai](https://chess.xcf.ai)

Play chess in the browser at **https://chess.xcf.ai**. Built by [AgentiLoop Agent!](https://agentiloop.ai).

- **🤖 vs Computer:** play White or Black at Easy, Medium or Hard. The computer is an alpha-beta search (up to 4 plies on Hard) over material and piece-square scores, with captures searched first.
- **👥 Same screen:** two players take turns on one device, with undo and board flip.
- **🌐 Online:** create a room, share the `/r/<code>` link. The first two people to join play White and Black, everyone after that watches. Refresh or reconnect and you keep your color. Rematch swaps colors.
- Full rules: castling, en passant, promotion (pick the piece), check, checkmate, stalemate, the 50-move rule, threefold repetition and insufficient material. Moves are listed in standard algebraic notation.

## How it's built

| Part | File | Runs on |
|---|---|---|
| Rules engine (move generation, SAN, game end, computer player) | `public/engine.js` | Browser **and** Durable Object (same file) |
| Board UI (lobby, board, move list, online client) | `public/index.html`, `app.js`, `style.css` | Browser |
| Room codes + static assets + WebSocket routing | `src/index.js` (`fetch`) | Cloudflare Worker |
| One online game per room, server-side move validation | `src/index.js` (`ChessRoom`) | Durable Object (SQLite storage) |

No framework, no build step, no image files: the board is CSS and the pieces are Unicode chess glyphs.

The move generator is checked with **perft** against the standard reference counts (start position to depth 3, "Kiwipete" to depth 3, position 3 to depth 4).

## Run / test / deploy
```sh
npm install
npm run dev                         # http://localhost:8787
npm test                            # perft + rules + computer tests
node test/e2e.mjs http://localhost:8787   # two players + a spectator over WebSockets
npm run deploy                      # creates the chess.xcf.ai custom domain
```
Sister site: [go.xcf.ai](https://go.xcf.ai).
