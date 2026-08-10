class StaticMascot extends SpriteMascot {
    constructor(jsonUrl, width = 100, height = 100, x = window.innerWidth / 2, y = window.innerHeight / 2, fps = 15) {
        // SpriteMascot(jsonUrl, width, height, fps, walkSpeed, route)
        super(jsonUrl, width, height, fps, 0, null);
        
        // Re-parent to document.body so it can be placed anywhere on the page
        if (this.wrapper.parentElement !== document.body) {
            document.body.appendChild(this.wrapper);
        }

        // Initial position
        this.x = x;
        this.y = y;

        // Reset physics
        this.gravity = 0;
        this.bounce = 0;
        this.friction = 1;
        this.vx = 0;
        this.vy = 0;
    }

    tick(dt = 1) {
        if (!this.isLoaded) return;
        
        // Play animation frames only (no walking or falling physics)
        this.animTimer += dt;
        if (this.animTimer >= this.frameDelay) {
            this.animTimer = 0;
            this.animFrame = (this.animFrame + 1) % this.frames.length;
        }
        this.renderFrame(this.animFrame);

        // Update DOM position (If dragged, Mascot base class updates x and y)
        this.updateDOMPosition();
    }
}
