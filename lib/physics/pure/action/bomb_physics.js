class BombPhysics extends SpriteMascot {
    constructor(x = 0, y = 0) {
        super('assets/mascots/bom3_coloranim.json', 120, 120, 30, 0, null); // walkspeed = 0
        this.x = x;
        this.y = y;
        
        this.bombState = 'IDLE'; // IDLE, ACTIVATED, EXPLODED
        this.fuseTimer = 180; // 3 seconds at 60fps
        
        this.friction = 0.985; // slightly increased friction so it doesn't roll forever
        this.rotation = 0;
        
        // Listen for drag & throw velocity release on both desktop (mouseup) and mobile (touchend, pointerup)
        const checkAndActivate = () => {
            setTimeout(() => {
                if (this.bombState === 'IDLE') {
                    if (Math.abs(this.vx) > 4.5 || Math.abs(this.vy) > 4.5) {
                        this.activateBomb();
                    }
                }
            }, 30); // Wait for Mascot base class to calculate throw velocity
        };

        this.wrapper.addEventListener('mouseup', checkAndActivate);
        this.wrapper.addEventListener('touchend', checkAndActivate);
        this.wrapper.addEventListener('pointerup', checkAndActivate);

        // On mobile/touch devices, also allow direct tap to ignite fuse for smooth touch UX!
        this.wrapper.addEventListener('click', (e) => {
            const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window && window.navigator.maxTouchPoints > 0);
            if (isMobile && this.bombState === 'IDLE') {
                this.activateBomb();
            }
        });
    }
    
    activateBomb() {
        this.bombState = 'ACTIVATED';
        this.fuseTimer = 120; // 2 seconds to detonate
        if (window.ASCILINE_AUDIO) window.ASCILINE_AUDIO.play('bombFuse');
    }
    
    explode() {
        this.bombState = 'EXPLODED';
        if (window.ASCILINE_AUDIO) window.ASCILINE_AUDIO.play('bombExplode');

        // 1. Spawn canvas 360-degree explosion sparks
        this.spawnCSSParticles();

        // 2. Hide bomb wrapper
        this.wrapper.style.display = 'none';

        // 3. Instant synchronous shatter of nearby DOM elements, mascots, and bomb itself (Frame 0 momentum blast)
        this.shatterNearbyDOM();

        window.lastExplosionTime = Date.now();

        // Clean up bomb mascot instance
        setTimeout(() => {
            if (typeof this.destroy === 'function') {
                this.destroy();
            } else if (this.wrapper && this.wrapper.parentNode) {
                this.wrapper.parentNode.removeChild(this.wrapper);
            }
            const idx = mascots.indexOf(this);
            if (idx > -1) mascots.splice(idx, 1);
        }, 1000);
    }

    shatterBombSelf(allShards) {
        const bombCenterX = this.x + this.width / 2;
        const bombCenterY = this.y + this.height / 2;
        const text = (this.pre ? (this.pre.textContent || this.pre.innerText) : '').trim() || '( * )💣';
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        // Strictly metallic black / dark charcoal casing colors only (NO RED)
        const colors = ['#1a1a20', '#25252d', '#111116', '#32323e'];
        
        lines.forEach((line, lIdx) => {
            const chunks = line.match(/.{1,6}/g) || [line];
            chunks.forEach((chunk, cIdx) => {
                const shardX = this.x + cIdx * 24;
                const shardY = this.y + lIdx * 14;
                const dx = shardX - bombCenterX || (Math.random() - 0.5) * 30;
                const dy = shardY - bombCenterY || -15;
                const dist = Math.max(10, Math.sqrt(dx * dx + dy * dy));
                const force = 32 + Math.random() * 22;
                const initVx = (dx / dist) * force + (this.vx * 0.4) + (Math.random() - 0.5) * 12;
                const initVy = (dy / dist) * force - (14 + Math.random() * 14);
                
                const styles = {
                    color: colors[Math.floor(Math.random() * colors.length)],
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    fontWeight: 'bold'
                };
                
                const shard = new DomPhysicsObject(
                    chunk, shardX, shardY,
                    Math.max(25, chunk.length * 8), 16,
                    styles, initVx, initVy
                );
                shard.isShatterShard = true;
                if (allShards) allShards.push(shard);
            });
        });
    }

    shatterNearbyDOM() {
        const bombCenterX = this.x + this.width / 2;
        const bombCenterY = this.y + this.height / 2;
        const radius = 380; // Explosion radius in pixels
        
        const containersToShatter = [];
        
        // Phase 1: Find DOM text elements in range
        // MASSIVE OPTIMIZATION: Use pre-calculated global collision cache! 
        // This avoids calling getBoundingClientRect() on 200+ elements per explosion, 
        // completely eliminating synchronous layout thrashing (the main cause of multi-bomb lag!)
        if (window.cachedStaticPlatforms && window.cachedStaticPlatforms.length > 0) {
            const uniqueNodes = new Set();
            window.cachedStaticPlatforms.forEach(plat => {
                const elCx = (plat.left + plat.right) / 2;
                const elCy = (plat.top + plat.bottom) / 2;
                const dist = Math.sqrt(Math.pow(elCx - bombCenterX, 2) + Math.pow(elCy - bombCenterY, 2));
                if (dist < radius) {
                    if (plat.node && plat.node.dataset && plat.node.dataset.shattered !== "true") {
                        uniqueNodes.add(plat.node);
                    }
                }
            });
            uniqueNodes.forEach(node => containersToShatter.push(node));
        } else {
            // Fallback spatial search if cache is empty
            const textContainers = document.querySelectorAll(window.ASCILINE_CONFIG ? window.ASCILINE_CONFIG.destructibleSelectors : 'h1, h2, h3, h4, p, li, button, .price-card, .feature-card');
            textContainers.forEach(container => {
                if (container.closest('.ascii-mascot-wrapper') || 
                    container.closest('#overlay-container') || 
                    container.closest('.widget-player') ||
                    container.closest('#excalibur-zone') ||
                    container.closest('.excalibur-section') ||
                    container.closest('#excalibur-container') ||
                    container.closest('.checkout-overlay')) {
                    return;
                }
                if (container.dataset && container.dataset.shattered === "true") return;
                
                const rect = container.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) return;
                
                const elCx = rect.left + window.scrollX + rect.width / 2;
                const elCy = rect.top + window.scrollY + rect.height / 2;
                
                const dist = Math.sqrt(Math.pow(elCx - bombCenterX, 2) + Math.pow(elCy - bombCenterY, 2));
                if (dist < radius) {
                    containersToShatter.push(container);
                }
            });
        }
        
        // Phase 1.5: Find MASCOTS in range
        this.mascotsToShatter = [];
        mascots.forEach(m => {
            if (m === this || m.isShatterShard) return;
            
            const mCx = m.x + m.width / 2;
            const mCy = m.y + m.height / 2;
            const dist = Math.sqrt(Math.pow(mCx - bombCenterX, 2) + Math.pow(mCy - bombCenterY, 2));
            
            if (dist < radius) {
                const isImmune = (typeof SwordMascot !== 'undefined' && m instanceof SwordMascot) ||
                                 (m.constructor && m.constructor.name === 'SwordMascot');
                if (isImmune) {
                    // Shockwave knockback impulse ONLY if Excalibur has already been pulled out of its shrine!
                    if (!m.isLevitating) {
                        const dx = mCx - bombCenterX;
                        const dy = mCy - bombCenterY;
                        const force = Math.min(50, (9000 / Math.max(25, dist)));
                        m.vx += (dx / (dist || 1)) * force + (Math.random() - 0.5) * 10;
                        m.vy += (dy / (dist || 1)) * force - (14 + Math.random() * 10);
                    }
                } else {
                    this.mascotsToShatter.push(m);
                }
            }
        });

        // Phase 2: Create Physics Shards for DOM Containers and Bomb itself
        const allShards = [];
        this.shatterBombSelf(allShards);
        
        containersToShatter.forEach(container => {
            const rect = container.getBoundingClientRect();
            const styles = window.getComputedStyle(container);
            const originalStyles = {
                color: styles.color,
                fontSize: styles.fontSize,
                fontFamily: styles.fontFamily,
                letterSpacing: styles.letterSpacing,
                fontWeight: styles.fontWeight,
                textTransform: styles.textTransform,
                lineHeight: styles.lineHeight,
                background: styles.background,
                webkitBackgroundClip: styles.webkitBackgroundClip,
                webkitTextFillColor: styles.webkitTextFillColor
            };

            const text = (container.textContent || container.innerText || '').trim();
            if (!text) return;

            const words = text.split(/\s+/).filter(w => w.length > 0);
            if (words.length === 0) return;

            // Chunk words into 2-word groups to halve DOM physics object creation (FPS Boost)
            const wordGroups = [];
            for (let i = 0; i < words.length; i += 2) {
                wordGroups.push(words.slice(i, i + 2).join(' '));
            }

            container.dataset.shattered = "true";
            container.classList.add("shattered-platform");
            container.style.transition = 'none';
            container.style.opacity = '0';
            container.style.pointerEvents = 'none';

            const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
            const scrollY = window.pageYOffset || document.documentElement.scrollTop;

            wordGroups.forEach((chunk, idx) => {
                const wordX = rect.left + scrollX + (idx / Math.max(1, wordGroups.length - 1)) * (rect.width * 0.7);
                const wordY = rect.top + scrollY + Math.random() * (rect.height * 0.5);

                const dx = wordX - bombCenterX;
                const dy = wordY - bombCenterY;
                const distance = Math.max(15, Math.sqrt(dx * dx + dy * dy));

                const force = Math.min(38, (7000 / distance));
                const initVx = (dx / distance) * force + (Math.random() - 0.5) * 10;
                const initVy = (dy / distance) * force - (10 + Math.random() * 8);

                const shard = new DomPhysicsObject(
                    chunk, 
                    wordX, 
                    wordY, 
                    Math.max(30, chunk.length * 9), 
                    Math.max(18, parseFloat(styles.fontSize) || 16), 
                    originalStyles, 
                    initVx, 
                    initVy
                );
                shard.isShatterShard = true;
                allShards.push(shard);
            });
        });

        // Phase 3: Shatter nearby mascots into single-line equal-size colored ASCII shards (Optimized shard count)
        const MAX_BOMB_SHARDS = 45; // Strict upper limit per explosion
        const maxShardsPerMascot = Math.ceil(MAX_BOMB_SHARDS / Math.max(1, this.mascotsToShatter.length));
        const dynamicChunkSize = Math.max(2, Math.floor(this.mascotsToShatter.length * 1.5)); // Scale chunks if many mascots explode

        this.mascotsToShatter.forEach(m => {
            let mascotShardsGenerated = 0;

            if (m.pre) {
                const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
                const scrollY = window.pageYOffset || document.documentElement.scrollTop;
                const compStyle = window.getComputedStyle(m.pre);
                const spans = m.pre.querySelectorAll('span');
                
                if (spans && spans.length > 0) {
                    // Group spans strictly by row line using offsetTop to prevent multi-line vertical stacking!
                    // MASSIVE OPTIMIZATION: Use offsetTop/offsetLeft instead of getBoundingClientRect 
                    // to completely eliminate layout thrashing when hundreds of spans are shattered at once!
                    const rowsMap = new Map();
                    spans.forEach(span => {
                        const width = span.offsetWidth;
                        const height = span.offsetHeight;
                        if (width === 0 || height === 0) return;
                        const rowKey = Math.round(span.offsetTop / 12) * 12;
                        if (!rowsMap.has(rowKey)) rowsMap.set(rowKey, []);
                        rowsMap.get(rowKey).push({ span, offsetLeft: span.offsetLeft, offsetTop: span.offsetTop, width, height });
                    });
                    
                    rowsMap.forEach((rowItems) => {
                        if (mascotShardsGenerated >= maxShardsPerMascot) return;
                        // In each row line, group spans into fine single-line shards
                        const chunkSize = dynamicChunkSize;
                        for (let i = 0; i < rowItems.length; i += chunkSize) {
                            if (mascotShardsGenerated >= maxShardsPerMascot) break;
                            mascotShardsGenerated++;
                            
                            const group = rowItems.slice(i, i + chunkSize);
                            const firstItem = group[0];
                            const shardX = m.x + firstItem.offsetLeft;
                            const shardY = m.y + firstItem.offsetTop;
                            const dx = shardX + firstItem.width / 2 - bombCenterX;
                            const dy = shardY + firstItem.height / 2 - bombCenterY;
                            const dist = Math.max(15, Math.sqrt(dx * dx + dy * dy));
                            const force = Math.min(48, (8500 / dist));
                            const initVx = (dx / dist) * force + (Math.random() - 0.5) * 14;
                            const initVy = (dy / dist) * force - (14 + Math.random() * 12);
                            
                            const groupHTML = group.map(g => g.span.outerHTML).join('');
                            const styles = {
                                color: firstItem.span.style.color || compStyle.color || '#00f3ff',
                                fontSize: compStyle.fontSize || '11px',
                                fontFamily: 'monospace',
                                fontWeight: 'bold',
                                lineHeight: '1',
                                whiteSpace: 'nowrap'
                            };
                            
                            const shard = new DomPhysicsObject(
                                groupHTML, shardX, shardY,
                                Math.max(20, firstItem.width * group.length), Math.max(14, firstItem.height),
                                styles, initVx, initVy
                            );
                            shard.isShatterShard = true;
                            allShards.push(shard);
                        }
                    });
                } else {
                    // Fallback plain ASCII mascot single-line chunking
                    const text = (m.pre.textContent || m.pre.innerText || '').trim();
                    if (text) {
                        const mX = m.x;
                        const mY = m.y;
                        const lines = text.split('\n').filter(l => l.trim().length > 0);
                        lines.forEach((line, lIdx) => {
                            if (mascotShardsGenerated >= maxShardsPerMascot) return;
                            const chunks = line.match(/.{1,3}/g) || [line];
                            chunks.forEach((chunk, cIdx) => {
                                if (mascotShardsGenerated >= maxShardsPerMascot) return;
                                mascotShardsGenerated++;
                                const shardX = mX + cIdx * 18;
                                const shardY = mY + lIdx * 14;
                                const dx = shardX - bombCenterX;
                                const dy = shardY - bombCenterY;
                                const dist = Math.max(15, Math.sqrt(dx * dx + dy * dy));
                                const force = Math.min(45, (8000 / dist));
                                const initVx = (dx / dist) * force + (Math.random() - 0.5) * 12;
                                const initVy = (dy / dist) * force - (14 + Math.random() * 10);
                                
                                const styles = {
                                    color: compStyle.color || '#00f3ff',
                                    fontSize: compStyle.fontSize || '11px',
                                    fontFamily: 'monospace',
                                    fontWeight: 'bold',
                                    whiteSpace: 'nowrap'
                                };
                                const shard = new DomPhysicsObject(
                                    chunk, shardX, shardY,
                                    Math.max(25, chunk.length * 8), 16,
                                    styles, initVx, initVy
                                );
                                shard.isShatterShard = true;
                                allShards.push(shard);
                            });
                        });
                    }
                }
            }
            if (typeof m.destroy === 'function') m.destroy();
            const idx = mascots.indexOf(m);
            if (idx > -1) mascots.splice(idx, 1);
        });
        this.mascotsToShatter = [];

        // Object Pool Cap: Purge oldest shards if total active shards exceed 18 to guarantee 60 FPS
        const existingShards = mascots.filter(m => m.isShatterShard);
        if (existingShards.length > 18) {
            const toRemove = existingShards.slice(0, existingShards.length - 12);
            toRemove.forEach(s => {
                if (typeof s.destroy === 'function') s.destroy();
                const idx = mascots.indexOf(s);
                if (idx > -1) mascots.splice(idx, 1);
            });
        }

        // Add ALL shards (Bomb shards + DOM shards + Mascot shards) IMMEDIATELY to mascots[] for instant Frame 0 momentum blast
        allShards.forEach(shard => {
            mascots.push(shard);
        });

        // Fast Auto-repair & Shard Dissolve after 2.5 seconds (2500ms) for high FPS responsiveness
        setTimeout(() => {
            containersToShatter.forEach(container => {
                if (container) {
                    container.style.transition = 'opacity 0.4s ease-in';
                    if (window.ASCILINE && typeof window.ASCILINE.repairElement === 'function') {
                        window.ASCILINE.repairElement(container);
                    } else {
                        delete container.dataset.shattered;
                        container.classList.remove("shattered-platform");
                        container.style.opacity = "1";
                        container.style.pointerEvents = "";
                    }
                    setTimeout(() => {
                        if (container) container.style.transition = 'none';
                    }, 450);
                }
            });

            allShards.forEach(shard => {
                if (shard.wrapper) {
                    shard.wrapper.style.transition = 'opacity 0.4s ease-out';
                    shard.wrapper.style.opacity = '0';
                }
            });

            setTimeout(() => {
                allShards.forEach(shard => {
                    if (typeof shard.destroy === 'function') shard.destroy();
                    const idx = mascots.indexOf(shard);
                    if (idx > -1) mascots.splice(idx, 1);
                });
                if (typeof buildCollisionCache === 'function') buildCollisionCache();
            }, 450);
        }, 2500);
    }

    spawnCSSParticles() {
        // Dedicated canvas per explosion to prevent concurrent multi-bomb animation loop race conditions
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:fixed; top:0; left:0; pointer-events:none; z-index:99999;';
        // Use viewport size — avoids horizontal scroll leak on mobile and reduces GPU load
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        document.body.appendChild(canvas);
        const ctx = canvas.getContext('2d');

        // Convert to viewport-relative coords (canvas is viewport-sized)
        const bombAbsX = this.x + this.width / 2 - window.scrollX;
        const bombAbsY = this.y + this.height / 2 - window.scrollY;
        const chars = ['*', '#', '+', '!', '@', ':', '.', '%', '$', '&'];
        const colors = ['#ff4500', '#ff8c00', '#ffd700', '#ffffff', '#ff0000', '#00ffcc'];
        
        // Build all particle data upfront (Optimized particle count for 60 FPS)
        const particles = [];
        // High speed outer particles
        for (let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 15 + Math.random() * 35;
            particles.push({
                char: chars[Math.floor(Math.random() * chars.length)],
                color: colors[Math.floor(Math.random() * colors.length)],
                fontSize: 10 + Math.random() * 24,
                x: bombAbsX,
                y: bombAbsY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed, // Perfectly spherical
                vr: (Math.random() - 0.5) * 20,
                rot: 0,
                life: 1.0
            });
        }
        // Dense, slower inner core particles to fill the center
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 12;
            particles.push({
                char: chars[Math.floor(Math.random() * chars.length)],
                color: ['#ffffff', '#ffeb3b', '#ff9800'][Math.floor(Math.random() * 3)],
                fontSize: 14 + Math.random() * 16,
                x: bombAbsX + (Math.random()-0.5)*15,
                y: bombAbsY + (Math.random()-0.5)*15,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed, 
                vr: (Math.random() - 0.5) * 30,
                rot: Math.random() * 360,
                life: 1.0 + Math.random() * 0.5
            });
        }

        let flashAlpha = 1.0;
        const flashRadius = 120;

        let lastTime = performance.now();
        let animId = null;
        
        // Draw first frame synchronously for instant impact
        const drawFrame = (dt, isSync) => {
            const tf = dt * 60;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 1. Draw the flash
            if (flashAlpha > 0) {
                ctx.save();
                const gradient = ctx.createRadialGradient(bombAbsX, bombAbsY, 0, bombAbsX, bombAbsY, flashRadius);
                gradient.addColorStop(0, `rgba(255,255,200,${flashAlpha})`);
                gradient.addColorStop(0.3, `rgba(255,140,0,${flashAlpha * 0.7})`);
                gradient.addColorStop(1, 'rgba(255,60,0,0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(bombAbsX, bombAbsY, flashRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                
                if (!isSync) flashAlpha -= 0.08 * tf;
            }

            // 2. Draw particles
            let alive = 0;
            for (const p of particles) {
                if (p.life <= 0) continue;
                if (!isSync) p.life -= 0.015 * tf;
                if (p.life <= 0) continue;
                alive++;

                if (!isSync) {
                    p.vy += 0.8 * tf; // Gravity
                    p.x += p.vx * tf;
                    p.y += p.vy * tf;
                    p.rot += p.vr * tf;
                }

                ctx.save();
                ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
                ctx.fillStyle = p.color;
                ctx.font = `bold ${p.fontSize}px monospace`;
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot * Math.PI / 180);
                ctx.fillText(p.char, 0, 0);
                ctx.restore();
            }
            
            return alive > 0 || flashAlpha > 0;
        };

        // Draw initial state immediately
        drawFrame(0, true);

        // Continue animation
        const loop = (now) => {
            const dt = Math.min(0.05, (now - lastTime) / 1000);
            lastTime = now;
            
            if (drawFrame(dt, false)) {
                animId = requestAnimationFrame(loop);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                cancelAnimationFrame(animId);
                // Remove canvas from DOM when done
                if (canvas && canvas.parentNode) {
                    canvas.parentNode.removeChild(canvas);
                }
            }
        };
        animId = requestAnimationFrame(loop);
    }

    tick(dt = 1) {
        if (!this.isLoaded) return;

        if (this.bombState === 'EXPLODED') {
            return; 
        }

        // Calculate rolling rotation
        if (this.bombState !== 'EXPLODED' && Math.abs(this.vx) > 0.1) {
            this.rotation += this.vx * 1.5 * dt; 
        }

        if (this.bombState === 'ACTIVATED') {
            this.fuseTimer -= dt;
            
            if (Math.floor(this.fuseTimer) % 8 === 0) {
                this.pre.style.filter = (Math.floor(this.fuseTimer) % 16 === 0) ? 'invert(1) brightness(2)' : 'none';
                this.wrapper.style.transform = `translate3d(${this.x}px, ${this.y}px, 0) scale(1.2) rotate(${this.rotation}deg)`;
            } else {
                this.wrapper.style.transform = `translate3d(${this.x}px, ${this.y}px, 0) scale(1) rotate(${this.rotation}deg)`;
            }

            if (this.fuseTimer <= 0) {
                this.explode();
                return;
            }
        }

        // --- Standard Falling Physics ---
        if (this.isDragging) {
            this.renderFrame(this.animFrame); 
            return;
        }

        this.vy += this.gravity * dt;
        this.vx *= Math.pow(this.friction, dt);
        this.vy *= Math.pow(this.friction, dt);
        
        let nextX = this.x + this.vx * dt;
        let nextY = this.y + this.vy * dt;
        
        if (nextX < 0) {
            nextX = 0;
            this.vx = -this.vx * this.bounce;
        } else if (nextX + this.width > window.innerWidth) {
            nextX = window.innerWidth - this.width;
            this.vx = -this.vx * this.bounce;
        }
        
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
            }
        }
        
        this.x = nextX;
        this.y = nextY;
        
        if (this.bombState !== 'ACTIVATED') {
            this.wrapper.style.transform = `translate3d(${this.x}px, ${this.y}px, 0) rotate(${this.rotation}deg)`;
        }

        this.animTimer += dt;
        if (this.animTimer >= this.frameDelay) {
            this.animFrame = (this.animFrame + 1) % this.frames.length;
            this.animTimer = 0;
        }
        this.renderFrame(this.animFrame);
    }
}

// Global helper to restore shattered text (supports optional selector filtering)
window.restoreShatteredDOM = function(targetSelector = null) {
    if (!targetSelector && window.ASCILINE && typeof window.ASCILINE.repairAll === 'function') {
        window.ASCILINE.repairAll();
        return;
    }
    let containers = Array.from(document.querySelectorAll('[data-shattered="true"], .shattered-platform'));
    if (targetSelector) {
        containers = containers.filter(el => el.matches(targetSelector) || el.closest(targetSelector));
    }
    
    containers.forEach(container => {
        if (window.ASCILINE && typeof window.ASCILINE.repairElement === 'function') {
            window.ASCILINE.repairElement(container);
        } else {
            delete container.dataset.shattered;
            container.classList.remove("shattered-platform");
            container.style.opacity = "1";
            container.style.pointerEvents = "";
        }
    });
    if (typeof buildCollisionCache === 'function') buildCollisionCache();
};
