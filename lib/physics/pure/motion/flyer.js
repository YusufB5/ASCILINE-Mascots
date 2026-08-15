class FlyingMascot extends SpriteMascot {
    constructor(jsonUrl, width = 60, height = 30, fps = 15, flySpeed = 2.0, route = null, spawnLoc = null) {
        super(jsonUrl, width, height, fps, flySpeed, route);
        
        // Move the wrapper from the fixed overlay directly to the document body!
        // This makes the mascot "live in the website" instead of the screen.
        document.body.appendChild(this.wrapper);
        this.wrapper.style.position = 'absolute';
        this.wrapper.style.zIndex = '9999';
        
        // Flight parameters
        this.time = Math.random() * Math.PI * 2;
        
        // Wandering center (used only in free roam mode, no route)
        this.centerX = window.innerWidth / 2;
        
        if (spawnLoc === 'bottom') {
            this.centerY = window.scrollY + window.innerHeight * 0.7 + Math.random() * window.innerHeight * 0.2;
        } else {
            // Clamp initial Y to visible viewport to avoid pushing page height on mobile
            this.centerY = window.scrollY + Math.random() * window.innerHeight * 0.5;
        }
        
        this.wanderVx = (Math.random() > 0.5 ? 1 : -1) * 0.5;
        this.wanderVy = (Math.random() > 0.5 ? 1 : -1) * 0.3;
        
        // Ensure starting Y reflects the desired centerY
        this.y = this.centerY;
        
        // Configuration: 'bounce' or 'wrap' (pac-man style)
        this.edgeBehavior = 'wrap';
    }

    tick(dt = 1) {
        if (!this.isLoaded) return;

        if (this.isDragging) {
            this.renderFrame(this.animFrame); 
            this.centerX = this.x;
            this.centerY = this.y;
            return;
        }

        if (this.route) {
            // ── WAYPOINT FLIGHT MODE ──
            this._waypointFlyAI(dt);
        } else {
            // ── FREE ROAM FLIGHT (wandering figure-8) ──
            this._freeRoamFlyAI(dt);
        }

        this.updateDOMPosition();

        // Always play animation loop while flying (unless waiting)
        if (!this.isWaiting) {
            this.animTimer += dt;
            if (this.animTimer >= this.frameDelay) {
                this.animFrame = (this.animFrame + 1) % this.frames.length;
                this.animTimer = 0;
            }
        }
        this.renderFrame(this.animFrame);
    }

    // ── WAYPOINT FLIGHT AI ──
    _waypointFlyAI(dt = 1) {
        const wp = this.route[this.routeIndex];
        const targetX = (wp.x / 100) * window.innerWidth;
        const targetY = (wp.y / 100) * window.innerHeight;

        if (wp.teleport && !this.isWaiting) {
            this.x = targetX;
            this.y = targetY;
        }

        // Are we waiting at this waypoint?
        if (this.isWaiting) {
            this.time += 0.03 * dt;
            this.y = targetY + Math.sin(this.time) * 5;
            this.vx = 0;
            this.vy = 0;

            this.waitTimer += dt;
            if (this.waitTimer >= wp.wait * 60) {
                this.isWaiting = false;
                this.waitTimer = 0;
                this.routeIndex = (this.routeIndex + 1) % this.route.length;
            }
            return;
        }

        // Fly towards waypoint
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const arrivedThreshold = this.walkSpeed * 3;

        if (dist < arrivedThreshold) {
            this.x = targetX;
            this.y = targetY;
            if (wp.wait > 0) {
                this.isWaiting = true;
                this.waitTimer = 0;
            } else {
                this.routeIndex = (this.routeIndex + 1) % this.route.length;
            }
        } else {
            // Smooth flight towards target (normalize direction, apply speed)
            this.vx = (dx / dist) * this.walkSpeed;
            this.vy = (dy / dist) * this.walkSpeed;
            this.x += this.vx * dt;
            this.y += this.vy * dt;
        }
    }

    // ── FREE ROAM FLIGHT (Random Vector Roaming) ──
    _freeRoamFlyAI(dt = 1) {
        // Initialize roam vectors if they don't exist
        if (this.targetVx === undefined) {
            this.targetVx = (Math.random() > 0.5 ? 1 : -1) * this.walkSpeed;
            this.targetVy = (Math.random() - 0.5) * (this.walkSpeed * 0.3);
            this.vx = this.targetVx;
            this.vy = this.targetVy;
            this.dirTimer = 0;
        }

        this.dirTimer -= dt;
        
        // Pick a new random flight path occasionally
        if (this.dirTimer <= 0) {
            const angle = (Math.random() - 0.5) * 0.8;
            
            // 80% chance to keep current direction, 20% to turn around
            const currentDir = this.vx >= 0 ? 1 : -1;
            const newDir = Math.random() > 0.2 ? currentDir : -currentDir;
            
            this.targetVx = Math.cos(angle) * this.walkSpeed * newDir;
            this.targetVy = Math.sin(angle) * this.walkSpeed;
            
            // Random duration between direction changes (5-10 seconds at 60fps)
            this.dirTimer = Math.random() * 300 + 300;
        }

        // Smoothly steer towards the target velocity (inertia)
        this.vx += (this.targetVx - this.vx) * (0.01 * dt);
        this.vy += (this.targetVy - this.vy) * (0.01 * dt);

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Use viewport-relative bounds to prevent dragon from pushing mobile page height
        const minY = window.scrollY - this.height;
        let maxY = window.scrollY + window.innerHeight;
        
        // Prevent expanding the page height at the very bottom
        const pageHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        if (maxY > pageHeight - this.height) {
            maxY = pageHeight - this.height;
        }
        
        const maxX = window.innerWidth;

        if (this.edgeBehavior === 'bounce') {
            // Bounce off horizontal edges
            if (this.x > maxX - this.width) {
                this.x = maxX - this.width;
                this.targetVx = -Math.abs(this.targetVx);
                this.vx = -Math.abs(this.vx);
            } else if (this.x < 0) {
                this.x = 0;
                this.targetVx = Math.abs(this.targetVx);
                this.vx = Math.abs(this.vx);
            }

            // Bounce off vertical edges (viewport-relative only)
            if (this.y > maxY - this.height) {
                this.y = maxY - this.height;
                this.targetVy = -Math.abs(this.targetVy);
                this.vy = -Math.abs(this.vy);
            } else if (this.y < minY) {
                this.y = minY;
                this.targetVy = Math.abs(this.targetVy);
                this.vy = Math.abs(this.vy);
            }
        } else {
            // Smooth Wrap-around (Pac-Man) — viewport-relative to avoid layout shifts
            if (this.x > maxX) {
                this.x = -this.width;
            } else if (this.x < -this.width) {
                this.x = maxX;
            }

            if (this.y > maxY + this.height) {
                this.y = minY;
            } else if (this.y < minY - this.height) {
                this.y = maxY;
            }
        }
    }
}
