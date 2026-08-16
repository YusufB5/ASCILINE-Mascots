class WalkingSpriteMascot extends SpriteMascot {
    constructor(jsonUrl, width = 60, height = 30, fps = 15) {
        // SpriteMascot handles DOM creation, animation loading, and rendering.
        // Pass walkSpeed=0 (AI controls speed internally) and route=null.
        super(jsonUrl, width, height, fps, 0, null);
        this.walkDir = Math.random() > 0.5 ? 1 : -1;

        // Initialize AI state (can't use lazy-init in tick because
        // SpriteMascot already sets walkSpeed=0, so 'walkSpeed === undefined' is always false)
        this.targetSpeed  = 0;
        this.walkDuration = 0;
        this.idleDuration = this._randomBetween(15, 60);
        this.stateTimer   = Math.random() * 150; // Random phase offset so multiple cats don't sync
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
        let floorY = window.scrollY + window.innerHeight - this.height;
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
        // (Properties are initialized in constructor — no lazy-init needed here)
        if (this.targetSpeed === undefined) {
            // Safety fallback in case constructor init was skipped somehow
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
        this.pre.style.transform = 'none';

        const speedRatio = Math.min(1, Math.abs(this.walkSpeed) / 1.5);
        const isMoving = speedRatio > 0.08;

        if (this.currentState === 'FALL' || isMoving || this.idleMode === 'play') {
            this.animTimer += dt;
            // When moving, scale frame delay with velocity; when fully stopped in 'play' mode, use base frameDelay smoothly
            const effectiveDelay = isMoving 
                ? Math.max(1, Math.round(this.frameDelay / Math.max(0.4, speedRatio)))
                : this.frameDelay;

            if (this.animTimer >= effectiveDelay) {
                this.animFrame = (this.animFrame + 1) % this.frames.length;
                this.animTimer = 0;
            }
            this.renderFrame(this.animFrame);
        } else {
            // Fully stopped and NOT in 'play' mode
            if (this.idleMode === 'freeze') {
                this.renderFrame(this.animFrame);
            } else if (!isNaN(parseInt(this.idleMode))) {
                const targetFrame = parseInt(this.idleMode);
                this.animFrame = targetFrame;
                this.renderFrame(targetFrame);
            } else {
                this.renderFrame(0);
            }
        }

        // Always sync DOM transform at the end of tick with latest direction & position
        this.updateDOMPosition();
    }

    _randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }
}
