/**
 * ASCII Video Engine
 * Real-time video to ASCII art conversion with color support
 *
 * Ported core algorithms from @ascii-tools/core for self-contained operation
 */

// ============================================================================
// CHARACTER SETS
// ============================================================================

const CHAR_SETS = {
  simple: {
    name: 'simple',
    mode: 'luminance',
    characters: ' .:-=+*#%@',
  },
  standard: {
    name: 'standard',
    mode: 'luminance',
    characters: " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  },
  blocks: {
    name: 'blocks',
    mode: 'luminance',
    characters: ' \u2591\u2592\u2593\u2588', // ' ░▒▓█'
  },
  quadrants: {
    name: 'quadrants',
    mode: 'block',
    // ' ▘▝▀▖▌▞▛▗▚▐▜▄▙▟█' - ordered by binary index 0-15
    characters: ' \u2598\u259D\u2580\u2596\u258C\u259E\u259B\u2597\u259A\u2590\u259C\u2584\u2599\u259F\u2588',
  },
  braille: {
    name: 'braille',
    mode: 'braille',
  },
  // Dense character sets for maximum detail
  dense: {
    name: 'dense',
    mode: 'luminance',
    characters: ' `.-\':_,^=;><+!rc*/z?sLTv)J7(|Fi{C}fI31tlu[neoZ5Yxjya]2ESwqkP6h9d4VpOGbUAKXHm8RD#$Bg0MNWQ%&@',
  },
};

// ============================================================================
// LUMINANCE CALCULATION
// ============================================================================

/**
 * Calculate luminance from RGB using Rec. 709 coefficients
 */
function calculateLuminance(r, g, b) {
  return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
}

/**
 * Get character for a luminance value
 */
function charForLuminance(luminance, characters, invert = false) {
  const len = characters.length;
  if (len === 0) return ' ';
  if (len === 1) return characters;

  const clamped = Math.max(0, Math.min(255, luminance));
  let index = Math.floor((clamped / 255) * len);
  index = Math.min(index, len - 1);

  if (invert) {
    index = len - 1 - index;
  }

  return characters[index];
}

/**
 * Map ImageData to ASCII using luminance
 */
function mapLuminance(imageData, characters, invert = false) {
  const { width, height, data } = imageData;
  const rows = [];

  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const luminance = calculateLuminance(r, g, b);
      row += charForLuminance(luminance, characters, invert);
    }
    rows.push(row);
  }

  return rows;
}

// ============================================================================
// BRAILLE ENCODING (2x4 sub-pixel = 8x more detail)
// ============================================================================

// Braille dot pattern mapping:
// 1 4    →  0x01 0x08
// 2 5    →  0x02 0x10
// 3 6    →  0x04 0x20
// 7 8    →  0x40 0x80
const BRAILLE_DOT_MAP = [
  [0x01, 0x08],  // Row 0
  [0x02, 0x10],  // Row 1
  [0x04, 0x20],  // Row 2
  [0x40, 0x80],  // Row 3
];

/**
 * Get pixel luminance, handling out-of-bounds
 */
function getPixelLuminance(data, width, height, x, y) {
  if (x < 0 || x >= width || y < 0 || y >= height) {
    return 0;
  }
  const idx = (y * width + x) * 4;
  return calculateLuminance(data[idx], data[idx + 1], data[idx + 2]);
}

/**
 * Encode ImageData to braille characters (2x4 per character)
 */
function encodeBraille(imageData, threshold = 128) {
  const { width, height, data } = imageData;
  const rows = [];

  // Each braille character represents 2x4 pixels
  const charWidth = Math.ceil(width / 2);
  const charHeight = Math.ceil(height / 4);

  for (let charY = 0; charY < charHeight; charY++) {
    let row = '';
    for (let charX = 0; charX < charWidth; charX++) {
      let pattern = 0;

      // Sample 2x4 pixel block
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const px = charX * 2 + dx;
          const py = charY * 4 + dy;
          const lum = getPixelLuminance(data, width, height, px, py);

          if (lum > threshold) {
            pattern |= BRAILLE_DOT_MAP[dy][dx];
          }
        }
      }

      // Braille block starts at U+2800
      row += String.fromCodePoint(0x2800 + pattern);
    }
    rows.push(row);
  }

  return rows;
}

// ============================================================================
// QUADRANT BLOCK ENCODING (2x2 sub-pixel)
// ============================================================================

/**
 * Encode ImageData to quadrant block characters (2x2 per character)
 */
function encodeBlocks(imageData, threshold = 128) {
  const { width, height, data } = imageData;
  const rows = [];

  // Quadrant characters indexed by binary pattern:
  // TL TR BL BR → bit pattern
  const QUADRANT_CHARS = ' \u2598\u259D\u2580\u2596\u258C\u259E\u259B\u2597\u259A\u2590\u259C\u2584\u2599\u259F\u2588';

  const charWidth = Math.ceil(width / 2);
  const charHeight = Math.ceil(height / 2);

  for (let charY = 0; charY < charHeight; charY++) {
    let row = '';
    for (let charX = 0; charX < charWidth; charX++) {
      let pattern = 0;

      // Sample 2x2 pixel block
      // Bit order: TL=1, TR=2, BL=4, BR=8
      const positions = [
        { dx: 0, dy: 0, bit: 1 },  // Top-left
        { dx: 1, dy: 0, bit: 2 },  // Top-right
        { dx: 0, dy: 1, bit: 4 },  // Bottom-left
        { dx: 1, dy: 1, bit: 8 },  // Bottom-right
      ];

      for (const { dx, dy, bit } of positions) {
        const px = charX * 2 + dx;
        const py = charY * 2 + dy;
        const lum = getPixelLuminance(data, width, height, px, py);

        if (lum > threshold) {
          pattern |= bit;
        }
      }

      row += QUADRANT_CHARS[pattern];
    }
    rows.push(row);
  }

  return rows;
}

// ============================================================================
// UNIFIED CHARACTER MAPPING
// ============================================================================

/**
 * Convert ImageData to ASCII lines
 */
function mapToCharacters(imageData, charsetName, options = {}) {
  const charset = CHAR_SETS[charsetName] || CHAR_SETS.simple;
  const { invert = false, threshold = 128 } = options;

  switch (charset.mode) {
    case 'luminance':
      return mapLuminance(imageData, charset.characters, invert);
    case 'block':
      return encodeBlocks(imageData, threshold);
    case 'braille':
      return encodeBraille(imageData, threshold);
    default:
      return mapLuminance(imageData, charset.characters || ' .:-=+*#%@', invert);
  }
}

// ============================================================================
// DITHERING ALGORITHMS
// ============================================================================

/**
 * Floyd-Steinberg error diffusion dithering
 */
function floydSteinbergDither(imageData) {
  const { width, height } = imageData;
  const data = new Uint8ClampedArray(imageData.data);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const oldR = data[idx];
      const oldG = data[idx + 1];
      const oldB = data[idx + 2];

      // Quantize to black or white
      const lum = calculateLuminance(oldR, oldG, oldB);
      const newVal = lum > 128 ? 255 : 0;

      data[idx] = newVal;
      data[idx + 1] = newVal;
      data[idx + 2] = newVal;

      // Calculate error
      const errR = oldR - newVal;
      const errG = oldG - newVal;
      const errB = oldB - newVal;

      // Distribute error to neighbors
      const distribute = (dx, dy, factor) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nidx = (ny * width + nx) * 4;
          data[nidx] = Math.max(0, Math.min(255, data[nidx] + errR * factor));
          data[nidx + 1] = Math.max(0, Math.min(255, data[nidx + 1] + errG * factor));
          data[nidx + 2] = Math.max(0, Math.min(255, data[nidx + 2] + errB * factor));
        }
      };

      distribute(1, 0, 7 / 16);
      distribute(-1, 1, 3 / 16);
      distribute(0, 1, 5 / 16);
      distribute(1, 1, 1 / 16);
    }
  }

  return new ImageData(data, width, height);
}

/**
 * Atkinson dithering (classic Mac look)
 */
function atkinsonDither(imageData) {
  const { width, height } = imageData;
  const data = new Uint8ClampedArray(imageData.data);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const oldR = data[idx];
      const oldG = data[idx + 1];
      const oldB = data[idx + 2];

      const lum = calculateLuminance(oldR, oldG, oldB);
      const newVal = lum > 128 ? 255 : 0;

      data[idx] = newVal;
      data[idx + 1] = newVal;
      data[idx + 2] = newVal;

      // Atkinson distributes 1/8 of error to 6 neighbors (loses 1/4 of error)
      const err = (oldR + oldG + oldB) / 3 - newVal;
      const errPart = err / 8;

      const distribute = (dx, dy) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nidx = (ny * width + nx) * 4;
          data[nidx] = Math.max(0, Math.min(255, data[nidx] + errPart));
          data[nidx + 1] = Math.max(0, Math.min(255, data[nidx + 1] + errPart));
          data[nidx + 2] = Math.max(0, Math.min(255, data[nidx + 2] + errPart));
        }
      };

      distribute(1, 0);
      distribute(2, 0);
      distribute(-1, 1);
      distribute(0, 1);
      distribute(1, 1);
      distribute(0, 2);
    }
  }

  return new ImageData(data, width, height);
}

/**
 * Bayer ordered dithering
 */
function bayerDither(imageData, matrixSize = 4) {
  const { width, height } = imageData;
  const data = new Uint8ClampedArray(imageData.data);

  // 4x4 Bayer matrix
  const bayer4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const lum = calculateLuminance(data[idx], data[idx + 1], data[idx + 2]);

      const threshold = (bayer4[y % 4][x % 4] / 16) * 255;
      const newVal = lum > threshold ? 255 : 0;

      data[idx] = newVal;
      data[idx + 1] = newVal;
      data[idx + 2] = newVal;
    }
  }

  return new ImageData(data, width, height);
}

/**
 * Apply dithering algorithm
 */
function applyDithering(imageData, algorithm) {
  switch (algorithm) {
    case 'floyd-steinberg':
      return floydSteinbergDither(imageData);
    case 'atkinson':
      return atkinsonDither(imageData);
    case 'bayer':
      return bayerDither(imageData);
    default:
      return imageData;
  }
}

// ============================================================================
// ASCII VIDEO ENGINE
// ============================================================================

export class AsciiVideoEngine {
  constructor(options = {}) {
    this.container = options.container;
    this.videoPlaylist = options.playlist || [];
    this.targetFps = options.targetFps || 24;
    this.width = options.width || 120;
    this.characterSet = options.characterSet || 'braille';
    this.dithering = options.dithering || null;
    this.colored = options.colored ?? true;
    this.invert = options.invert ?? false;
    this.threshold = options.threshold ?? 128;
    this.fontSize = options.fontSize || 10;
    this.renderMode = options.renderMode || 'canvas'; // 'canvas' or 'dom'

    // Internal state
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.outputCanvas = null;
    this.outputCtx = null;
    this.currentVideoIndex = 0;
    this.isPlaying = false;
    this.rafId = null;
    this.lastFrameTime = 0;
    this.frameInterval = 1000 / this.targetFps;

    // Stats
    this.stats = {
      fps: 0,
      frameCount: 0,
      lastFpsUpdate: 0,
      processingTime: 0,
    };

    // Callbacks
    this.onFrame = options.onFrame || null;
    this.onStats = options.onStats || null;

    this._init();
  }

  _init() {
    // Create hidden video element
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.preload = 'auto';
    this.video.crossOrigin = 'anonymous';

    // Playlist handling
    if (this.videoPlaylist.length > 0) {
      this.video.src = this.videoPlaylist[0];
      this.video.addEventListener('ended', () => this._nextVideo());
    }

    // Hidden canvas for frame extraction
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    // Setup output
    if (this.renderMode === 'canvas') {
      this._setupCanvasOutput();
    } else {
      this._setupDomOutput();
    }

    this.video.load();
  }

  _setupCanvasOutput() {
    this.outputCanvas = document.createElement('canvas');
    this.outputCanvas.className = 'ascii-output-canvas';
    this.outputCtx = this.outputCanvas.getContext('2d');

    if (this.container) {
      this.container.appendChild(this.outputCanvas);
    }
  }

  _setupDomOutput() {
    this.outputPre = document.createElement('pre');
    this.outputPre.className = 'ascii-output-pre';

    if (this.container) {
      this.container.appendChild(this.outputPre);
    }
  }

  _nextVideo() {
    this.currentVideoIndex = (this.currentVideoIndex + 1) % this.videoPlaylist.length;
    this.video.src = this.videoPlaylist[this.currentVideoIndex];
    this.video.load();
    if (this.isPlaying) {
      this.video.play().catch(() => {});
    }
  }

  /**
   * Calculate ASCII dimensions maintaining aspect ratio
   */
  _calculateDimensions() {
    const videoWidth = this.video.videoWidth || 1920;
    const videoHeight = this.video.videoHeight || 1080;
    const videoAspect = videoWidth / videoHeight;

    // Character aspect ratio (monospace chars are taller than wide)
    const charAspect = 0.5;

    let asciiWidth = this.width;
    let asciiHeight;

    // For braille, we need dimensions divisible by 2x4
    // For quadrants, divisible by 2x2
    if (this.characterSet === 'braille') {
      // Braille: 2x4 pixels per character
      asciiWidth = Math.floor(this.width / 2) * 2;
      asciiHeight = Math.floor((asciiWidth / videoAspect) * charAspect / 4) * 4;
    } else if (this.characterSet === 'quadrants') {
      // Quadrants: 2x2 pixels per character
      asciiWidth = Math.floor(this.width / 2) * 2;
      asciiHeight = Math.floor((asciiWidth / videoAspect) * charAspect / 2) * 2;
    } else {
      // Standard: 1:1 character to "pixel"
      asciiHeight = Math.round(asciiWidth / videoAspect * charAspect);
    }

    return { width: asciiWidth, height: asciiHeight };
  }

  /**
   * Extract frame from video and convert to ASCII
   */
  _processFrame() {
    const startTime = performance.now();

    const dims = this._calculateDimensions();

    // Resize extraction canvas
    this.canvas.width = dims.width;
    this.canvas.height = dims.height;

    // Draw video frame
    this.ctx.drawImage(this.video, 0, 0, dims.width, dims.height);

    // Get image data
    let imageData = this.ctx.getImageData(0, 0, dims.width, dims.height);

    // Apply dithering if requested
    if (this.dithering && this.dithering !== 'none') {
      imageData = applyDithering(imageData, this.dithering);
    }

    // Convert to ASCII
    const lines = mapToCharacters(imageData, this.characterSet, {
      invert: this.invert,
      threshold: this.threshold,
    });

    // Render output
    if (this.renderMode === 'canvas') {
      this._renderToCanvas(lines, imageData);
    } else {
      this._renderToDom(lines, imageData);
    }

    // Update stats
    this.stats.processingTime = performance.now() - startTime;
    this.stats.frameCount++;

    const now = performance.now();
    if (now - this.stats.lastFpsUpdate > 1000) {
      this.stats.fps = Math.round(this.stats.frameCount * 1000 / (now - this.stats.lastFpsUpdate));
      this.stats.frameCount = 0;
      this.stats.lastFpsUpdate = now;
      this.onStats?.(this.stats);
    }

    this.onFrame?.(lines, imageData);
  }

  /**
   * Render ASCII to canvas (fast)
   */
  _renderToCanvas(lines, imageData) {
    if (!this.outputCanvas || !this.outputCtx) return;

    const fontSize = this.fontSize;
    const charWidth = fontSize * 0.6;
    const charHeight = fontSize;

    const canvasWidth = (lines[0]?.length || 1) * charWidth;
    const canvasHeight = lines.length * charHeight;

    // Resize output canvas if needed
    if (this.outputCanvas.width !== canvasWidth || this.outputCanvas.height !== canvasHeight) {
      this.outputCanvas.width = canvasWidth;
      this.outputCanvas.height = canvasHeight;
      this.outputCanvas.style.width = `${canvasWidth}px`;
      this.outputCanvas.style.height = `${canvasHeight}px`;
    }

    const ctx = this.outputCtx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.font = `${fontSize}px monospace`;
    ctx.textBaseline = 'top';

    const data = imageData.data;
    const imgWidth = imageData.width;

    for (let y = 0; y < lines.length; y++) {
      const line = lines[y];
      for (let x = 0; x < line.length; x++) {
        const char = line[x];

        if (this.colored) {
          // Sample color from center of character's pixel region
          let px, py;
          if (this.characterSet === 'braille') {
            px = Math.min(x * 2, imgWidth - 1);
            py = Math.min(y * 4, imageData.height - 1);
          } else if (this.characterSet === 'quadrants') {
            px = Math.min(x * 2, imgWidth - 1);
            py = Math.min(y * 2, imageData.height - 1);
          } else {
            px = x;
            py = y;
          }

          const idx = (py * imgWidth + px) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          ctx.fillStyle = `rgb(${r},${g},${b})`;
        } else {
          ctx.fillStyle = '#0f0'; // Classic green terminal
        }

        ctx.fillText(char, x * charWidth, y * charHeight);
      }
    }
  }

  /**
   * Render ASCII to DOM (colored spans)
   */
  _renderToDom(lines, imageData) {
    if (!this.outputPre) return;

    const data = imageData.data;
    const imgWidth = imageData.width;

    let html = '';

    for (let y = 0; y < lines.length; y++) {
      const line = lines[y];
      for (let x = 0; x < line.length; x++) {
        const char = line[x];

        if (this.colored) {
          let px, py;
          if (this.characterSet === 'braille') {
            px = Math.min(x * 2, imgWidth - 1);
            py = Math.min(y * 4, imageData.height - 1);
          } else if (this.characterSet === 'quadrants') {
            px = Math.min(x * 2, imgWidth - 1);
            py = Math.min(y * 2, imageData.height - 1);
          } else {
            px = x;
            py = y;
          }

          const idx = (py * imgWidth + px) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // Escape HTML entities
          const escaped = char === '<' ? '&lt;' : char === '>' ? '&gt;' : char === '&' ? '&amp;' : char;
          html += `<span style="color:rgb(${r},${g},${b})">${escaped}</span>`;
        } else {
          const escaped = char === '<' ? '&lt;' : char === '>' ? '&gt;' : char === '&' ? '&amp;' : char;
          html += escaped;
        }
      }
      html += '\n';
    }

    this.outputPre.innerHTML = html;
  }

  /**
   * Animation loop
   */
  _animate(timestamp) {
    if (!this.isPlaying) return;

    const elapsed = timestamp - this.lastFrameTime;

    if (elapsed >= this.frameInterval) {
      this.lastFrameTime = timestamp - (elapsed % this.frameInterval);
      this._processFrame();
    }

    this.rafId = requestAnimationFrame((t) => this._animate(t));
  }

  /**
   * Start playback
   */
  async play() {
    if (this.isPlaying) return;

    try {
      await this.video.play();
      this.isPlaying = true;
      this.lastFrameTime = performance.now();
      this.stats.lastFpsUpdate = performance.now();
      this.stats.frameCount = 0;
      this._animate(performance.now());
    } catch (err) {
      console.warn('Video autoplay prevented:', err);
    }
  }

  /**
   * Pause playback
   */
  pause() {
    this.isPlaying = false;
    this.video.pause();
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Toggle play/pause
   */
  toggle() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Update options dynamically
   */
  setOptions(options) {
    if (options.width !== undefined) this.width = options.width;
    if (options.characterSet !== undefined) this.characterSet = options.characterSet;
    if (options.dithering !== undefined) this.dithering = options.dithering;
    if (options.colored !== undefined) this.colored = options.colored;
    if (options.invert !== undefined) this.invert = options.invert;
    if (options.threshold !== undefined) this.threshold = options.threshold;
    if (options.fontSize !== undefined) this.fontSize = options.fontSize;
    if (options.targetFps !== undefined) {
      this.targetFps = options.targetFps;
      this.frameInterval = 1000 / this.targetFps;
    }
  }

  /**
   * Get current stats
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Cleanup
   */
  destroy() {
    this.pause();

    if (this.video) {
      this.video.src = '';
      this.video.load();
      this.video = null;
    }

    if (this.outputCanvas && this.outputCanvas.parentNode) {
      this.outputCanvas.parentNode.removeChild(this.outputCanvas);
    }

    if (this.outputPre && this.outputPre.parentNode) {
      this.outputPre.parentNode.removeChild(this.outputPre);
    }

    this.canvas = null;
    this.ctx = null;
    this.outputCanvas = null;
    this.outputCtx = null;
    this.outputPre = null;
  }
}

// Export utilities for direct use
export { mapToCharacters, applyDithering, CHAR_SETS };
