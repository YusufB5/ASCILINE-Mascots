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
            // Auto-resolve relative filename using configured baseAssetUrl
            if (typeof url === 'string' && typeof window !== 'undefined' && window.ASCILINE && typeof window.ASCILINE.resolveAssetUrl === 'function') {
                url = window.ASCILINE.resolveAssetUrl(url);
            }

            SpriteMascot._jsonCache = SpriteMascot._jsonCache || {};
            let data;

            // Support passing a raw data object directly (e.g. window.MY_MASCOT_DATA)
            // This avoids CORS/NetworkError when opening via file:// without a local server.
            if (url && typeof url === 'object' && url.frames) {
                data = url;
            } else {
                data = SpriteMascot._jsonCache[url];
            }

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
            this.facing = (data.metadata && data.metadata.facing) || data.facing || 'right';
            this.idleMode = (data.metadata && data.metadata.idleMode) || data.idleMode || 'freeze'; // freeze, play, 0
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

            // Measure actual rendered ASCII pixel dimensions accurately
            this.wrapper.style.width = 'auto';
            this.wrapper.style.height = 'auto';
            this.pre.style.width = 'max-content';
            this.pre.style.display = 'inline-block';

            const updateDimensions = () => {
                if (!this.pre) return;
                const w = this.pre.offsetWidth || this.width || 100;
                const h = this.pre.offsetHeight || this.height || 100;
                this.width = w;
                this.height = h;
                this.wrapper.style.width = `${w}px`;
                this.wrapper.style.height = `${h}px`;
                this.renderHitboxOverlay();
            };

            if (this.pre.offsetWidth && this.pre.offsetHeight) {
                updateDimensions();
            } else {
                requestAnimationFrame(updateDimensions);
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

    renderHitboxOverlay() {
        if (!this.wrapper) return;
        
        let overlay = this.wrapper.querySelector('.hitbox-debug-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'hitbox-debug-overlay';
            overlay.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999;';
            this.wrapper.appendChild(overlay);
        }
        
        // Check global debug flag (hidden by default, enabled via ASCILINE.setDebug)
        const isDebugVisible = !!(window.ASCILINE_CONFIG && window.ASCILINE_CONFIG.debug && window.ASCILINE_CONFIG.debug.hitboxes);
        overlay.style.display = isDebugVisible ? 'block' : 'none';
        if (!isDebugVisible || !this.customPoints || this.customPoints.length === 0) {
            overlay.innerHTML = '';
            return;
        }

        // Measure grid cell dimensions based on metadata width/height
        let cols = (this.metadata && this.metadata.width) || 1;
        let rows = (this.metadata && this.metadata.height) || 1;
        
        if ((!this.metadata || !this.metadata.width) && this.frames && this.frames.length > 0) {
            if (typeof this.frames[0] === 'string') {
                const lines = this.frames[0].split('\n');
                rows = lines.length || rows;
                // Strip HTML tags if colored string to get true character column count
                const cleanLine = lines[0].replace(/<[^>]*>/g, '');
                cols = cleanLine.length || cols;
            } else if (Array.isArray(this.frames[0])) {
                rows = this.frames[0].length || rows;
                cols = (this.frames[0][0] && this.frames[0][0].length) || cols;
            }
        }

        const cellW = this.width / cols;
        const cellH = this.height / rows;

        let svgHtml = `<svg width="100%" height="100%" style="position:absolute; top:0; left:0; overflow:visible;">`;
        
        // Render connected polygon if multiple polygon points exist
        const polyPoints = this.customPoints.filter(pt => pt.type === 'polygon');
        if (polyPoints.length > 1) {
            const pointsAttr = polyPoints.map(pt => {
                const px = (pt.ax + 0.5) * cellW;
                const py = (pt.ay + 0.5) * cellH;
                return `${px},${py}`;
            }).join(' ');
            svgHtml += `<polygon points="${pointsAttr}" fill="rgba(255, 0, 85, 0.25)" stroke="#ff0055" stroke-width="1.5" stroke-dasharray="3,2" />`;
        }

        this.customPoints.forEach(pt => {
            const cx = (pt.ax + 0.5) * cellW;
            const cy = (pt.ay + 0.5) * cellH;

            if (pt.type === 'rect') {
                const rx = pt.ax * cellW;
                const ry = pt.ay * cellH;
                const rw = (pt.aw || 1) * cellW;
                const rh = (pt.ah || 1) * cellH;
                svgHtml += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="rgba(255, 0, 85, 0.25)" stroke="#ff0055" stroke-width="1.5" stroke-dasharray="3,2" />`;
            } else if (pt.type === 'circle') {
                const r = (pt.ar || 1) * cellW;
                svgHtml += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(0, 255, 204, 0.25)" stroke="#00ffcc" stroke-width="1.5" stroke-dasharray="3,2" />`;
            } else if (pt.type === 'polygon') {
                // Polygon vertices as small dots
                svgHtml += `<circle cx="${cx}" cy="${cy}" r="2.5" fill="#ff0055" stroke="#ffffff" stroke-width="1" />`;
            } else {
                // Single Point / Anchor
                svgHtml += `<circle cx="${cx}" cy="${cy}" r="3.5" fill="#ff00cc" stroke="#ffffff" stroke-width="1.2" />`;
            }
        });

        svgHtml += `</svg>`;
        overlay.innerHTML = svgHtml;
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
        
        // Ensure pre transform is clear (flip is handled on wrapper)
        this.pre.style.transform = 'none';

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

        this.updateDOMPosition();
    }

    // Bake flip transformation into the wrapper's CSS transform so the drag & collision box
    // always matches the rendered visual position across all mascot types.
    updateDOMPosition() {
        let dir = this.walkDir || 1;
        if (Math.abs(this.vx) > 0.01) {
            dir = this.vx > 0 ? 1 : -1;
        }

        const needsFlip = (this.facing === 'left' && dir === 1) || 
                          (this.facing === 'right' && dir === -1);

        if (needsFlip) {
            this.wrapper.style.transform = `translate3d(${this.x}px, ${this.y}px, 0) scaleX(-1)`;
        } else {
            this.wrapper.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
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
