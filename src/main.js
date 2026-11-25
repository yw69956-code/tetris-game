import './style.css'
import {
  hardDrop,
  hold,
  move,
  rotate,
  softDrop,
  startGame,
  tick,
  togglePause,
  createState,
} from './engine.js'
import { drawBoard, drawPreview } from './render.js'

const STORAGE_KEY = 'tetris.highScore'
const DAS = 140
const ARR = 32
const SOFT_EVERY = 45
const CLEAR_LABELS = {
  1: '单行消除',
  2: '双行消除',
  3: '三行消除',
  4: '四行消除',
}

const state = createState()
let highScore = loadHighScore()
let newRecord = false

const board = document.querySelector('#board')
const nextCanvas = document.querySelector('#next')
const holdCanvas = document.querySelector('#hold')
const scoreEl = document.querySelector('#score')
const levelEl = document.querySelector('#level')
const linesEl = document.querySelector('#lines')
const bestEl = document.querySelector('#best')
const recordTag = document.querySelector('#record-tag')
const holdEmpty = document.querySelector('#hold-empty')
const nextEmpty = document.querySelector('#next-empty')
const holdHint = document.querySelector('#hold-hint')
const flashEl = document.querySelector('#flash')
const overlay = document.querySelector('#overlay')
const overlayTitle = document.querySelector('#overlay-title')
const overlayText = document.querySelector('#overlay-text')
const overlayAction = document.querySelector('#overlay-action')
const pauseBtn = document.querySelector('#pause-btn')
const restartBtn = document.querySelector('#restart')

const held = new Set()
let horiz = null
let horizAt = 0
let softAt = 0

function loadHighScore() {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY))
    if (!Number.isFinite(value) || value < 0) return 0
    return Math.floor(value)
  } catch {
    return 0
  }
}

function saveHighScore(value) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // Private mode and blocked storage still leave the score on screen.
  }
}

function formatScore(value) {
  return Math.floor(value).toLocaleString('zh-CN')
}

function setFigure(el, value) {
  const text = formatScore(value)
  if (el.textContent === text) return
  el.textContent = text
  el.classList.remove('bump')
  void el.offsetWidth
  el.classList.add('bump')
}

function begin() {
  newRecord = false
  startGame(state, performance.now())
}

function onAction(name) {
  const now = performance.now()
  if (name === 'left') move(state, -1)
  else if (name === 'right') move(state, 1)
  else if (name === 'rotate') rotate(state, 1)
  else if (name === 'soft') softDrop(state)
  else if (name === 'hard') hardDrop(state, now)
  else if (name === 'hold') hold(state, now)
  else if (name === 'pause') togglePause(state)
}

window.addEventListener('keydown', (event) => {
  const key = event.key
  const control =
    key === 'ArrowLeft' ||
    key === 'ArrowRight' ||
    key === 'ArrowDown' ||
    key === 'ArrowUp' ||
    key === ' ' ||
    key === 'c' ||
    key === 'C' ||
    key === 'p' ||
    key === 'P'
  if (control) event.preventDefault()
  if (event.repeat || held.has(key)) return
  held.add(key)

  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    horiz = key
    horizAt = performance.now() + DAS
    onAction(key === 'ArrowLeft' ? 'left' : 'right')
  } else if (key === 'ArrowDown') {
    onAction('soft')
    softAt = performance.now() + SOFT_EVERY
  } else if (key === 'ArrowUp') {
    onAction('rotate')
  } else if (key === ' ') {
    if (state.status === 'playing') onAction('hard')
    else if (state.status === 'paused') togglePause(state)
    else begin()
  } else if (key === 'c' || key === 'C') {
    onAction('hold')
  } else if (key === 'p' || key === 'P') {
    onAction('pause')
  } else if (key === 'Enter' && state.status !== 'playing') {
    if (state.status === 'paused') togglePause(state)
    else begin()
  }
})

window.addEventListener('keyup', (event) => {
  held.delete(event.key)
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  if (event.key !== horiz) return
  if (held.has('ArrowLeft')) {
    horiz = 'ArrowLeft'
    horizAt = performance.now() + DAS
    onAction('left')
  } else if (held.has('ArrowRight')) {
    horiz = 'ArrowRight'
    horizAt = performance.now() + DAS
    onAction('right')
  } else {
    horiz = null
  }
})

window.addEventListener('blur', () => {
  held.clear()
  horiz = null
})

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.status === 'playing') {
    held.clear()
    horiz = null
    togglePause(state)
  }
})

function bindPress(button) {
  const repeatName = button.dataset.repeat
  const onceName = button.dataset.once
  let delay = 0
  let timer = 0
  const stop = () => {
    clearTimeout(delay)
    clearInterval(timer)
    delay = 0
    timer = 0
  }
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    stop()
    button.setPointerCapture(event.pointerId)
    onAction(repeatName || onceName)
    if (!repeatName) return
    delay = window.setTimeout(() => {
      timer = window.setInterval(() => onAction(repeatName), ARR)
    }, DAS)
  })
  button.addEventListener('pointerup', stop)
  button.addEventListener('pointercancel', stop)
  button.addEventListener('lostpointercapture', stop)
  button.addEventListener('contextmenu', (event) => event.preventDefault())
  button.addEventListener('click', (event) => {
    if (event.detail !== 0) return
    onAction(repeatName || onceName)
  })
}

document.querySelectorAll('.touch button').forEach(bindPress)

overlayAction.addEventListener('click', () => {
  overlayAction.blur()
  if (state.status === 'paused') togglePause(state)
  else begin()
})

restartBtn.addEventListener('click', () => {
  restartBtn.blur()
  begin()
})

function pumpKeys(now) {
  if (state.status !== 'playing') return
  if (horiz && now >= horizAt) {
    onAction(horiz === 'ArrowLeft' ? 'left' : 'right')
    horizAt = now + ARR
  }
  if (held.has('ArrowDown') && now >= softAt) {
    onAction('soft')
    softAt = now + SOFT_EVERY
  }
}

function syncOverlay() {
  const paused = state.status === 'paused'
  const over = state.status === 'over'
  const ready = state.status === 'ready'
  overlay.classList.toggle('is-open', paused || over || ready)
  if (ready) {
    overlayTitle.textContent = '俄罗斯方块'
    overlayText.textContent = '把方块排成完整的一行。'
    overlayAction.textContent = '开始游戏'
  } else if (paused) {
    overlayTitle.textContent = '暂停'
    overlayText.textContent = '游戏已暂停。'
    overlayAction.textContent = '继续'
  } else if (over) {
    overlayTitle.textContent = '游戏结束'
    overlayText.textContent = newRecord
      ? `新纪录 ${formatScore(state.score)}`
      : `本局分数 ${formatScore(state.score)}`
    overlayAction.textContent = '重新开始'
  }
}

function syncView() {
  if (state.score > highScore) {
    highScore = state.score
    newRecord = state.score > 0
    saveHighScore(highScore)
  }
  setFigure(scoreEl, state.score)
  setFigure(levelEl, state.status === 'ready' ? 1 : state.level)
  setFigure(linesEl, state.lines)
  setFigure(bestEl, highScore)
  recordTag.hidden = !newRecord
  holdEmpty.hidden = Boolean(state.hold)
  nextEmpty.hidden = Boolean(state.next)
  holdHint.textContent = state.holdLocked ? '本回合已用' : 'C 暂存'
  const paused = state.status === 'paused'
  pauseBtn.textContent = paused ? '继续' : '暂停'
  pauseBtn.setAttribute('aria-label', paused ? '继续' : '暂停')
  pauseBtn.setAttribute('aria-pressed', paused ? 'true' : 'false')
  const showFlash = state.lastClear > 0 && performance.now() < state.lastClearUntil
  flashEl.hidden = !showFlash
  if (showFlash) flashEl.textContent = CLEAR_LABELS[state.lastClear] || ''
  syncOverlay()
}

function frame(now) {
  pumpKeys(now)
  tick(state, now)
  drawBoard(board, state)
  drawPreview(nextCanvas, state.next)
  drawPreview(holdCanvas, state.hold, { dim: state.holdLocked })
  syncView()
  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
