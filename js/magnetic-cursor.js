/**
 * Magnetic Cursor - Period Magnet Effect
 *
 * Creates a magnetic pull effect when cursor approaches the period trigger.
 * When captured, draws an SVG rectangle and triggers metamorphosis animation.
 *
 * @see PUNCTUATION-MAGNET-METAMORPHOSIS-IMPLEMENTATION.md (source)
 */

import { animate } from 'animejs';

// === CONFIGURATION ===
const CONFIG = {
  magnetRadius: 80,      // Distance to start magnetic pull
  captureRadius: 20,     // Distance to fully capture cursor
  escapeRadius: 110,     // Distance to release
  suckStrength: 0.7,     // How strongly cursor is pulled (0-1)
};

// === STATE ===
let periodTrigger = null;
let rect = null;
let svg = null;
let cursor = null;
let isActive = false;
let isCaptured = false;
let drawAnim = null;
let closeAnim = null;
let mouseX = 0;
let mouseY = 0;
let animationId = null;
let isInitialized = false;

/**
 * Get the center point of the period trigger
 * Period sits at baseline, target the actual dot (~75% down)
 */
function getPeriodCenter() {
  if (!periodTrigger) return { x: 0, y: 0 };
  const r = periodTrigger.getBoundingClientRect();
  return {
    x: r.left + r.width / 2,
    y: r.top + r.height * 0.75
  };
}

/**
 * Calculate distance between two points
 */
function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

/**
 * Easing function for smooth magnetic pull
 */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Update SVG rectangle dimensions to match viewport
 */
function updateRect() {
  if (!svg || !rect) return;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);

  // Clean rectangle below hero text
  const padding = 40;
  const topY = vh * 0.35;
  const rectWidth = vw - (padding * 2);
  const rectHeight = vh * 0.55;

  rect.setAttribute('x', padding);
  rect.setAttribute('y', topY);
  rect.setAttribute('width', rectWidth);
  rect.setAttribute('height', rectHeight);
  rect.setAttribute('rx', 4);

  // Set up dash array for drawing animation
  const perimeter = 2 * (rectWidth + rectHeight);
  rect.style.strokeDasharray = perimeter;
  rect.style.strokeDashoffset = perimeter;
}

/**
 * Animate drawing the rectangle
 */
function drawRectangle() {
  if (isActive) return;
  isActive = true;

  // Stop wiggle animation when captured
  if (periodTrigger) {
    periodTrigger.style.animation = 'none';
  }

  // Cancel any closing animation
  if (closeAnim) closeAnim.pause();

  // Show the SVG
  if (svg) svg.classList.add('active');

  // Animate the stroke dash offset to draw the rectangle
  const perimeter = parseFloat(rect.style.strokeDasharray);
  drawAnim = animate(rect, {
    strokeDashoffset: [perimeter, 0],
    duration: 600,
    ease: 'outQuad'
  });

  // Start metamorphosis animation if available
  if (window.startMetamorphosis) {
    window.startMetamorphosis();
  }
}

/**
 * Animate closing/erasing the rectangle
 */
function closeRectangle() {
  if (!isActive) return;
  isActive = false;
  isCaptured = false;

  // Resume wiggle animation
  if (periodTrigger) {
    periodTrigger.style.animation = '';
  }

  // Cancel any drawing animation
  if (drawAnim) drawAnim.pause();

  // Animate the stroke dash offset to erase the rectangle
  const perimeter = parseFloat(rect.style.strokeDasharray);
  closeAnim = animate(rect, {
    strokeDashoffset: [0, perimeter],
    duration: 400,
    ease: 'inQuad',
    complete: () => {
      // Hide the SVG after animation completes
      if (svg) svg.classList.remove('active');
    }
  });

  // Stop metamorphosis animation if available
  if (window.stopMetamorphosis) {
    window.stopMetamorphosis();
  }
}

/**
 * Main magnetic loop - runs every frame to update cursor position
 */
function magnetLoop() {
  if (!cursor || !periodTrigger) {
    animationId = requestAnimationFrame(magnetLoop);
    return;
  }

  const center = getPeriodCenter();
  const dist = distance(mouseX, mouseY, center.x, center.y);

  if (dist < CONFIG.captureRadius) {
    // Fully captured - snap cursor to period
    if (!isCaptured) {
      isCaptured = true;
      drawRectangle();
    }
    // Position cursor exactly on the period
    cursor.style.transform = `translate(calc(${center.x}px - 50%), calc(${center.y}px - 50%))`;

  } else if (dist < CONFIG.magnetRadius) {
    // Magnetic pull zone - interpolate cursor position
    const normalizedDist = dist / CONFIG.magnetRadius;
    const pull = easeInOutCubic(1 - normalizedDist) * CONFIG.suckStrength;
    const pullX = mouseX + (center.x - mouseX) * pull;
    const pullY = mouseY + (center.y - mouseY) * pull;

    cursor.style.transform = `translate(calc(${pullX}px - 50%), calc(${pullY}px - 50%))`;

    // Trigger draw if close enough (60% of magnet radius)
    if (!isActive && dist < CONFIG.magnetRadius * 0.6) {
      drawRectangle();
    }

  } else if (dist > CONFIG.escapeRadius) {
    // Outside escape radius - release capture
    if (isActive) {
      closeRectangle();
    }
    // Return cursor to normal mouse position (handled by cursor.js)
  }

  animationId = requestAnimationFrame(magnetLoop);
}

/**
 * Track mouse position
 */
function handleMouseMove(e) {
  mouseX = e.clientX;
  mouseY = e.clientY;
}

/**
 * Initialize the magnetic cursor effect
 */
export function initMagneticCursor(options = {}) {
  // Merge options with defaults
  if (options.magnetRadius) CONFIG.magnetRadius = options.magnetRadius;
  if (options.captureRadius) CONFIG.captureRadius = options.captureRadius;
  if (options.escapeRadius) CONFIG.escapeRadius = options.escapeRadius;
  if (options.suckStrength) CONFIG.suckStrength = options.suckStrength;

  // Get required elements
  periodTrigger = document.getElementById('period-trigger');
  rect = document.getElementById('period-rect-path');
  svg = document.getElementById('period-rect-svg');
  cursor = document.querySelector('.custom-cursor');

  // Check for required elements
  if (!periodTrigger || !rect || !svg) {
    console.log('[MagneticCursor] Missing required elements (period-trigger, period-rect-path, or period-rect-svg)');
    return;
  }

  // Check for reduced motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    console.log('[MagneticCursor] Disabled due to reduced motion preference');
    return;
  }

  // Check for touch device
  if (window.matchMedia('(pointer: coarse)').matches) {
    console.log('[MagneticCursor] Disabled on touch device');
    return;
  }

  // Initialize rectangle dimensions
  updateRect();
  window.addEventListener('resize', updateRect);

  // Track mouse movement
  document.addEventListener('mousemove', handleMouseMove, { passive: true });

  // Start the magnetic loop
  magnetLoop();

  isInitialized = true;
  console.log('[MagneticCursor] Initialized - hover near the period');
}

/**
 * Destroy the magnetic cursor effect
 */
export function destroyMagneticCursor() {
  if (!isInitialized) return;

  // Stop animation loop
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  // Remove event listeners
  window.removeEventListener('resize', updateRect);
  document.removeEventListener('mousemove', handleMouseMove);

  // Cancel any running animations
  if (drawAnim) drawAnim.pause();
  if (closeAnim) closeAnim.pause();

  // Reset state
  isActive = false;
  isCaptured = false;
  isInitialized = false;

  // Hide SVG
  if (svg) svg.classList.remove('active');

  console.log('[MagneticCursor] Destroyed');
}

/**
 * Debug function - exposed globally for testing
 */
window.testPeriodMagnet = () => {
  console.log('[MagneticCursor] Debug:', {
    isActive,
    isCaptured,
    cursor: !!cursor,
    periodTrigger: !!periodTrigger,
    mousePosition: { x: mouseX, y: mouseY }
  });
};

export default {
  initMagneticCursor,
  destroyMagneticCursor
};
