/**
 * ASCILINE MASCOT ENGINE — SpiderMascot
 * =========================================
 * @class SpiderMascot
 * @extends Mascot
 * @architecture Procedural Standalone ASCII Mascot
 * 
 * NOTE FOR DEVELOPERS:
 * This mascot is 100% procedural — it does NOT require any external JSON animation assets.
 * Its body, dynamic swinging web line, and procedural crawling leg animations are
 * generated mathematically in real-time ASCII characters.
 */


// ── SPIDER MASCOT ──
class SpiderMascot extends Mascot {
    constructor() {
        const uniqueId = Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
        const wrapperId = 'spider-wrapper-' + uniqueId;
        const preId = 'spider-pre-' + uniqueId;
        const webId = 'spider-web-' + uniqueId;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'ascii-mascot-wrapper notranslate';
        wrapper.setAttribute('translate', 'no');
        wrapper.id = wrapperId;
        wrapper.style.position = 'absolute';
        wrapper.style.top = '0px';
        wrapper.style.left = '0px';
        wrapper.style.cursor = 'grab';
        wrapper.style.zIndex = '99999';
        wrapper.style.userSelect = 'none';
        wrapper.style.willChange = 'transform';
        
        const web = document.createElement('pre');
        web.className = 'spider-web-line notranslate';
        web.setAttribute('translate', 'no');
        web.id = webId;
        web.style.position = 'absolute';
        web.style.bottom = 'calc(100% - 4px)';
        web.style.left = '50%';
        web.style.transform = 'translateX(-50%)';
        web.style.margin = '0';
        web.style.color = '#7a889b';
        web.style.textShadow = '0 0 1px rgba(0,0,0,0.4), 0 0 2px rgba(255,255,255,0.6)';
        web.style.fontWeight = 'bold';
        web.style.lineHeight = '9px';
        web.style.fontSize = '12px';
        web.style.display = 'none';
        
        const pre = document.createElement('pre');
        pre.className = 'ascii-mascot-pre notranslate';
        pre.setAttribute('translate', 'no');
        pre.id = preId;
        pre.style.margin = '0px';
        pre.style.padding = '0px';
        pre.style.fontFamily = 'monospace';
        pre.style.fontSize = '12px';
        pre.style.lineHeight = '9px';
        pre.style.whiteSpace = 'pre';
        pre.style.display = 'inline-block';
        pre.style.width = 'max-content';
        pre.style.pointerEvents = 'none';
        
        wrapper.appendChild(web);
        wrapper.appendChild(pre);
        document.body.appendChild(wrapper);

        super(wrapperId, preId, 60, 27); // Increased width to fit spider art
        
        this.walkDir = 1;
        this.webDiv = document.getElementById(webId);
        this.targetCeilingY = window.scrollY || 0;
        
        this.ANIM_IDLE = [
            ` //(oo)\\\\ \n ||    || \n \\\\    // `
        ];
        this.ANIM_WALK_LEFT = [
            ` //(oo)\\\\ \n /|    |\\ \n \\\\    // `,
            ` \\\\(oo)// \n ||    || \n //    \\\\ `
        ];
        this.ANIM_WALK_RIGHT = [
            ` \\\\(oo)// \n ||    || \n //    \\\\ `,
            ` //(oo)\\\\ \n /|    |\\ \n \\\\    // `
        ];
        this.ANIM_FALL = [
            ` //(oo)\\\\ \n \\\\    // \n          `
        ];
        this.ANIM_CLIMB_LEFT = [
            ` |  /// \n | (oo) \n |  \\\\\\ `
        ];
        this.ANIM_CLIMB_RIGHT = [
            ` \\\\\\  | \n (oo) | \n ///  | `
        ];
        this.ANIM_HANG = [
            ` \\\\    // \n ||    || \n //(oo)\\\\ `
        ];
        this.ANIM_WEB_PAUSE = [
            `   ||   \n //(oo)\\\\ \n ||    || `
        ];
    }
    
    updateWebVisual() {
        if (this.currentState === 'SHOOT_WEB' || this.currentState === 'PULL_WEB' || this.currentState === 'PAUSE_WEB') {
            const distance = Math.max(0, this.y - this.targetCeilingY);
            if (distance > 0) {
                const charsNeeded = Math.ceil(distance / 9) + 1; // Ceil + 1 to ensure zero gap with body
                this.webDiv.textContent = '|\n'.repeat(charsNeeded);
                this.webDiv.style.height = `${distance}px`;
                this.webDiv.style.display = 'block';
            } else {
                this.webDiv.style.display = 'none';
            }
        } else {
            this.webDiv.style.display = 'none';
        }
    }

    tick(dt = 1) {
        // Reset rotation by default, only override when climbing
        this.pre.style.transform = 'none';

        if (this.isDragging) {
            this.pre.textContent = this.ANIM_FALL[0];
            this.updateWebVisual();
            return;
        }

        if (this.currentState === 'SHOOT_WEB') {
            this.vx = 0;
            this.vy = 0;
            this.updateWebVisual();
            this.stateTimer += dt;
            this.pre.textContent = this.ANIM_IDLE[0];
            if (this.stateTimer > 20) {
                this.currentState = 'PULL_WEB';
                this.stateTimer = 0;
            }
            return;
        }

        if (this.currentState === 'PULL_WEB') {
            // Very rarely take a break so it often pulls straight up
            if (Math.random() < 0.002 * dt && this.y > this.targetCeilingY + 50) {
                this.currentState = 'PAUSE_WEB';
                this.stateTimer = 30 + Math.random() * 60; // Pause for 0.5 - 1.5 seconds
                return;
            }

            this.vx = 0;
            this.vy = -3; // Pull up speed
            this.y += this.vy * dt;
            
            if (this.y <= this.targetCeilingY) {
                this.y = this.targetCeilingY;
                this.vy = 0;
                this.currentState = 'HANG';
                this.stateTimer = 0;
            }
            
            this.updateWebVisual();
            this.updateDOMPosition();
            this.pre.textContent = this.ANIM_WEB_PAUSE[0]; // Same visual as pause while pulling
            return;
        }

        if (this.currentState === 'PAUSE_WEB') {
            this.vx = 0;
            this.vy = 0;
            this.stateTimer -= dt;
            this.updateWebVisual();
            this.pre.textContent = this.ANIM_WEB_PAUSE[0];
            if (this.stateTimer <= 0) {
                this.currentState = 'PULL_WEB';
            }
            return;
        }

        if (this.currentState === 'HANG') {
            this.vx = 0;
            this.vy = 0;
            this.stateTimer += dt;
            // Hide the web string since we reached the top
            this.webDiv.style.display = 'none';
            this.pre.textContent = this.ANIM_HANG[0]; // Upside down!
            if (this.stateTimer > 180) { // Hang for 3 seconds
                this.currentState = 'FALL';
            }
            return;
        }

        if (this.currentState === 'CEILING_WALK') {
            this.vx = this.walkDir * 1.5;
            this.vy = 0;
            this.x += this.vx * dt;
            this.updateDOMPosition();
            
            // Check if ceiling is still there
            const prevY = this.y;
            this.y += 5; // Look slightly below the ceiling
            const newCeil = this.findCeilingAbove();
            this.y = prevY;
            
            if (newCeil !== this.targetCeilingY) {
                // Walked off the edge!
                this.currentState = 'FALL';
                this.pre.style.transform = 'none';
                return;
            }

            this.animTimer += dt;
            const frames = this.vx > 0 ? this.ANIM_WALK_RIGHT : this.ANIM_WALK_LEFT;
            if (this.animTimer > 6) {
                this.animFrame = (this.animFrame + 1) % frames.length;
                this.animTimer = 0;
            }
            this.pre.textContent = frames[this.animFrame];
            this.pre.style.transform = 'rotate(180deg)';

            this.stateTimer += dt;
            
            // Randomly stop walking or change dir
            const rng = Math.random();
            if (rng < 0.005 * dt) {
                this.walkDir = -this.walkDir;
            } else if (rng < 0.01 * dt) {
                this.currentState = 'HANG';
                this.stateTimer = 0;
            } else if (this.stateTimer > 200) { // Max walk time
                this.currentState = 'FALL';
                this.pre.style.transform = 'none';
            }
            
            // Fall if hitting screen edge
            if (this.x < 0 || this.x > window.innerWidth - this.width) {
                this.currentState = 'FALL';
                this.pre.style.transform = 'none';
            }
            return;
        }

        if (this.currentState === 'CLIMB_WALL') {
            this.y += this.vy * dt;
            this.updateDOMPosition();
            
            // Use normal walk animation but rotate it via CSS
            this.animTimer += dt;
            const frames = this.vy > 0 ? this.ANIM_WALK_RIGHT : this.ANIM_WALK_LEFT;
            if (this.animTimer > 6) {
                this.animFrame = (this.animFrame + 1) % frames.length;
                this.animTimer = 0;
            }
            this.pre.textContent = frames[this.animFrame];
            
            // Rotate so it looks like it's facing the wall
            if (this.x < 100) {
                this.pre.style.transform = 'rotate(90deg)';
            } else {
                this.pre.style.transform = 'rotate(-90deg)';
            }
            
            if (this.y < 20 || this.y > window.innerHeight - this.height - 20) {
                this.currentState = 'FALL';
                this.vx = this.x < 100 ? 2 : -2;
            }
            return;
        }

        // Standard Physics
        this.vy += this.gravity * dt;
        this.vx *= Math.pow(this.friction, dt);
        this.vy *= Math.pow(this.friction, dt);
        
        let nextX = this.x + this.vx * dt;
        let nextY = this.y + this.vy * dt;
        
        // Wall climbing detection
        if (nextX < 0) {
            nextX = 0;
            if (Math.abs(this.vx) > 0.5 && this.currentState !== 'CLIMB_WALL') {
                this.currentState = 'CLIMB_WALL';
                this.vy = -2; // Climb up the wall
                this.vx = 0;
                return;
            }
            this.vx = -this.vx * this.bounce;
        } else if (nextX + this.width > window.innerWidth) {
            nextX = window.innerWidth - this.width;
            if (Math.abs(this.vx) > 0.5 && this.currentState !== 'CLIMB_WALL') {
                this.currentState = 'CLIMB_WALL';
                this.vy = -2; // Climb up the wall
                this.vx = 0;
                return;
            }
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
        this.updateWebVisual();
        
        if (landed) {
            if (this.currentState === 'FALL') {
                this.currentState = 'IDLE';
                this.stateTimer = 0;
            }
            this.stateTimer += dt;
            
            // Random Web Shooting
            if (this.currentState === 'IDLE' && Math.random() < 0.001 * dt && this.y > 100) {
                this.currentState = 'SHOOT_WEB';
                this.targetCeilingY = this.findCeilingAbove();
                this.stateTimer = 0;
                return;
            }

            if (this.currentState === 'IDLE') {
                if (this.stateTimer > 80) {
                    this.currentState = 'WALK';
                    this.walkDir = Math.random() > 0.5 ? 1 : -1;
                    this.stateTimer = 0;
                }
            } else if (this.currentState === 'WALK') {
                this.vx = this.walkDir * 1.5; // Spider walks slightly faster
                
                const rng = Math.random();
                if (rng < 0.005 * dt) this.walkDir = -this.walkDir; // Occasional random turn
                else if (rng < 0.02 * dt) { this.currentState = 'IDLE'; this.vx = 0; this.stateTimer = 0; }
            }
        } else {
            this.currentState = 'FALL';
        }
        
        this.animTimer += dt;
        if (this.currentState === 'IDLE') {
            this.pre.textContent = this.ANIM_IDLE[0];
        } else if (this.currentState === 'WALK') {
            const frames = this.walkDir === 1 ? this.ANIM_WALK_RIGHT : this.ANIM_WALK_LEFT;
            if (this.animTimer > 6) {
                this.animFrame = (this.animFrame + 1) % frames.length;
                this.animTimer = 0;
            }
            this.pre.textContent = frames[this.animFrame];
        } else if (this.currentState === 'FALL') {
            this.pre.textContent = this.ANIM_FALL[0];
        }
    }
}

(window.ASCILINE = window.ASCILINE || {}).Physics = window.ASCILINE.Physics || {};
window.ASCILINE.Physics.Spider = SpiderMascot;
