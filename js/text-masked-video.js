/**
 * TextMaskedVideo - Video content displayed inside text letterforms
 * Per-letter proximity-based reveal - letters brighten as cursor approaches
 */

class TextMaskedVideo {
  constructor(container, options = {}) {
    this.container = container;

    // Parse video playlist from data attribute (comma-separated)
    const playlistAttr = container.dataset.videoPlaylist || '';
    const playlist = playlistAttr ? playlistAttr.split(',').map(s => s.trim()).filter(Boolean) : [];

    this.options = {
      text: container.dataset.text || 'DEM Systems',
      videoPlaylist: playlist,
      videoSrc: container.dataset.videoSrc || '',
      videoFallback: container.dataset.videoFallback || '',
      playbackRate: options.playbackRate || 0.5,
      lerpFactor: options.lerpFactor || 0.15,
      fontFamily: 'Satoshi, -apple-system, BlinkMacSystemFont, sans-serif',
      fontWeight: 900,
      // Proximity settings
      maxDistance: 200, // Full darkness beyond this distance (px)
      minBrightness: 0.15, // Brightness when far away (very dark)
      maxBrightness: 1.0, // Brightness when cursor is on letter
      ...options
    };

    // State
    this.mouseX = -1000;
    this.mouseY = -1000;
    this.isHovering = false; // Track if mouse is over container
    this.letterData = []; // {char, x, y, width, currentBrightness}
    this.animationId = null;
    this.isDestroyed = false;

    // Playlist state
    this.currentVideoIndex = 0;
    this.usePlaylist = this.options.videoPlaylist.length > 0;

    // Create elements
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'text-masked-video-canvas';
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false });

    // Create video element (off-DOM)
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.preload = 'auto';

    // Only loop if NOT using playlist (playlist handles its own looping)
    this.video.loop = !this.usePlaylist;

    // Set video source (playlist or single)
    if (this.usePlaylist) {
      this.video.src = this.options.videoPlaylist[0];
    } else if (this.options.videoSrc) {
      const sourceWebm = document.createElement('source');
      sourceWebm.src = this.options.videoSrc;
      sourceWebm.type = 'video/webm';
      this.video.appendChild(sourceWebm);

      if (this.options.videoFallback) {
        const sourceMp4 = document.createElement('source');
        sourceMp4.src = this.options.videoFallback;
        sourceMp4.type = 'video/mp4';
        this.video.appendChild(sourceMp4);
      }
    }

    this.init();
  }

  async init() {
    // Wait for font to load before rendering
    try {
      await document.fonts.load(`${this.options.fontWeight} 48px ${this.options.fontFamily.split(',')[0]}`);
    } catch (e) {
      // Font load failed, proceed anyway
    }

    // Add canvas to container
    this.container.appendChild(this.canvas);

    // Set up event handlers
    this.resizeHandler = this.resize.bind(this);
    this.mouseMoveHandler = this.onMouseMove.bind(this);
    this.mouseEnterHandler = this.onMouseEnter.bind(this);
    this.mouseLeaveHandler = this.onMouseLeave.bind(this);

    window.addEventListener('resize', this.resizeHandler);
    document.addEventListener('mousemove', this.mouseMoveHandler);
    this.container.addEventListener('mouseenter', this.mouseEnterHandler);
    this.container.addEventListener('mouseleave', this.mouseLeaveHandler);

    // Initial resize and letter position calculation
    this.resize();

    // Start video and render loop when ready
    this.video.addEventListener('canplay', () => {
      this.video.playbackRate = this.options.playbackRate;
      this.video.play().catch(() => {
        this.video.muted = true;
        this.video.play();
      });
      this.startRenderLoop();
    }, { once: true });

    // Handle playlist advancement when video ends
    if (this.usePlaylist) {
      this.video.addEventListener('ended', () => {
        this.advanceToNextVideo();
      });
    }

    // Load video
    this.video.load();
  }

  advanceToNextVideo() {
    if (this.isDestroyed) return;

    // Move to next video (loop back to 0 if at end)
    this.currentVideoIndex = (this.currentVideoIndex + 1) % this.options.videoPlaylist.length;
    const nextSrc = this.options.videoPlaylist[this.currentVideoIndex];

    // Load and play next video
    this.video.src = nextSrc;
    this.video.load();
    this.video.play().catch(() => {
      this.video.muted = true;
      this.video.play();
    });
  }

  onMouseMove(e) {
    const rect = this.container.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;
  }

  onMouseEnter() {
    this.isHovering = true;
  }

  onMouseLeave() {
    // Move mouse far away to darken all letters
    this.mouseX = -1000;
    this.mouseY = -1000;
    this.isHovering = false;
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    this.ctx.scale(dpr, dpr);

    // Calculate font size and letter positions
    this.fontSize = this.calculateFontSize(rect.width, rect.height);
    this.calculateLetterPositions(rect.width, rect.height);
  }

  calculateFontSize(width, height) {
    let size = height * 0.85;

    this.ctx.font = `${this.options.fontWeight} ${size}px ${this.options.fontFamily}`;
    const textWidth = this.ctx.measureText(this.options.text).width;

    if (textWidth > width * 0.95) {
      size = size * (width * 0.95) / textWidth;
    }

    return size;
  }

  calculateLetterPositions(width, height) {
    this.ctx.font = `${this.options.fontWeight} ${this.fontSize}px ${this.options.fontFamily}`;

    const text = this.options.text;
    const totalWidth = this.ctx.measureText(text).width;
    let currentX = (width - totalWidth) / 2;
    const centerY = height / 2;

    this.letterData = [];

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const charWidth = this.ctx.measureText(char).width;
      const charCenterX = currentX + charWidth / 2;

      this.letterData.push({
        char,
        x: currentX,
        centerX: charCenterX,
        centerY: centerY,
        width: charWidth,
        currentBrightness: this.options.minBrightness
      });

      currentX += charWidth;
    }
  }

  calculateLetterBrightness(letter) {
    const dx = this.mouseX - letter.centerX;
    const dy = this.mouseY - letter.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const { maxDistance, minBrightness, maxBrightness } = this.options;

    if (distance >= maxDistance) {
      return minBrightness;
    }

    // Ease-out curve for smoother reveal
    const t = 1 - (distance / maxDistance);
    const eased = 1 - Math.pow(1 - t, 2); // Quadratic ease-out

    return minBrightness + (maxBrightness - minBrightness) * eased;
  }

  render() {
    if (this.isDestroyed) return;

    const rect = this.container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Clear canvas
    this.ctx.clearRect(0, 0, width, height);

    if (this.video.readyState < 2) return;

    // Calculate video scaling
    const videoAspect = this.video.videoWidth / this.video.videoHeight;
    const canvasAspect = width / height;
    let drawWidth, drawHeight, drawX, drawY;

    if (videoAspect > canvasAspect) {
      drawHeight = height;
      drawWidth = height * videoAspect;
      drawX = (width - drawWidth) / 2;
      drawY = 0;
    } else {
      drawWidth = width;
      drawHeight = width / videoAspect;
      drawX = 0;
      drawY = (height - drawHeight) / 2;
    }

    // Draw each letter individually with its own brightness
    this.ctx.font = `${this.options.fontWeight} ${this.fontSize}px ${this.options.fontFamily}`;
    this.ctx.textBaseline = 'middle';

    for (const letter of this.letterData) {
      // Calculate target brightness based on cursor distance
      const targetBrightness = this.calculateLetterBrightness(letter);

      // Lerp for smooth transition
      letter.currentBrightness += (targetBrightness - letter.currentBrightness) * this.options.lerpFactor;

      // Save state
      this.ctx.save();

      // Draw letter as mask
      this.ctx.beginPath();
      this.ctx.fillStyle = 'white';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(letter.char, letter.x, letter.centerY);

      // Apply source-in to show video only in letter
      this.ctx.globalCompositeOperation = 'source-in';

      // Draw video with brightness adjustment
      // We use a filter to adjust brightness per-letter
      this.ctx.filter = `brightness(${letter.currentBrightness})`;
      this.ctx.drawImage(this.video, drawX, drawY, drawWidth, drawHeight);
      this.ctx.filter = 'none';

      // Restore and composite this letter onto the main canvas
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.restore();
    }

    // Re-composite all letters - need a different approach
    // Actually, we need to use an offscreen canvas per letter
    this.renderWithOffscreen(width, height, drawX, drawY, drawWidth, drawHeight);
  }

  renderWithOffscreen(width, height, drawX, drawY, drawWidth, drawHeight) {
    // Clear main canvas
    this.ctx.clearRect(0, 0, width, height);

    // Create offscreen canvas for compositing if needed
    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    }

    const dpr = window.devicePixelRatio || 1;
    this.offscreenCanvas.width = width * dpr;
    this.offscreenCanvas.height = height * dpr;
    this.offscreenCtx.scale(dpr, dpr);

    this.ctx.font = `${this.options.fontWeight} ${this.fontSize}px ${this.options.fontFamily}`;
    this.ctx.textBaseline = 'middle';

    for (const letter of this.letterData) {
      // Calculate target brightness
      const targetBrightness = this.calculateLetterBrightness(letter);
      letter.currentBrightness += (targetBrightness - letter.currentBrightness) * this.options.lerpFactor;

      // Clear offscreen
      this.offscreenCtx.clearRect(0, 0, width, height);

      // Draw letter mask on offscreen
      this.offscreenCtx.font = `${this.options.fontWeight} ${this.fontSize}px ${this.options.fontFamily}`;
      this.offscreenCtx.textBaseline = 'middle';
      this.offscreenCtx.textAlign = 'left';
      this.offscreenCtx.fillStyle = 'white';
      this.offscreenCtx.fillText(letter.char, letter.x, letter.centerY);

      // Apply video with mask
      this.offscreenCtx.globalCompositeOperation = 'source-in';
      this.offscreenCtx.filter = `brightness(${letter.currentBrightness})`;
      this.offscreenCtx.drawImage(this.video, drawX, drawY, drawWidth, drawHeight);
      this.offscreenCtx.filter = 'none';
      this.offscreenCtx.globalCompositeOperation = 'source-over';

      // Draw offscreen result to main canvas
      this.ctx.drawImage(this.offscreenCanvas, 0, 0, width, height);

      // Draw letter border with opacity based on proximity
      // Map brightness (0.15-1.0) to border opacity (0-0.4)
      const { minBrightness, maxBrightness } = this.options;
      const brightnessRange = maxBrightness - minBrightness;
      const normalizedBrightness = (letter.currentBrightness - minBrightness) / brightnessRange;
      const borderOpacity = normalizedBrightness * 0.4;

      if (borderOpacity > 0.01) {
        this.ctx.font = `${this.options.fontWeight} ${this.fontSize}px ${this.options.fontFamily}`;
        this.ctx.textBaseline = 'middle';
        this.ctx.textAlign = 'left';
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${borderOpacity})`;
        this.ctx.lineWidth = 1;
        this.ctx.strokeText(letter.char, letter.x, letter.centerY);
      }
    }
  }

  startRenderLoop() {
    const loop = () => {
      if (this.isDestroyed) return;
      this.renderWithOffscreen(
        this.container.getBoundingClientRect().width,
        this.container.getBoundingClientRect().height,
        0, 0, 0, 0 // Will be recalculated
      );
      this.animationId = requestAnimationFrame(loop);
    };

    // Actually call the proper render
    const renderLoop = () => {
      if (this.isDestroyed) return;

      const rect = this.container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      if (this.video.readyState >= 2) {
        const videoAspect = this.video.videoWidth / this.video.videoHeight;
        const canvasAspect = width / height;
        let drawWidth, drawHeight, drawX, drawY;

        if (videoAspect > canvasAspect) {
          drawHeight = height;
          drawWidth = height * videoAspect;
          drawX = (width - drawWidth) / 2;
          drawY = 0;
        } else {
          drawWidth = width;
          drawHeight = width / videoAspect;
          drawX = 0;
          drawY = (height - drawHeight) / 2;
        }

        this.renderWithOffscreen(width, height, drawX, drawY, drawWidth, drawHeight);
      }

      this.animationId = requestAnimationFrame(renderLoop);
    };

    renderLoop();
  }

  destroy() {
    this.isDestroyed = true;

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    window.removeEventListener('resize', this.resizeHandler);
    document.removeEventListener('mousemove', this.mouseMoveHandler);
    this.container.removeEventListener('mouseenter', this.mouseEnterHandler);
    this.container.removeEventListener('mouseleave', this.mouseLeaveHandler);

    this.video.pause();
    this.video.src = '';
    this.video.load();

    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}

/**
 * Initialize text masked video effect
 */
export function initTextMaskedVideo(options = {}) {
  const containerSelector = options.containerSelector || '#hero-video-text';
  const container = document.querySelector(containerSelector);

  if (!container) {
    console.warn('TextMaskedVideo: Container not found:', containerSelector);
    return null;
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return null;
  }

  return new TextMaskedVideo(container, options);
}

export { TextMaskedVideo };
