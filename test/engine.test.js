import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  COLS,
  LINE_SCORES,
  PIECES,
  ROWS,
  cells,
  collides,
  createState,
  gravityInterval,
  hardDrop,
  hold,
  move,
  rotate,
  softDrop,
  startGame,
  tick,
  togglePause,
} from '../src/engine.js'

function advance(state, ms, step = 50) {
  let now = state.lastTick ?? 0
  if (state.lastTick == null) tick(state, now)
  let left = ms
  while (left > 0) {
    const delta = Math.min(step, left)
    now += delta
    tick(state, now)
    left -= delta
  }
  return now
}

function finishClearing(state) {
  let guard = 0
  while (state.status === 'clearing' && guard < 20) {
    advance(state, 50)
    guard += 1
  }
}

test('seven tetrominoes have distinct colors and four rotations', () => {
  const types = Object.keys(PIECES)
  assert.deepEqual(types.sort(), ['I', 'J', 'L', 'O', 'S', 'T', 'Z'])
  const colors = types.map((type) => PIECES[type].color)
  assert.equal(new Set(colors).size, 7)
  for (const type of types) {
    assert.equal(PIECES[type].rotations.length, 4)
    for (const rotation of PIECES[type].rotations) {
      assert.equal(rotation.length, 4)
      const keys = rotation.map(([x, y]) => `${x},${y}`)
      assert.equal(new Set(keys).size, 4)
      for (const [x, y] of rotation) {
        assert.ok(x >= 0 && x < 4 && y >= 0 && y < 4, type)
      }
    }
  }
})

test('a new game deals one 7-bag and starts at level 1', () => {
  const state = createState(() => 0)
  startGame(state, 0)
  assert.equal(state.status, 'playing')
  assert.equal(state.score, 0)
  assert.equal(state.lines, 0)
  assert.equal(state.level, 1)
  assert.equal(state.board.length, ROWS)
  assert.equal(state.board[0].length, COLS)
  const seen = [state.piece.type, state.next, ...state.bag]
  assert.equal(seen.length, 7)
  assert.equal(new Set(seen).size, 7)
})

test('pieces stop at the walls', () => {
  const state = createState(() => 0)
  startGame(state, 0)
  assert.equal(state.piece.type, 'I')
  while (move(state, -1)) {}
  assert.equal(state.piece.x, 0)
  assert.equal(move(state, -1), false)
  while (move(state, 1)) {}
  assert.equal(state.piece.x, 6)
  assert.equal(move(state, 1), false)
})

test('soft drop scores 1 and hard drop scores 2 per row', () => {
  const state = createState(() => 0)
  startGame(state, 0)
  assert.equal(softDrop(state), true)
  assert.equal(state.piece.y, 1)
  assert.equal(state.score, 1)
  const distance = hardDrop(state, 0)
  assert.equal(distance, 17)
  assert.equal(state.score, 1 + 17 * 2)
  assert.ok(state.board[19].slice(3, 7).every((cell) => cell === 'I'))
})

test('a filled row clears, scores, and lets the stack fall', () => {
  const state = createState(() => 0)
  startGame(state, 0)
  state.piece.y = 18
  state.board[17][0] = 'J'
  for (let x = 0; x < COLS; x += 1) {
    if (x < 3 || x > 6) state.board[19][x] = 'T'
  }
  hardDrop(state, 0)
  assert.equal(state.status, 'clearing')
  finishClearing(state)
  assert.equal(state.lines, 1)
  assert.equal(state.score, LINE_SCORES[1])
  assert.equal(state.level, 1)
  assert.equal(state.board[18][0], 'J')
  assert.equal(state.board[19][0], null)
  assert.equal(state.status, 'playing')
})

test('four lines score a tetris and ten lines raise the level', () => {
  const state = createState(() => 0)
  startGame(state, 0)
  state.piece = { type: 'I', rotation: 1, x: 3, y: 16 }
  for (let y = 16; y <= 19; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (x !== 5) state.board[y][x] = 'O'
    }
  }
  assert.equal(collides(state, state.piece), false)
  hardDrop(state, 0)
  finishClearing(state)
  assert.equal(state.lines, 4)
  assert.equal(state.score, 800)
  assert.equal(state.level, 1)

  state.lines = 9
  state.level = 1
  state.score = 0
  state.piece = { type: 'I', rotation: 0, x: 3, y: 18 }
  for (let x = 0; x < COLS; x += 1) {
    if (x < 3 || x > 6) state.board[19][x] = 'T'
  }
  hardDrop(state, 0)
  finishClearing(state)
  assert.equal(state.lines, 10)
  assert.equal(state.level, 2)
  assert.equal(state.score, 100)
})

test('line score uses the level before it increases', () => {
  const state = createState(() => 0)
  startGame(state, 0)
  state.lines = 20
  state.level = 3
  state.score = 0
  state.piece = { type: 'O', rotation: 0, x: 3, y: 18 }
  for (const y of [18, 19]) {
    for (let x = 0; x < COLS; x += 1) {
      if (x !== 4 && x !== 5) state.board[y][x] = 'T'
    }
  }
  hardDrop(state, 0)
  finishClearing(state)
  assert.equal(state.lines, 22)
  assert.equal(state.level, 3)
  assert.equal(state.score, 300 * 3)
})

test('rotation stays inside the well and kicks off the floor and stacked blocks', () => {
  for (const type of Object.keys(PIECES)) {
    const open = createState(() => 0)
    open.status = 'playing'
    open.piece = { type, rotation: 0, x: 3, y: 5 }
    for (let step = 0; step < 4; step += 1) {
      assert.equal(rotate(open, 1), true, type)
      for (const [x, y] of cells(open.piece)) {
        assert.ok(x >= 0 && x < COLS && y >= 0 && y < ROWS, type)
      }
    }

    const floor = createState(() => 0)
    floor.status = 'playing'
    floor.piece = { type, rotation: 0, x: 3, y: 18 }
    assert.equal(rotate(floor, 1), true, `${type} floor`)
    for (const [x, y] of cells(floor.piece)) {
      assert.ok(x >= 0 && x < COLS && y >= 0 && y < ROWS, `${type} floor bounds`)
    }
  }

  const kicked = createState(() => 0)
  kicked.status = 'playing'
  kicked.piece = { type: 'T', rotation: 0, x: 3, y: 5 }
  kicked.board[7][4] = 'J'
  assert.equal(rotate(kicked, 1), true)
  assert.equal(kicked.piece.rotation, 1)
  assert.equal(kicked.piece.x, 2)

  const blocked = createState(() => 0)
  startGame(blocked, 0)
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) blocked.board[y][x] = 'T'
  }
  for (const [x, y] of cells(blocked.piece)) blocked.board[y][x] = null
  const before = { ...blocked.piece }
  assert.equal(rotate(blocked, 1), false)
  assert.deepEqual(blocked.piece, before)
})

test('hold swaps once per piece and returns the stored piece later', () => {
  const state = createState(() => 0)
  startGame(state, 0)
  const first = state.piece.type
  assert.equal(hold(state, 0), true)
  assert.equal(state.hold, first)
  assert.notEqual(state.piece.type, first)
  assert.equal(hold(state, 0), false)
  hardDrop(state, 0)
  assert.equal(state.holdLocked, false)
  const third = state.piece.type
  assert.equal(hold(state, 0), true)
  assert.equal(state.piece.type, first)
  assert.equal(state.hold, third)
})

test('an empty bag refills before the next piece', () => {
  const state = createState(() => 0)
  startGame(state, 0)
  state.bag = []
  state.next = 'T'
  hardDrop(state, 0)
  assert.equal(state.piece.type, 'T')
  assert.equal(state.bag.length, 6)
  assert.ok(PIECES[state.next])
})

test('pause freezes gravity and blocks play', () => {
  const state = createState(() => 0)
  startGame(state, 0)
  assert.equal(togglePause(state), true)
  advance(state, 3000)
  assert.equal(state.piece.y, 0)
  assert.equal(move(state, -1), false)
  assert.equal(hold(state, 0), false)
  assert.equal(togglePause(state), true)
  advance(state, gravityInterval(1))
  assert.equal(state.piece.y, 1)
})

test('gravity interval shrinks by level and locks a grounded piece', () => {
  assert.ok(gravityInterval(1) > gravityInterval(5))
  assert.ok(gravityInterval(5) > gravityInterval(10))
  assert.equal(gravityInterval(1), 1000)
  assert.equal(gravityInterval(30), 80)

  const state = createState(() => 0)
  startGame(state, 0)
  state.piece.y = 18
  advance(state, 400)
  assert.equal(state.piece.y, 18)
  assert.equal(state.board[19].some(Boolean), false)
  move(state, -1)
  advance(state, 400)
  assert.equal(state.piece.y, 18)
  assert.equal(state.board[19].some(Boolean), false)
  advance(state, 200)
  assert.ok(state.board[19].some((cell) => cell === 'I'))
})

test('spawn overlap ends the game without writing the new piece', () => {
  const state = createState(() => 0)
  startGame(state, 0)
  for (let x = 0; x < COLS; x += 1) {
    if (x !== 9) {
      state.board[0][x] = 'S'
      state.board[1][x] = 'S'
    }
  }
  const before = state.board[1][3]
  hardDrop(state, 0)
  assert.equal(state.status, 'over')
  assert.equal(state.score, 36)
  assert.equal(state.board[1][3], before)
  assert.equal(state.board[19][3], 'I')
})

test('restart clears the previous attempt', () => {
  const state = createState(() => 0)
  startGame(state, 0)
  softDrop(state)
  hardDrop(state, 0)
  assert.ok(state.score > 0)
  startGame(state, 0)
  assert.equal(state.score, 0)
  assert.equal(state.lines, 0)
  assert.equal(state.hold, null)
  assert.equal(state.board.every((row) => row.every((cell) => cell == null)), true)
})
