import { CHESS_CBURNETT_PIECE_SVGS } from './chess-cburnett-pieces.js';

const CHESS_FILES = 'abcdefgh';
let chessOpeningBookPromise = null;

function chessSvgToDataUrl(svg) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(String(svg || '').trim())}`;
}

const CHESS_PIECE_DATA_URLS = (() => {
    const urls = {};
    for (const [piece, svg] of Object.entries(CHESS_CBURNETT_PIECE_SVGS)) {
        urls[piece] = chessSvgToDataUrl(svg);
    }
    return Object.freeze(urls);
})();

function getChessPieceUrl(piece) {
    return CHESS_PIECE_DATA_URLS[piece] || '';
}

function resolveChessAssetUrl(relativePath) {
    const baseUrl = import.meta.env?.BASE_URL || '/';
    return new URL(relativePath, `${window.location.origin}${baseUrl}`).href;
}

function ensureChessOpeningBookLoaded() {
    if (window.ChessOpeningBook) return Promise.resolve(true);
    if (chessOpeningBookPromise) return chessOpeningBookPromise;

    chessOpeningBookPromise = new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = resolveChessAssetUrl('chess-ref/opening-book.js');
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
    });

    return chessOpeningBookPromise;
}

function squareToAlgebraic(row, col) {
    return `${CHESS_FILES[col]}${8 - row}`;
}

function uciSquareToCoords(fileChar, rankChar) {
    const col = String(fileChar).toLowerCase().charCodeAt(0) - 97;
    const rank = Number(rankChar);
    if (!Number.isInteger(col) || col < 0 || col > 7) return null;
    if (!Number.isInteger(rank) || rank < 1 || rank > 8) return null;
    return { row: 8 - rank, col };
}

EphemeraApps.register({
    id: 'chess',
    name: 'Chess',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z"/></svg>`,
    width: 940,
    height: 760,
    category: 'game',
    content: (windowId) => {
        return {
            html: `
                <style>
                    .chess-container { display:flex;flex-direction:column;height:100%;background:linear-gradient(135deg,#1a1a2e,#16213e); }
                    .chess-header { display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:rgba(0,0,0,0.3);border-bottom:1px solid var(--border); }
                    .chess-header h2 { margin:0;font-size:1.1rem;color:var(--fg-primary); }
                    .chess-header-actions { display:flex;gap:8px; }
                    .chess-header button { padding:8px 14px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--fg-secondary);border-radius:var(--radius-sm);cursor:pointer;font-family:inherit;font-size:0.8rem; }
                    .chess-header button:hover { background:var(--bg-secondary);color:var(--fg-primary); }
                    .chess-header button.primary { background:var(--accent);color:#fff;border-color:var(--accent); }
                    .chess-main { display:flex;flex:1;padding:16px;gap:16px;overflow:auto; }
                    .chess-board-container { display:flex;flex-direction:column;align-items:center; }
                    .chess-board-wrapper { position:relative; }
                    .chess-board { display:grid;grid-template-columns:repeat(8,1fr);border:3px solid #4a4a5a;border-radius:4px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.4); }
                    .chess-square { width:50px;height:50px;display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer; }
                    .chess-square.light { background:#eeeed2; }
                    .chess-square.dark { background:#769656; }
                    .chess-square.selected { background:rgba(255,255,0,0.5) !important; }
                    .chess-square.valid-move::after { content:'';position:absolute;width:14px;height:14px;background:rgba(0,0,0,0.15);border-radius:50%; }
                    .chess-square.valid-capture { background:rgba(255,0,0,0.3) !important; }
                    .chess-square.last-move { background:rgba(255,255,0,0.25) !important; }
                    .chess-square.check { background:rgba(255,0,0,0.5) !important; }
                    .chess-piece { width:44px;height:44px;user-select:none;pointer-events:none;-webkit-user-drag:none;filter:drop-shadow(1px 1px 1px rgba(0,0,0,0.3)); }
                    .chess-coords { position:absolute;font-size:0.65rem;color:var(--fg-muted);font-weight:500; }
                    .chess-coords.file { bottom:2px;right:4px; }
                    .chess-coords.rank { top:2px;left:4px; }
                    .chess-square.light .chess-coords { color:#769656; }
                    .chess-square.dark .chess-coords { color:#eeeed2; }
                    .chess-side { display:flex;flex-direction:column;gap:12px;min-width:220px;max-width:280px; }
                    .chess-panel { background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px; }
                    .chess-panel-title { font-size:0.8rem;color:var(--fg-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px; }
                    .chess-turn { display:flex;align-items:center;gap:10px; }
                    .chess-turn-indicator { width:24px;height:24px;border-radius:50%;border:2px solid var(--border); }
                    .chess-turn-indicator.white { background:#fff; }
                    .chess-turn-indicator.black { background:#333; }
                    .chess-turn-text { color:var(--fg-primary);font-weight:500; }
                    .chess-captured { display:flex;flex-wrap:wrap;gap:2px;min-height:30px; }
                    .chess-captured-piece { width:20px;height:20px;opacity:0.8;user-select:none;pointer-events:none;-webkit-user-drag:none; }
                    .chess-moves { max-height:200px;overflow-y:auto;font-family:'JetBrains Mono',monospace;font-size:0.75rem; }
                    .chess-move { display:flex;gap:8px;padding:4px 0;border-bottom:1px solid var(--border); }
                    .chess-move-num { color:var(--fg-muted);min-width:24px; }
                    .chess-move-white,.chess-move-black { flex:1;color:var(--fg-primary); }
                    .chess-status { text-align:center;padding:8px;border-radius:var(--radius-sm);font-weight:500; }
                    .chess-status.white-turn { background:rgba(255,255,255,0.1);color:#fff; }
                    .chess-status.black-turn { background:rgba(0,0,0,0.3);color:#ccc; }
                    .chess-status.check { background:rgba(255,0,0,0.2);color:#ff6b6b; }
                    .chess-status.checkmate { background:rgba(255,0,0,0.3);color:#ff4757; }
                    .chess-status.stalemate { background:rgba(255,184,77,0.2);color:#ffb84d; }
                    .chess-status.engine-turn { background:rgba(0,212,170,0.16);color:#9be8db; }
                    .chess-engine-status { margin-top:8px;font-size:0.75rem;color:var(--fg-secondary);line-height:1.35; }
                    .chess-engine-status.error { color:#ff8f8f; }
                    .chess-form-row { display:grid;gap:6px;margin-bottom:8px; }
                    .chess-form-row:last-child { margin-bottom:0; }
                    .chess-form-row label { font-size:0.68rem;color:var(--fg-muted);text-transform:uppercase;letter-spacing:.08em; }
                    .chess-form-row select { width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-tertiary);color:var(--fg-primary);font:inherit;font-size:.8rem; }
                    .chess-form-row select:disabled { opacity:0.55;cursor:not-allowed; }
                    .chess-promotion { position:absolute;inset:0;background:rgba(0,0,0,0.8);display:none;align-items:center;justify-content:center;z-index:10; }
                    .chess-promotion.active { display:flex; }
                    .chess-promotion-pieces { display:flex;gap:8px;background:var(--bg-secondary);padding:16px;border-radius:var(--radius-lg); }
                    .chess-promotion-piece { width:56px;height:56px;display:flex;align-items:center;justify-content:center;background:transparent;border:1px solid transparent;cursor:pointer;padding:6px;border-radius:var(--radius-sm);transition:background 0.15s,border-color 0.15s; }
                    .chess-promotion-piece:hover { background:var(--bg-tertiary); }
                    .chess-promotion-piece:focus-visible { outline:2px solid var(--accent);outline-offset:2px; }
                    .chess-promotion-piece-img { width:44px;height:44px;user-select:none;pointer-events:none;-webkit-user-drag:none; }
                </style>
                <div class="chess-container">
                    <div class="chess-header">
                        <h2>Chess</h2>
                        <div class="chess-header-actions">
                            <button id="chess-undo-${windowId}">Undo</button>
                            <button id="chess-flip-${windowId}">Flip Board</button>
                            <button class="primary" id="chess-new-${windowId}">New Game</button>
                        </div>
                    </div>
                    <div class="chess-main">
                        <div class="chess-board-container">
                            <div class="chess-board-wrapper">
                                <div class="chess-board" id="chess-board-${windowId}"></div>
                                <div class="chess-promotion" id="chess-promotion-${windowId}">
                                    <div class="chess-promotion-pieces" id="chess-promotion-pieces-${windowId}"></div>
                                </div>
                            </div>
                        </div>
                        <div class="chess-side">
                            <div class="chess-panel">
                                <div class="chess-panel-title">Current Turn</div>
                                <div class="chess-status white-turn" id="chess-status-${windowId}">White to move</div>
                                <div class="chess-engine-status" id="chess-engine-status-${windowId}">Engine: starting...</div>
                            </div>
                            <div class="chess-panel">
                                <div class="chess-panel-title">Play Options</div>
                                <div class="chess-form-row">
                                    <label for="chess-mode-${windowId}">Mode</label>
                                    <select id="chess-mode-${windowId}">
                                        <option value="ai" selected>Vs Computer</option>
                                        <option value="local">Two Players</option>
                                    </select>
                                </div>
                                <div class="chess-form-row">
                                    <label for="chess-side-${windowId}">You Play As</label>
                                    <select id="chess-side-${windowId}">
                                        <option value="white" selected>White</option>
                                        <option value="black">Black</option>
                                    </select>
                                </div>
                                <div class="chess-form-row">
                                    <label for="chess-depth-${windowId}">Engine Depth</label>
                                    <select id="chess-depth-${windowId}">
                                        <option value="6">6 (Fast)</option>
                                        <option value="8">8</option>
                                        <option value="10" selected>10 (Default)</option>
                                        <option value="12">12</option>
                                        <option value="14">14 (Strong)</option>
                                    </select>
                                </div>
                            </div>
                            <div class="chess-panel">
                                <div class="chess-panel-title">Captured</div>
                                <div style="margin-bottom:8px;">
                                    <div style="font-size:0.7rem;color:var(--fg-muted);margin-bottom:4px;">By White:</div>
                                    <div class="chess-captured" id="chess-captured-white-${windowId}"></div>
                                </div>
                                <div>
                                    <div style="font-size:0.7rem;color:var(--fg-muted);margin-bottom:4px;">By Black:</div>
                                    <div class="chess-captured" id="chess-captured-black-${windowId}"></div>
                                </div>
                            </div>
                            <div class="chess-panel">
                                <div class="chess-panel-title">Move History</div>
                                <div class="chess-moves" id="chess-moves-${windowId}"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            init: () => {
                const lifecycle = createAppLifecycle();

                const boardEl = document.getElementById(`chess-board-${windowId}`);
                const statusEl = document.getElementById(`chess-status-${windowId}`);
                const engineStatusEl = document.getElementById(`chess-engine-status-${windowId}`);
                const movesEl = document.getElementById(`chess-moves-${windowId}`);
                const capturedWhiteEl = document.getElementById(`chess-captured-white-${windowId}`);
                const capturedBlackEl = document.getElementById(`chess-captured-black-${windowId}`);
                const promotionEl = document.getElementById(`chess-promotion-${windowId}`);
                const promotionPiecesEl = document.getElementById(`chess-promotion-pieces-${windowId}`);
                const undoBtn = document.getElementById(`chess-undo-${windowId}`);
                const flipBtn = document.getElementById(`chess-flip-${windowId}`);
                const newBtn = document.getElementById(`chess-new-${windowId}`);
                const modeSelect = document.getElementById(`chess-mode-${windowId}`);
                const sideSelect = document.getElementById(`chess-side-${windowId}`);
                const depthSelect = document.getElementById(`chess-depth-${windowId}`);

                const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

                let board = [];
                let selectedSquare = null;
                let validMoves = [];
                let currentTurn = 'white';
                let moveHistory = [];
                let capturedPieces = { white: [], black: [] };
                let isFlipped = false;
                let lastMove = null;
                let isGameOver = false;
                let halfmoveClock = 0;
                let fullmoveNumber = 1;

                let gameMode = 'ai';
                let humanColor = 'white';
                const AI_DEPTH_MIN = 6;
                const AI_DEPTH_MAX = 14;
                const AI_DEPTH_STEP = 2;
                const AI_DEPTH_DEFAULT = 10;
                let aiDepth = AI_DEPTH_DEFAULT;
                let aiSearchSerial = 0;
                let engineThinking = false;
                let engineReady = false;
                let engineError = null;
                let engineWorker = null;
                let engineRequestId = 1;
                const pendingEngine = new Map();

                function getAIColor() {
                    return humanColor === 'white' ? 'black' : 'white';
                }

                function isAITurn() {
                    return gameMode === 'ai' && currentTurn === getAIColor();
                }

                function cancelPendingAI() {
                    aiSearchSerial += 1;
                    engineThinking = false;
                }

                function initBoard() {
                    board = [
                        ['r','n','b','q','k','b','n','r'],
                        ['p','p','p','p','p','p','p','p'],
                        [null,null,null,null,null,null,null,null],
                        [null,null,null,null,null,null,null,null],
                        [null,null,null,null,null,null,null,null],
                        [null,null,null,null,null,null,null,null],
                        ['P','P','P','P','P','P','P','P'],
                        ['R','N','B','Q','K','B','N','R']
                    ];
                    selectedSquare = null;
                    validMoves = [];
                    currentTurn = 'white';
                    moveHistory = [];
                    capturedPieces = { white: [], black: [] };
                    lastMove = null;
                    isGameOver = false;
                    halfmoveClock = 0;
                    fullmoveNumber = 1;
                    if (modeSelect) modeSelect.value = gameMode;
                    if (sideSelect) sideSelect.value = humanColor;
                    if (depthSelect) depthSelect.value = String(aiDepth);
                    updateOptionControls();
                    cancelPendingAI();
                    renderBoard();
                    updateStatus();
                    updateEngineStatus();
                    updateMoves();
                    updateCaptured();
                    maybeMakeAIMove();
                }

                function isWhitePiece(piece) {
                    return piece && piece === piece.toUpperCase();
                }

                function getPieceColor(piece) {
                    if (!piece) return null;
                    return isWhitePiece(piece) ? 'white' : 'black';
                }

                function normalizePromotionPiece(piece, color) {
                    const lower = String(piece || 'q').toLowerCase();
                    const valid = ['q', 'r', 'b', 'n'].includes(lower) ? lower : 'q';
                    return color === 'white' ? valid.toUpperCase() : valid;
                }

                function renderBoard() {
                    boardEl.innerHTML = '';
                    
                    for (let row = 0; row < 8; row++) {
                        for (let col = 0; col < 8; col++) {
                            const displayRow = isFlipped ? 7 - row : row;
                            const displayCol = isFlipped ? 7 - col : col;
                            
                            const square = document.createElement('div');
                            const isLight = (displayRow + displayCol) % 2 === 0;
                            square.className = `chess-square ${isLight ? 'light' : 'dark'}`;
                            square.dataset.row = displayRow;
                            square.dataset.col = displayCol;

                            const piece = board[displayRow][displayCol];
                            
                            if (selectedSquare && selectedSquare.row === displayRow && selectedSquare.col === displayCol) {
                                square.classList.add('selected');
                            }

                            if (validMoves.some(m => m.row === displayRow && m.col === displayCol)) {
                                if (piece) {
                                    square.classList.add('valid-capture');
                                } else {
                                    square.classList.add('valid-move');
                                }
                            }

                            if (lastMove) {
                                if ((lastMove.from.row === displayRow && lastMove.from.col === displayCol) ||
                                    (lastMove.to.row === displayRow && lastMove.to.col === displayCol)) {
                                    square.classList.add('last-move');
                                }
                            }

                            if (piece) {
                                const pieceEl = document.createElement('img');
                                pieceEl.className = 'chess-piece';
                                pieceEl.src = getChessPieceUrl(piece);
                                pieceEl.alt = piece;
                                pieceEl.draggable = false;
                                pieceEl.decoding = 'async';
                                square.appendChild(pieceEl);

                                if (piece.toLowerCase() === 'k') {
                                    const kingColor = getPieceColor(piece);
                                    if (isInCheck(kingColor)) {
                                        square.classList.add('check');
                                    }
                                }
                            }

                            if (displayCol === (isFlipped ? 7 : 0)) {
                                const rank = document.createElement('span');
                                rank.className = 'chess-coords rank';
                                rank.textContent = 8 - displayRow;
                                square.appendChild(rank);
                            }
                            if (displayRow === (isFlipped ? 0 : 7)) {
                                const file = document.createElement('span');
                                file.className = 'chess-coords file';
                                file.textContent = String.fromCharCode(97 + displayCol);
                                square.appendChild(file);
                            }

                            square.addEventListener('click', () => handleSquareClick(displayRow, displayCol));
                            boardEl.appendChild(square);
                        }
                    }
                }

                function handleSquareClick(row, col) {
                    if (isGameOver) return;
                    if (engineThinking) return;
                    if (gameMode === 'ai' && currentTurn !== humanColor) return;

                    const piece = board[row][col];
                    const pieceColor = getPieceColor(piece);

                    if (selectedSquare) {
                        const move = validMoves.find(m => m.row === row && m.col === col);
                        if (move) {
                            makeMove(selectedSquare.row, selectedSquare.col, row, col, move);
                            selectedSquare = null;
                            validMoves = [];
                            renderBoard();
                            return;
                        }
                    }

                    if (piece && pieceColor === currentTurn) {
                        selectedSquare = { row, col };
                        validMoves = getValidMoves(row, col);
                        renderBoard();
                    } else {
                        selectedSquare = null;
                        validMoves = [];
                        renderBoard();
                    }
                }

                function getValidMoves(row, col) {
                    const piece = board[row][col];
                    if (!piece) return [];

                    const moves = [];
                    const color = getPieceColor(piece);
                    const type = piece.toLowerCase();

                    const addMove = (r, c, special = null) => {
                        if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                            const target = board[r][c];
                            if (!target || getPieceColor(target) !== color) {
                                if (!wouldBeInCheck(row, col, r, c, color, special)) {
                                    moves.push({ row: r, col: c, ...special });
                                }
                            }
                        }
                    };

                    const addSlidingMoves = (directions) => {
                        for (const [dr, dc] of directions) {
                            for (let i = 1; i < 8; i++) {
                                const r = row + dr * i;
                                const c = col + dc * i;
                                if (r < 0 || r >= 8 || c < 0 || c >= 8) break;
                                const target = board[r][c];
                                if (!target) {
                                    addMove(r, c);
                                } else {
                                    if (getPieceColor(target) !== color) {
                                        addMove(r, c);
                                    }
                                    break;
                                }
                            }
                        }
                    };

                    switch (type) {
                        case 'p':
                            const dir = color === 'white' ? -1 : 1;
                            const startRow = color === 'white' ? 6 : 1;
                            const promotionRow = color === 'white' ? 0 : 7;
                            
                            if (!board[row + dir]?.[col]) {
                                if (row + dir === promotionRow) {
                                    addMove(row + dir, col, { promotion: true });
                                } else {
                                    addMove(row + dir, col);
                                }
                                if (row === startRow && !board[row + 2 * dir]?.[col]) {
                                    addMove(row + 2 * dir, col, { enPassantTarget: { row: row + dir, col } });
                                }
                            }
                            for (const dc of [-1, 1]) {
                                const target = board[row + dir]?.[col + dc];
                                if (target && getPieceColor(target) !== color) {
                                    if (row + dir === promotionRow) {
                                        addMove(row + dir, col + dc, { promotion: true });
                                    } else {
                                        addMove(row + dir, col + dc);
                                    }
                                }
                                if (lastMove?.enPassant && row + dir === lastMove.enPassant.row && col + dc === lastMove.enPassant.col) {
                                    addMove(row + dir, col + dc, { enPassantCapture: { row, col: col + dc } });
                                }
                            }
                            break;

                        case 'n':
                            for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
                                addMove(row + dr, col + dc);
                            }
                            break;

                        case 'b':
                            addSlidingMoves([[-1,-1],[-1,1],[1,-1],[1,1]]);
                            break;

                        case 'r':
                            addSlidingMoves([[-1,0],[1,0],[0,-1],[0,1]]);
                            break;

                        case 'q':
                            addSlidingMoves([[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]);
                            break;

                        case 'k':
                            for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
                                addMove(row + dr, col + dc);
                            }
                            if (!isInCheck(color)) {
                                if (color === 'white') {
                                    if (canCastle(7, 4, 7, 7, color)) {
                                        moves.push({ row: 7, col: 6, castle: 'kingside' });
                                    }
                                    if (canCastle(7, 4, 7, 0, color)) {
                                        moves.push({ row: 7, col: 2, castle: 'queenside' });
                                    }
                                } else {
                                    if (canCastle(0, 4, 0, 7, color)) {
                                        moves.push({ row: 0, col: 6, castle: 'kingside' });
                                    }
                                    if (canCastle(0, 4, 0, 0, color)) {
                                        moves.push({ row: 0, col: 2, castle: 'queenside' });
                                    }
                                }
                            }
                            break;
                    }

                    return moves;
                }

                function canCastle(kingRow, kingCol, rookRow, rookCol, color) {
                    const rook = board[rookRow][rookCol];
                    if (!rook || rook.toLowerCase() !== 'r' || getPieceColor(rook) !== color) return false;
                    
                    const hasMoved = moveHistory.some(m => 
                        (m.from.row === kingRow && m.from.col === kingCol) ||
                        (m.from.row === rookRow && m.from.col === rookCol)
                    );
                    if (hasMoved) return false;

                    const start = Math.min(kingCol, rookCol) + 1;
                    const end = Math.max(kingCol, rookCol);
                    for (let c = start; c < end; c++) {
                        if (board[kingRow][c]) return false;
                    }

                    const dir = rookCol > kingCol ? 1 : -1;
                    for (let c = kingCol; c !== kingCol + 3 * dir; c += dir) {
                        if (c < 0 || c > 7) break;
                        if (wouldBeInCheck(kingRow, kingCol, kingRow, c, color)) return false;
                    }

                    return true;
                }

                function findKing(color) {
                    const king = color === 'white' ? 'K' : 'k';
                    for (let r = 0; r < 8; r++) {
                        for (let c = 0; c < 8; c++) {
                            if (board[r][c] === king) return { row: r, col: c };
                        }
                    }
                    return null;
                }

                function isSquareAttacked(row, col, byColor) {
                    for (let r = 0; r < 8; r++) {
                        for (let c = 0; c < 8; c++) {
                            const piece = board[r][c];
                            if (piece && getPieceColor(piece) === byColor) {
                                const attacks = getAttackSquares(r, c);
                                if (attacks.some(a => a.row === row && a.col === col)) {
                                    return true;
                                }
                            }
                        }
                    }
                    return false;
                }

                function getAttackSquares(row, col) {
                    const piece = board[row][col];
                    if (!piece) return [];

                    const attacks = [];
                    const color = getPieceColor(piece);
                    const type = piece.toLowerCase();

                    const addAttack = (r, c) => {
                        if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                            attacks.push({ row: r, col: c });
                        }
                    };

                    const addSlidingAttacks = (directions) => {
                        for (const [dr, dc] of directions) {
                            for (let i = 1; i < 8; i++) {
                                const r = row + dr * i;
                                const c = col + dc * i;
                                if (r < 0 || r >= 8 || c < 0 || c >= 8) break;
                                addAttack(r, c);
                                if (board[r][c]) break;
                            }
                        }
                    };

                    switch (type) {
                        case 'p':
                            const dir = color === 'white' ? -1 : 1;
                            addAttack(row + dir, col - 1);
                            addAttack(row + dir, col + 1);
                            break;
                        case 'n':
                            for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
                                addAttack(row + dr, col + dc);
                            }
                            break;
                        case 'b':
                            addSlidingAttacks([[-1,-1],[-1,1],[1,-1],[1,1]]);
                            break;
                        case 'r':
                            addSlidingAttacks([[-1,0],[1,0],[0,-1],[0,1]]);
                            break;
                        case 'q':
                            addSlidingAttacks([[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]);
                            break;
                        case 'k':
                            for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
                                addAttack(row + dr, col + dc);
                            }
                            break;
                    }

                    return attacks;
                }

                function isInCheck(color) {
                    const king = findKing(color);
                    if (!king) return false;
                    const enemyColor = color === 'white' ? 'black' : 'white';
                    return isSquareAttacked(king.row, king.col, enemyColor);
                }

                function wouldBeInCheck(fromRow, fromCol, toRow, toCol, color, moveInfo = null) {
                    const movingPiece = board[fromRow][fromCol];
                    const capturedPiece = board[toRow][toCol];

                    board[toRow][toCol] = movingPiece;
                    board[fromRow][fromCol] = null;

                    let enPassantCapturedPiece = null;
                    if (moveInfo?.enPassantCapture) {
                        const ep = moveInfo.enPassantCapture;
                        enPassantCapturedPiece = board[ep.row][ep.col];
                        board[ep.row][ep.col] = null;
                    }

                    let rookFrom = null;
                    let rookTo = null;
                    if (moveInfo?.castle) {
                        if (moveInfo.castle === 'kingside') {
                            rookFrom = { row: toRow, col: 7 };
                            rookTo = { row: toRow, col: 5 };
                        } else {
                            rookFrom = { row: toRow, col: 0 };
                            rookTo = { row: toRow, col: 3 };
                        }
                        board[rookTo.row][rookTo.col] = board[rookFrom.row][rookFrom.col];
                        board[rookFrom.row][rookFrom.col] = null;
                    }

                    const inCheck = isInCheck(color);

                    if (moveInfo?.castle && rookFrom && rookTo) {
                        board[rookFrom.row][rookFrom.col] = board[rookTo.row][rookTo.col];
                        board[rookTo.row][rookTo.col] = null;
                    }
                    if (moveInfo?.enPassantCapture) {
                        const ep = moveInfo.enPassantCapture;
                        board[ep.row][ep.col] = enPassantCapturedPiece;
                    }

                    board[fromRow][fromCol] = movingPiece;
                    board[toRow][toCol] = capturedPiece;

                    return inCheck;
                }

                function makeMove(fromRow, fromCol, toRow, toCol, moveInfo, options = {}) {
                    const piece = board[fromRow][fromCol];
                    const captured = board[toRow][toCol];
                    const color = getPieceColor(piece);

                    if (captured) {
                        capturedPieces[color].push(captured);
                    }

                    if (moveInfo?.enPassantCapture) {
                        const ep = moveInfo.enPassantCapture;
                        const epPiece = board[ep.row][ep.col];
                        capturedPieces[color].push(epPiece);
                        board[ep.row][ep.col] = null;
                    }

                    if (moveInfo?.castle) {
                        if (moveInfo.castle === 'kingside') {
                            board[toRow][5] = board[toRow][7];
                            board[toRow][7] = null;
                        } else {
                            board[toRow][3] = board[toRow][0];
                            board[toRow][0] = null;
                        }
                    }

                    if (moveInfo?.promotion) {
                        const forcedPromotion = options.promotionPiece
                            ? normalizePromotionPiece(options.promotionPiece, color)
                            : null;

                        const applyPromotion = (promotedPiece) => {
                            board[toRow][toCol] = normalizePromotionPiece(promotedPiece, color);
                            board[fromRow][fromCol] = null;
                            finishMove(fromRow, fromCol, toRow, toCol, piece, captured, moveInfo);
                        };

                        if (forcedPromotion) {
                            applyPromotion(forcedPromotion);
                        } else {
                            showPromotionDialog(toRow, toCol, color, applyPromotion);
                        }
                        return;
                    }

                    board[toRow][toCol] = piece;
                    board[fromRow][fromCol] = null;

                    finishMove(fromRow, fromCol, toRow, toCol, piece, captured, moveInfo);
                }

                function finishMove(fromRow, fromCol, toRow, toCol, piece, captured, moveInfo = null) {
                    const movedColor = getPieceColor(piece);

                    lastMove = {
                        from: { row: fromRow, col: fromCol },
                        to: { row: toRow, col: toCol },
                        enPassant: moveInfo?.enPassantTarget || null
                    };

                    if (piece.toLowerCase() === 'p' || captured || moveInfo?.enPassantCapture) {
                        halfmoveClock = 0;
                    } else {
                        halfmoveClock += 1;
                    }

                    if (movedColor === 'black') {
                        fullmoveNumber += 1;
                    }

                    const notation = getMoveNotation(fromRow, fromCol, toRow, toCol, piece, captured, moveInfo);
                    moveHistory.push({
                        from: { row: fromRow, col: fromCol },
                        to: { row: toRow, col: toCol },
                        piece,
                        captured,
                        notation,
                        boardState: JSON.parse(JSON.stringify(board)),
                        lastMoveState: JSON.parse(JSON.stringify(lastMove)),
                        halfmoveClock,
                        fullmoveNumber
                    });

                    currentTurn = movedColor === 'white' ? 'black' : 'white';
                    isGameOver = isCheckmate(currentTurn) || isStalemate(currentTurn) || halfmoveClock >= 100;
                    
                    updateStatus();
                    updateEngineStatus();
                    updateMoves();
                    updateCaptured();
                    renderBoard();
                    maybeMakeAIMove();
                }

                function getMoveNotation(fromRow, fromCol, toRow, toCol, piece, captured, moveInfo) {
                    const files = 'abcdefgh';
                    const type = piece.toLowerCase();
                    
                    if (moveInfo?.castle === 'kingside') return 'O-O';
                    if (moveInfo?.castle === 'queenside') return 'O-O-O';

                    let notation = '';
                    
                    if (type !== 'p') {
                        notation += type.toUpperCase();
                    }

                    if (captured || moveInfo?.enPassantCapture) {
                        if (type === 'p') {
                            notation += files[fromCol];
                        }
                        notation += 'x';
                    }

                    notation += files[toCol] + (8 - toRow);

                    if (moveInfo?.enPassantCapture) {
                        notation += ' e.p.';
                    }

                    const enemyColor = currentTurn === 'white' ? 'black' : 'white';
                    if (isInCheck(enemyColor)) {
                        if (isCheckmate(enemyColor)) {
                            notation += '#';
                        } else {
                            notation += '+';
                        }
                    }

                    return notation;
                }

                function showPromotionDialog(row, col, color, callback) {
                    const pieces = color === 'white' ? ['Q', 'R', 'B', 'N'] : ['q', 'r', 'b', 'n'];
                    
                    promotionPiecesEl.innerHTML = pieces.map((p) => {
                        const src = getChessPieceUrl(p);
                        const safeSrc = src ? ` src="${src}"` : '';
                        return `<button type="button" class="chess-promotion-piece" data-piece="${p}"><img class="chess-promotion-piece-img" alt=""${safeSrc} draggable="false" decoding="async"></button>`;
                    }).join('');

                    promotionPiecesEl.querySelectorAll('.chess-promotion-piece').forEach(el => {
                        el.addEventListener('click', () => {
                            promotionEl.classList.remove('active');
                            callback(el.dataset.piece);
                        });
                    });

                    promotionEl.classList.add('active');
                }

                function isCheckmate(color) {
                    if (!isInCheck(color)) return false;
                    return !hasLegalMoves(color);
                }

                function isStalemate(color) {
                    if (isInCheck(color)) return false;
                    return !hasLegalMoves(color);
                }

                function hasLegalMoves(color) {
                    for (let r = 0; r < 8; r++) {
                        for (let c = 0; c < 8; c++) {
                            const piece = board[r][c];
                            if (piece && getPieceColor(piece) === color) {
                                const moves = getValidMoves(r, c);
                                if (moves.length > 0) return true;
                            }
                        }
                    }
                    return false;
                }

                function updateStatus() {
                    if (isCheckmate(currentTurn)) {
                        statusEl.className = 'chess-status checkmate';
                        const winner = currentTurn === 'white' ? 'Black' : 'White';
                        statusEl.textContent = `Checkmate! ${winner} wins!`;
                    } else if (isStalemate(currentTurn)) {
                        statusEl.className = 'chess-status stalemate';
                        statusEl.textContent = 'Stalemate! Draw.';
                    } else if (halfmoveClock >= 100) {
                        statusEl.className = 'chess-status stalemate';
                        statusEl.textContent = 'Draw by fifty-move rule.';
                    } else if (isAITurn() && engineThinking) {
                        statusEl.className = 'chess-status engine-turn';
                        statusEl.textContent = `${currentTurn.charAt(0).toUpperCase() + currentTurn.slice(1)} (engine) thinking...`;
                    } else if (isInCheck(currentTurn)) {
                        statusEl.className = 'chess-status check';
                        statusEl.textContent = `${currentTurn.charAt(0).toUpperCase() + currentTurn.slice(1)} is in check!`;
                    } else {
                        statusEl.className = `chess-status ${currentTurn}-turn`;
                        statusEl.textContent = `${currentTurn.charAt(0).toUpperCase() + currentTurn.slice(1)} to move`;
                    }
                }

                function updateMoves() {
                    let html = '';
                    for (let i = 0; i < moveHistory.length; i += 2) {
                        const moveNum = Math.floor(i / 2) + 1;
                        const whiteMove = moveHistory[i]?.notation || '';
                        const blackMove = moveHistory[i + 1]?.notation || '';
                        html += `
                            <div class="chess-move">
                                <span class="chess-move-num">${moveNum}.</span>
                                <span class="chess-move-white">${whiteMove}</span>
                                <span class="chess-move-black">${blackMove}</span>
                            </div>
                        `;
                    }
                    movesEl.innerHTML = html || '<div style="color:var(--fg-muted);font-size:0.8rem;">No moves yet</div>';
                    movesEl.scrollTop = movesEl.scrollHeight;
                }

                function updateCaptured() {
                    capturedWhiteEl.innerHTML = capturedPieces.white
                        .sort((a, b) => PIECE_VALUES[a.toLowerCase()] - PIECE_VALUES[b.toLowerCase()])
                        .map((p) => {
                            const src = getChessPieceUrl(p);
                            const safeSrc = src ? ` src="${src}"` : '';
                            return `<img class="chess-captured-piece" alt="${p}"${safeSrc} draggable="false" decoding="async">`;
                        })
                        .join('');
                    capturedBlackEl.innerHTML = capturedPieces.black
                        .sort((a, b) => PIECE_VALUES[a.toLowerCase()] - PIECE_VALUES[b.toLowerCase()])
                        .map((p) => {
                            const src = getChessPieceUrl(p);
                            const safeSrc = src ? ` src="${src}"` : '';
                            return `<img class="chess-captured-piece" alt="${p}"${safeSrc} draggable="false" decoding="async">`;
                        })
                        .join('');
                }

                function updateEngineStatus() {
                    if (gameMode !== 'ai') {
                        engineStatusEl.className = 'chess-engine-status';
                        engineStatusEl.textContent = 'Engine: disabled in two-player mode.';
                        return;
                    }

                    if (engineError) {
                        engineStatusEl.className = 'chess-engine-status error';
                        engineStatusEl.textContent = `Engine error: ${engineError}`;
                        return;
                    }

                    engineStatusEl.className = 'chess-engine-status';
                    if (!engineReady) {
                        engineStatusEl.textContent = 'Engine: starting...';
                    } else if (engineThinking) {
                        engineStatusEl.textContent = `Engine: thinking (depth ${aiDepth})...`;
                    } else {
                        engineStatusEl.textContent = `Engine: ready. You play ${humanColor}.`;
                    }
                }

                function collectAllLegalMoves(color) {
                    const legalMoves = [];
                    for (let r = 0; r < 8; r++) {
                        for (let c = 0; c < 8; c++) {
                            const piece = board[r][c];
                            if (!piece || getPieceColor(piece) !== color) continue;
                            const moves = getValidMoves(r, c);
                            for (const move of moves) {
                                legalMoves.push({ fromRow: r, fromCol: c, move });
                            }
                        }
                    }
                    return legalMoves;
                }

                function getCastlingRights() {
                    let rights = '';
                    const hasMoved = (row, col) => moveHistory.some((m) => m.from.row === row && m.from.col === col);
                    if (board[7][4] === 'K' && board[7][7] === 'R' && !hasMoved(7, 4) && !hasMoved(7, 7)) rights += 'K';
                    if (board[7][4] === 'K' && board[7][0] === 'R' && !hasMoved(7, 4) && !hasMoved(7, 0)) rights += 'Q';
                    if (board[0][4] === 'k' && board[0][7] === 'r' && !hasMoved(0, 4) && !hasMoved(0, 7)) rights += 'k';
                    if (board[0][4] === 'k' && board[0][0] === 'r' && !hasMoved(0, 4) && !hasMoved(0, 0)) rights += 'q';
                    return rights || '-';
                }

                function getFEN() {
                    const boardPart = board.map((row) => {
                        let fenRow = '';
                        let empty = 0;
                        for (const piece of row) {
                            if (!piece) {
                                empty += 1;
                            } else {
                                if (empty > 0) fenRow += String(empty);
                                empty = 0;
                                fenRow += piece;
                            }
                        }
                        if (empty > 0) fenRow += String(empty);
                        return fenRow;
                    }).join('/');

                    const active = currentTurn === 'white' ? 'w' : 'b';
                    const castling = getCastlingRights();
                    const enPassant = lastMove?.enPassant
                        ? squareToAlgebraic(lastMove.enPassant.row, lastMove.enPassant.col)
                        : '-';

                    return `${boardPart} ${active} ${castling} ${enPassant} ${halfmoveClock} ${fullmoveNumber}`;
                }

                function rejectAllPendingEngine(message) {
                    for (const pending of pendingEngine.values()) {
                        if (pending.timeoutId) clearTimeout(pending.timeoutId);
                        pending.reject(new Error(message));
                    }
                    pendingEngine.clear();
                }

                function stopEngineWorker() {
                    if (engineWorker) {
                        try { engineWorker.terminate(); } catch (_e) { /* no-op */ }
                    }
                    engineWorker = null;
                    rejectAllPendingEngine('Chess engine stopped.');
                    engineReady = false;
                    engineThinking = false;
                }

                function initEngineWorker() {
                    if (typeof Worker !== 'function') {
                        engineError = 'Web Workers are unavailable.';
                        updateEngineStatus();
                        return;
                    }

                    try {
                        engineWorker = new Worker(resolveChessAssetUrl('chess-ref/engine-worker.js'));
                    } catch (error) {
                        engineError = error?.message || 'Failed to start engine worker.';
                        updateEngineStatus();
                        return;
                    }

                    engineReady = false;
                    engineError = null;
                    updateEngineStatus();

                    engineWorker.onmessage = (event) => {
                        const data = event?.data || {};
                        if (data.type === 'ready') {
                            if (data.error) {
                                engineReady = false;
                                engineError = String(data.error);
                            } else {
                                engineReady = true;
                                engineError = null;
                            }
                            updateEngineStatus();
                            maybeMakeAIMove();
                            return;
                        }

                        const id = Number(data.id);
                        if (!Number.isFinite(id)) return;
                        const pending = pendingEngine.get(id);
                        if (!pending) return;
                        pendingEngine.delete(id);
                        if (pending.timeoutId) clearTimeout(pending.timeoutId);

                        if (data.error) pending.reject(new Error(String(data.error)));
                        else pending.resolve(data.result || null);
                    };

                    engineWorker.onerror = () => {
                        engineReady = false;
                        engineError = 'Engine worker crashed.';
                        rejectAllPendingEngine('Engine worker crashed.');
                        updateEngineStatus();
                    };
                }

                function analyzeFENAsync(fen, options = {}) {
                    return new Promise((resolve, reject) => {
                        if (!engineWorker || !engineReady) {
                            reject(new Error('Engine is not ready.'));
                            return;
                        }

                        const id = engineRequestId++;
                        const timeoutId = setTimeout(() => {
                            pendingEngine.delete(id);
                            reject(new Error('Engine response timeout.'));
                        }, 15000);

                        pendingEngine.set(id, { resolve, reject, timeoutId });

                        try {
                            engineWorker.postMessage({ id, fen, options });
                        } catch (error) {
                            clearTimeout(timeoutId);
                            pendingEngine.delete(id);
                            reject(error instanceof Error ? error : new Error(String(error)));
                        }
                    });
                }

                function applyUciMove(uci) {
                    const moveText = String(uci || '').trim();
                    if (moveText.length < 4) return false;

                    const from = uciSquareToCoords(moveText[0], moveText[1]);
                    const to = uciSquareToCoords(moveText[2], moveText[3]);
                    if (!from || !to) return false;

                    const piece = board[from.row][from.col];
                    if (!piece || getPieceColor(piece) !== currentTurn) return false;

                    const legalMoves = getValidMoves(from.row, from.col);
                    const chosenMove = legalMoves.find((m) => m.row === to.row && m.col === to.col);
                    if (!chosenMove) return false;

                    const promotion = moveText.length >= 5 ? moveText[4] : null;
                    makeMove(from.row, from.col, to.row, to.col, chosenMove, {
                        promotionPiece: chosenMove.promotion ? (promotion || 'q') : null
                    });
                    return true;
                }

                async function maybeMakeAIMove() {
                    if (!isAITurn() || isGameOver || engineThinking) return;
                    if (!engineReady) {
                        updateEngineStatus();
                        return;
                    }

                    const searchSerial = ++aiSearchSerial;
                    engineThinking = true;
                    updateStatus();
                    updateEngineStatus();

                    try {
                        const fen = getFEN();
                        let bestUci = null;

                        await ensureChessOpeningBookLoaded();
                        if (window.ChessOpeningBook?.getBookMove) {
                            const book = window.ChessOpeningBook.getBookMove(fen, { maxPly: 24, variety: 0.34 });
                            bestUci = book?.uci || null;
                        }

                        if (!bestUci) {
                            const result = await analyzeFENAsync(fen, { maxDepth: aiDepth, timeMs: 9000 });
                            if (searchSerial !== aiSearchSerial) return;
                            bestUci = result?.move?.uci || null;
                        }

                        if (!bestUci) {
                            const fallback = collectAllLegalMoves(currentTurn);
                            if (fallback.length > 0) {
                                const random = fallback[Math.floor(Math.random() * fallback.length)];
                                bestUci = `${squareToAlgebraic(random.fromRow, random.fromCol)}${squareToAlgebraic(random.move.row, random.move.col)}${random.move.promotion ? 'q' : ''}`;
                            }
                        }

                        if (!bestUci) throw new Error('Engine did not return a move.');
                        if (searchSerial !== aiSearchSerial) return;

                        engineError = null;
                        if (!applyUciMove(bestUci)) {
                            throw new Error(`Engine returned illegal move: ${bestUci}`);
                        }
                    } catch (error) {
                        if (searchSerial === aiSearchSerial) {
                            engineError = error?.message || 'Engine move failed.';
                            if (window.EphemeraNotifications?.error) {
                                window.EphemeraNotifications.error('Chess Engine', engineError);
                            }
                            updateEngineStatus();
                        }
                    } finally {
                        if (searchSerial === aiSearchSerial) {
                            engineThinking = false;
                            updateStatus();
                            updateEngineStatus();
                        }
                    }
                }

                function updateOptionControls() {
                    const aiMode = gameMode === 'ai';
                    sideSelect.disabled = !aiMode;
                    depthSelect.disabled = !aiMode;
                    updateEngineStatus();
                }

                lifecycle.addListener(undoBtn, 'click', () => {
                    if (moveHistory.length === 0) return;
                    cancelPendingAI();

                    const plies = gameMode === 'ai' && currentTurn === humanColor && moveHistory.length >= 2 ? 2 : 1;
                    for (let i = 0; i < plies; i++) {
                        if (moveHistory.length === 0) break;
                        moveHistory.pop();
                    }

                    if (moveHistory.length > 0) {
                        const last = moveHistory[moveHistory.length - 1];
                        board = JSON.parse(JSON.stringify(last.boardState));
                        lastMove = last.lastMoveState ? JSON.parse(JSON.stringify(last.lastMoveState)) : null;
                        halfmoveClock = Number(last.halfmoveClock) || 0;
                        fullmoveNumber = Number(last.fullmoveNumber) || 1;
                    } else {
                        board = [
                            ['r','n','b','q','k','b','n','r'],
                            ['p','p','p','p','p','p','p','p'],
                            [null,null,null,null,null,null,null,null],
                            [null,null,null,null,null,null,null,null],
                            [null,null,null,null,null,null,null,null],
                            [null,null,null,null,null,null,null,null],
                            ['P','P','P','P','P','P','P','P'],
                            ['R','N','B','Q','K','B','N','R']
                        ];
                        lastMove = null;
                        halfmoveClock = 0;
                        fullmoveNumber = 1;
                    }

                    currentTurn = moveHistory.length % 2 === 0 ? 'white' : 'black';
                    isGameOver = isCheckmate(currentTurn) || isStalemate(currentTurn) || halfmoveClock >= 100;
                    selectedSquare = null;
                    validMoves = [];

                    capturedPieces = { white: [], black: [] };
                    for (const move of moveHistory) {
                        if (move.captured) {
                            const capturer = getPieceColor(move.piece);
                            capturedPieces[capturer].push(move.captured);
                        }
                    }

                    updateStatus();
                    updateEngineStatus();
                    updateMoves();
                    updateCaptured();
                    renderBoard();
                    maybeMakeAIMove();
                });

                lifecycle.addListener(flipBtn, 'click', () => {
                    isFlipped = !isFlipped;
                    renderBoard();
                });

                lifecycle.addListener(newBtn, 'click', async () => {
                    if (moveHistory.length > 0) {
                        const confirmed = await window.EphemeraDialog?.confirm?.(
                            'Start a new game? Current game will be lost.',
                            'New Game',
                            true
                        );
                        if (!confirmed) return;
                    }
                    initBoard();
                });

                lifecycle.addListener(modeSelect, 'change', async () => {
                    const selectedMode = modeSelect.value === 'local' ? 'local' : 'ai';
                    if (selectedMode === gameMode) return;

                    if (moveHistory.length > 0) {
                        const confirmed = await window.EphemeraDialog?.confirm?.(
                            'Changing mode starts a new game. Continue?',
                            'Change Chess Mode',
                            true
                        );
                        if (!confirmed) {
                            modeSelect.value = gameMode;
                            return;
                        }
                    }

                    gameMode = selectedMode;
                    updateOptionControls();
                    initBoard();
                });

                lifecycle.addListener(sideSelect, 'change', async () => {
                    const side = sideSelect.value === 'black' ? 'black' : 'white';
                    if (side === humanColor) return;

                    if (moveHistory.length > 0) {
                        const confirmed = await window.EphemeraDialog?.confirm?.(
                            'Changing side starts a new game. Continue?',
                            'Change Side',
                            true
                        );
                        if (!confirmed) {
                            sideSelect.value = humanColor;
                            return;
                        }
                    }

                    humanColor = side;
                    initBoard();
                });

                lifecycle.addListener(depthSelect, 'change', () => {
                    const parsed = Number(depthSelect.value);
                    if (!Number.isFinite(parsed)) {
                        aiDepth = AI_DEPTH_DEFAULT;
                    } else {
                        const truncated = Math.trunc(parsed);
                        const clamped = Math.max(AI_DEPTH_MIN, Math.min(AI_DEPTH_MAX, truncated));
                        const stepped = AI_DEPTH_MIN + (Math.round((clamped - AI_DEPTH_MIN) / AI_DEPTH_STEP) * AI_DEPTH_STEP);
                        aiDepth = Math.max(AI_DEPTH_MIN, Math.min(AI_DEPTH_MAX, stepped));
                    }
                    depthSelect.value = String(aiDepth);
                    updateEngineStatus();
                });

                initEngineWorker();
                ensureChessOpeningBookLoaded();
                updateOptionControls();
                initBoard();

                return {
                    destroy: () => {
                        cancelPendingAI();
                        stopEngineWorker();
                        lifecycle.destroy();
                    }
                };
            }
        };
    }
});

