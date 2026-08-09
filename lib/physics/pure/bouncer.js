class BouncerMascot extends SpriteMascot {
    constructor(jsonUrl = '/assets/mascots/baseball_coloranim.json', width = 90, height = 90, fps = 15) {
        super(jsonUrl, width, height, fps);
        
        // Physics - High momentum, low friction, high bounce
        this.gravity = 0.6;
        this.friction = 0.995; 
        this.bounce = 0.95; 
        
        // Initial toss
        this.vx = (Math.random() - 0.5) * 15;
        this.vy = (Math.random() - 0.5) * 10 - 10;
        this.rot = 0;
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
        
        let didBounce = false;

        // Walls
        if (nextX < 0) {
            nextX = 0;
            if (Math.abs(this.vx) > 2) didBounce = true;
            this.vx = Math.abs(this.vx) * this.bounce;
        } else if (nextX + this.width > window.innerWidth) {
            nextX = window.innerWidth - this.width;
            if (Math.abs(this.vx) > 2) didBounce = true;
            this.vx = -Math.abs(this.vx) * this.bounce;
        }
        
        // Ceiling (Viewport Top)
        let ceilY = window.scrollY;
        if (nextY <= ceilY) {
            nextY = ceilY;
            if (Math.abs(this.vy) > 2) didBounce = true;
            this.vy = Math.abs(this.vy) * this.bounce;
        }
        
        // Floor and Platforms
        let floorY = window.scrollY + window.innerHeight - this.height;
        const collision = this.findPlatformCollision();
        
        if (collision && collision.platform) {
            floorY = collision.top - this.height;
        }
        
        // Special floor bounce behavior
        if (nextY >= floorY) {
            nextY = floorY;
            if (Math.abs(this.vy) > 2) didBounce = true;
            this.vy = -Math.abs(this.vy) * this.bounce;
            
            // Prevent getting permanently stuck rolling at very low velocity
            if (Math.abs(this.vx) < 1.0 && Math.abs(this.vy) < 1.0) {
                 this.vx += (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random());
                 this.vy -= 2 + Math.random() * 3;
            }
        }
        
        if (didBounce && window.ASCILINE_AUDIO) {
            window.ASCILINE_AUDIO.play('bouncerBounce');
        }
        
        this.x = nextX;
        this.y = nextY;
        
        // Rolling effect
        this.rot += this.vx * 2.5 * dt;
        this.pre.innerHTML = this.frames[this.animFrame];
        this.pre.style.transform = `rotate(${this.rot}deg)`;
        
        this.updateDOMPosition();
    }
}
