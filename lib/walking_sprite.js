class WalkingSpriteMascot extends Mascot {
    constructor(jsonUrl, width = 60, height = 30, fps = 15) {
        // Create a unique wrapper ID for this sprite
        const uniqueId = Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
        const wrapperId = 'sprite-wrapper-' + uniqueId;
        const preId = 'sprite-pre-' + uniqueId;
        
        // We must create the elements since they aren't hardcoded in HTML
        const wrapper = document.createElement('div');
        wrapper.className = 'ascii-mascot-wrapper notranslate';
        wrapper.setAttribute('translate', 'no');
        wrapper.id = wrapperId;
        
        const pre = document.createElement('pre');
        pre.className = 'ascii-mascot-pre notranslate';
        pre.setAttribute('translate', 'no');
        pre.id = preId;
        pre.textContent = "Loading..."; // Placeholder
        
        wrapper.appendChild(pre);
        document.body.appendChild(wrapper);

        super(wrapperId, preId, width, height);
        this.jsonUrl = jsonUrl;
        this.frames = [];
        this.isLoaded = false;
        
        // Animation settings
        this.fps = fps;
        this.frameDelay = Math.max(1, Math.round(60 / this.fps)); // Assuming 60Hz tick rate
        
        this.walkDir = 1;
        
        this.loadAnimation(jsonUrl);
    }
    
    async loadAnimation(urlOrData) {
        try {
            let data;
            if (typeof urlOrData === 'string') {
                const response = await fetch(urlOrData);
                data = await response.json();
            } else {
                data = urlOrData;
            }
            this.frames = data.frames;
            this.isColored = data.isColored || (data.metadata && data.metadata.type === 'color') || false;
            this.facing = data.facing || (data.metadata && data.metadata.facing) || 'right';
            this.idleMode = data.idleMode || 'freeze'; // freeze, play, 0
            if (data.metadata) {
                this.metadata = data.metadata;
                this.customPoints = data.metadata.customPoints || [];
            }
            if (this.isColored) {
                this.pre.classList.add('colored-mascot-pre');
            }
            this.isLoaded = true;
            this.renderFrame(0);
            
            // Update collision box to match actual rendered ASCII pixel dimensions
            setTimeout(() => {
                if (this.pre) {
                    this.pre.style.width = 'max-content';
                    this.width = this.pre.scrollWidth || this.pre.offsetWidth || 100;
                    this.height = this.pre.scrollHeight || this.pre.offsetHeight || 100;
                    this.wrapper.style.width = `${this.width}px`;
                    this.wrapper.style.height = `${this.height}px`;
                    this.renderHitboxOverlay();
                }
            }, 50);

        } catch (error) {
            console.error("Failed to load mascot animation:", error);
            this.pre.textContent = "Error Loading Anim";
        }
    }

    renderFrame(index) {
        if (!this.frames || this.frames.length === 0) return;
        if (this.currentRenderedFrame === index) return;
        this.currentRenderedFrame = index;
        
        if (!this._htmlCache) this._htmlCache = {};
        
        if (this.isColored) {
            if (!this._htmlCache[index]) {
                this._htmlCache[index] = SpriteMascot.formatFrameToHTML(this.frames[index]);
            }
            this.pre.innerHTML = this._htmlCache[index];
        } else {
            if (!this._htmlCache[index]) {
                const frameData = this.frames[index];
                this._htmlCache[index] = typeof frameData === 'string' ? frameData : SpriteMascot.formatFrameToHTML(frameData);
            }
            this.pre.textContent = this._htmlCache[index];
        }
    }

    tick(dt = 1) {
        if (!this.isLoaded) return;

        if (this.isDragging) {
            this.renderFrame(this.animFrame);
            return;
        }

        // ── PHYSICS ──
        this.vy += this.gravity * dt;
        this.vx *= Math.pow(this.friction, dt);
        this.vy *= Math.pow(this.friction, dt);
        
        let nextX = this.x + this.vx * dt;
        let nextY = this.y + this.vy * dt;
        
        // Wall collisions
        if (nextX < 0) {
            nextX = 0;
            this.vx = -this.vx * this.bounce;
        } else if (nextX + this.width > window.innerWidth) {
            nextX = window.innerWidth - this.width;
            this.vx = -this.vx * this.bounce;
        }
        
        let landed = false;
        let floorY = window.scrollY + window.innerHeight - this.height - 20;
        const collision = this.findPlatformCollision();
        
        if (collision.platform) {
            floorY = collision.top - this.height;
        }
        
        if (nextY >= floorY) {
            nextY = floorY;
            if (this.vy > 1.5) {
                this.vy = -this.vy * this.bounce;
            } else {
                this.vy = 0;
                landed = true;
            }
        }
        
        this.x = nextX;
        this.y = nextY;
        this.updateDOMPosition();

        // ── AI STATE MACHINE ──
        // Initialize AI properties with randomized offsets for asynchronous movement
        if (this.walkSpeed === undefined) {
            this.walkSpeed = 0;
            this.targetSpeed = 0;
            this.walkDuration = 0;
            this.idleDuration = this._randomBetween(15, 60);
            this.stateTimer = Math.random() * 150; // Random phase offset
            this.walkDir = Math.random() > 0.5 ? 1 : -1;
        }

        if (landed) {
            if (this.currentState === 'FALL') {
                // Eliminate landing synchronization: 80% chance to walk immediately, 20% micro-breath
                if (Math.random() < 0.8) {
                    this.currentState = 'WALK';
                    if (!this.walkDir) this.walkDir = Math.random() > 0.5 ? 1 : -1;
                    this.targetSpeed = this._randomBetween(2.2, 5.8);
                    this.walkDuration = this._randomBetween(300, 720);
                    this.stateTimer = 0;
                } else {
                    this.currentState = 'IDLE';
                    this.stateTimer = 0;
                    this.idleDuration = this._randomBetween(5, 20); // Micro-breath (0.08 - 0.3s)
                    this.walkSpeed = 0;
                }
            }
            this.stateTimer += dt;

            // ── EDGE AWARENESS ──
            const edgeMargin = 15;
            const nearLeftEdge = this.x < edgeMargin && this.walkDir === -1;
            const nearRightEdge = this.x + this.width > window.innerWidth - edgeMargin && this.walkDir === 1;

            if (this.currentState === 'WALK' && (nearLeftEdge || nearRightEdge)) {
                this.currentState = 'TURN';
                this.stateTimer = 0;
                this.targetSpeed = 0;
                // 75% chance instant turn, 25% chance brief 0.75-1.5s pause to stare off-screen
                this.turnPauseDuration = Math.random() < 0.75 ? 3 : this._randomBetween(45, 90);
            }

            // ── STATE: IDLE ──
            if (this.currentState === 'IDLE') {
                // Smooth deceleration friction
                this.walkSpeed *= Math.pow(0.85, dt);
                if (Math.abs(this.walkSpeed) < 0.05) this.walkSpeed = 0;
                this.vx = this.walkSpeed;

                if (this.stateTimer > this.idleDuration) {
                    this.currentState = 'WALK';
                    this.walkDir = Math.random() > 0.5 ? 1 : -1;
                    this.targetSpeed = this._randomBetween(2.2, 5.8);
                    this.walkDuration = this._randomBetween(300, 720); // 5-12s active walk
                    this.stateTimer = 0;
                }
            }
            // ── STATE: WALK ──
            else if (this.currentState === 'WALK') {
                const target = this.walkDir * this.targetSpeed;
                this.walkSpeed += (target - this.walkSpeed) * (0.08 * dt);
                this.vx = this.walkSpeed;

                if (this.stateTimer > this.walkDuration) {
                    // 65% chance to seamlessly continue walking in current direction
                    // 35% chance to decelerate and take a 1-2.5s organic break
                    if (Math.random() < 0.65) {
                        this.targetSpeed = this._randomBetween(2.2, 5.8);
                        this.walkDuration = this._randomBetween(300, 720);
                        this.stateTimer = 0;
                    } else {
                        this.currentState = 'IDLE';
                        this.stateTimer = 0;
                        this.idleDuration = this._randomBetween(60, 150); // 1-2.5s organic break
                    }
                }
            }
            // ── STATE: TURN ──
            else if (this.currentState === 'TURN') {
                this.walkSpeed *= Math.pow(0.85, dt);
                if (Math.abs(this.walkSpeed) < 0.05) this.walkSpeed = 0;
                this.vx = this.walkSpeed;

                const limit = this.turnPauseDuration || 3;
                if (this.stateTimer > limit) {
                    this.walkDir = -this.walkDir;
                    this.currentState = 'WALK';
                    this.targetSpeed = this._randomBetween(2.2, 5.8);
                    this.walkDuration = this._randomBetween(300, 720);
                    this.stateTimer = 0;
                }
            }

        } else {
            this.currentState = 'FALL';
        }

        // ── ANIMATION RENDERING ──
        const needsFlip = (this.facing === 'left' && this.walkDir === 1) || 
                          (this.facing === 'right' && this.walkDir === -1);
        this.pre.style.transform = needsFlip ? 'scaleX(-1)' : 'none';

        if (this._hitboxOverlaySvg) {
            this._hitboxOverlaySvg.style.transform = this.pre.style.transform;
        }

        const speedRatio = Math.min(1, Math.abs(this.walkSpeed) / 1.5);
        const isMoving = speedRatio > 0.08;

        if (this.currentState === 'FALL' || isMoving) {
            this.animTimer += dt;
            const adjustedDelay = Math.round(this.frameDelay / Math.max(0.2, speedRatio));
            if (this.animTimer >= adjustedDelay) {
                this.animFrame = (this.animFrame + 1) % this.frames.length;
                this.animTimer = 0;
            }
            this.renderFrame(this.animFrame);
        } else {
            // Fully stopped
            if (this.idleMode === 'play') {
                this.animTimer += dt;
                if (this.animTimer >= this.frameDelay) {
                    this.animFrame = (this.animFrame + 1) % this.frames.length;
                    this.animTimer = 0;
                }
                this.renderFrame(this.animFrame);
            } else if (this.idleMode === 'freeze') {
                this.renderFrame(this.animFrame);
            } else if (!isNaN(parseInt(this.idleMode))) {
                const targetFrame = parseInt(this.idleMode);
                this.animFrame = targetFrame;
                this.renderFrame(targetFrame);
            } else {
                this.renderFrame(0);
            }
        }
    }

    _randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }
}
