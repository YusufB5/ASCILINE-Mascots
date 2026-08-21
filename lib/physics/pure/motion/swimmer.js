/**
 * ASCILINE SWIMMER MASCOT ENGINE
 * ===============================================
 * Autonomous Swimming Mascot for Web Applications & Mascot Marketplaces.
 * Supports:
 * 1. 'free_float': Glides gracefully across the entire screen/page.
 * 2. 'aquarium': Bounded to a specific HTML water container (#asciquarium or custom selector).
 * 3. 'auto': Automatically detects water containers on the page, or falls back to free_float.
 * 4. Land Physics: Optional gravity & flopping physics when dragged out of water.
 */

class SwimmerMascot extends SpriteMascot {
    constructor(jsonUrl, widthOrOptions = 100, height = 50, fps = 15, speed = 3, facingRight = false) {
        let opts = {};

        // Flexible Constructor: Supports both positional parameters & Options Object
        if (typeof widthOrOptions === 'object' && widthOrOptions !== null) {
            opts = widthOrOptions;
        } else {
            opts = {
                width: widthOrOptions,
                height: height,
                fps: fps,
                speed: speed,
                facingRight: facingRight
            };
        }

        // Configuration Defaults
        const config = {
            width: opts.width || 100,
            height: opts.height || 50,
            fps: opts.fps || 15,
            speed: opts.speed || 3,
            facingRight: opts.facingRight || false,
            mode: opts.mode || 'auto',                    // 'auto' | 'aquarium' | 'free_float'
            targetWater: opts.targetWater || '#asciquarium',// Water container selector
            enableLandPhysics: opts.enableLandPhysics !== undefined ? opts.enableLandPhysics : true,
            bubbleEffect: opts.bubbleEffect !== undefined ? opts.bubbleEffect : true,
            splashEffect: opts.splashEffect !== undefined ? opts.splashEffect : true
        };

        super(jsonUrl, config.width, config.height, config.fps, config.speed, null);

        this.config = config;
        this.facingRight = config.facingRight;
        
        const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window && window.navigator.maxTouchPoints > 0);
        this.walkSpeed = isMobile ? config.speed * 0.65 : config.speed;

        // Re-parent to document.body so it can navigate freely
        if (this.wrapper.parentElement !== document.body) {
            document.body.appendChild(this.wrapper);
        }

        // State Machine & Directions
        this.swimState = 'SWIM_RIGHT';
        this.walkDir = 1; // 1 = right, -1 = left
        this.vx = this.walkSpeed;
        this.vy = 0;
        this.baseY = this.y;
        this.time = Math.random() * 100;
        
        // Physics constants
        this.gravity = 1.6;   // Heavy fall when out of water
        this.bounce = 0.4;
        this.friction = 0.935; // dt-scaled (matches 0.98^200fps)

        this._waterCache = null;      // Cached water bounds
        this._waterCacheAge = 0;      // Frames since last cache refresh
        this._waterCacheTTL = 60;     // Refresh every 60 ticks (~1 sec)

        this.isInWater = false;
        this.bubbleTimer = 0;
    }

    // Helper: Find target water element or global AsciiAquarium instance
    getWaterContainer() {
        if (this.config.mode === 'free_float') return null;

        // 1. Check Global AsciiAquariumInstance
        if (window.AsciiAquariumInstance && window.AsciiAquariumInstance.isInside) {
            return window.AsciiAquariumInstance;
        }

        // 2. Check DOM by selector
        if (this.config.targetWater) {
            const el = document.querySelector(this.config.targetWater);
            if (el) {
                const rect = el.getBoundingClientRect();
                return {
                    bounds: {
                        left: rect.left + window.scrollX,
                        top: rect.top + window.scrollY,
                        right: rect.right + window.scrollX,
                        bottom: rect.bottom + window.scrollY,
                        width: rect.width,
                        height: rect.height
                    },
                    isInside: (px, py) => {
                        const l = rect.left + window.scrollX;
                        const r = rect.right + window.scrollX;
                        const t = rect.top + window.scrollY;
                        const b = rect.bottom + window.scrollY;
                        return px >= l && px <= r && py >= t && py <= b;
                    },
                    addSplash: (px, py) => {
                        if (window.AsciiAquariumInstance && window.AsciiAquariumInstance.addSplash) {
                            window.AsciiAquariumInstance.addSplash(px, py);
                        }
                    },
                    addBubble: (px, py) => {
                        if (window.AsciiAquariumInstance && window.AsciiAquariumInstance.addBubble) {
                            window.AsciiAquariumInstance.addBubble(px, py);
                        }
                    }
                };
            }
        }

        return null;
    }

    tick(dt = 1) {
        if (!this.isLoaded) return;

        // Dragging Override
        if (this.isDragging) {
            this.baseY = this.y;
            this.updateDOMPosition();
            this.renderFrame(this.animFrame); // Freeze frame while dragging
            return;
        }

        // Render animation frame (slow down animation playback when out of water)
        const animDt = this.isInWater ? dt : dt * 0.4;
        this.animTimer += animDt;
        if (this.animTimer >= this.frameDelay) {
            this.animTimer = 0;
            this.animFrame = (this.animFrame + 1) % this.frames.length;
            this.renderFrame(this.animFrame);
        }

        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;

        // Cache water container to avoid getBoundingClientRect every frame (perf fix)
        this._waterCacheAge += dt;
        if (this.isDragging || !this._waterCache || this._waterCacheAge >= this._waterCacheTTL) {
            this._waterCache = this.getWaterContainer();
            this._waterCacheAge = 0;
        }
        const water = this._waterCache;
        
        // Hysteresis boundary check: require 8px deeper entry/exit to prevent boundary flickering
        let currentlyInWater = false;
        if (water && water.bounds) {
            const b = water.bounds;
            if (this.isInWater) {
                // To exit water, center must move completely beyond bounds
                currentlyInWater = (cx >= b.left - 5 && cx <= b.right + 5 && cy >= b.top - 5 && cy <= b.bottom + 5);
            } else {
                // To enter water, center must be cleanly inside bounds
                currentlyInWater = (cx >= b.left + 5 && cx <= b.right - 5 && cy >= b.top + 5 && cy <= b.bottom - 5);
            }
        }

        // Water Entry / Exit Particle Effects & Velocity Dampening
        if (currentlyInWater && !this.isInWater) {
            this.isInWater = true;
            this.vy *= 0.3; // Water drag dampening upon entry
            if (this.config.splashEffect && water && water.addSplash) {
                water.addSplash(cx, cy, 12);
            }
        } else if (!currentlyInWater && this.isInWater) {
            this.isInWater = false;
            if (this.config.splashEffect && water && water.addSplash) {
                water.addSplash(cx, cy, 8);
            }
        }

        // ── EXECUTE MOVEMENT BASED ON MODE & WATER STATUS ──
        if (this.config.mode === 'free_float' || (!water && !this.config.enableLandPhysics)) {
            this.freeFloatMovement(dt);
        } else if (this.isInWater && water) {
            this.aquariumMovement(water, cx, cy, dt);
        } else {
            this.landPhysicsMovement(water, dt);
        }

        this.updateDOMPosition();
    }

    // Free floating mode across full viewport
    freeFloatMovement(dt = 1) {
        this.time += 0.04 * dt;

        const isBody = this.wrapper.parentElement === document.body;
        const scrollY = isBody ? (window.pageYOffset || document.documentElement.scrollTop) : 0;
        const docWidth = isBody ? Math.max(document.documentElement.scrollWidth, window.innerWidth) : window.innerWidth;
        const docHeight = isBody ? Math.max(document.documentElement.scrollHeight, window.innerHeight) : window.innerHeight;

        switch (this.swimState) {
            case 'SWIM_RIGHT':
                this.walkDir = 1;
                this.vx = this.walkSpeed;
                if (this.x > docWidth - this.width - 20) {
                    this.swimState = 'SWIM_LEFT';
                }
                break;
                
            case 'SWIM_LEFT':
                this.walkDir = -1;
                this.vx = -this.walkSpeed;
                if (this.x < 20) {
                    this.swimState = 'SWIM_RIGHT';
                }
                break;
        }

        this.x += this.vx * dt;
        this.y = this.baseY + Math.sin(this.time) * 20;

        // Boundaries
        if (this.y < scrollY + 50) this.y = scrollY + 50;
        if (this.y > docHeight - this.height - 50) this.y = docHeight - this.height - 50;
    }

    // Aquarium bounded movement
    aquariumMovement(water, cx, cy, dt = 1) {
        this.time += 0.05 * dt;

        const b = water.bounds;
        const waterLeft = b.left + 5;
        const waterRight = b.right - this.width - 5;
        const waterTop = b.top + 5;
        const waterBottom = b.bottom - this.height - 5;

        // Bubble Particles
        if (this.config.bubbleEffect && water.addBubble) {
            this.bubbleTimer += dt;
            if (this.bubbleTimer > 10) {
                this.bubbleTimer = 0;
                const bubbleX = this.swimState === 'SWIM_RIGHT' ? this.x : this.x + this.width;
                water.addBubble(bubbleX, cy);
            }
        }

        switch (this.swimState) {
            case 'SWIM_RIGHT':
                this.walkDir = 1;
                this.vx = this.walkSpeed;
                if (this.x >= waterRight) {
                    this.swimState = 'SWIM_LEFT';
                    this.walkDir = -1;
                }
                break;
                
            case 'SWIM_LEFT':
                this.walkDir = -1;
                this.vx = -this.walkSpeed;
                if (this.x <= waterLeft) {
                    this.swimState = 'SWIM_RIGHT';
                    this.walkDir = 1;
                }
                break;
        }

        this.x += this.vx * dt;
        
        // Smooth Buoyancy towards center of aquarium (prevent sudden snapping)
        const targetY = b.top + (b.height / 2) - (this.height / 2) + Math.sin(this.time) * 15;
        this.y += (targetY - this.y) * (0.04 * dt);

        // Clamping (both vertical and horizontal to prevent edge sticking)
        if (this.x < waterLeft) this.x = waterLeft;
        if (this.x > waterRight) this.x = waterRight;
        if (this.y < waterTop) this.y = waterTop;
        if (this.y > waterBottom) this.y = waterBottom;
    }

    // Land physics (gravity & flopping outside water)
    landPhysicsMovement(water, dt = 1) {
        this.vy += this.gravity * dt;
        this.vx *= Math.pow(this.friction, dt);
        this.vy *= Math.pow(this.friction, dt);

        let nextX = this.x + this.vx * dt;
        let nextY = this.y + this.vy * dt;

        // Sync direction with velocity momentum when thrown/moving
        if (Math.abs(this.vx) > 0.3) {
            this.walkDir = this.vx > 0 ? 1 : -1;
            this.swimState = this.walkDir === 1 ? 'SWIM_RIGHT' : 'SWIM_LEFT';
        }

        // Floor collision handling when "falling" (e.g. after being thrown out of water)
        const floorY = window.scrollY + window.innerHeight - this.height;
        if (nextY >= floorY) {
            nextY = floorY;
            if (this.vy > 1.5) {
                this.vy = -this.vy * this.bounce;
            } else {
                this.vy = 0;
                // Flop on floor when outside water
                if (Math.abs(this.vx) < 0.2) {
                    this.walkDir = this.walkDir || (Math.random() > 0.5 ? 1 : -1);
                    this.swimState = this.walkDir === 1 ? 'SWIM_RIGHT' : 'SWIM_LEFT';
                    this.vx = this.walkDir * 3.0;
                    if (Math.random() < 0.01) {
                        this.walkDir = -this.walkDir;
                        this.swimState = this.walkDir === 1 ? 'SWIM_RIGHT' : 'SWIM_LEFT';
                    }
                }
            }
        }

        this.x = nextX;
        this.y = nextY;
        this.baseY = this.y;
    }
}

(window.ASCILINE = window.ASCILINE || {}).Physics = window.ASCILINE.Physics || {};
window.ASCILINE.Physics.Swimmer = SwimmerMascot;
