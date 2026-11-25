import { COLS, PIECES, ROWS, cells, collides } from './engine.js'

function colorOf(type) {
  return PIECES[type]?.color || '#d7dde8'
}

function shade(hex, amount) {
  const value = parseInt(hex.slice(1), 16)
  const channel = (shift) => {
    const raw = (value >> shift) & 255
    return Math.max(0, Math.min(255, Math.round(raw * amount)))
  }
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function prepare(canvas) {
  const rect = canvas.getBoundingClientRect()
  const width = rect.width
  const height = rect.height
  if (width < 8 || height < 8) return null
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const bufferW = Math.round(width * dpr)
  const bufferH = Math.round(height * dpr)
  if (canvas.width !== bufferW || canvas.height !== bufferH) {
    canvas.width = bufferW
    canvas.height = bufferH
  }
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, width, height }
}

function drawBlock(ctx, x, y, size, color) {
  const pad = size * 0.08
  const bx = x + pad
  const by = y + pad
  const side = size - pad * 2
  const radius = side * 0.2
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'
  roundRect(ctx, bx, by + size * 0.05, side, side, radius)
  ctx.fill()
  const gradient = ctx.createLinearGradient(bx, by, bx + side, by + side)
  gradient.addColorStop(0, shade(color, 1.28))
  gradient.addColorStop(0.45, color)
  gradient.addColorStop(1, shade(color, 0.72))
  ctx.fillStyle = gradient
  roundRect(ctx, bx, by, side, side, radius)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.38)'
  roundRect(
    ctx,
    bx + side * 0.16,
    by + side * 0.12,
    side * 0.36,
    Math.max(2, side * 0.14),
    radius * 0.45,
  )
  ctx.fill()
}

function paintPiece(ctx, piece, cell) {
  const color = colorOf(piece.type)
  for (const [x, y] of cells(piece)) {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) continue
    drawBlock(ctx, x * cell, y * cell, cell, color)
  }
}

function drawGhost(ctx, piece, cell) {
  ctx.save()
  ctx.strokeStyle = colorOf(piece.type)
  ctx.globalAlpha = 0.75
  ctx.lineWidth = Math.max(1.5, cell * 0.07)
  ctx.lineJoin = 'round'
  for (const [x, y] of cells(piece)) {
    if (y < 0 || x < 0 || x >= COLS || y >= ROWS) continue
    const pad = cell * 0.12
    roundRect(
      ctx,
      x * cell + pad,
      y * cell + pad,
      cell - pad * 2,
      cell - pad * 2,
      cell * 0.16,
    )
    ctx.stroke()
  }
  ctx.restore()
}

function ghostPiece(state) {
  if (!state.piece) return null
  if (state.status !== 'playing' && state.status !== 'paused') return null
  let y = state.piece.y
  const probe = { ...state.piece }
  while (true) {
    probe.y = y + 1
    if (collides(state, probe)) break
    y += 1
  }
  if (y === state.piece.y) return null
  return { ...state.piece, y }
}

export function drawBoard(canvas, state) {
  const view = prepare(canvas)
  if (!view) return
  const { ctx, width, height } = view
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#07090d'
  ctx.fillRect(0, 0, width, height)

  const cell = width / COLS
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 1; x < COLS; x += 1) {
    ctx.moveTo(x * cell, 0)
    ctx.lineTo(x * cell, height)
  }
  for (let y = 1; y < ROWS; y += 1) {
    ctx.moveTo(0, y * cell)
    ctx.lineTo(width, y * cell)
  }
  ctx.stroke()

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const type = state.board[y][x]
      if (type) drawBlock(ctx, x * cell, y * cell, cell, colorOf(type))
    }
  }

  const ghost = ghostPiece(state)
  if (ghost) drawGhost(ctx, ghost, cell)
  if (state.piece) paintPiece(ctx, state.piece, cell)

  if (state.clearRows.length) {
    ctx.fillStyle = 'rgba(255, 244, 214, 0.45)'
    for (const y of state.clearRows) ctx.fillRect(0, y * cell, width, cell)
  }
}

export function drawPreview(canvas, type, options = {}) {
  const view = prepare(canvas)
  if (!view) return
  const { ctx, width, height } = view
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#07090d'
  ctx.fillRect(0, 0, width, height)
  if (!type || !PIECES[type]) return

  const minos = PIECES[type].rotations[0]
  let minX = 4
  let minY = 4
  let maxX = -1
  let maxY = -1
  for (const [x, y] of minos) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  const spanX = maxX - minX + 1
  const spanY = maxY - minY + 1
  const size = Math.min(width, height) / 4.7
  const offsetX = (width - spanX * size) / 2 - minX * size
  const offsetY = (height - spanY * size) / 2 - minY * size
  ctx.save()
  if (options.dim) ctx.globalAlpha = 0.38
  for (const [x, y] of minos) {
    drawBlock(ctx, offsetX + x * size, offsetY + y * size, size, colorOf(type))
  }
  ctx.restore()
}
