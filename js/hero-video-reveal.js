/**
 * DEM Systems - Hero Video Reveal
 * Orchestrates mouse tracking + video canvas for hero section
 * Vanilla JS port of VideoRevealHero.tsx from automation-hero
 */

import { MouseReveal } from './mouse-reveal.js';
import { VideoRevealCanvas } from './video-reveal.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Initialize hero video reveal effect
 * @param {Object} options - Configuration options
 * @param {string} options.heroSelector - CSS selector for hero section
 * @param {string} options.videoSrc - Primary video source (WebM)
 * @param {string} options.fallbackSrc - Fallback video source (MP4)
 * @param {number} options.revealRadius - Radius of reveal circle
 * @param {number} options.edgeSoftness - Feather amount at edge
 * @param {number} options.opacity - Video opacity
 * @param {number} options.lerpFactor - Mouse smoothing factor
 * @returns {{ destroy: Function } | null} Cleanup function or null if disabled
 */
export function initHeroVideoReveal(options = {}) {
  // Respect reduced motion preference
  if (prefersReducedMotion) {
    console.log('Hero video reveal disabled: prefers-reduced-motion');
    return null;
  }

  // Check for touch-primary device
  if (window.matchMedia('(pointer: coarse)').matches) {
    console.log('Hero video reveal disabled: touch-primary device');
    return null;
  }

  const {
    heroSelector = '.section--hero',
    videoSrc = 'assets/videos/dem-loop-08.webm',
    fallbackSrc = 'assets/videos/dem-loop-08.mp4',
    videoPlaylist = [],
    revealRadius = 180,
    edgeSoftness = 50,
    opacity = 0.95,
    lerpFactor = 0.12
  } = options;

  const heroSection = document.querySelector(heroSelector);
  if (!heroSection) {
    console.warn('Hero video reveal: hero section not found');
    return null;
  }

  // Create mouse tracker
  const mouseReveal = new MouseReveal(heroSection, {
    lerpFactor,
    enabled: true,
    supportTouch: false // Desktop only for video reveal
  });

  // Create video canvas
  const videoCanvas = new VideoRevealCanvas({
    videoSrc,
    fallbackSrc,
    videoPlaylist,
    revealRadius,
    edgeSoftness,
    opacity,
    scaleMode: 'cover'
  });

  // Add canvas to hero section
  const canvas = videoCanvas.getCanvas();
  heroSection.appendChild(canvas);

  // Initial resize
  function handleResize() {
    const rect = heroSection.getBoundingClientRect();
    videoCanvas.resize(rect.width, rect.height);
  }
  handleResize();

  // Handle window resize
  let resizeTimeout;
  function onResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(handleResize, 100);
  }
  window.addEventListener('resize', onResize);

  // RAF loop
  let rafId = null;
  let isRunning = true;

  function animate() {
    if (!isRunning) return;

    // Update smoothed mouse position
    mouseReveal.updateMouse();

    // Get current position
    const { x, y, isActive } = mouseReveal.getPosition();

    // Render video with mask
    videoCanvas.render(x, y, isActive);

    // Start video playback when mouse enters
    if (isActive && !videoCanvas.isPlaying) {
      videoCanvas.play();
    }

    rafId = requestAnimationFrame(animate);
  }

  // Start animation loop
  animate();

  // Return cleanup function
  return {
    destroy() {
      isRunning = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('resize', onResize);
      mouseReveal.destroy();
      videoCanvas.destroy();
    }
  };
}

// Auto-initialize when DOM is ready (can be disabled via data attribute)
document.addEventListener('DOMContentLoaded', () => {
  const heroSection = document.querySelector('.section--hero');

  // Check for disable flag
  if (heroSection?.dataset.disableVideoReveal === 'true') {
    return;
  }

  // Parse video playlist from data attribute (comma-separated)
  const playlistAttr = heroSection?.dataset.videoPlaylist || '';
  const videoPlaylist = playlistAttr ? playlistAttr.split(',').map(s => s.trim()).filter(Boolean) : [];

  // Initialize with default options
  // Options can be overridden via data attributes or by calling initHeroVideoReveal directly
  const instance = initHeroVideoReveal({
    heroSelector: '.section--hero',
    videoSrc: heroSection?.dataset.videoSrc || 'assets/videos/dem-loop-08.webm',
    fallbackSrc: heroSection?.dataset.fallbackSrc || 'assets/videos/dem-loop-08.mp4',
    videoPlaylist,
    revealRadius: parseInt(heroSection?.dataset.revealRadius, 10) || 180,
    edgeSoftness: parseInt(heroSection?.dataset.edgeSoftness, 10) || 50,
    opacity: parseFloat(heroSection?.dataset.videoOpacity) || 0.95
  });

  // Store instance for potential cleanup
  if (instance) {
    window.__heroVideoReveal = instance;
  }
});
