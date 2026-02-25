(() => {
  'use strict';

  const VER = '5.11.9-js-port';
  const EMPTY = 0;
  const PAWN = 1;
  const KNIGHT = 2;
  const KING = 3;
  const ENP = 4;
  const BISHOP = 5;
  const ROOK = 6;
  const QUEEN = 7;

  const LOWER = 0;
  const EXACT = 1;
  const UPPER = 2;

  const NO_MOVE = 0;
  const ANY_MOVE = 1;
  const GOOD_MOVE = 2;

  const HASH = 0;
  const NOISY = 1;
  const QUIET = 2;
  const EXIT = 3;

  const HMASK = 0x7fffff;
  const CNODES = 0x3fff;
  const MAXSCORE = 16384;

  const MASK64 = (1n << 64n) - 1n;
  const U64 = (v) => v & MASK64;
  const not64 = (v) => (~v) & MASK64;

  const pval = [0, 100, 290, 0, 100, 310, 500, 950];
  const fval = [0, 0, 2, 0, 0, 3, 5, 9];
  const cornbase = [4, 4, 2, 1, 0, 0, 0];
  const pieceChar = '*PNK.BRQ';
  const nullvar = [13, 43, 149, 519, 1809, 6311, 22027];

  const _knight = [-17, -10, 6, 15, 17, 10, -6, -15];
  const _king = [-9, -1, 7, 8, 9, 1, -7, -8];

  const FROM = (x) => x & 63;
  const TO = (x) => (x >> 6) & 63;
  const ONMV = (x) => (x >> 12) & 1;
  const PROM = (x) => (x >> 13) & 7;
  const PIECE = (x) => (x >> 16) & 7;
  const CAP = (x) => (x >> 19) & 7;
  const _TO = (x) => x << 6;
  const _ONMV = (x) => x << 12;
  const _PROM = (x) => x << 13;
  const _PIECE = (x) => x << 16;
  const _CAP = (x) => x << 19;
  const PREMOVE = (f, p, c) => (f | _ONMV(c) | _PIECE(p));

  const ISFILE = (ch) => ch >= 'a' && ch <= 'h';
  const ISRANK = (ch) => ch >= '1' && ch <= '8';

  const MIN = (a, b) => (a < b ? a : b);
  const MAX = (a, b) => (a > b ? a : b);
  const truncDiv = (a, b) => Math.trunc(a / b);

  function bitcnt(v) {
    let x = U64(v);
    let c = 0;
    while (x) {
      x &= x - 1n;
      c++;
    }
    return c;
  }

  function getLsb(v) {
    const x = U64(v);
    if (!x) return -1;
    const low = Number(x & 0xffffffffn);
    if (low) return 31 - Math.clz32(low & -low);
    const high = Number((x >> 32n) & 0xffffffffn);
    return 63 - Math.clz32(high & -high);
  }

  function createMoveList() {
    return { n: 0, list: new Int32Array(256) };
  }

  function createPos() {
    return {
      hash: 0n,
      king: new Int32Array(2),
      sf: new Int32Array(3),
      color: new Array(3).fill(0n),
      piece: new Array(8).fill(0n)
    };
  }

  function copyPos(dst, src) {
    dst.hash = src.hash;
    dst.king[0] = src.king[0];
    dst.king[1] = src.king[1];
    dst.sf[0] = src.sf[0];
    dst.sf[1] = src.sf[1];
    dst.sf[2] = src.sf[2];
    for (let i = 0; i < 3; i++) dst.color[i] = src.color[i];
    for (let i = 0; i < 8; i++) dst.piece[i] = src.piece[i];
  }

  class OliThinkEnginePort {
    constructor() {
      this.P = createPos();

      this.hashKey = new BigUint64Array(HMASK + 1);
      this.hashMove = new Int32Array(HMASK + 1);
      this.hashValue = new Int16Array(HMASK + 1);
      this.hashDepth = new Int8Array(HMASK + 1);
      this.hashType = new Int8Array(HMASK + 1);

      this.hstack = new Array(0x400).fill(0n);
      this.mstack = new Array(0x400).fill(0n);
      this.hashxor = new Array(0x1000).fill(0n);

      this.pmoves = [new Array(64).fill(0n), new Array(64).fill(0n)];
      this.pawnprg = [new Array(64).fill(0n), new Array(64).fill(0n)];
      this.pawnfree = [new Array(64).fill(0n), new Array(64).fill(0n)];
      this.pawnfile = [new Array(64).fill(0n), new Array(64).fill(0n)];
      this.pawnhelp = [new Array(64).fill(0n), new Array(64).fill(0n)];
      this.RANK = [new Int32Array(64), new Int32Array(64)];
      this.pcaps = [new Array(192).fill(0n), new Array(192).fill(0n)];

      this.BIT = new Array(64).fill(0n);
      this.nmoves = new Array(64).fill(0n);
      this.kmoves = new Array(64).fill(0n);
      this.bmask135 = new Array(64).fill(0n);
      this.bmask45 = new Array(64).fill(0n);
      this.rmask0 = new Array(64).fill(0n);
      this.rankb = new Array(8).fill(0n);
      this.fileb = new Array(8).fill(0n);
      this.raysRank = new Array(8 * 64).fill(0n);
      this.raysAFile = new Array(8 * 64).fill(0n);
      this.xrayRank = new Array(8 * 64).fill(0n);
      this.xrayAFile = new Array(8 * 64).fill(0n);

      this.whitesq = 0n;
      this.centr = 0n;
      this.centr2 = 0n;
      this.maxtime = 0;
      this.starttime = 0;
      this.eval1 = 0;
      this.nodes = 0;
      this.qnodes = 0;

      this.crevoke = new Uint32Array(64);
      this.count = 0;
      this.flags = 0;
      this.pondering = 0;

      this.pv = Array.from({ length: 128 }, () => new Int32Array(128));
      this.killer = new Int32Array(128);
      this.wstack = new Int32Array(0x400);
      this.history = new Int32Array(0x2000);
      this.kmobil = new Int32Array(64);
      this.bishcorn = new Int32Array(64);
      this.tmpMoveList = createMoveList();
      this.swapScratch = new Int32Array(32);
      this.framePool = [];
      this.frameTop = 0;
      for (let i = 0; i < 192; i++) {
        this.framePool.push({ mp1: createMoveList(), mp2: createMoveList(), pos: createPos() });
      }

      this.sabort = 0;
      this.onmove = 0;
      this.sd = 64;
      this.ttime = 30000;
      this.mps = 0;
      this.inc = 0;
      this.st = 0;
      this.sfen = 'rnbqkbnr/pppppppp/////PPPPPPPP/RNBQKBNR w KQkq - 0 1';

      this._init();
    }

    _acquireFrame() {
      const idx = this.frameTop++;
      if (idx >= this.framePool.length) {
        this.framePool.push({ mp1: createMoveList(), mp2: createMoveList(), pos: createPos() });
      }
      return this.framePool[idx];
    }

    _releaseFrame() {
      if (this.frameTop > 0) this.frameTop--;
    }

    _resetSearchState() {
      for (let i = 0; i < 128; i++) this.pv[i].fill(0);
      this.killer.fill(0);
      this.history.fill(0);
      this.frameTop = 0;
    }

    MAT() {
      return this.P.sf[2];
    }

    setMAT(v) {
      this.P.sf[2] = v;
    }

    BOARD() {
      return this.P.color[2];
    }

    setBOARD(v) {
      this.P.color[2] = U64(v);
    }

    RQU() {
      return U64(this.P.piece[QUEEN] | this.P.piece[ROOK]);
    }

    BQU() {
      return U64(this.P.piece[QUEEN] | this.P.piece[BISHOP]);
    }

    ENPASS() {
      return this.flags & 63;
    }

    CASTLE(c) {
      return this.flags & (320 << c);
    }

    COUNT() {
      return this.count & 0x3ff;
    }

    NOMATEMAT(c) {
      return ((this.P.sf[c] <= 4 || (this.P.sf[c] <= 8 && this.P.sf[c] <= this.P.sf[c ^ 1] + 3)) &&
        ((this.P.piece[PAWN] & this.P.color[c]) === 0n));
    }

    hasp(c) {
      return U64(this.P.hash ^ this.hashxor[this.flags | 1024 | (c << 11)]);
    }

    RATT1(f, occ) {
      return U64(this.raysRank[((f & 7) << 6) + this.key000(occ, f)] & this.rmask0[f]);
    }

    RATT2(f, occ) {
      return U64(this.raysAFile[((f >> 3) << 6) + this.key090(occ, f)] << BigInt(f & 7));
    }

    BATT3(f, occ) {
      return U64(this.raysRank[((f & 7) << 6) + this.key045(occ, f)] & this.bmask45[f]);
    }

    BATT4(f, occ) {
      return U64(this.raysRank[((f & 7) << 6) + this.key135(occ, f)] & this.bmask135[f]);
    }

    RXRAY1(f, occ) {
      return U64(this.xrayRank[((f & 7) << 6) + this.key000(occ, f)] & this.rmask0[f]);
    }

    RXRAY2(f, occ) {
      return U64(this.xrayAFile[((f >> 3) << 6) + this.key090(occ, f)] << BigInt(f & 7));
    }

    BXRAY3(f, occ) {
      return U64(this.xrayRank[((f & 7) << 6) + this.key045(occ, f)] & this.bmask45[f]);
    }

    BXRAY4(f, occ) {
      return U64(this.xrayRank[((f & 7) << 6) + this.key135(occ, f)] & this.bmask135[f]);
    }

    RATT(f, occ) {
      return U64(this.RATT1(f, occ) | this.RATT2(f, occ));
    }

    BATT(f, occ) {
      return U64(this.BATT3(f, occ) | this.BATT4(f, occ));
    }

    KMOVE(x, occ) {
      return U64(this.kmoves[x] & not64(occ));
    }

    KCAP(x, c) {
      return U64(this.kmoves[x] & this.P.color[c ^ 1]);
    }

    PMOVE(x, c, occ) {
      return U64(this.pmoves[c][x] & not64(occ));
    }

    PCAP(x, c) {
      return U64(this.pcaps[c][x] & this.P.color[c ^ 1]);
    }

    PCA3(x, c) {
      const epMask = this.BIT[this.ENPASS()] & (c ? 0xff0000n : 0xff0000000000n);
      return U64(this.pcaps[c][x | 64] & U64(this.P.color[c ^ 1] | epMask));
    }

    PCA4(x, c) {
      const epMask = this.BIT[this.ENPASS()] & (c ? 0xff0000n : 0xff0000000000n);
      return U64(this.pcaps[c][x | 128] & U64(this.P.color[c ^ 1] | epMask));
    }

    getTime() {
      return Math.floor(performance.now());
    }

    bioskey() {
      return 0;
    }

    _getpiece(s) {
      for (let i = 1; i < 8; i++) {
        if (pieceChar[i] === s) return { piece: i, c: 0 };
        if (pieceChar[i] === s.toUpperCase() && s === s.toLowerCase()) return { piece: i, c: 1 };
      }
      if (s >= 'A' && s <= 'Z') {
        const lower = s.toLowerCase();
        for (let i = 1; i < 8; i++) {
          if (pieceChar[i].toLowerCase() === lower) return { piece: i, c: 0 };
        }
      } else {
        for (let i = 1; i < 8; i++) {
          if (pieceChar[i].toLowerCase() === s) return { piece: i, c: 1 };
        }
      }
      return { piece: 0, c: 0 };
    }

    _parse_fen(fen, reset) {
      const parts = String(fen).trim().split(/\s+/);
      const pos = parts[0] || '';
      const mv = parts[1] || 'w';
      const cas = parts[2] || '-';
      const enps = parts[3] || '-';
      let halfm = parseInt(parts[4] || '0', 10);
      let fullm = parseInt(parts[5] || '1', 10);
      if (!Number.isFinite(fullm) || fullm < 1) fullm = 1;
      if (!Number.isFinite(halfm) || halfm < 0) halfm = 0;

      this.P = createPos();

      let i = 0;
      let col = 0;
      let row = 7;
      while (i < pos.length) {
        const s = pos[i++];
        if (s === '/') {
          row--;
          col = 0;
        } else if (s >= '1' && s <= '8') {
          col += Number(s);
        } else {
          const info = this._getpiece(s);
          const p = info.piece;
          const c = info.c;
          const t = row * 8 + col;
          col++;
          if (p === KING) {
            this.P.king[c] = t;
          } else {
            this.setMAT(this.MAT() + this.changeMat(_CAP(p) | _TO(t), c ^ 1, -1));
          }
          this.P.hash = U64(this.P.hash ^ this.hashxor[col | (row << 3) | (p << 6) | (c << 9)]);
          this.P.piece[p] = U64(this.P.piece[p] | this.BIT[t]);
          this.P.color[c] = U64(this.P.color[c] | this.BIT[t]);
        }
      }

      this.onmove = mv === 'b' ? 1 : 0;
      this.flags = 0;
      this.count = (fullm - 1) * 2 + this.onmove + (halfm << 10);

      for (let k = 0; k < cas.length; k++) {
        const s = cas[k];
        const b = s === 'K' ? 6 : s === 'k' ? 7 : s === 'Q' ? 8 : s === 'q' ? 9 : 0;
        if (b) this.flags |= Number(this.BIT[b]);
      }

      if (enps.length >= 2 && enps[0] >= 'a' && enps[0] <= 'h' && enps[1] >= '1' && enps[1] <= '8') {
        this.flags |= 8 * (enps[1].charCodeAt(0) - 49) + (enps[0].charCodeAt(0) - 97);
      }

      for (let j = 0; j < this.COUNT(); j++) this.hstack[j] = 0n;
      if (reset) {
        this.hashKey.fill(0n);
        this.hashMove.fill(0);
        this.hashValue.fill(0);
        this.hashDepth.fill(0);
        this.hashType.fill(0);
      }
      this.setBOARD(this.P.color[0] | this.P.color[1]);
    }

    _init_pawns(moves, caps, freep, filep, helpp, prgp, c) {
      for (let i = 0; i < 64; i++) {
        const rank = (i / 8) | 0;
        const file = i & 7;
        let m = i + (c ? -8 : 8);
        prgp[i] = BigInt(1 << (c ? 7 - rank : rank));

        for (let j = 0; j < 64; j++) {
          const jrank = (j / 8) | 0;
          const df = (j & 7) - file;
          const dfile = df * df;
          if (dfile > 1) continue;
          if ((c && jrank < rank) || (!c && jrank > rank)) {
            if (dfile === 0) filep[i] = U64(filep[i] | this.BIT[j]);
            freep[i] = U64(freep[i] | this.BIT[j]);
          } else if (dfile !== 0 && (jrank - rank) * (jrank - rank) <= 1) {
            helpp[i] = U64(helpp[i] | this.BIT[j]);
          }
        }

        if (m < 0 || m > 63) continue;
        moves[i] = U64(moves[i] | this.BIT[m]);
        if (file > 0) {
          m = i + (c ? -9 : 7);
          if (m >= 0 && m <= 63) {
            caps[i] = U64(caps[i] | this.BIT[m]);
            caps[i + 64 * (2 - c)] = U64(caps[i + 64 * (2 - c)] | this.BIT[m]);
          }
        }
        if (file < 7) {
          m = i + (c ? -7 : 9);
          if (m >= 0 && m <= 63) {
            caps[i] = U64(caps[i] | this.BIT[m]);
            caps[i + 64 * (c + 1)] = U64(caps[i + 64 * (c + 1)] | this.BIT[m]);
          }
        }
      }
    }

    _init_shorts(moves, m) {
      for (let i = 0; i < 64; i++) {
        for (let j = 0; j < 8; j++) {
          const n = i + m[j];
          const diff = (n & 7) - (i & 7);
          if (n < 64 && n >= 0 && diff * diff <= 4) {
            moves[i] = U64(moves[i] | this.BIT[n]);
          }
        }
      }
    }

    _occ_free_board(bc, del, free) {
      let perm = free;
      let f = free;
      for (let i = 0; i < bc; i++) {
        const low = f & -f;
        f &= not64(low);
        if ((del & (1 << i)) === 0) perm &= not64(low);
      }
      return U64(perm);
    }

    _rook0(f, board, t) {
      let occ = 0n;
      let xray = 0n;
      let b = 0;
      for (let i = f + 1; i < 64 && i % 8 !== 0; i++) {
        if (this.BIT[i] & board) {
          if (b) {
            xray = U64(xray | this.BIT[i]);
            break;
          }
          occ = U64(occ | this.BIT[i]);
          b = 1;
        } else if (!b) {
          occ = U64(occ | this.BIT[i]);
        }
      }
      b = 0;
      for (let i = f - 1; i >= 0 && i % 8 !== 7; i--) {
        if (this.BIT[i] & board) {
          if (b) {
            xray = U64(xray | this.BIT[i]);
            break;
          }
          occ = U64(occ | this.BIT[i]);
          b = 1;
        } else if (!b) {
          occ = U64(occ | this.BIT[i]);
        }
      }
      return t ? xray : occ;
    }

    _rook90(f, board, t) {
      let occ = 0n;
      let xray = 0n;
      let b = 0;
      for (let i = f - 8; i >= 0; i -= 8) {
        if (this.BIT[i] & board) {
          if (b) {
            xray = U64(xray | this.BIT[i]);
            break;
          }
          occ = U64(occ | this.BIT[i]);
          b = 1;
        } else if (!b) {
          occ = U64(occ | this.BIT[i]);
        }
      }
      b = 0;
      for (let i = f + 8; i < 64; i += 8) {
        if (this.BIT[i] & board) {
          if (b) {
            xray = U64(xray | this.BIT[i]);
            break;
          }
          occ = U64(occ | this.BIT[i]);
          b = 1;
        } else if (!b) {
          occ = U64(occ | this.BIT[i]);
        }
      }
      return t ? xray : occ;
    }

    _bishop45(f, board, t) {
      let occ = 0n;
      let xray = 0n;
      let b = 0;
      for (let i = f + 9; i < 64 && i % 8 !== 0; i += 9) {
        if (this.BIT[i] & board) {
          if (b) {
            xray = U64(xray | this.BIT[i]);
            break;
          }
          occ = U64(occ | this.BIT[i]);
          b = 1;
        } else if (!b) {
          occ = U64(occ | this.BIT[i]);
        }
      }
      b = 0;
      for (let i = f - 9; i >= 0 && i % 8 !== 7; i -= 9) {
        if (this.BIT[i] & board) {
          if (b) {
            xray = U64(xray | this.BIT[i]);
            break;
          }
          occ = U64(occ | this.BIT[i]);
          b = 1;
        } else if (!b) {
          occ = U64(occ | this.BIT[i]);
        }
      }
      return t ? xray : occ;
    }

    _bishop135(f, board, t) {
      let occ = 0n;
      let xray = 0n;
      let b = 0;
      for (let i = f - 7; i >= 0 && i % 8 !== 0; i -= 7) {
        if (this.BIT[i] & board) {
          if (b) {
            xray = U64(xray | this.BIT[i]);
            break;
          }
          occ = U64(occ | this.BIT[i]);
          b = 1;
        } else if (!b) {
          occ = U64(occ | this.BIT[i]);
        }
      }
      b = 0;
      for (let i = f + 7; i < 64 && i % 8 !== 7; i += 7) {
        if (this.BIT[i] & board) {
          if (b) {
            xray = U64(xray | this.BIT[i]);
            break;
          }
          occ = U64(occ | this.BIT[i]);
          b = 1;
        } else if (!b) {
          occ = U64(occ | this.BIT[i]);
        }
      }
      return t ? xray : occ;
    }

    _init_rays(rays, xrays, rayFunc, key, file) {
      const fileStep = Number(file);
      for (let f = 0; f < 64; f += fileStep) {
        const mmask = U64(rayFunc.call(this, f, 0n, 0) | this.BIT[f]);
        const bc = bitcnt(mmask);
        const iperm = 1 << bc;
        for (let i = 0; i < iperm; i++) {
          const board = this._occ_free_board(bc, i, mmask);
          const occ = rayFunc.call(this, f, board, 0);
          const xray = rayFunc.call(this, f, board, 1);
          const index = Number(key.call(this, board, f));
          const ix = ((f / fileStep) | 0) & 7;
          const ridx = (ix << 6) + index;
          rays[ridx] = U64(rays[ridx] | occ);
          xrays[ridx] = U64(xrays[ridx] | xray);
        }
      }
    }

    identPiece(f) {
      for (let i = PAWN; i <= QUEEN; i++) {
        if (i !== ENP && (this.BIT[f] & this.P.piece[i])) return i;
      }
      return ENP;
    }

    key000(b, f) {
      return Number((b >> BigInt((f & 56) + 1)) & 0x3fn);
    }

    key090(b, f) {
      const _b = (b >> BigInt(f & 7)) & 0x0101010101010101n;
      return Number(U64(_b * 0x0080402010080400n) >> 58n);
    }

    key045(b, f) {
      return Number(U64((b & this.bmask45[f]) * 0x0202020202020202n) >> 58n);
    }

    key135(b, f) {
      return Number(U64((b & this.bmask135[f]) * 0x0202020202020202n) >> 58n);
    }

    reach(f, c, occ) {
      return U64(((this.nmoves[f] & this.P.piece[KNIGHT]) | (this.RATT(f, occ) & this.RQU()) |
        (this.BATT(f, occ) & this.BQU())) & this.P.color[c ^ 1]);
    }

    attacked(f, c) {
      return U64((this.PCAP(f, c) & this.P.piece[PAWN]) | this.reach(f, c, this.BOARD()));
    }

    pinnedPieces(k, oc) {
      let pin = 0n;
      const occ = this.BOARD();
      let b = U64((this.RXRAY1(k, occ) | this.RXRAY2(k, occ)) & this.P.color[oc] & this.RQU());
      while (b) {
        const low = b & -b;
        const t = getLsb(low);
        b ^= low;
        pin = U64(pin | (this.RATT(k, occ) & this.RATT(t, occ) & this.P.color[oc ^ 1]));
      }
      b = U64((this.BXRAY3(k, occ) | this.BXRAY4(k, occ)) & this.P.color[oc] & this.BQU());
      while (b) {
        const low = b & -b;
        const t = getLsb(low);
        b ^= low;
        pin = U64(pin | (this.BATT(k, occ) & this.BATT(t, occ) & this.P.color[oc ^ 1]));
      }
      return pin;
    }

    getDir(f, t) {
      if (((f ^ t) & 56) === 0) return 8;
      if (((f ^ t) & 7) === 0) return 16;
      return ((f - t) % 9 === 0) ? 32 : 64;
    }

    changeMat(m, c, d) {
      let dm = pval[CAP(m)];
      if (PROM(m)) dm += -pval[PAWN] + pval[PROM(m)];
      this.P.sf[c] += d * fval[PROM(m)];
      this.P.sf[c ^ 1] -= d * fval[CAP(m)];
      return c ? -d * dm : d * dm;
    }

    move(m, c, d) {
      let f = FROM(m);
      let t = TO(m);
      const p = PIECE(m);
      let a = CAP(m);

      this.P.color[c] = U64(this.P.color[c] ^ (this.BIT[f] | this.BIT[t]));
      this.P.piece[p] = U64(this.P.piece[p] ^ (this.BIT[f] | this.BIT[t]));
      this.P.hash = U64(this.P.hash ^ this.hashxor[f | (p << 6) | (c << 9)]);
      this.P.hash = U64(this.P.hash ^ this.hashxor[t | (p << 6) | (c << 9)]);

      if (a) {
        if (a === ENP) {
          t = (t & 7) | (f & 56);
          a = PAWN;
        } else if (a === ROOK) {
          this.flags &= this.crevoke[t];
        }
        this.P.piece[a] = U64(this.P.piece[a] ^ this.BIT[t]);
        this.P.color[c ^ 1] = U64(this.P.color[c ^ 1] ^ this.BIT[t]);
        this.P.hash = U64(this.P.hash ^ this.hashxor[t | (a << 6) | ((c ^ 1) << 9)]);
        this.count &= 0x3ff;
        this.setMAT(this.MAT() + this.changeMat(m, c, d));
      }

      if (p === PAWN) {
        if (((f ^ t) & 8) === 0) this.flags |= f ^ 24;
        else if ((t & 56) === 0 || (t & 56) === 56) {
          this.P.piece[PAWN] = U64(this.P.piece[PAWN] ^ this.BIT[t]);
          this.P.piece[PROM(m)] = U64(this.P.piece[PROM(m)] ^ this.BIT[t]);
          this.P.hash = U64(this.P.hash ^ this.hashxor[t | (PAWN << 6) | (c << 9)]);
          this.P.hash = U64(this.P.hash ^ this.hashxor[t | (PROM(m) << 6) | (c << 9)]);
          if (!a) this.setMAT(this.MAT() + this.changeMat(m, c, d));
        }
        this.count &= 0x3ff;
      } else if (p === KING) {
        if (this.P.king[c] === f) this.P.king[c] = t;
        else this.P.king[c] = f;
        this.flags &= ~(320 << c);
        if (((f ^ t) & 3) === 2) {
          t = (f < t) ? f + 1 : f - 1;
          f = (f < t) ? f + 3 : f - 4;
          this.P.color[c] = U64(this.P.color[c] ^ (this.BIT[f] | this.BIT[t]));
          this.P.piece[ROOK] = U64(this.P.piece[ROOK] ^ (this.BIT[f] | this.BIT[t]));
          this.P.hash = U64(this.P.hash ^ this.hashxor[f | (ROOK << 6) | (c << 9)]);
          this.P.hash = U64(this.P.hash ^ this.hashxor[t | (ROOK << 6) | (c << 9)]);
        }
      } else if (p === ROOK) {
        this.flags &= this.crevoke[f];
      }
      this.setBOARD(this.P.color[0] | this.P.color[1]);
    }

    doMove(m, c) {
      this.mstack[this.COUNT()] = BigInt(this.count | (this.flags << 17)) | (BigInt(m) << 27n);
      this.flags &= 960;
      this.count += 0x401;
      if (m) this.move(m, c, 1);
    }

    undoMove(m, c) {
      const u = this.mstack[this.COUNT() - 1];
      if (m) this.move(m, c, -1);
      this.count = Number(u & 0x1ffffn);
      this.flags = Number((u >> 17n) & 0x3ffn);
    }

    regMoves(m, bt, mp, cap) {
      let b = bt;
      while (b) {
        const low = b & -b;
        const t = getLsb(low);
        b ^= low;
        mp.list[mp.n++] = m | _TO(t) | (cap ? _CAP(this.identPiece(t)) : 0);
      }
    }

    regPromotions(f, c, bt, mp, cap, queen) {
      let b = bt;
      while (b) {
        const low = b & -b;
        const t = getLsb(low);
        b ^= low;
        const m = f | _ONMV(c) | _PIECE(PAWN) | _TO(t) | (cap ? _CAP(this.identPiece(t)) : 0);
        if (queen) mp.list[mp.n++] = m | _PROM(QUEEN);
        mp.list[mp.n++] = m | _PROM(KNIGHT);
        mp.list[mp.n++] = m | _PROM(ROOK);
        mp.list[mp.n++] = m | _PROM(BISHOP);
      }
    }

    regKings(m, bt, mp, c, cap) {
      let b = bt;
      while (b) {
        const low = b & -b;
        const t = getLsb(low);
        b ^= low;
        if (this.attacked(t, c) | (this.KCAP(t, c) & this.P.piece[KING])) continue;
        mp.list[mp.n++] = m | _TO(t) | (cap ? _CAP(this.identPiece(t)) : 0);
      }
    }

    generateCheckEsc(ch, apin, c, k, mp) {
      let occ = this.BOARD();
      const bfCount = bitcnt(ch);
      this.setBOARD(this.BOARD() ^ this.BIT[k]);
      this.regKings(PREMOVE(k, KING, c), this.KCAP(k, c), mp, c, 1);
      this.regKings(PREMOVE(k, KING, c), this.KMOVE(k, occ), mp, c, 0);
      this.setBOARD(this.BOARD() ^ this.BIT[k]);
      if (bfCount > 1) return bfCount;

      let bf = getLsb(ch);
      let cc = this.attacked(bf, c ^ 1) & apin;
      while (cc) {
        const low = cc & -cc;
        const cf = getLsb(low);
        cc ^= low;
        const p = this.identPiece(cf);
        if (p === PAWN && this.RANK[c][cf] === 7) this.regPromotions(cf, c, ch, mp, 1, 1);
        else this.regMoves(PREMOVE(cf, p, c), ch, mp, 1);
      }

      if (this.ENPASS() && (ch & this.P.piece[PAWN])) {
        cc = this.PCAP(this.ENPASS(), c ^ 1) & this.P.piece[PAWN] & apin;
        while (cc) {
          const low = cc & -cc;
          const cf = getLsb(low);
          cc ^= low;
          this.regMoves(PREMOVE(cf, PAWN, c), this.BIT[this.ENPASS()], mp, 1);
        }
      }

      if (ch & (this.nmoves[k] | this.kmoves[k])) return 1;
      const d = this.getDir(bf, k);
      let fl;
      if (d === 8) fl = this.RATT1(bf, occ) & this.RATT1(k, occ);
      else if (d === 16) fl = this.RATT2(bf, occ) & this.RATT2(k, occ);
      else if (d === 32) fl = this.BATT3(bf, occ) & this.BATT3(k, occ);
      else fl = this.BATT4(bf, occ) & this.BATT4(k, occ);

      while (fl) {
        const lowf = fl & -fl;
        const f = getLsb(lowf);
        fl ^= lowf;
        cc = this.reach(f, c ^ 1, occ) & apin;
        while (cc) {
          const lowc = cc & -cc;
          const cf = getLsb(lowc);
          cc ^= lowc;
          this.regMoves(PREMOVE(cf, this.identPiece(cf), c), this.BIT[f], mp, 0);
        }
        bf = c ? f + 8 : f - 8;
        if (bf < 0 || bf > 63 || !((this.P.piece[PAWN] & this.P.color[c] & apin))) continue;
        cc = this.P.piece[PAWN] & this.P.color[c] & apin;
        if (this.BIT[bf] & cc) {
          if (this.RANK[c][bf] === 7) this.regPromotions(bf, c, this.BIT[f], mp, 0, 1);
          else this.regMoves(PREMOVE(bf, PAWN, c), this.BIT[f], mp, 0);
        }
        if (this.RANK[c][f] === 4 && !(occ & this.BIT[bf]) && (this.BIT[c ? f + 16 : f - 16] & cc)) {
          this.regMoves(PREMOVE(c ? f + 16 : f - 16, PAWN, c), this.BIT[f], mp, 0);
        }
      }
      return 1;
    }

    generateSlides(c, k, pin, mp, tb, cb, q) {
      const occ = this.BOARD();
      let b;

      b = this.P.piece[KNIGHT] & cb;
      while (b) {
        const low = b & -b;
        const f = getLsb(low);
        b ^= low;
        this.regMoves(PREMOVE(f, KNIGHT, c), this.nmoves[f] & tb, mp, q);
      }

      b = this.P.piece[ROOK] & cb;
      while (b) {
        const low = b & -b;
        const f = getLsb(low);
        b ^= low;
        this.regMoves(PREMOVE(f, ROOK, c), this.RATT(f, occ) & tb, mp, q);
      }

      b = this.P.piece[BISHOP] & cb;
      while (b) {
        const low = b & -b;
        const f = getLsb(low);
        b ^= low;
        this.regMoves(PREMOVE(f, BISHOP, c), this.BATT(f, occ) & tb, mp, q);
      }

      b = this.P.piece[QUEEN] & cb;
      while (b) {
        const low = b & -b;
        const f = getLsb(low);
        b ^= low;
        this.regMoves(PREMOVE(f, QUEEN, c), (this.RATT(f, occ) | this.BATT(f, occ)) & tb, mp, q);
      }

      if (pin) {
        b = pin & (this.RQU() | this.P.piece[BISHOP]);
        while (b) {
          const low = b & -b;
          const f = getLsb(low);
          b ^= low;
          const p = this.identPiece(f);
          const t = p | this.getDir(f, k);
          if ((t & 10) === 10) this.regMoves(PREMOVE(f, p, c), this.RATT1(f, occ) & tb, mp, q);
          if ((t & 18) === 18) this.regMoves(PREMOVE(f, p, c), this.RATT2(f, occ) & tb, mp, q);
          if ((t & 33) === 33) this.regMoves(PREMOVE(f, p, c), this.BATT3(f, occ) & tb, mp, q);
          if ((t & 65) === 65) this.regMoves(PREMOVE(f, p, c), this.BATT4(f, occ) & tb, mp, q);
        }
      }
    }

    dualatt(x, y, c) {
      return U64(this.attacked(x, c) | this.attacked(y, c) | ((this.KCAP(x, c) | this.KCAP(y, c)) & this.P.piece[KING]));
    }

    generateQuiet(c, k, pin, mp) {
      const cb = this.P.color[c] & not64(pin);
      const tb = not64(this.BOARD());
      const occ = this.BOARD();

      let b = this.P.piece[PAWN] & this.P.color[c];
      while (b) {
        const low = b & -b;
        const f = getLsb(low);
        b ^= low;
        const t = (this.BIT[f] & pin) ? this.getDir(f, k) : 17;
        if (t === 8) continue;
        const r = this.RANK[c][f];
        let m = (t & 16) ? this.PMOVE(f, c, occ) : 0n;
        if (m && r === 2) m |= this.PMOVE(c ? f - 8 : f + 8, c, occ);
        if (r === 7) {
          const a = t === 17 ? this.PCAP(f, c) : t === 32 ? this.PCA3(f, c) : t === 64 ? this.PCA4(f, c) : 0n;
          if (a) this.regPromotions(f, c, a, mp, 1, 0);
          if (m) this.regPromotions(f, c, m, mp, 0, 0);
        } else if (r !== 6) {
          this.regMoves(PREMOVE(f, PAWN, c), m, mp, 0);
        }
      }

      if (this.CASTLE(c)) {
        b = this.P.piece[ROOK] & cb;
        while (b) {
          const low = b & -b;
          const f = getLsb(low);
          b ^= low;
          if (f === 63 && (this.flags & 128) && !(occ & (3n << 61n))) {
            if (!this.dualatt(61, 62, c)) this.regMoves(PREMOVE(60, KING, c), 1n << 62n, mp, 0);
          }
          if (f === 56 && (this.flags & 512) && !(occ & (7n << 57n))) {
            if (!this.dualatt(59, 58, c)) this.regMoves(PREMOVE(60, KING, c), 1n << 58n, mp, 0);
          }
          if (f === 7 && (this.flags & 64) && !(occ & (3n << 5n))) {
            if (!this.dualatt(5, 6, c)) this.regMoves(PREMOVE(4, KING, c), 1n << 6n, mp, 0);
          }
          if (f === 0 && (this.flags & 256) && !(occ & (7n << 1n))) {
            if (!this.dualatt(3, 2, c)) this.regMoves(PREMOVE(4, KING, c), 1n << 2n, mp, 0);
          }
        }
      }

      this.generateSlides(c, k, pin, mp, tb, cb, 0);
      this.regKings(PREMOVE(k, KING, c), this.kmoves[k] & tb, mp, c, 0);
    }

    generateNoisy(c, k, pin, mp) {
      const cb = this.P.color[c] & not64(pin);
      const tb = this.P.color[c ^ 1];
      let occ = this.BOARD();

      let b = this.P.piece[PAWN] & this.P.color[c];
      while (b) {
        const low = b & -b;
        const f = getLsb(low);
        b ^= low;
        const t = (this.BIT[f] & pin) ? this.getDir(f, k) : 17;
        if (t === 8) continue;
        const r = this.RANK[c][f];
        const m = (t & 16) ? this.PMOVE(f, c, occ) : 0n;
        let a = t === 17 ? this.PCAP(f, c) : t === 32 ? this.PCA3(f, c) : t === 64 ? this.PCA4(f, c) : 0n;
        if (r >= 6) {
          if (a) this.regMoves(PREMOVE(f, PAWN, c) | (r === 7 ? _PROM(QUEEN) : 0), a, mp, 1);
          if (m) this.regMoves(PREMOVE(f, PAWN, c) | (r === 7 ? _PROM(QUEEN) : 0), m, mp, 0);
        } else {
          if (t === 17 && this.ENPASS() && (this.BIT[this.ENPASS()] & this.pcaps[c][f])) {
            occ ^= this.BIT[this.ENPASS() ^ 8];
            if (!(this.RATT1(f, occ) & this.BIT[k]) || !(this.RATT1(f, occ) & tb & this.RQU())) {
              a |= this.BIT[this.ENPASS()];
            }
            occ ^= this.BIT[this.ENPASS() ^ 8];
          }
          this.regMoves(PREMOVE(f, PAWN, c), a, mp, 1);
        }
      }

      this.generateSlides(c, k, pin, mp, tb, cb, 1);
      this.regKings(PREMOVE(k, KING, c), this.kmoves[k] & tb, mp, c, 1);
    }

    generate(ch, c, mp, noisy, quiet) {
      const k = this.P.king[c];
      const pin = this.pinnedPieces(k, c ^ 1);
      mp.n = 0;
      if (ch) return this.generateCheckEsc(ch, not64(pin), c, k, mp);
      if (noisy) this.generateNoisy(c, k, pin, mp);
      if (quiet) this.generateQuiet(c, k, pin, mp);
      return 0;
    }

    swap(m) {
      const s_list = this.swapScratch;
      const f = FROM(m);
      const t = TO(m);
      let c = ONMV(m);
      let piece = PIECE(m);
      let nc = 1;
      let occ = this.BOARD() & not64(this.BIT[f]);
      let attacks = U64(((this.PCAP(t, 0) | this.PCAP(t, 1)) & this.P.piece[PAWN]) |
        (this.nmoves[t] & this.P.piece[KNIGHT]) | (this.kmoves[t] & this.P.piece[KING]));

      s_list[0] = pval[CAP(m)];
      do {
        s_list[nc] = -s_list[nc - 1] + pval[piece];
        c ^= 1;
        attacks = U64((attacks | (this.BATT(t, occ) & this.BQU()) | (this.RATT(t, occ) & this.RQU())) & occ);
        const cAttacks = attacks & this.P.color[c];
        if (!cAttacks) break;

        let temp = this.P.piece[PAWN] & cAttacks;
        if (temp) piece = PAWN;
        else if ((temp = this.P.piece[KNIGHT] & cAttacks)) piece = KNIGHT;
        else if ((temp = this.P.piece[BISHOP] & cAttacks)) piece = BISHOP;
        else if ((temp = this.P.piece[ROOK] & cAttacks)) piece = ROOK;
        else if ((temp = this.P.piece[QUEEN] & cAttacks)) piece = QUEEN;
        else {
          nc += !(this.P.color[c ^ 1] & attacks) ? 1 : 0;
          break;
        }
        occ ^= temp & -temp;
      } while (pval[piece] >= s_list[nc++]);

      while (--nc) {
        if (s_list[nc] > -s_list[nc - 1]) s_list[nc - 1] = -s_list[nc];
      }
      return s_list[0];
    }

    pick(mp, s, ply) {
      let pi = 0;
      let vmax = -9999;
      for (let i = s; i < mp.n; i++) {
        const m = mp.list[i];
        let t;
        if (ply < 0) {
          t = pval[CAP(m)] - fval[PIECE(m)];
        } else if (m === this.killer[ply]) {
          pi = i;
          break;
        } else {
          t = this.history[m & 0x1fff];
        }
        if (t > vmax) {
          vmax = t;
          pi = i;
        }
      }
      const m = mp.list[pi];
      if (pi !== s) mp.list[pi] = mp.list[s];
      return m;
    }

    pawnAttack(c) {
      const p = this.P.color[c] & this.P.piece[PAWN];
      return c
        ? U64(((p & not64(this.fileb[7])) >> 7n) | ((p & not64(this.fileb[0])) >> 9n))
        : U64(((p & not64(this.fileb[0])) << 7n) | ((p & not64(this.fileb[7])) << 9n));
    }

    mobilityb(c, occ) {
      let b = c ? (this.rankb[6] | (occ << 8n)) : (this.rankb[1] | (occ >> 8n));
      b &= this.P.color[c] & this.P.piece[PAWN];
      return not64(b | this.pawnAttack(c ^ 1));
    }

    kmobilf(c) {
      let km = this.kmobil[this.P.king[c]];
      const sfo = this.P.sf[c ^ 1];
      if (!this.P.sf[c] && sfo === 5 && this.P.piece[BISHOP] && !this.P.piece[PAWN]) {
        const bc = this.bishcorn[this.P.king[c]] << 5;
        if (this.P.piece[BISHOP] & this.whitesq) km += bc;
        else km -= bc;
      }
      return sfo < 14 ? km : truncDiv(km * (16 - sfo), 4);
    }

    evalc(c) {
      let mn = 0;
      let katt = 0;
      const oc = c ^ 1;
      const egf = truncDiv(10400, 80 + this.P.sf[c] + this.P.sf[oc]);
      const cb = this.P.color[c];
      const ocb = this.P.color[oc];
      let occ = this.BOARD();
      const mb = this.mobilityb(c, occ) & this.centr;
      const kn = this.kmoves[this.P.king[oc]] & not64(this.P.piece[PAWN]);
      const c3 = this.centr2 | this.rankb[c ? 1 : 6];

      let b = this.P.piece[PAWN] & cb;
      while (b) {
        const low = b & -b;
        const f = getLsb(low);
        b ^= low;
        let ppos = truncDiv(truncDiv(Number(this.pawnprg[c][f]) * egf * egf, 96), 96);
        if (!(this.pawnfree[c][f] & this.P.piece[PAWN] & ocb)) ppos <<= 1;
        if (!(this.pawnhelp[c][f] & this.P.piece[PAWN] & cb)) {
          const openfile = !(this.pawnfile[c][f] & this.P.piece[PAWN] & ocb);
          ppos -= openfile ? 32 : 10;
        }
        const a = this.pcaps[c][f] & occ;
        ppos += bitcnt(a & cb) << 2;
        katt += bitcnt(a & kn);
        mn += ppos | 0;
      }

      b = this.P.piece[KNIGHT] & cb;
      while (b) {
        const low = b & -b;
        const f = getLsb(low);
        b ^= low;
        const a = this.nmoves[f];
        katt += bitcnt(a & kn);
        mn += (bitcnt(a) + bitcnt(a & mb) + bitcnt(a & mb & c3)) << 2;
      }

      occ ^= this.BIT[this.P.king[oc]];
      occ ^= this.P.piece[QUEEN];
      b = this.P.piece[QUEEN] & cb;
      while (b) {
        const low = b & -b;
        const f = getLsb(low);
        b ^= low;
        const a = this.BATT(f, occ) | this.RATT(f, occ);
        katt += bitcnt(a & kn);
        const mob = bitcnt(a) + bitcnt(a & mb) + bitcnt(a & mb & c3);
        mn += truncDiv(truncDiv(mob * egf * egf, 80), 80);
      }

      occ ^= this.P.piece[ROOK];
      b = this.P.piece[BISHOP] & cb;
      while (b) {
        const low = b & -b;
        const f = getLsb(low);
        b ^= low;
        const a = this.BATT(f, occ);
        katt += bitcnt(a & kn);
        mn += (bitcnt(a) + bitcnt(a & mb) + bitcnt(a & mb & c3)) << 2;
      }

      b = this.P.piece[ROOK] & cb;
      while (b) {
        const low = b & -b;
        const f = getLsb(low);
        b ^= low;
        const a = this.RATT(f, occ);
        katt += bitcnt(a & kn);
        const mob = bitcnt(a) + bitcnt(a & mb) + bitcnt(a & mb & c3);
        mn += truncDiv(mob * egf, 40);
      }

      return mn + this.kmobilf(c) + katt * (this.P.sf[c] + 2);
    }

    eval(c) {
      let ev = this.evalc(c) - this.evalc(c ^ 1);
      this.eval1++;
      if ((this.MAT() < 0 && this.NOMATEMAT(1)) || (this.MAT() > 0 && this.NOMATEMAT(0))) return ev;
      return ev + (c ? -this.MAT() : this.MAT());
    }

    quiesce(ch, c, ply, alpha, beta) {
      let best = -MAXSCORE;
      if (ply === 127) return this.eval(c);
      if (!ch) {
        const cmat = c ? -this.MAT() : this.MAT();
        if (cmat - 125 >= beta) return beta;
        if (cmat + 85 > alpha) {
          best = this.eval(c);
          if (best >= beta) return beta;
          if (best > alpha) alpha = best;
        }
      }

      const frame = this._acquireFrame();
      const mp = frame.mp1;
      const pos = frame.pos;
      let posSaved = 0;
      try {
        this.generate(ch, c, mp, 1, 0);
        if (mp.n === 0) return ch ? -MAXSCORE + ply : (best > -MAXSCORE ? best : this.eval(c));

        for (let i = 0; i < mp.n; i++) {
          const m = this.pick(mp, i, -1);
          if (!ch && pval[PIECE(m)] > pval[CAP(m)] && this.swap(m) < 0) continue;
          if (!posSaved) {
            copyPos(pos, this.P);
            posSaved = 1;
          }
          this.doMove(m, c);
          this.qnodes++;
          const w = -this.quiesce(this.attacked(this.P.king[c ^ 1], c ^ 1), c ^ 1, ply + 1, -beta, -alpha);
          this.undoMove(0, c);
          copyPos(this.P, pos);
          if (w > best) {
            best = w;
            if (w > alpha) {
              alpha = w;
              if (alpha >= beta) return beta;
            }
          }
          if (ch) break;
        }
        return best > -MAXSCORE ? best : this.eval(c);
      } finally {
        this._releaseFrame();
      }
    }

    retPVMove(c) {
      const mp = this.tmpMoveList;
      this.generate(this.attacked(this.P.king[c], c), c, mp, 1, 1);
      for (let i = 0; i < mp.n; i++) {
        const m = mp.list[i];
        if (m === this.pv[0][0]) return m;
      }
      return 0;
    }

    isDraw(hp, nrep) {
      if (this.count > 0xfff) {
        const n = this.COUNT() - (this.count >> 10);
        if (this.count >= 0x400 * 100) return 2;
        let c = 0;
        for (let i = this.COUNT() - 2; i >= n; i -= 2) {
          if (this.hstack[i] === hp && ++c === nrep) return 1;
        }
      }
      return (!this.P.piece[PAWN] && !this.RQU() && bitcnt(this.BOARD()) <= 3) ? 3 : 0;
    }

    nullvariance(delta) {
      let r = 0;
      if (delta >= 4) {
        for (r = 1; r <= 7; r++) {
          if (delta < nullvar[r - 1]) break;
        }
      }
      return r;
    }

    search(ch, c, d, ply, alpha, beta, nullMove, sem) {
      const oc = c ^ 1;
      const pvnode = beta > alpha + 1;

      if (ply) this.pv[ply][ply] = 0;
      if (((++this.nodes) & CNODES) === 0) {
        if (!this.pondering && this.getTime() - this.starttime > this.maxtime) this.sabort = 1;
      }
      if (this.sabort) return alpha;

      const hp = this.hasp(c);
      if (ply && this.isDraw(hp, 1)) return 0;
      if (ch) d++;
      if (d <= 0 || ply > 100) return this.quiesce(ch, c, ply, alpha, beta);
      if (alpha < -MAXSCORE + ply) alpha = -MAXSCORE + ply;
      if (beta > MAXSCORE - ply - 1) beta = MAXSCORE - ply - 1;
      if (alpha >= beta) return alpha;

      let hmove = ply ? 0 : this.retPVMove(c);
      const hidx = Number(hp & BigInt(HMASK));
      const heKey = this.hashKey[hidx];
      const heMove = this.hashMove[hidx];
      const heValue = this.hashValue[hidx];
      const heDepth = this.hashDepth[hidx];
      const heType = this.hashType[hidx];

      if (heKey === hp && !sem) {
        if (heDepth >= d) {
          if (heType <= EXACT && heValue >= beta) return beta;
          if (heType >= EXACT && heValue <= alpha) return alpha;
        }
        if (!hmove) hmove = heMove;
      }

      let w;
      const wstat = this.wstack[this.COUNT()] = ch ? -MAXSCORE : (heKey === hp ? heValue : this.eval(c));
      if (!ch && heKey !== hp) {
        this.hashKey[hidx] = hp;
        this.hashMove[hidx] = hmove;
        this.hashValue[hidx] = wstat;
        this.hashDepth[hidx] = d;
        this.hashType[hidx] = LOWER;
      }
      if (!ch && !pvnode) {
        if (d <= 3 && wstat + 400 < beta) {
          w = this.quiesce(ch, c, ply, alpha, beta);
          if (w < beta) return w;
        }
        if (d <= 8 && wstat - 88 * d > beta) return beta;
      }

      const raising = !ch && ply >= 2 && wstat >= this.wstack[this.COUNT() - 2] && this.wstack[this.COUNT() - 2] !== -MAXSCORE;
      this.hstack[this.COUNT()] = hp;

      nullMove = nullMove && !ch && beta > -MAXSCORE + 500 && d > 1 && wstat > alpha && (ply < 2 || (this.mstack[this.COUNT() - 2] >> 27n));
      if (nullMove && bitcnt(this.P.color[c] & not64(this.P.piece[PAWN]) & not64(this.pinnedPieces(this.P.king[c], oc))) > 1) {
        const R = (((9 + d + this.nullvariance(wstat - alpha)) / 4) | 0) + (raising ? 1 : 0);
        this.doMove(0, c);
        w = -this.search(0n, oc, d - R, ply + 1, -beta, 1 - beta, 0, 0);
        this.undoMove(0, c);
        if (w >= beta) return beta;
      }

      if (d >= 4 && !hmove) d--;

      const frame = this._acquireFrame();
      const mp = frame.mp1;
      const mpq = frame.mp2;
      const pos = frame.pos;
      let posSaved = 0;
      try {
        mpq.n = 0;
        let first = NO_MOVE;
        let hismax = -9999;

        for (let n = HASH; n <= (ch ? NOISY : QUIET); n++) {
          let nd = d - 1;
          if (n === HASH) {
            if (!hmove) continue;
            mp.n = 1;
            mp.list[0] = hmove;
            if (d >= 8 && ply && heType === LOWER && heDepth >= d - 3) {
              const bc = heValue - d;
              const ss = this.search(ch, c, d >> 1, ply, bc - 1, bc, 0, hmove);
              if (ss < bc) nd++;
              else if (ss >= beta) return ((ss + beta) / 2) | 0;
            }
          } else if (n === NOISY) {
            this.generate(ch, c, mp, 1, 0);
          } else {
            this.generate(ch, c, mp, 0, 1);
          }

          for (let i = 0; i < mp.n; i++) {
            const m = n === HASH ? hmove : (n === NOISY ? this.pick(mp, i, -1) : this.pick(mp, i, ply));
            if ((n !== HASH && m === hmove) || m === sem) continue;
            if (!ch && n === QUIET && mpq.n > 2 * d * (raising + 1)) {
              n = EXIT;
              break;
            }
            if (n !== HASH && alpha > -MAXSCORE + 500 && d < 8 && this.swap(m) < -d * 60) continue;

            let ext = 0;
            const quiet = !CAP(m) && !PROM(m);
            if (!posSaved) {
              copyPos(pos, this.P);
              posSaved = 1;
            }
            this.doMove(m, c);
            if (quiet) mpq.list[mpq.n++] = m;
            const nch = this.attacked(this.P.king[oc], oc);
            if (nch || pvnode || ch || (PIECE(m) === PAWN && !(this.pawnfree[c][TO(m)] & this.P.piece[PAWN] & this.P.color[oc]))) {
              // no reduction
            } else if (n === NOISY && d >= 2 && this.swap(m) < 0) {
              ext -= ((d + 1) / (3 + raising)) | 0;
            } else if (n === QUIET && m !== this.killer[ply]) {
              const his = this.history[m & 0x1fff];
              if (his > hismax) hismax = his;
              else if (d < 5 && (his < 0 || his * his < hismax)) {
                this.undoMove(0, c);
                copyPos(this.P, pos);
                continue;
              } else {
                ext -= ((d + 1) / 3) | 0;
              }
            }

            const firstPVNode = first === NO_MOVE && pvnode;
            if (!firstPVNode) w = -this.search(nch, oc, nd + ext, ply + 1, -alpha - 1, -alpha, 1, 0);
            if (ext < 0 && w > alpha) w = -this.search(nch, oc, nd, ply + 1, -alpha - 1, -alpha, 1, 0);
            if (firstPVNode || (w > alpha && w < beta)) w = -this.search(nch, oc, nd, ply + 1, -beta, -alpha, 0, 0);

            this.undoMove(0, c);
            copyPos(this.P, pos);
            if (this.sabort) return alpha;

            if (w > alpha) {
              alpha = w;
              first = GOOD_MOVE;
              this.pv[ply][ply] = m;
              for (let j = ply + 1; (this.pv[ply][j] = this.pv[ply + 1][j]); j++) {}
              if (w >= beta) {
                if (quiet) {
                  const his = MIN(d * d, 512);
                  this.killer[ply] = m;
                  const idx = m & 0x1fff;
                  const h0 = this.history[idx];
                  this.history[idx] = h0 + his - truncDiv(h0 * his, 512);
                  for (let j = 0; j < mpq.n - 1; j++) {
                    const m2 = mpq.list[j];
                    const idx2 = m2 & 0x1fff;
                    const h1 = this.history[idx2];
                    this.history[idx2] = h1 - his - truncDiv(h1 * his, 512);
                  }
                }
                n = EXIT;
                break;
              }
            } else if (first === NO_MOVE) {
              first = ANY_MOVE;
            }
          }
        }

        if (first === NO_MOVE) alpha = ch || sem ? -MAXSCORE + ply : 0;
        let type = UPPER;
        if (first === GOOD_MOVE) {
          type = alpha >= beta ? LOWER : EXACT;
          hmove = this.pv[ply][ply];
        }
        if (!sem) {
          this.hashKey[hidx] = hp;
          this.hashMove[hidx] = hmove;
          this.hashValue[hidx] = alpha;
          this.hashDepth[hidx] = d;
          this.hashType[hidx] = type;
        }
        return alpha;
      } finally {
        this._releaseFrame();
      }
    }

    ismove(m, to, from, piece, prom, h) {
      if (TO(m) !== to) return 0;
      if (from < 0 && PIECE(m) !== piece) return 0;
      if (from >= 0 && FROM(m) !== from) return 0;
      if (h && ISFILE(h) && (FROM(m) & 7) !== h.charCodeAt(0) - 97) return 0;
      if (h && ISRANK(h) && (FROM(m) & 56) !== 8 * (h.charCodeAt(0) - 49)) return 0;
      if (prom && PROM(m) !== prom) return 0;
      return 1;
    }

    parseMove(s, c, p) {
      let str = String(s);
      let from = -1;
      let piece = PAWN;
      let prom = 0;
      let h = '';

      if (str.startsWith('O-O-O')) str = c ? 'Kc8' : 'Kc1';
      else if (str.startsWith('O-O')) str = c ? 'Kg8' : 'Kg1';

      let idx = 0;
      if (str[idx] >= 'A' && str[idx] <= 'Z') {
        const info = this._getpiece(str[idx]);
        piece = info.piece;
        if (piece < 1) return -1;
        idx++;
      }
      if (str[idx] === 'x') idx++;
      if (ISRANK(str[idx])) {
        h = str[idx++];
        if (str[idx] === 'x') idx++;
      }
      if (!ISFILE(str[idx])) return -1;
      let c1 = str[idx++];
      if (str[idx] === 'x') idx++;
      if (ISFILE(str[idx])) {
        h = c1;
        c1 = str[idx++];
      }
      let c2 = str[idx++];
      if (!ISRANK(c2)) return -1;

      if (idx < str.length) {
        if (str[idx] === '=') {
          prom = this._getpiece(str[idx + 1]).piece;
        } else if (str[idx] !== '+') {
          from = c1.charCodeAt(0) - 97 + 8 * (c2.charCodeAt(0) - 49);
          c1 = str[idx++];
          c2 = str[idx++];
          if (!ISFILE(c1) || !ISRANK(c2)) return -1;
          prom = this._getpiece(str[idx] || '').piece;
        }
      }

      const to = c1.charCodeAt(0) - 97 + 8 * (c2.charCodeAt(0) - 49);
      if (p) return this.ismove(p, to, from, piece, prom, h) ? p : 0;
      const mp = this.tmpMoveList;
      this.generate(this.attacked(this.P.king[c], c), c, mp, 1, 1);
      for (let i = 0; i < mp.n; i++) {
        if (this.ismove(mp.list[i], to, from, piece, prom, h)) return mp.list[i];
      }
      return 0;
    }

    displaym(m) {
      const from = FROM(m);
      const to = TO(m);
      let out = `${String.fromCharCode(97 + (from % 8))}${String.fromCharCode(49 + ((from / 8) | 0))}` +
        `${String.fromCharCode(97 + (to % 8))}${String.fromCharCode(49 + ((to / 8) | 0))}`;
      if (PROM(m)) out += pieceChar[PROM(m)].toLowerCase();
      return out;
    }

    calc(tm) {
      let w = 0;
      const m2go = this.mps === 0 ? 32 : 1 + this.mps;
      const tmsh = MAX((((tm * 8) / 10) | 0) - 50 - m2go * 5, 5);
      let searchtime = MIN((((tm * 6) / 10 / m2go) | 0) + ((this.inc * 6) / 10 | 0), tmsh);
      this.maxtime = MIN(searchtime * 5, tmsh);
      if (this.st > 0) {
        this.maxtime = this.st;
        searchtime = this.st;
      }

      this.starttime = this.getTime();
      const ch = this.attacked(this.P.king[this.onmove], this.onmove);
      this.history.fill(0);
      this.killer.fill(0);
      this.sabort = 0;
      this.eval1 = 0;
      this.qnodes = 0;
      this.nodes = 0;
      this.frameTop = 0;

      let depthReached = 0;
      for (let d = 1; d <= this.sd; d++) {
        depthReached = d;
        let alpha = d > 6 ? w - 13 : -MAXSCORE;
        let beta = d > 6 ? w + 13 : MAXSCORE;
        let delta = 18;
        const bestm = this.pv[0][0];

        for (;;) {
          w = this.search(ch, this.onmove, d, 0, alpha, beta, 0, 0);
          if (this.sabort) break;
          if (w <= alpha) {
            alpha -= delta;
            beta = ((alpha + beta) / 2) | 0;
          } else if (w >= beta) {
            beta += delta;
          } else {
            break;
          }
          delta += ((delta * 2) / 3) | 0;
        }

        const t1 = (this.getTime() - this.starttime) | 0;
        if (this.sabort) break;
        if (this.pondering) continue;
        if (d > 1 && t1 > searchtime * (bestm === this.pv[0][0] ? 1 : 3)) break;
      }

      const finalMove = this.pv[0][0] || 0;
      const ponderMove = this.pv[0][1] || 0;
      return {
        move: finalMove,
        ponder: ponderMove,
        score: w,
        depth: depthReached,
        nodes: this.nodes + this.qnodes,
        timeMs: this.getTime() - this.starttime
      };
    }

    analyzeFEN(fen, options = null) {
      const opts = options || {};
      const timeMsRaw = Number(opts.timeMs);
      const maxDepthRaw = Number(opts.maxDepth ?? opts.depth);
      const resetHash = !!opts.resetHash;
      const resetSearchState = opts.resetSearchState !== false;
      const movetimeRaw = Number(opts.movetime);
      const movestogoRaw = Number(opts.movestogo);
      const wtimeRaw = Number(opts.wtime);
      const btimeRaw = Number(opts.btime);
      const wincRaw = Number(opts.winc);
      const bincRaw = Number(opts.binc);

      this._parse_fen(fen || this.sfen, resetHash);
      if (resetSearchState) this._resetSearchState();
      this.ttime = Number.isFinite(timeMsRaw) && timeMsRaw > 0 ? Math.trunc(timeMsRaw) : 30000;
      this.inc = 0;
      this.st = 0;
      this.mps = 0;
      this.pondering = 0;
      this.sd = Number.isFinite(maxDepthRaw) && maxDepthRaw > 0 ? Math.trunc(maxDepthRaw) : 64;

      // Mirror UCI go time controls when provided by the caller.
      if (this.onmove === 0) {
        if (Number.isFinite(wtimeRaw) && wtimeRaw >= 0) this.ttime = Math.trunc(wtimeRaw);
        if (Number.isFinite(wincRaw) && wincRaw >= 0) this.inc = Math.trunc(wincRaw);
      } else {
        if (Number.isFinite(btimeRaw) && btimeRaw >= 0) this.ttime = Math.trunc(btimeRaw);
        if (Number.isFinite(bincRaw) && bincRaw >= 0) this.inc = Math.trunc(bincRaw);
      }
      if (Number.isFinite(movetimeRaw) && movetimeRaw > 0) this.st = Math.trunc(movetimeRaw);
      if (Number.isFinite(movestogoRaw) && movestogoRaw > 0) this.mps = Math.trunc(movestogoRaw);

      const result = this.calc(this.ttime);
      const bestMove = result.move ? this.displaym(result.move) : null;
      return {
        fen: fen,
        sideToMove: this.onmove === 0 ? 'white' : 'black',
        move: bestMove ? { uci: bestMove } : null,
        score: result.score,
        depth: result.depth,
        nodes: result.nodes,
        timeMs: Math.round(result.timeMs),
        version: VER
      };
    }

    _init() {
      let n = 1n;
      const m = 6364136223846793005n;
      for (let i = 4096; i--;) {
        n = U64(n * m + 1n);
        this.hashxor[4095 - i] = n;
      }

      for (let i = 0; i < 64; i++) this.BIT[i] = 1n << BigInt(i);
      for (let i = 0; i < 64; i++) {
        this.bmask45[i] = this._bishop45(i, 0n, 0);
        this.bmask135[i] = this._bishop135(i, 0n, 0);
        this.rmask0[i] = this._rook0(i, 0n, 0);
      }
      for (let i = 0; i < 64; i++) {
        this.crevoke[i] = 0x3ff;
        this.rankb[(i / 8) | 0] = U64(this.rankb[(i / 8) | 0] | this.BIT[i]);
        this.fileb[i & 7] = U64(this.fileb[i & 7] | this.BIT[i]);
      }
      for (let i = 0; i < 64; i++) {
        this.RANK[0][i] = 1 + (i >> 3);
        this.RANK[1][63 - i] = 1 + (i >> 3);
      }
      for (let i = 0; i < 64; i++) {
        if ((((i / 8) | 0) % 2) !== ((i & 7) % 2)) this.whitesq = U64(this.whitesq | this.BIT[i]);
      }
      this.crevoke[7] ^= Number(this.BIT[6]);
      this.crevoke[63] ^= Number(this.BIT[7]);
      this.crevoke[0] ^= Number(this.BIT[8]);
      this.crevoke[56] ^= Number(this.BIT[9]);

      this._init_rays(this.raysRank, this.xrayRank, this._rook0, this.key000, 1);
      this._init_rays(this.raysAFile, this.xrayAFile, this._rook90, this.key090, 8);
      this._init_shorts(this.nmoves, _knight);
      this._init_shorts(this.kmoves, _king);
      this._init_pawns(this.pmoves[0], this.pcaps[0], this.pawnfree[0], this.pawnfile[0], this.pawnhelp[0], this.pawnprg[0], 0);
      this._init_pawns(this.pmoves[1], this.pcaps[1], this.pawnfree[1], this.pawnfile[1], this.pawnhelp[1], this.pawnprg[1], 1);

      for (let i = 0; i < 64; i++) {
        const n0 = bitcnt(this.nmoves[i]);
        this.kmobil[i] = n0 === 2 ? 33 : n0 * 10;
      }
      for (let i = 0; i < 64; i++) {
        const n0 = bitcnt(this.nmoves[i]);
        if (n0 >= 4) this.centr = U64(this.centr | this.BIT[i]);
        if (n0 >= 8) this.centr2 = U64(this.centr2 | this.BIT[i]);
      }
      for (let i = 0; i < 32; i++) {
        this.bishcorn[i] = this.bishcorn[63 - i] = ((i & 7) < 4) ? cornbase[(i & 7) + ((i / 8) | 0)] : -cornbase[7 - (i & 7) + ((i / 8) | 0)];
      }
      this._parse_fen(this.sfen, 0);
    }
  }

  const instance = new OliThinkEnginePort();
  window.OliThinkEngine = {
    analyzeFEN: (fen, options = null) => instance.analyzeFEN(fen, options || {}),
    version: () => VER
  };
})();
