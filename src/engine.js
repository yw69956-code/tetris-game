export const COLS = 10
export const ROWS = 20
export const SPAWN_X = 3
export const SPAWN_Y = 0
export const LOCK_DELAY = 500
export const MAX_LOCK_RESETS = 15

export const LINE_SCORES = [0, 100, 300, 500, 800]

const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']

// Rotation states are 4x4 matrices in spawn orientation, then clockwise.
export const PIECES = {
  I: {
    color: '#3ecbff',
    rotations: [
      [[0, 1], [1, 1], [2, 1], [3, 1]],
      [[2, 0], [2, 1], [2, 2], [2, 3]],
      [[0, 2], [1, 2], [2, 2], [3, 2]],
      [[1, 0], [1, 1], [1, 2], [1, 3]],
    ],
  },
  O: {
    color: '#ffd166',
    rotations: [
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
    ],
  },
  T: {
    color: '#c084fc',
    rotations: [
      [[1, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [1, 2]],
      [[1, 0], [0, 1], [1, 1], [1, 2]],
    ],
  },
  S: {
    color: '#3ddc97',
    rotations: [
      [[1, 0], [2, 0], [0, 1], [1, 1]],
      [[1, 0], [1, 1], [2, 1], [2, 2]],
      [[1, 1], [2, 1], [0, 2], [1, 2]],
      [[0, 0], [0, 1], [1, 1], [1, 2]],
    ],
  },
  Z: {
    color: '#ff5d73',
    rotations: [
      [[0, 0], [1, 0], [1, 1], [2, 1]],
      [[2, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [1, 2], [2, 2]],
      [[1, 0], [0, 1], [1, 1], [0, 2]],
    ],
  },
  J: {
    color: '#5b8cff',
    rotations: [
      [[0, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [2, 2]],
      [[1, 0], [1, 1], [0, 2], [1, 2]],
    ],
  },
  L: {
    color: '#ff9f43',
    rotations: [
      [[2, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [1, 2], [2, 2]],
      [[0, 1], [1, 1], [2, 1], [0, 2]],
      [[0, 0], [1, 0], [1, 1], [1, 2]],
    ],
  },
}

// Basic wall kicks: the first offset that does not collide wins.
export const KICKS = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [-2, 0],
  [2, 0],
  [0, -1],
  [-1, -1],
  [1, -1],
  [0, -2],
  [-1, -2],
  [1, -2],
  [-2, -1],
  [2, -1],
]

export function gravityInterval(level) {
  const safe = Math.max(1, level)
  return Math.max(80, Math.round(1000 * Math.pow(0.8, safe - 1)))
}

export function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null))
}

export function createState(rng = Math.random) {
  return {
    rng,
    board: emptyBoard(),
    piece: null,
    next: null,
    hold: null,
    holdLocked: false,
    bag: [],
    score: 0,
    lines: 0,
    level: 1,
    status: 'ready',
    dropAcc: 0,
    groundedTime: 0,
    lockResets: 0,
    clearRows: [],
    clearLeft: 0,
    lastClear: 0,
    lastClearUntil: 0,
    lastTick: null,
  }
}

export function cells(piece) {
  const shape = PIECES[piece.type].rotations[piece.rotation]
  return shape.map(([x, y]) => [x + piece.x, y + piece.y])
}

export function collides(state, piece) {
  for (const [x, y] of cells(piece)) {
    if (x < 0 || x >= COLS || y >= ROWS) return true
    if (y >= 0 && state.board[y][x]) return true
  }
  return false
}

function pull(state) {
  if (state.bag.length === 0) {
    const types = TYPES.slice()
    for (let i = types.length - 1; i > 0; i -= 1) {
      const j = Math.min(i, Math.floor(state.rng() * (i + 1)))
      const swap = types[i]
      types[i] = types[j]
      types[j] = swap
    }
    state.bag = types
  }
  return state.bag.pop()
}

function canControl(state) {
  return state.status === 'playing' && Boolean(state.piece)
}

function grounded(state) {
  if (!state.piece) return false
  return collides(state, { ...state.piece, y: state.piece.y + 1 })
}

function notePlayerShift(state) {
  if (grounded(state)) {
    if (state.lockResets < MAX_LOCK_RESETS) {
      state.groundedTime = 0
      state.lockResets += 1
    }
    return
  }
  state.groundedTime = 0
  state.lockResets = 0
}

function enterPiece(state, type, now) {
  state.piece = { type, rotation: 0, x: SPAWN_X, y: SPAWN_Y }
  state.dropAcc = 0
  state.groundedTime = 0
  state.lockResets = 0
  state.lastTick = now
  if (collides(state, state.piece)) {
    state.status = 'over'
    return false
  }
  state.status = 'playing'
  return true
}

function spawnFromQueue(state, now) {
  const type = state.next ?? pull(state)
  state.next = pull(state)
  return enterPiece(state, type, now)
}

export function startGame(state, now = 0) {
  state.board = emptyBoard()
  state.score = 0
  state.lines = 0
  state.level = 1
  state.hold = null
  state.holdLocked = false
  state.next = null
  state.bag = []
  state.clearRows = []
  state.clearLeft = 0
  state.lastClear = 0
  state.lastClearUntil = 0
  state.piece = null
  state.dropAcc = 0
  state.groundedTime = 0
  state.lockResets = 0
  spawnFromQueue(state, now)
  return state
}

function tryShift(state, dx, dy, kind) {
  const next = {
    type: state.piece.type,
    rotation: state.piece.rotation,
    x: state.piece.x + dx,
    y: state.piece.y + dy,
  }
  if (collides(state, next)) return false
  state.piece = next
  if (kind === 'slide') notePlayerShift(state)
  else if (!grounded(state)) {
    state.groundedTime = 0
    state.lockResets = 0
  }
  return true
}

export function move(state, dx) {
  if (!canControl(state) || !dx) return false
  return tryShift(state, dx, 0, 'slide')
}

export function rotate(state, dir = 1) {
  if (!canControl(state)) return false
  const rotation = (state.piece.rotation + dir + 4) % 4
  for (const [kx, ky] of KICKS) {
    const next = {
      type: state.piece.type,
      rotation,
      x: state.piece.x + kx,
      y: state.piece.y + ky,
    }
    if (!collides(state, next)) {
      state.piece = next
      notePlayerShift(state)
      return true
    }
  }
  return false
}

export function softDrop(state) {
  if (!canControl(state)) return false
  if (!tryShift(state, 0, 1, 'soft')) return false
  state.score += 1
  state.dropAcc = 0
  return true
}

function finishClear(state, now) {
  const count = state.clearRows.length
  const remove = new Set(state.clearRows)
  const kept = []
  for (let y = 0; y < ROWS; y += 1) {
    if (!remove.has(y)) kept.push(state.board[y])
  }
  while (kept.length < ROWS) kept.unshift(Array(COLS).fill(null))
  state.board = kept
  state.clearRows = []
  state.clearLeft = 0
  state.lines += count
  state.score += (LINE_SCORES[count] || 0) * state.level
  state.level = Math.floor(state.lines / 10) + 1
  state.lastClear = count
  state.lastClearUntil = now + 900
  state.holdLocked = false
  state.status = 'playing'
  spawnFromQueue(state, now)
}

function lockPiece(state, now) {
  if (!state.piece) return
  for (const [x, y] of cells(state.piece)) {
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) state.board[y][x] = state.piece.type
  }
  const full = []
  for (let y = 0; y < ROWS; y += 1) {
    if (state.board[y].every(Boolean)) full.push(y)
  }
  state.piece = null
  state.groundedTime = 0
  state.lockResets = 0
  state.dropAcc = 0
  if (full.length) {
    state.clearRows = full
    state.clearLeft = 160
    state.status = 'clearing'
    return
  }
  state.holdLocked = false
  spawnFromQueue(state, now)
}

export function hardDrop(state, now = 0) {
  if (!canControl(state)) return 0
  let distance = 0
  while (!collides(state, { ...state.piece, y: state.piece.y + 1 })) {
    state.piece = { ...state.piece, y: state.piece.y + 1 }
    distance += 1
  }
  state.score += distance * 2
  lockPiece(state, now)
  return distance
}

export function hold(state, now = 0) {
  if (!canControl(state) || state.holdLocked) return false
  const current = state.piece.type
  state.holdLocked = true
  if (state.hold == null) {
    state.hold = current
    spawnFromQueue(state, now)
  } else {
    const swapped = state.hold
    state.hold = current
    enterPiece(state, swapped, now)
  }
  return true
}

export function togglePause(state) {
  if (state.status === 'playing') {
    state.status = 'paused'
    return true
  }
  if (state.status === 'paused') {
    state.status = 'playing'
    state.lastTick = null
    return true
  }
  return false
}

export function tick(state, now) {
  if (state.status !== 'playing' && state.status !== 'clearing') return
  if (state.lastTick == null) {
    state.lastTick = now
    return
  }
  const dt = Math.min(50, Math.max(0, now - state.lastTick))
  state.lastTick = now
  if (dt === 0) return

  if (state.status === 'clearing') {
    state.clearLeft -= dt
    if (state.clearLeft <= 0) finishClear(state, now)
    return
  }

  if (!state.piece) return
  state.dropAcc += dt
  const interval = gravityInterval(state.level)
  while (state.dropAcc >= interval && state.status === 'playing') {
    state.dropAcc -= interval
    if (!tryShift(state, 0, 1, 'gravity')) break
  }
  if (state.status === 'playing' && state.piece && grounded(state)) {
    state.groundedTime += dt
    if (state.groundedTime >= LOCK_DELAY) lockPiece(state, now)
  }
}
