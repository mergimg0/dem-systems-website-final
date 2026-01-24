/**
 * DEM Systems - Main JavaScript
 * Handles scroll reveals and UI interactions
 */

import { initTextMaskedVideo } from './text-masked-video.js';

// Check for reduced motion preference
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Loading bar utility
 * Shows progress indication for async operations > 300ms
 */
const loadingBar = {
  element: null,
  timeout: null,

  init() {
    this.element = document.querySelector('.loading-bar');
  },

  /**
   * Start showing the loading bar
   * @param {boolean} determinate - If true, use setProgress() to update
   */
  start(determinate = false) {
    if (!this.element) return;

    // Clear any existing timeout
    clearTimeout(this.timeout);

    // Only show if operation takes > 300ms
    this.timeout = setTimeout(() => {
      this.element.classList.add('visible');
      if (!determinate) {
        this.element.classList.add('indeterminate');
      }
    }, 300);
  },

  /**
   * Set determinate progress (0-100)
   * @param {number} percent
   */
  setProgress(percent) {
    if (!this.element) return;
    this.element.classList.remove('indeterminate');
    this.element.style.transform = `scaleX(${Math.min(100, Math.max(0, percent)) / 100})`;
  },

  /**
   * Complete and hide the loading bar
   */
  complete() {
    if (!this.element) return;

    // Clear the delay timeout
    clearTimeout(this.timeout);

    // If not visible yet, just reset
    if (!this.element.classList.contains('visible')) {
      return;
    }

    // Show complete state briefly
    this.element.classList.remove('indeterminate');
    this.element.style.transform = 'scaleX(1)';

    // Fade out after brief delay
    setTimeout(() => {
      this.element.classList.remove('visible');
      // Reset after fade
      setTimeout(() => {
        this.element.style.transform = 'scaleX(0)';
      }, 200);
    }, 200);
  }
};

/**
 * Initialize hero text reveal animation
 * Quick stagger on page load - 100ms delay, then title, then tagline
 */
function initHeroReveal() {
  const heroElements = document.querySelectorAll('.hero-reveal');
  if (heroElements.length === 0) return;

  // If reduced motion is preferred, show immediately
  if (prefersReducedMotion) {
    heroElements.forEach(el => {
      el.classList.add('visible');
    });
    return;
  }

  // 100ms delay after page load, then trigger reveal
  // CSS handles the stagger via transition-delay on .hero-reveal--delayed
  setTimeout(() => {
    heroElements.forEach(el => {
      el.classList.add('visible');
    });
  }, 100);
}

/**
 * Initialize Intersection Observer for scroll reveal animations
 */
function initScrollReveals() {
  // Skip if reduced motion is preferred - elements will be visible by default via CSS
  if (prefersReducedMotion) {
    document.querySelectorAll('[data-reveal], [data-reveal-stagger]').forEach(el => {
      el.classList.add('visible');
    });
    return;
  }

  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -10% 0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        // Unobserve after revealing (one-time animation)
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe all elements with data-reveal or data-reveal-stagger
  document.querySelectorAll('[data-reveal], [data-reveal-stagger]').forEach(el => {
    observer.observe(el);
  });
}

/**
 * Initialize scroll indicator behavior
 * Hides the scroll indicator after user starts scrolling
 */
function initScrollIndicator() {
  const scrollIndicator = document.querySelector('.scroll-indicator');
  if (!scrollIndicator) return;

  let hasScrolled = false;

  const hideIndicator = () => {
    if (!hasScrolled && window.scrollY > 50) {
      hasScrolled = true;
      scrollIndicator.classList.add('hidden');
      window.removeEventListener('scroll', hideIndicator);
    }
  };

  window.addEventListener('scroll', hideIndicator, { passive: true });
}

/**
 * Initialize testimonial carousel (auto-fade rotation)
 * Pauses on hover, respects reduced motion
 */
function initTestimonialCarousel() {
  const carousel = document.querySelector('.testimonial-carousel');
  if (!carousel) return;

  const testimonials = carousel.querySelectorAll('.testimonial');
  if (testimonials.length <= 1) {
    // Single or no testimonials - just show first, no rotation
    if (testimonials.length === 1) {
      testimonials[0].classList.add('active');
    }
    return;
  }

  // For reduced motion - show first only, no rotation
  if (prefersReducedMotion) {
    testimonials[0].classList.add('active');
    return;
  }

  let current = 0;
  let interval = null;

  function rotate() {
    testimonials[current].classList.remove('active');
    testimonials[current].classList.add('exiting');

    current = (current + 1) % testimonials.length;
    testimonials[current].classList.add('active');

    // Clean up exiting class after transition
    setTimeout(() => {
      testimonials.forEach(t => t.classList.remove('exiting'));
    }, 500);
  }

  // Pause on hover (user might be reading)
  carousel.addEventListener('mouseenter', () => {
    clearInterval(interval);
  });

  carousel.addEventListener('mouseleave', () => {
    interval = setInterval(rotate, 6000);
  });

  // Start carousel
  testimonials[0].classList.add('active');
  interval = setInterval(rotate, 6000);
}

/**
 * Smooth scroll for anchor links (optional enhancement)
 */
function initSmoothScroll() {
  if (prefersReducedMotion) return;

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;

      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

/**
 * Initialize all UI functionality
 */
function init() {
  loadingBar.init();
  initHeroReveal();
  initScrollReveals();
  initScrollIndicator();
  initTestimonialCarousel();
  initSmoothScroll();

  // Initialize video-masked text effect (only if motion is allowed)
  if (!prefersReducedMotion) {
    initTextMaskedVideo({
      containerSelector: '#hero-video-text',
      playbackRate: 0.5,
      lerpFactor: 0.4,
      sampleColor: true
    });
  }
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { prefersReducedMotion, loadingBar };
