class GodHand extends SpriteMascot {
    constructor(jsonUrl, width = 120, height = 120, fps = 15, speed = 4, mode = 'hunter') {
        super(jsonUrl, width, height, fps, speed, null);
        
        // Re-parent to document.body so it can go anywhere
        if (this.wrapper.parentElement) {
            this.wrapper.parentElement.removeChild(this.wrapper);
        }
        document.body.appendChild(this.wrapper);

        // Styling the hand
        this.wrapper.style.position = 'absolute';
        this.wrapper.style.zIndex = '99999'; // God level z-index
        this.wrapper.style.pointerEvents = 'none';

        this.pre.style.transformOrigin = 'center left';
        this.pre.style.transition = 'transform 0.15s ease-out';
        
        // Override physics properties
        this.gravity = 0;
        this.bounce = 0;
        this.friction = 1;
        this.vx = 0;
        this.vy = 0;
        this.walkSpeed = speed;
        this.isHand = true;

        // Position off-screen right
        this.x = window.innerWidth + 300;
        this.y = window.innerHeight / 2;

        this.mode = mode;
        this.handState = 'IDLE';
        this.stateTimer = 0; // Immediate activation on spawn!
        this.target = null;
    }

    tick(dt = 1) {
        if (!this.isLoaded) return;
        
        // Update Animation Frame
        this.animTimer += dt;
        if (this.animTimer >= this.frameDelay) {
            this.animTimer = 0;
            if (this.handState === 'IDLE' && this.idleMode === 'freeze') {
                this.animFrame = 0;
            } else {
                this.animFrame = (this.animFrame + 1) % this.frames.length;
            }
        }
        this.renderFrame(this.animFrame);

        if (this.isDragging) return;

        const docWidth = window.innerWidth;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;

        switch (this.handState) {
            case 'IDLE':
                this.stateTimer -= dt;
                if (this.mode === 'hunter') {
                    this.x = docWidth + 300;
                }
                
                if (this.stateTimer <= 0) {
                    const possibleTargets = [];

                    // 1. MASCOT PRIORITY: If active mascots exist on screen, ONLY target real mascots!
                    const activeMascots = mascots.filter(m => {
                        if (!m || m === this || m.isDragging || m.isShatterShard || m.isHand || m instanceof GodHand || m instanceof DomPhysicsObject || (m.constructor && m.constructor.name === 'DomPhysicsObject')) return false;
                        const mTop = m.y - scrollY;
                        return mTop >= -100 && mTop <= window.innerHeight + 100;
                    });

                    if (activeMascots.length > 0) {
                        const randomIndex = Math.floor(Math.random() * activeMascots.length);
                        possibleTargets.push(activeMascots[randomIndex]);
                    } else {
                        // 2. DOM TEXT FALLBACK: Only if NO mascots exist, target visible text in viewport
                        const textEls = document.querySelectorAll('h1 span, h1, h2, h3, p, button, .price-card, .feature-card');
                        textEls.forEach(el => {
                            if (el && el.style.visibility !== 'hidden' && el.style.display !== 'none' && !el.classList.contains('shattered-platform')) {
                                const rect = el.getBoundingClientRect();
                                // Strict viewport boundaries check
                                if (rect.width > 20 && rect.height > 10 && rect.top >= 40 && rect.bottom <= window.innerHeight - 40 && rect.left >= 10 && rect.right <= window.innerWidth - 10) {
                                    possibleTargets.push({
                                        isDOM: true,
                                        node: el,
                                        get x() {
                                            const r = el.getBoundingClientRect();
                                            return r.left + (window.pageXOffset || document.documentElement.scrollLeft);
                                        },
                                        get y() {
                                            const r = el.getBoundingClientRect();
                                            return r.top + (window.pageYOffset || document.documentElement.scrollTop);
                                        },
                                        get width() { return el.getBoundingClientRect().width; },
                                        get height() { return el.getBoundingClientRect().height; },
                                        mutate: () => {
                                            if (el.style.visibility === 'hidden') return;
                                            const liveRect = el.getBoundingClientRect();
                                            const sX = window.pageXOffset || document.documentElement.scrollLeft;
                                            const sY = window.pageYOffset || document.documentElement.scrollTop;

                                            el.style.visibility = 'hidden';
                                            const computedStyle = window.getComputedStyle(el);
                                            const originalStyles = {
                                                color: computedStyle.color,
                                                fontSize: computedStyle.fontSize,
                                                fontFamily: computedStyle.fontFamily,
                                                letterSpacing: computedStyle.letterSpacing,
                                                fontWeight: computedStyle.fontWeight,
                                                textTransform: computedStyle.textTransform,
                                                lineHeight: computedStyle.lineHeight,
                                                background: computedStyle.background,
                                                webkitBackgroundClip: computedStyle.webkitBackgroundClip,
                                                webkitTextFillColor: computedStyle.webkitTextFillColor
                                            };
                                            const fallingText = new DomPhysicsObject(
                                                el.innerHTML || el.textContent, 
                                                liveRect.left + sX, 
                                                liveRect.top + sY, 
                                                liveRect.width, 
                                                liveRect.height,
                                                originalStyles
                                            );
                                            mascots.push(fallingText);
                                        }
                                    });
                                }
                            }
                        });
                    }

                    // 3. Fallback: Target mouse position or center of screen if no targets exist
                    if (possibleTargets.length === 0) {
                        const mouseX = window.ascilineMouseX || (docWidth / 2);
                        const mouseY = window.ascilineMouseY || (scrollY + window.innerHeight / 2);
                        possibleTargets.push({
                            x: mouseX,
                            y: mouseY,
                            width: 20,
                            height: 20,
                            isFallback: true
                        });
                    }
                    
                    if (possibleTargets.length > 0) {
                        this.target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
                        this.handState = 'TARGETING';
                        this.y = this.target.y - 180;
                    } else {
                        this.stateTimer = 30;
                    }
                }
                break;
                
            case 'TARGETING':
                if (!this.target) {
                    this.handState = 'RETREAT';
                    break;
                }
                
                const isMovingLeft = (this.target.vx && this.target.vx < 0);
                const headOffsetX = isMovingLeft ? (this.target.width * 0.1) : (this.target.width * 0.8);
                
                // Track dynamic live x/y position of target
                const targetX = this.target.x + headOffsetX; 
                const targetY = this.target.y - 15;
                
                // Smooth lerp speed
                const lerpSpeed = 0.025 * dt;
                this.x += (targetX - this.x) * Math.min(1.0, lerpSpeed);
                this.y += (targetY - this.y) * Math.min(1.0, lerpSpeed);

                const dx = targetX - this.x;
                const dy = targetY - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Touch trigger distance
                if (dist < 35) {
                    this.handState = 'TOUCH';
                    this.stateTimer = 40; // ~0.7s satisfying poke duration
                    this.animFrame = 0;
                    this.animTimer = 0;
                }
                break;

            case 'TOUCH':
                this.stateTimer -= dt;

                // Visual poke nudge on the hand element
                if (this.pre) {
                    this.pre.style.transform = 'scale(1.25) translate3d(-10px, 10px, 0)';
                }

                if (this.stateTimer <= 0) {
                    // Reset hand transform
                    if (this.pre) this.pre.style.transform = 'scale(1.0)';

                    // Trigger target poke effect
                    if (this.target) {
                        if (typeof this.target.mutate === 'function') {
                            this.target.mutate();
                        } else if (this.target.pre) {
                            // Poke mascot: random hue rotate and upward bounce!
                            const hue = Math.floor(Math.random() * 360);
                            this.target.pre.style.filter = `hue-rotate(${hue}deg) saturate(250%)`;
                            if (typeof this.target.vy !== 'undefined') {
                                this.target.vy = -10;
                            }
                        }
                    }

                    this.target = null;
                    this.handState = 'RETREAT';
                }
                break;

            case 'RETREAT':
                if (this.pre) this.pre.style.transform = 'scale(1.0)';

                // Smooth exit offscreen
                const retreatXSpeed = 0.025 * dt;
                const retreatYSpeed = 0.018 * dt;
                this.x += (docWidth + 300 - this.x) * Math.min(1.0, retreatXSpeed);
                this.y += ((scrollY + window.innerHeight / 2) - this.y) * Math.min(1.0, retreatYSpeed);
                
                if (this.x > docWidth + 180) {
                    // Self-destruct cleanly when exit completed
                    if (typeof this.destroy === 'function') this.destroy();
                    const idx = mascots.indexOf(this);
                    if (idx > -1) mascots.splice(idx, 1);
                }
                break;
        }

        this.updateDOMPosition();
    }
}
