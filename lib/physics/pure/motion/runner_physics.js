class RunnerMascot extends SpriteMascot {
    constructor(jsonUrl, width = 100, height = 70, fps = 15, speed = 3) {
        super(jsonUrl, width, height, fps);
        this.speed = speed;
        this.dir = Math.random() > 0.5 ? 1 : -1;
        
        // Ensure the sprite starts at floor level
        this.y = window.scrollY + window.innerHeight - this.height;
        this.x = Math.random() * (window.innerWidth - this.width);
        
        // Physics for jumping if needed, but mostly walking
        this.vy = 0;
        this.gravity = 0.5;
    }

    tick(dt = 1) {
        if (!this.isLoaded) return;
        
        // Animation
        this.animTimer += dt;
        if (this.animTimer > this.frameDelay) {
            this.animFrame = (this.animFrame + 1) % this.frames.length;
            this.animTimer = 0;
        }
        
        // Drag logic
        if (this.isDragging) {
            this.renderFrame(this.animFrame);
            this.vy = 0;
            return;
        }

        // After being thrown: sync direction from velocity (only if meaningful momentum)
        // Threshold is intentionally high so a gentle drop doesn't flip the runner mid-stride
        if (Math.abs(this.vx) > 2.0) {
            this.dir = this.vx > 0 ? 1 : -1;
        }

        // Horizontal Movement
        this.x += this.speed * this.dir * dt;
        
        // Screen Wrap (run off right -> enter from left)
        if (this.dir === 1 && this.x > window.innerWidth) {
            this.x = -this.width;
        } else if (this.dir === -1 && this.x + this.width < 0) {
            this.x = window.innerWidth;
        }

        // Vertical Gravity (keep on floor or platforms)
        this.vy += this.gravity * dt;
        this.y += this.vy * dt;
        
        let floorY = window.scrollY + window.innerHeight - this.height;
        const collision = this.findPlatformCollision();
        
        if (collision && collision.platform) {
            floorY = collision.top - this.height;
        }
        
        if (this.y >= floorY) {
            this.y = floorY;
            this.vy = 0;
        }

        // Sync walkDir for base SpriteMascot transform handling (flip + drag box)
        this.walkDir = this.dir;
        this.renderFrame(this.animFrame);
        this.updateDOMPosition();
    }
}
