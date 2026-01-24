/**
 * Typewriter Effect for Hero Subtitle
 *
 * Cycles through taglines with natural human-like typing animation.
 * Uses async/await for clean sequential animation control.
 */

// Phrases to cycle through (period handled separately for magnetic cursor effect)
const PHRASES = [
  'Complexity to simplicity',
  'Friction to flow',
  'Chaos to order'
];

// Timing configuration
const CONFIG = {
  typeSpeed: { min: 60, max: 100 },      // ms per character (natural variance)
  deleteSpeed: { min: 30, max: 50 },     // 2x faster than typing
  holdDuration: { min: 3000, max: 4000 }, // pause between phrases
  initialDelay: 500                       // delay before first type starts
};

/**
 * Get a random number between min and max (inclusive)
 */
function randomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Set cursor blinking state
 */
function setCursorBlinking(cursor, blinking) {
  if (blinking) {
    cursor.classList.add('typewriter__cursor--blink');
  } else {
    cursor.classList.remove('typewriter__cursor--blink');
  }
}

/**
 * Type a phrase character by character with natural timing variance
 */
async function typePhrase(text, textElement, cursor) {
  setCursorBlinking(cursor, false);

  for (let i = 0; i < text.length; i++) {
    textElement.textContent += text[i];
    const delay = randomInRange(CONFIG.typeSpeed.min, CONFIG.typeSpeed.max);
    await sleep(delay);
  }
}

/**
 * Delete the current text character by character (2x faster)
 */
async function deletePhrase(textElement, cursor) {
  setCursorBlinking(cursor, false);

  const text = textElement.textContent;
  for (let i = text.length; i > 0; i--) {
    textElement.textContent = text.substring(0, i - 1);
    const delay = randomInRange(CONFIG.deleteSpeed.min, CONFIG.deleteSpeed.max);
    await sleep(delay);
  }
}

/**
 * Hold with cursor blinking
 */
async function holdWithBlink(cursor) {
  setCursorBlinking(cursor, true);
  const holdTime = randomInRange(CONFIG.holdDuration.min, CONFIG.holdDuration.max);
  await sleep(holdTime);
}

/**
 * Main animation loop - runs indefinitely
 */
async function runTypewriterLoop(textElement, cursor) {
  let phraseIndex = 0;

  while (true) {
    const phrase = PHRASES[phraseIndex];

    // Type the phrase
    await typePhrase(phrase, textElement, cursor);

    // Hold with blinking cursor
    await holdWithBlink(cursor);

    // Delete the phrase
    await deletePhrase(textElement, cursor);

    // Small pause before next phrase (cursor stays solid during delete)
    await sleep(200);

    // Move to next phrase (loop back to start)
    phraseIndex = (phraseIndex + 1) % PHRASES.length;
  }
}

/**
 * Initialize the typewriter effect
 * @param {string} selector - CSS selector for the typewriter container
 */
export function initTypewriter(selector = '.typewriter') {
  const container = document.querySelector(selector);
  if (!container) {
    console.warn('Typewriter: Container not found:', selector);
    return;
  }

  const textElement = container.querySelector('.typewriter__text');
  const cursor = container.querySelector('.typewriter__cursor');

  if (!textElement || !cursor) {
    console.warn('Typewriter: Required elements not found');
    return;
  }

  // Start with blinking cursor, then begin typing after initial delay
  setCursorBlinking(cursor, true);

  setTimeout(() => {
    runTypewriterLoop(textElement, cursor);
  }, CONFIG.initialDelay);
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initTypewriter());
} else {
  // Small delay to let hero reveal animation start first
  setTimeout(() => initTypewriter(), 100);
}
