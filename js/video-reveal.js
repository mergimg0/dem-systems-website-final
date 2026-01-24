/**
 * DEM Systems - Video Reveal Canvas
 * Canvas-based video reveal with radial mask
 * Vanilla JS port of MouseRevealVideo.tsx from automation-hero
 */

/**
 * VideoRevealCanvas - Renders video through a radial gradient mask
 */
export class VideoRevealCanvas {
  /**
   * @param {Object} options - Configuration options
   * @param {string} options.videoSrc - Primary video source (WebM recommended)
   * @param {string} options.fallbackSrc - Fallback video source (MP4 for Safari)
   * @param {number} options.revealRadius - Radius of reveal circle in pixels
   * @param {number} options.edgeSoftness - Feather amount at edge in pixels
   * @param {number} options.opacity - Video opacity (0-1)
   * @param {'cover'|'contain'} options.scaleMode - How video fits canvas
   */
  constructor(options = {}) {
    this.videoSrc = options.videoSrc || '';
    this.fallbackSrc = options.fallbackSrc || '';
    this.videoPlaylist = options.videoPlaylist || [];
    this.revealRadius = options.revealRadius ?? 150;
    this.edgeSoftness = options.edgeSoftness ?? 40;
    this.opacity = options.opacity ?? 0.9;
    this.scaleMode = options.scaleMode || 'cover';

    this.canvas = null;
    this.ctx = null;
    this.video = null;
    this.isVideoReady = false;
    this.isPlaying = false;

    // Playlist state
    this.currentVideoIndex = 0;
    this.usePlaylist = this.videoPlaylist.length > 0;

    // Device pixel ratio for crisp rendering
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this._createCanvas();
    this._createVideo();
  }

  /**
   * Create the canvas element
   * @private
   */
  _createCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'video-reveal-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * Create offscreen video element
   * @private
   */
  _createVideo() {
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.preload = 'auto';

    // Only loop if NOT using playlist (playlist handles its own looping)
    this.video.loop = !this.usePlaylist;

    // Set video source (playlist or single)
    if (this.usePlaylist) {
      this.video.src = this.videoPlaylist[0];
    } else {
      // Prefer WebM, fallback to MP4 for Safari
      const canPlayWebM = this.video.canPlayType('video/webm; codecs="vp9"') ||
                          this.video.canPlayType('video/webm; codecs="vp8"');

      if (canPlayWebM && this.videoSrc) {
        this.video.src = this.videoSrc;
      } else if (this.fallbackSrc) {
        this.video.src = this.fallbackSrc;
      } else if (this.videoSrc) {
        this.video.src = this.videoSrc;
      }
    }

    this.video.addEventListener('canplaythrough', () => {
      this.isVideoReady = true;
    });

    this.video.addEventListener('error', (e) => {
      console.warn('Video failed to load:', e);
      // Try fallback if primary failed
      if (!this.usePlaylist && this.video.src !== this.fallbackSrc && this.fallbackSrc) {
        console.log('Trying fallback video source...');
        this.video.src = this.fallbackSrc;
      }
    });

    // Handle playlist advancement when video ends
    if (this.usePlaylist) {
      this.video.addEventListener('ended', () => {
        this._advanceToNextVideo();
      });
    }

    // Start loading
    this.video.load();
  }

  /**
   * Advance to the next video in the playlist
   * @private
   */
  _advanceToNextVideo() {
    // Move to next video (loop back to 0 if at end)
    this.currentVideoIndex = (this.currentVideoIndex + 1) % this.videoPlaylist.length;
    const nextSrc = this.videoPlaylist[this.currentVideoIndex];

    // Load and play next video
    this.video.src = nextSrc;
    this.video.load();
    if (this.isPlaying) {
      this.video.play().catch(() => {});
    }
  }

  /**
   * Get the canvas element to append to DOM
   * @returns {HTMLCanvasElement}
   */
  getCanvas() {
    return this.canvas;
  }

  /**
   * Resize canvas to match container
   * @param {number} width - Container width
   * @param {number} height - Container height
   */
  resize(width, height) {
    // Set display size
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Set actual canvas size (accounting for DPR)
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;

    // Scale context for DPR
    this.ctx.scale(this.dpr, this.dpr);
  }

  /**
   * Start video playback
   */
  async play() {
    if (this.isPlaying || !this.video) return;

    try {
      await this.video.play();
      this.isPlaying = true;
    } catch (err) {
      console.warn('Video autoplay prevented:', err);
    }
  }

  /**
   * Pause video playback
   */
  pause() {
    if (!this.isPlaying || !this.video) return;
    this.video.pause();
    this.isPlaying = false;
  }

  /**
   * Calculate video dimensions for cover/contain scaling
   * @private
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   * @returns {{ x: number, y: number, width: number, height: number }}
   */
  _calculateVideoDimensions(canvasWidth, canvasHeight) {
    if (!this.video.videoWidth || !this.video.videoHeight) {
      return { x: 0, y: 0, width: canvasWidth, height: canvasHeight };
    }

    const videoAspect = this.video.videoWidth / this.video.videoHeight;
    const canvasAspect = canvasWidth / canvasHeight;

    let width, height, x, y;

    if (this.scaleMode === 'cover') {
      // Cover: fill canvas, crop excess
      if (canvasAspect > videoAspect) {
        width = canvasWidth;
        height = canvasWidth / videoAspect;
      } else {
        height = canvasHeight;
        width = canvasHeight * videoAspect;
      }
    } else {
      // Contain: fit inside canvas, letterbox
      if (canvasAspect > videoAspect) {
        height = canvasHeight;
        width = canvasHeight * videoAspect;
      } else {
        width = canvasWidth;
        height = canvasWidth / videoAspect;
      }
    }

    x = (canvasWidth - width) / 2;
    y = (canvasHeight - height) / 2;

    return { x, y, width, height };
  }

  /**
   * Render a frame with radial mask
   * @param {number} mouseX - Mouse X position in canvas coordinates
   * @param {number} mouseY - Mouse Y position in canvas coordinates
   * @param {boolean} isActive - Whether mouse is active (inside container)
   */
  render(mouseX, mouseY, isActive) {
    if (!this.ctx || !this.canvas) return;

    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;

    // Clear canvas
    this.ctx.clearRect(0, 0, width, height);

    // Don't render if mouse isn't active or video isn't ready
    if (!isActive || !this.isVideoReady) return;

    // Save context state
    this.ctx.save();

    // Set global opacity
    this.ctx.globalAlpha = this.opacity;

    // Draw video to canvas (scaled to cover/contain)
    const dims = this._calculateVideoDimensions(width, height);
    this.ctx.drawImage(this.video, dims.x, dims.y, dims.width, dims.height);

    // Apply radial gradient mask using globalCompositeOperation
    // 'destination-in' keeps only the intersection with the next draw
    this.ctx.globalCompositeOperation = 'destination-in';

    // Create radial gradient for feathered mask
    const innerRadius = Math.max(0, this.revealRadius - this.edgeSoftness);
    const outerRadius = this.revealRadius;

    const gradient = this.ctx.createRadialGradient(
      mouseX, mouseY, innerRadius,
      mouseX, mouseY, outerRadius
    );

    // Solid center, fade to transparent at edge
    gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    // Draw the gradient mask
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);

    // Restore context state
    this.ctx.restore();
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.pause();

    if (this.video) {
      this.video.src = '';
      this.video.load();
      this.video = null;
    }

    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    this.canvas = null;
    this.ctx = null;
    this.isVideoReady = false;
  }
}
