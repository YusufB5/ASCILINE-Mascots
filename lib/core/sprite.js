class SpriteMascot extends Mascot {
    constructor(jsonUrl, width = 60, height = 30, fps = 15, walkSpeed = 4.0, route = null) {
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
        // Start invisible via CSS class only if not already cached
        SpriteMascot._jsonCache = SpriteMascot._jsonCache || {};
        if (!SpriteMascot._jsonCache[jsonUrl]) {
            wrapper.classList.add('mascot-loading');
        }
        
        wrapper.appendChild(pre);
        document.body.appendChild(wrapper);

        super(wrapperId, preId, width, height);
        this.jsonUrl = jsonUrl;
        this.frames = [];
        this.isLoaded = false;
        
        // Animation settings
        this.fps = fps;
        this.frameDelay = Math.max(1, Math.round(60 / this.fps)); // Assuming 60Hz tick rate
        this.walkSpeed = walkSpeed;
        
        this.walkDir = 1;
        
        // Waypoint Route System (optional)
        this.route = route; // Array of {x: vw%, y: vh%, wait: seconds} or null
        this.routeIndex = 0;
        this.waitTimer = 0;
        this.isWaiting = false;
        
        this.loadAnimation(jsonUrl);
    }
    
    async loadAnimation(url) {
        try {
            SpriteMascot._jsonCache = SpriteMascot._jsonCache || {};
            let data = SpriteMascot._jsonCache[url];

            if (!data) {
                let response = await fetch(url).catch(() => null);
                if (!response || !response.ok) {
                    const relUrl = url.replace(/^\//, '');
                    response = await fetch(relUrl).catch(() => null);
                }
                if (!response || !response.ok) {
                    throw new Error(`HTTP error! status: ${response ? response.status : 'NetworkError'}`);
                }
                data = await response.json();
                SpriteMascot._jsonCache[url] = data;
            }

            this.frames = data.frames;
            this.isColored = data.isColored || false;
            this.facing = data.facing || 'right';
            this.idleMode = data.idleMode || 'freeze'; // freeze, play, 0
            // Load optional metadata (customPoints hitbox, etc.)
            if (data.metadata) {
                this.metadata = data.metadata;
                this.customPoints = data.metadata.customPoints || [];
            }
            if (this.isColored) {
                this.pre.classList.add('colored-mascot-pre');
            }
            this.isLoaded = true;
            this.renderFrame(0);
            
            // Remove loading class immediately — no transition delay or opacity:0
            this.wrapper.classList.remove('mascot-loading');

            if (this.pre.offsetWidth && this.pre.offsetHeight) {
                this.width = this.pre.offsetWidth;
                this.height = this.pre.offsetHeight;
                this.wrapper.style.width = `${this.width}px`;
                this.wrapper.style.height = `${this.height}px`;
            } else {
                requestAnimationFrame(() => {
                    if (!this.pre) return;
                    this.width = this.pre.offsetWidth || this.width || 100;
                    this.height = this.pre.offsetHeight || this.height || 100;
                    this.wrapper.style.width = `${this.width}px`;
                    this.wrapper.style.height = `${this.height}px`;
                });
            }

        } catch (error) {
            console.error("Failed to load mascot animation:", error);
            // Completely destroy and remove from memory if JSON fails to load
            if (typeof this.destroy === 'function') {
                this.destroy();
            } else if (this.wrapper && this.wrapper.parentNode) {
                this.wrapper.parentNode.removeChild(this.wrapper);
            }
            if (typeof mascots !== 'undefined') {
                const idx = mascots.indexOf(this);
                if (idx > -1) mascots.splice(idx, 1);
            }
        }
    }

    renderFrame(index) {
        if (!this.frames || this.frames.length === 0) return;
        if (this.currentRenderedFrame === index) return;
        this.currentRenderedFrame = index;
        
        // Cache HTML to prevent massive GC and CPU parsing every frame
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

    static formatFrameToHTML(frameData) {
        if (typeof frameData === 'string') return frameData;
        if (!Array.isArray(frameData)) return '';
        
        let htmlLines = [];
        for (let r = 0; r < frameData.length; r++) {
            let row = frameData[r];
            if (!Array.isArray(row)) {
                htmlLines.push(String(row));
                continue;
            }
            let rowHtml = '';
            let currentColor = null;
            let runLength = 0;
            
            for (let c = 0; c < row.length; c++) {
                let color = row[c];
                if (color === currentColor) {
                    runLength++;
                } else {
                    if (runLength > 0) {
                        if (currentColor === null) {
                            rowHtml += ' '.repeat(runLength);
                        } else {
                            rowHtml += `<span style="color:${currentColor}">` + '█'.repeat(runLength) + '</span>';
                        }
                    }
                    currentColor = color;
                    runLength = 1;
                }
            }
            if (runLength > 0) {
                if (currentColor === null) {
                    rowHtml += ' '.repeat(runLength);
                } else {
                    rowHtml += `<span style="color:${currentColor}">` + '█'.repeat(runLength) + '</span>';
                }
            }
            htmlLines.push(rowHtml);
        }
        return htmlLines.join('\n');
    }
    
    mutate() {
        if (!this.pre) return;
        const hue = Math.floor(Math.random() * 360);
        this.pre.style.filter = `hue-rotate(${hue}deg) saturate(250%)`;
        this.pre.style.transition = 'filter 0.5s ease-in-out';
        
        // Pop effect
        this.wrapper.style.transform = 'scale(1.4)';
        this.wrapper.style.transition = 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'; // bouncy
        
        setTimeout(() => {
            this.wrapper.style.transform = 'scale(1)';
        }, 300);
    }

    tick(dt = 1) {
        if (!this.isLoaded) return; // Wait until frames are fetched

        if (this.isDragging) {
            this.renderFrame(this.animFrame); // Just freeze frame while dragging
            return;
        }

        // Standard Physics
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
                this.vy = -this.vy * this.bounce; // Bounce!
            } else {
                this.vy = 0;
                landed = true;
            }
        }
        
        this.x = nextX;
        this.y = nextY;
        this.updateDOMPosition();
        
        // AI Logic
        if (landed) {
            if (this.currentState === 'FALL') {
                this.currentState = 'IDLE';
                this.stateTimer = 0;
            }
            this.stateTimer += dt;
            
            if (this.route) {
                // ── WAYPOINT MODE ──
                this._waypointWalkAI(dt);
            } else {
                // ── FREE ROAM MODE (no route given) ──
                if (this.currentState === 'IDLE') {
                    if (this.stateTimer > 180) { // Chill for ~3 seconds
                        this.currentState = 'WALK';
                        this.walkDir = Math.random() > 0.5 ? 1 : -1;
                        this.stateTimer = 0;
                    }
                } else if (this.currentState === 'WALK') {
                    this.vx = this.walkDir * this.walkSpeed; // vx is in px/step; dt applied at position update
                    
                    const rng = Math.random();
                    if (rng < 0.002) this.walkDir = -this.walkDir; // Turn around (very rare)
                    else if (rng < 0.005) { this.currentState = 'IDLE'; this.vx = 0; this.stateTimer = 0; }
                }
            }
        } else {
            this.currentState = 'FALL';
        }
        
        // Update Animation Frame
        const needsFlip = (this.facing === 'left' && this.walkDir === 1) || 
                          (this.facing === 'right' && this.walkDir === -1);
                          
        if (needsFlip) {
            this.pre.style.transform = 'scaleX(-1)';
        } else {
            this.pre.style.transform = 'none';
        }

        // Loop animation frames if walking or if idlePlay is true
        if (this.currentState === 'WALK' || this.currentState === 'FALL' || (this.currentState === 'IDLE' && this.idleMode === 'play')) {
            this.animTimer += dt;
            if (this.animTimer >= this.frameDelay) {
                this.animFrame = (this.animFrame + 1) % this.frames.length;
                this.animTimer = 0;
            }
            this.renderFrame(this.animFrame);
        } else if (this.currentState === 'IDLE') {
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
    }

    // ── WAYPOINT WALKING AI ──
    _waypointWalkAI(dt = 1) {
        const wp = this.route[this.routeIndex];
        const targetX = (wp.x / 100) * window.innerWidth;

        if (wp.teleport && !this.isWaiting) {
            this.x = targetX;
        }

        const dist = Math.abs(targetX - this.x);

        // Are we waiting at this waypoint?
        if (this.isWaiting) {
            this.currentState = 'IDLE';
            this.vx = 0;
            this.waitTimer += dt;
            if (this.waitTimer >= wp.wait * 60) { // wait is in seconds, tick is 60fps
                this.isWaiting = false;
                this.waitTimer = 0;
                this.routeIndex = (this.routeIndex + 1) % this.route.length;
            }
            return;
        }

        // Walk towards waypoint
        const dx = targetX - this.x;
        const arrivedThreshold = this.walkSpeed * 2;

        if (Math.abs(dx) < arrivedThreshold) {
            // Arrived at waypoint!
            this.vx = 0;
            if (wp.wait > 0) {
                this.isWaiting = true;
                this.waitTimer = 0;
                this.currentState = 'IDLE';
                this.stateTimer = 0;
            } else {
                this.routeIndex = (this.routeIndex + 1) % this.route.length;
            }
        } else {
            // Walk towards target
            this.currentState = 'WALK';
            this.walkDir = dx > 0 ? 1 : -1;
            this.vx = this.walkDir * this.walkSpeed; // dt applied at position update
        }
    }
}
