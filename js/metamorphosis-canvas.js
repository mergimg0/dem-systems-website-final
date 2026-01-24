/**
 * Metamorphosis Canvas Animation
 *
 * 8-phase canvas animation triggered by magnetic cursor capture:
 * 1. START - dots appear at center
 * 2. CHAOS - dots scatter randomly
 * 3. ORDER - dots form grid (stagger from center)
 * 4. CONVERGE - dots converge back to center (stagger from edges)
 * 5. WAVE - single dot expands into complex wave
 * 6. FILTER - harmonics filter out, wave simplifies
 * 7. SPLIT - wave contracts, splits into 3 dots
 * 8. FLOW - 3 dots become flowing sine lines (loops)
 *
 * @see PUNCTUATION-MAGNET-METAMORPHOSIS-IMPLEMENTATION.md (source)
 */

import { animate, createTimeline, stagger } from 'animejs';

// === CONFIGURATION ===
const CONFIG = {
  cols: 30,
  rows: 15,
  dotRadius: 2,
  gridSpacing: 20,
  dotColor: '#000',
  baseCycles: 2,
  baseAmplitude: 40,
  harmonicCount: 8,
  samples: 300
};

// === STATE ===
let canvas = null;
let ctx = null;
let particles = [];
let centerX = 0;
let centerY = 0;
let mainTimeline = null;
let flowLoop = null;
let isRunning = false;
let harmonics = [];
let currentPhase = 'start';

const state = {
  dotScale: 0,
  waveExpand: 0,
  waveFilter: 0,
  splitProgress: 0,
  flowStretch: 0,
  dashOffset: 0,
  dotOpacity: 1
};

/**
 * Seeded random number generator (mulberry32)
 * Ensures consistent "random" values across runs
 */
function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Initialize particle positions
 */
function initParticles() {
  const random = mulberry32(12345);
  const w = canvas.width;
  const h = canvas.height;
  centerX = w / 2;
  centerY = h / 2;

  const gridW = (CONFIG.cols - 1) * CONFIG.gridSpacing;
  const gridH = (CONFIG.rows - 1) * CONFIG.gridSpacing;
  const offX = (w - gridW) / 2;
  const offY = (h - gridH) / 2;

  particles = [];
  for (let r = 0; r < CONFIG.rows; r++) {
    for (let c = 0; c < CONFIG.cols; c++) {
      particles.push({
        x: centerX,
        y: centerY,
        chaosX: random() * w,
        chaosY: random() * h,
        gridX: offX + c * CONFIG.gridSpacing,
        gridY: offY + r * CONFIG.gridSpacing,
        gridRow: r,
        gridCol: c
      });
    }
  }
}

/**
 * Initialize harmonics for wave animation
 */
function initHarmonics() {
  const random = mulberry32(42);
  harmonics = [];
  for (let n = 0; n < CONFIG.harmonicCount; n++) {
    harmonics.push({
      freqMult: 2 + n * 2 + random(),
      amp: 30 * (1 - n / CONFIG.harmonicCount) * (0.6 + random() * 0.4),
      phase: random() * Math.PI * 2,
      decayPower: 1.2 + n * 0.4
    });
  }
}

/**
 * Compute wave Y position with harmonics
 */
function computeWaveY(x, filter) {
  const baseFreq = (CONFIG.baseCycles * 2 * Math.PI) / canvas.width;
  let y = centerY + CONFIG.baseAmplitude * Math.sin(baseFreq * x);

  for (const h of harmonics) {
    const damp = Math.pow(1 - filter, h.decayPower);
    y += h.amp * damp * Math.sin(h.freqMult * baseFreq * x + h.phase);
  }

  return y;
}

// === RENDER FUNCTIONS ===

/**
 * Render dots (phases: start, chaos, order, converge)
 */
function renderDots() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  ctx.fillStyle = CONFIG.dotColor;
  ctx.globalAlpha = state.dotOpacity;

  for (const p of particles) {
    const r = CONFIG.dotRadius * state.dotScale;
    if (r > 0.1) {
      ctx.moveTo(p.x + r, p.y);
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    }
  }

  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * Render expanding wave (phases: wave, filter)
 */
function renderWave() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const extent = state.waveExpand;
  if (extent <= 0) {
    // Draw single center dot
    ctx.beginPath();
    ctx.fillStyle = CONFIG.dotColor;
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const maxExt = canvas.width / 2;
  const currExt = extent * maxExt;
  const leftX = centerX - currExt;
  const rightX = centerX + currExt;
  const pts = Math.max(2, Math.floor(extent * CONFIG.samples));

  // Draw wave line
  ctx.beginPath();
  ctx.strokeStyle = CONFIG.dotColor;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  for (let i = 0; i <= pts; i++) {
    const x = leftX + (i / pts) * (rightX - leftX);
    const y = computeWaveY(x, state.waveFilter);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Draw end dots
  ctx.beginPath();
  ctx.fillStyle = CONFIG.dotColor;
  ctx.arc(leftX, computeWaveY(leftX, state.waveFilter), 4, 0, Math.PI * 2);
  ctx.arc(rightX, computeWaveY(rightX, state.waveFilter), 4, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Render wave split (phase: split)
 */
function renderSplit() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const progress = state.splitProgress;
  const flowSpacing = 50;

  if (progress < 0.5) {
    // Wave contracting back to center
    const contractProgress = progress * 2;
    const extent = 1 - contractProgress;
    const maxExt = canvas.width / 2;
    const currExt = Math.max(1, extent * maxExt);
    const leftX = centerX - currExt;
    const rightX = centerX + currExt;
    const pts = Math.max(2, Math.floor(extent * CONFIG.samples));

    ctx.beginPath();
    ctx.strokeStyle = CONFIG.dotColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    for (let i = 0; i <= pts; i++) {
      const x = leftX + (i / pts) * (rightX - leftX);
      const y = computeWaveY(x, 1); // Fully filtered
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = CONFIG.dotColor;
    ctx.arc(leftX, computeWaveY(leftX, 1), 4, 0, Math.PI * 2);
    ctx.arc(rightX, computeWaveY(rightX, 1), 4, 0, Math.PI * 2);
    ctx.fill();

  } else {
    // Dot splits into 3 and spreads vertically
    const spreadProgress = (progress - 0.5) * 2;
    const spread = spreadProgress * flowSpacing * (2 - spreadProgress);

    ctx.beginPath();
    ctx.fillStyle = CONFIG.dotColor;
    ctx.arc(centerX, centerY - spread, 4, 0, Math.PI * 2);
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.arc(centerX, centerY + spread, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Render flowing lines (phase: flow)
 */
function renderFlow() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const stretch = state.flowStretch;
  const flowSpacing = 50;

  if (stretch < 1) {
    // Dots stretching into lines
    const lineEndX = centerX + (canvas.width / 2) * stretch;
    const lineStartX = centerX - (canvas.width / 2) * stretch;

    ctx.strokeStyle = CONFIG.dotColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    for (let i = -1; i <= 1; i++) {
      const yOff = i * flowSpacing;
      const baseY = centerY + yOff;

      ctx.beginPath();
      for (let x = lineStartX; x <= lineEndX; x += 3) {
        const y = baseY + 20 * Math.sin((3 * 2 * Math.PI * x) / canvas.width);
        if (x === lineStartX) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // End dots (shrinking as stretch increases)
      ctx.beginPath();
      ctx.fillStyle = CONFIG.dotColor;
      const startY = baseY + 20 * Math.sin((3 * 2 * Math.PI * lineStartX) / canvas.width);
      const endY = baseY + 20 * Math.sin((3 * 2 * Math.PI * lineEndX) / canvas.width);
      ctx.arc(lineStartX, startY, 4 * (1 - stretch * 0.5), 0, Math.PI * 2);
      ctx.arc(lineEndX, endY, 4 * (1 - stretch * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }

  } else {
    // Full flowing lines with dash animation
    const pathLen = canvas.width + 50;
    const gap = pathLen * 0.05;
    const dash = pathLen - gap;

    ctx.strokeStyle = CONFIG.dotColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.setLineDash([dash, gap]);
    ctx.lineDashOffset = state.dashOffset;

    for (let i = -1; i <= 1; i++) {
      const yOff = i * flowSpacing;

      ctx.beginPath();
      for (let x = 0; x <= canvas.width; x += 3) {
        const y = centerY + yOff + 20 * Math.sin((3 * 2 * Math.PI * x) / canvas.width);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.setLineDash([]);
  }
}

/**
 * Main render function - calls appropriate phase renderer
 */
function render() {
  if (!ctx) return;

  switch (currentPhase) {
    case 'start':
    case 'chaos':
    case 'order':
    case 'converge':
      renderDots();
      break;
    case 'wave':
    case 'filter':
      renderWave();
      break;
    case 'split':
      renderSplit();
      break;
    case 'flow':
      renderFlow();
      break;
  }
}

/**
 * Start the flow loop (infinite dash animation)
 */
function startFlowLoop() {
  if (!isRunning) return;

  state.dashOffset = 0;
  flowLoop = animate(state, {
    dashOffset: [0, -(canvas.width + 50)],
    duration: 2000,
    ease: 'linear',
    loop: true,
    onUpdate: render
  });
}

/**
 * Build and run the main animation timeline
 */
function runAnimation() {
  currentPhase = 'start';

  // Reset state
  Object.assign(state, {
    dotScale: 0,
    waveExpand: 0,
    waveFilter: 0,
    splitProgress: 0,
    flowStretch: 0,
    dashOffset: 0,
    dotOpacity: 1
  });

  // Reset particle positions to center
  for (const p of particles) {
    p.x = centerX;
    p.y = centerY;
  }

  // Create main timeline
  mainTimeline = createTimeline({ defaults: { ease: 'linear' } });

  // Phase 1: START - dots appear
  mainTimeline.add(state, {
    dotScale: [0, 1],
    duration: 300,
    ease: 'outBack',
    onUpdate: render
  });
  mainTimeline.add({}, { duration: 400 });

  // Phase 2: CHAOS - scatter to random positions
  mainTimeline.add({}, {
    duration: 1,
    onComplete: () => { currentPhase = 'chaos'; }
  });
  mainTimeline.add(particles, {
    x: p => p.chaosX,
    y: p => p.chaosY,
    duration: 800,
    ease: 'outExpo',
    onUpdate: render
  });
  mainTimeline.add({}, { duration: 300 });

  // Phase 3: ORDER - form grid (stagger from center)
  mainTimeline.add({}, {
    duration: 1,
    onComplete: () => { currentPhase = 'order'; }
  });
  mainTimeline.add(particles, {
    x: p => p.gridX,
    y: p => p.gridY,
    duration: 1500,
    delay: stagger(2, { grid: [CONFIG.cols, CONFIG.rows], from: 'center' }),
    ease: 'outQuad',
    onUpdate: render
  });
  mainTimeline.add({}, { duration: 600 });

  // Phase 4: CONVERGE - back to center (stagger from edges)
  mainTimeline.add({}, {
    duration: 1,
    onComplete: () => { currentPhase = 'converge'; }
  });
  mainTimeline.add(particles, {
    x: centerX,
    y: centerY,
    duration: 1200,
    delay: stagger(2, { grid: [CONFIG.cols, CONFIG.rows], from: 'edges' }),
    ease: 'inOutQuad',
    onUpdate: render
  });
  mainTimeline.add({}, { duration: 400 });

  // Phase 5: WAVE - expand into complex wave
  mainTimeline.add({}, {
    duration: 1,
    onComplete: () => {
      currentPhase = 'wave';
      state.waveExpand = 0;
      state.waveFilter = 0;
    }
  });
  mainTimeline.add(state, {
    waveExpand: [0, 1],
    duration: 800,
    ease: 'outQuad',
    onUpdate: render
  });
  mainTimeline.add({}, { duration: 300 });

  // Phase 6: FILTER - harmonics filter out
  mainTimeline.add({}, {
    duration: 1,
    onComplete: () => { currentPhase = 'filter'; }
  });
  mainTimeline.add(state, {
    waveFilter: [0, 1],
    duration: 1200,
    ease: 'inOutSine',
    onUpdate: render
  });
  mainTimeline.add({}, { duration: 400 });

  // Phase 7: SPLIT - contract then split to 3 dots
  mainTimeline.add({}, {
    duration: 1,
    onComplete: () => {
      currentPhase = 'split';
      state.splitProgress = 0;
    }
  });
  // Contract
  mainTimeline.add(state, {
    splitProgress: [0, 0.5],
    duration: 600,
    ease: 'inQuad',
    onUpdate: render
  });
  // Spread to 3
  mainTimeline.add(state, {
    splitProgress: [0.5, 1],
    duration: 600,
    ease: 'outBack',
    onUpdate: render
  });
  mainTimeline.add({}, { duration: 300 });

  // Phase 8: FLOW - stretch into flowing lines
  mainTimeline.add({}, {
    duration: 1,
    onComplete: () => {
      currentPhase = 'flow';
      state.flowStretch = 0;
    }
  });
  mainTimeline.add(state, {
    flowStretch: [0, 1],
    duration: 800,
    ease: 'inOutQuad',
    onUpdate: render
  });
  // Dash animation leading to loop
  mainTimeline.add(state, {
    dashOffset: [0, -(canvas.width + 50)],
    duration: 2000,
    ease: 'linear',
    onUpdate: render,
    onComplete: startFlowLoop
  });

  return mainTimeline;
}

/**
 * Setup canvas with proper sizing
 */
function setupCanvas() {
  if (!canvas) return;

  // Size canvas to match CSS dimensions
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for performance

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
}

/**
 * Initialize the metamorphosis animation
 */
export function initMetamorphosis(canvasId = 'metamorphosis-canvas') {
  canvas = document.getElementById(canvasId);

  if (!canvas) {
    console.log('[Metamorphosis] Canvas element not found:', canvasId);
    return;
  }

  // Check for reduced motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    console.log('[Metamorphosis] Disabled due to reduced motion preference');
    return;
  }

  setupCanvas();
  initParticles();
  initHarmonics();

  console.log('[Metamorphosis] Initialized');
}

/**
 * Start the metamorphosis animation
 * Called by magnetic cursor when period is captured
 */
window.startMetamorphosis = () => {
  if (isRunning) return;
  if (!canvas) {
    initMetamorphosis();
    if (!canvas) return;
  }

  isRunning = true;
  canvas.classList.add('active');

  // Re-setup in case window was resized
  setupCanvas();
  initParticles();

  runAnimation();
  console.log('[Metamorphosis] Started');
};

/**
 * Stop the metamorphosis animation
 * Called by magnetic cursor when cursor escapes
 */
window.stopMetamorphosis = () => {
  if (!isRunning) return;

  isRunning = false;
  canvas.classList.remove('active');

  // Pause all animations
  if (mainTimeline) {
    mainTimeline.pause();
    mainTimeline = null;
  }
  if (flowLoop) {
    flowLoop.pause();
    flowLoop = null;
  }

  // Clear canvas
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  console.log('[Metamorphosis] Stopped');
};

/**
 * Replay animation (for debugging)
 */
window.replayMetamorphosis = () => {
  window.stopMetamorphosis();
  setTimeout(() => window.startMetamorphosis(), 100);
};

export default {
  initMetamorphosis
};
