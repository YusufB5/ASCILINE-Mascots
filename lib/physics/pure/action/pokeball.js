class PokeballMascot extends SpriteMascot {
    constructor(jsonUrl = 'assets/mascots/pokeball_coloranim.json', width = 90, height = 90, fps = 24) {
        super(jsonUrl, width, height, fps);
        
        // Physics - High momentum, low friction, high bounce
        this.gravity = 0.6;
        this.friction = 0.995; 
        this.bounce = 0.8; 
        
        // Initial toss
        this.vx = (Math.random() - 0.5) * 15;
        this.vy = (Math.random() - 0.5) * 10 - 10;
        this.rot = 0;
        
        this.hasCaught = false; // Prevents catching multiple mascots
        this.isDestroyed = false;
        
        // Spawn wild pokemon! (Safely check if Pokeball wasn't recycled in the meantime)
        this.spawnTimeout = setTimeout(() => {
            if (this.isDestroyed || !this.wrapper || !this.wrapper.isConnected) return;
            if (window.ASCILINE) {
                const pokes = ['pikachu', 'jumpluff', 'flyerpokemon'];
                const randomPoke = pokes[Math.floor(Math.random() * pokes.length)];
                window.ASCILINE.spawn(randomPoke);
            }
        }, 100);
    }

    destroy() {
        this.isDestroyed = true;
        if (this.spawnTimeout) {
            clearTimeout(this.spawnTimeout);
            this.spawnTimeout = null;
        }
        if (typeof super.destroy === 'function') {
            super.destroy();
        } else if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.parentNode.removeChild(this.wrapper);
        }
    }
    
    checkCatch() {
        if (this.hasCaught || this.isDragging) return;
        
        const allMascots = window.ASCILINE.getMascots();
        
        for (let m of allMascots) {
            // Don't catch itself, other pokeballs, blackholes, Excalibur sword, or shatter shards
            if (m === this || m instanceof PokeballMascot || m.isBlackhole || (m.constructor && (m.constructor.name === 'BlackholePhysics' || m.constructor.name === 'SwordMascot')) || m.isSword || m.isShatterShard) continue;
            
            // AABB Collision Detection
            if (this.x < m.x + m.width &&
                this.x + this.width > m.x &&
                this.y < m.y + m.height &&
                this.y + this.height > m.y) {
                    
                // Caught!
                this.hasCaught = true;
                
                // Visual catch effect
                this.vx = 0;
                this.vy = -5; // Small jump
                this.gravity = 1.5; // Fall fast
                this.rot = 0;
                this.rot = 0;
                // Add a cute wiggle and flash animation
                this.pre.style.animation = 'pokeball-wiggle 1s ease-in-out, pokeball-flash 0.8s ease-out';
                
                // Remove the wild pokemon
                window.ASCILINE.removeMascot(m);
                
                // Play a catch log
                console.log(`[ASCILINE] Pokeball caught a wild mascot!`);
                break;
            }
        }
    }
    
    tick(dt = 1) {
        if (!this.isLoaded) return;
        
        // Handle animation frame mapping
        this.animTimer += dt;
        if (this.animTimer > this.frameDelay) {
            this.animFrame = (this.animFrame + 1) % this.frames.length;
            this.animTimer = 0;
        }

        if (this.isDragging) {
            this.pre.innerHTML = this.frames[this.animFrame];
            this.pre.style.transform = `scale(1.2)`;
            this.rot = 0;
            return;
        }
        
        this.vy += this.gravity * dt;
        this.vx *= Math.pow(this.friction, dt);
        this.vy *= Math.pow(this.friction, dt);
        
        let nextX = this.x + this.vx * dt;
        let nextY = this.y + this.vy * dt;
        
        // Walls
        if (nextX < 0) {
            nextX = 0;
            this.vx = Math.abs(this.vx) * this.bounce;
        } else if (nextX + this.width > window.innerWidth) {
            nextX = window.innerWidth - this.width;
            this.vx = -Math.abs(this.vx) * this.bounce;
        }
        
        // Ceiling
        let ceilY = window.scrollY;
        if (nextY <= ceilY) {
            nextY = ceilY;
            this.vy = Math.abs(this.vy) * this.bounce;
        }
        
        // Floor and Platforms
        let floorY = window.scrollY + window.innerHeight - this.height;
        const collision = this.findPlatformCollision();
        
        if (collision && collision.platform) {
            floorY = collision.top - this.height;
        }
        
        if (nextY >= floorY) {
            nextY = floorY;
            this.vy = -Math.abs(this.vy) * this.bounce;
            
            // If caught, decay speed extremely fast so it rests on the floor
            if (this.hasCaught) {
                this.vx *= 0.5;
                if (Math.abs(this.vy) < 2) this.vy = 0;
            } else {
                // Keep rolling if active
                if (Math.abs(this.vx) < 1.0 && Math.abs(this.vy) < 1.0) {
                    this.vx += (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random());
                    this.vy -= 2 + Math.random() * 3;
                }
            }
        }
        
        this.x = nextX;
        this.y = nextY;
        
        // Check for capturing pokemon!
        this.checkCatch();
        
        // Rolling effect
        if (!this.hasCaught) {
            this.rot += this.vx * 2.5 * dt;
            this.pre.style.transform = `rotate(${this.rot}deg)`;
        } else {
            this.pre.style.transform = `rotate(0deg)`; // Reset rotation when caught
        }
        
        this.pre.innerHTML = this.frames[this.animFrame];
        this.updateDOMPosition();
    }
}
