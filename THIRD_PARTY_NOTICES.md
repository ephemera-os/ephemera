# Third Party Notices

This project bundles third-party materials. Their licenses apply to the corresponding files.

## Chess Piece SVGs ("cburnett")

- Used by: `js/apps/chess-cburnett-pieces.js`
- Author: Colin M. Burnett (aka "Cburnett")
- Origin: Commonly distributed via Wikimedia Commons as the "Chess_*.svg" set, and used by lichess.org as the
  "cburnett" piece theme.
- License: Multi-licensed upstream. The upstream notice states you may choose one of:
  - GNU Free Documentation License, Version 1.2 or later
  - Creative Commons Attribution-ShareAlike 3.0 Unported
  - BSD License
  - GNU General Public License, Version 2 or later

References:

- https://commons.wikimedia.org/wiki/User:Cburnett/GFDL_images/Chess
- https://commons.wikimedia.org/wiki/File:Chess_klt45.svg

## OliThink Chess Engine

- Used by: `chess_ref/olithink.js`, `chess_ref/engine-worker.js`
- Upstream project: OliThink
- Upstream repository: https://github.com/olithink/OliThink
- Upstream license: MIT
- Notes: `chess_ref/olithink.js` is a JavaScript port/integration based on OliThink sources.

## Opening Book Data

- Used by: `chess_ref/opening-book.js`
- Source dataset: `lichess-org/chess-openings` (`a.tsv` ... `e.tsv`)
- Source repository: https://github.com/lichess-org/chess-openings
- Source license: CC0 / Public Domain
- Notes: `chess_ref/opening-book.js` is generated data with provenance and generation timestamp embedded in the file header.
