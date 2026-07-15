const navToggle = document.querySelector('.nav-toggle');
const siteNav = document.querySelector('.site-nav');

if (navToggle && siteNav) {
  navToggle.addEventListener('click', () => {
    const isOpen = siteNav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  siteNav.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      siteNav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

const canvas = document.querySelector('#game-canvas');
const ctx = canvas?.getContext('2d');
const startBtn = document.querySelector('#start-btn');
const pauseBtn = document.querySelector('#pause-btn');
const restartBtn = document.querySelector('#restart-btn');
const scoreEl = document.querySelector('#score');
const bestEl = document.querySelector('#best-score');
const statusEl = document.querySelector('#status');
const touchButtons = [...document.querySelectorAll('.touch-btn')];
const boardWrap = document.querySelector('.canvas-wrap');

if (canvas && ctx && startBtn && pauseBtn && restartBtn && scoreEl && bestEl && statusEl && boardWrap) {
  const COLS = 20;
  const ROWS = 20;
  const CELL = 1;
  const SNAKE_SPEED = 130;
  const ENEMY_SPEED = 280;
  const ENEMY_EXPLODE_MS = 5000;
  const STORAGE_KEY = 'young924-snake-best-score';

  const directions = {
    up: { x: 0, y: -1, name: 'up' },
    down: { x: 0, y: 1, name: 'down' },
    left: { x: -1, y: 0, name: 'left' },
    right: { x: 1, y: 0, name: 'right' },
  };

  const opposite = {
    up: 'down',
    down: 'up',
    left: 'right',
    right: 'left',
  };

  const state = {
    running: false,
    paused: false,
    gameOver: false,
    score: 0,
    bestScore: Number(localStorage.getItem(STORAGE_KEY) || 0),
    snake: [],
    food: null,
    enemy: null,
    direction: directions.right,
    nextDirection: directions.right,
    tickId: null,
    enemyMoveId: null,
    explosionVisibleUntil: 0,
    enemyMoveCount: 0,
    enemyExplosionCount: 0,
    nextEnemyExplosionAt: 0,
    canvasWidth: 640,
    canvasHeight: 640,
  };

  const resizeCanvas = () => {
    const size = Math.max(300, Math.floor(boardWrap.clientWidth));
    const dpr = window.devicePixelRatio || 1;
    state.canvasWidth = size;
    state.canvasHeight = size;
    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  };

  const sameCell = (a, b) => a && b && a.x === b.x && a.y === b.y;

  const inBounds = (cell) => cell.x >= 0 && cell.x < COLS && cell.y >= 0 && cell.y < ROWS;

  const boardToPixels = (x, y) => {
    const size = state.canvasWidth / COLS;
    return {
      x: x * size,
      y: y * size,
      size,
    };
  };

  const randomInt = (limit) => Math.floor(Math.random() * limit);

  const isSnakeCell = (cell) => state.snake.some((part) => sameCell(part, cell));

  const randomFreeCell = () => {
    for (let guard = 0; guard < 600; guard += 1) {
      const cell = { x: randomInt(COLS), y: randomInt(ROWS) };
      if (!isSnakeCell(cell) && !sameCell(cell, state.food) && !sameCell(cell, state.enemy?.cell)) {
        return cell;
      }
    }
    return { x: 0, y: 0 };
  };

  const setStatus = (label) => {
    statusEl.textContent = label;
  };

  const setBestScore = (value) => {
    state.bestScore = Math.max(state.bestScore, value);
    localStorage.setItem(STORAGE_KEY, String(state.bestScore));
    bestEl.textContent = String(state.bestScore);
  };

  const clearTimers = () => {
    if (state.tickId) {
      clearInterval(state.tickId);
      state.tickId = null;
    }
    if (state.enemyMoveId) {
      clearInterval(state.enemyMoveId);
      state.enemyMoveId = null;
    }
  };

  const spawnFood = () => {
    state.food = randomFreeCell();
  };

  const spawnEnemy = () => {
    state.enemy = {
      cell: randomFreeCell(),
      direction: Object.values(directions)[randomInt(4)],
      exploding: false,
    };
  };

  const resetSnake = () => {
    const midX = Math.floor(COLS / 2);
    const midY = Math.floor(ROWS / 2);
    state.snake = [
      { x: midX - 1, y: midY },
      { x: midX, y: midY },
      { x: midX + 1, y: midY },
    ];
    state.direction = directions.right;
    state.nextDirection = directions.right;
  };

  const updateHud = () => {
    scoreEl.textContent = String(state.score);
    bestEl.textContent = String(state.bestScore);
  };

  const gameOver = (reason) => {
    state.running = false;
    state.paused = false;
    state.gameOver = true;
    clearTimers();
    setBestScore(state.score);
    updateHud();
    setStatus(`Game over · ${reason}`);
    draw();
  };

  const startTimers = () => {
    clearTimers();
    state.tickId = setInterval(stepSnake, SNAKE_SPEED);
    state.enemyMoveId = setInterval(moveEnemy, ENEMY_SPEED);
  };

  const startGame = () => {
    resetSnake();
    state.score = 0;
    state.running = true;
    state.paused = false;
    state.gameOver = false;
    state.explosionVisibleUntil = 0;
    state.enemyMoveCount = 0;
    state.enemyExplosionCount = 0;
    state.nextEnemyExplosionAt = performance.now() + ENEMY_EXPLODE_MS;
    spawnFood();
    spawnEnemy();
    updateHud();
    setStatus('Running');
    startTimers();
    draw();
  };

  const pauseGame = () => {
    if (!state.running || state.gameOver) {
      return;
    }
    state.paused = !state.paused;
    if (state.paused) {
      clearTimers();
      setStatus('Paused');
    } else {
      setStatus('Running');
      startTimers();
    }
  };

  const restartGame = () => {
    startGame();
  };

  const queueDirection = (nextName) => {
    const next = directions[nextName];
    if (!next) {
      return;
    }
    if (state.snake.length > 1 && opposite[state.direction.name] === next.name) {
      return;
    }
    if (!state.running) {
      startGame();
    }
    state.nextDirection = next;
  };

  const moveEnemy = () => {
    if (!state.running || state.paused || state.gameOver || state.enemy?.exploding) {
      return;
    }

    maybeExplodeEnemy();

    const candidates = [
      directions.up,
      directions.down,
      directions.left,
      directions.right,
    ].sort(() => Math.random() - 0.5);

    for (const candidate of candidates) {
      const nextCell = {
        x: state.enemy.cell.x + candidate.x,
        y: state.enemy.cell.y + candidate.y,
      };
      if (inBounds(nextCell) && !isSnakeCell(nextCell)) {
        state.enemy.cell = nextCell;
        state.enemy.direction = candidate;
        state.enemyMoveCount += 1;
        draw();
        return;
      }
    }
  };

  const respawnEnemy = () => {
    if (!state.running || state.gameOver) {
      return;
    }
    state.enemy = {
      cell: randomFreeCell(),
      direction: Object.values(directions)[randomInt(4)],
      exploding: false,
    };
    state.nextEnemyExplosionAt = performance.now() + ENEMY_EXPLODE_MS;
    setStatus('Running');
    draw();
  };

  const explodeEnemy = () => {
    if (!state.running || state.paused || state.gameOver) {
      return;
    }
    state.enemy.exploding = true;
    state.enemyExplosionCount += 1;
    state.explosionVisibleUntil = performance.now() + 380;
    draw();
    window.setTimeout(() => {
      if (!state.running || state.paused || state.gameOver) {
        return;
      }
      respawnEnemy();
      state.explosionVisibleUntil = 0;
    }, 380);
  };

  const maybeExplodeEnemy = () => {
    if (!state.running || state.paused || state.gameOver || state.enemy?.exploding) {
      return false;
    }
    if (performance.now() >= state.nextEnemyExplosionAt) {
      explodeEnemy();
      return true;
    }
    return false;
  };

  const stepSnake = () => {
    if (!state.running || state.paused || state.gameOver) {
      return;
    }

    maybeExplodeEnemy();
    state.direction = state.nextDirection;

    const head = state.snake[state.snake.length - 1];
    const nextHead = {
      x: head.x + state.direction.x,
      y: head.y + state.direction.y,
    };

    if (!inBounds(nextHead)) {
      gameOver('Wall collision');
      return;
    }

    const selfHit = state.snake.some((part, index) => index < state.snake.length - 1 && sameCell(part, nextHead));
    if (selfHit) {
      gameOver('Self collision');
      return;
    }

    if (sameCell(nextHead, state.enemy?.cell) && !state.enemy?.exploding) {
      gameOver('Enemy collision');
      return;
    }

    state.snake.push(nextHead);

    if (sameCell(nextHead, state.food)) {
      state.score += 10;
      setBestScore(state.score);
      spawnFood();
      setStatus('Snack time');
    } else {
      state.snake.shift();
    }

    updateHud();
    draw();
  };

  const drawCell = (cell, fill, radius = 0.28) => {
    const { x, y, size } = boardToPixels(cell.x, cell.y);
    const pad = size * radius;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x + pad, y + pad, size - pad * 2, size - pad * 2, size * 0.22);
    ctx.fill();
  };

  const draw = () => {
    const size = state.canvasWidth / COLS;
    ctx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);

    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const alternate = (x + y) % 2 === 0;
        const { x: px, y: py } = boardToPixels(x, y);
        ctx.fillStyle = alternate ? 'rgba(255,255,255,0.3)' : 'rgba(255,114,159,0.06)';
        ctx.fillRect(px, py, size, size);
      }
    }

    if (state.food) {
      drawCell(state.food, '#ff8b4f', 0.36);
    }

    if (state.enemy) {
      if (state.enemy.exploding) {
        const { x, y, size: cellSize } = boardToPixels(state.enemy.cell.x, state.enemy.cell.y);
        const cx = x + cellSize / 2;
        const cy = y + cellSize / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = '#ff4f7d';
        ctx.lineWidth = 5;
        ctx.beginPath();
        for (let i = 0; i < 8; i += 1) {
          const angle = (Math.PI * 2 * i) / 8;
          const inner = cellSize * 0.08;
          const outer = cellSize * 0.42;
          ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
          ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
        }
        ctx.stroke();
        ctx.restore();
      } else {
        drawCell(state.enemy.cell, '#ff4f7d', 0.22);
      }
    }

    state.snake.forEach((part, index) => {
      const color = index === state.snake.length - 1 ? '#32c37b' : '#74de9f';
      drawCell(part, color, index === state.snake.length - 1 ? 0.18 : 0.22);
    });

    const head = state.snake[state.snake.length - 1];
    if (head) {
      const { x, y, size: cellSize } = boardToPixels(head.x, head.y);
      ctx.fillStyle = '#1f1a21';
      ctx.beginPath();
      ctx.arc(x + cellSize * 0.37, y + cellSize * 0.4, cellSize * 0.05, 0, Math.PI * 2);
      ctx.arc(x + cellSize * 0.63, y + cellSize * 0.4, cellSize * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!state.running && !state.gameOver) {
      ctx.fillStyle = 'rgba(255,255,255,0.64)';
      ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);
      ctx.fillStyle = '#2f2432';
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Press Start or move to begin', state.canvasWidth / 2, state.canvasHeight / 2);
    }

    if (state.gameOver) {
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);
      ctx.fillStyle = '#2f2432';
      ctx.font = '800 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over', state.canvasWidth / 2, state.canvasHeight / 2 - 8);
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.fillText('Press Restart to play again', state.canvasWidth / 2, state.canvasHeight / 2 + 20);
    }
  };

  const handleDirection = (name) => queueDirection(name);

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key === 'arrowup' || key === 'w') {
      event.preventDefault();
      handleDirection('up');
    } else if (key === 'arrowdown' || key === 's') {
      event.preventDefault();
      handleDirection('down');
    } else if (key === 'arrowleft' || key === 'a') {
      event.preventDefault();
      handleDirection('left');
    } else if (key === 'arrowright' || key === 'd') {
      event.preventDefault();
      handleDirection('right');
    } else if (key === ' ' || key === 'p') {
      event.preventDefault();
      pauseGame();
    } else if (key === 'enter') {
      event.preventDefault();
      if (state.gameOver) {
        restartGame();
      } else if (!state.running) {
        startGame();
      }
    }
  });

  startBtn.addEventListener('click', () => startGame());
  pauseBtn.addEventListener('click', () => pauseGame());
  restartBtn.addEventListener('click', () => restartGame());

  touchButtons.forEach((button) => {
    button.addEventListener('click', () => {
      handleDirection(button.dataset.direction);
    });
  });

  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', resizeCanvas);

  state.bestScore = Number(localStorage.getItem(STORAGE_KEY) || 0);
  setBestScore(state.bestScore);
  updateHud();
  resizeCanvas();
  setStatus('Ready');
  draw();

  window.__snakeGame = {
    get state() {
      return state;
    },
    startGame,
    pauseGame,
    restartGame,
    queueDirection,
    spawnFood,
    spawnEnemy,
    forceEnemyExplosion: () => explodeEnemy(),
    draw,
  };
}
