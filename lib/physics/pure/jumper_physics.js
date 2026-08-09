class JumperPhysics extends SpriteMascot {
  constructor(jsonUrl = "assets/mascots/slime_coloranim.json", width = 80, height = 80, fps = 15, x = null, y = null, customConfig = null) {
    super(jsonUrl, width, height, fps, 0, null);
    
    if (x === 'center') {
        this.x = window.innerWidth / 2 - this.width / 2;
    } else if (x !== null) {
        this.x = x;
    }

    if (y === 'bottom') {
        this.y = window.scrollY + window.innerHeight - this.height - 20;
    } else if (y !== null) {
        this.y = y;
    }

    this.friction = 0.935;
    this.bounce = 0.6;

    this.jumperState = "JUMPING";
    this.stateTimer = 0;
    this.squishAmount = 1;
    this.stretchAmount = 1;

    this.allowSquish = true;
    
    this.jumpPowerY = customConfig && customConfig.jumpPowerY ? customConfig.jumpPowerY : 33;
    this.jumpFreqTimer = customConfig && customConfig.jumpFreqTimer ? customConfig.jumpFreqTimer : 40;
    this.squishFactor = customConfig && customConfig.squishFactor !== undefined ? customConfig.squishFactor : 1.0;

    // Random color tint for slime (only for default slime, not jumpluff)
    if (!jsonUrl || jsonUrl.includes('slime')) {
        const colors = [
            null,                          // original green
            'hue-rotate(120deg)',           // red/orange
            'hue-rotate(180deg) saturate(1.4)', // blue
            'hue-rotate(-60deg) saturate(1.2)'  // red
        ];
        const picked = colors[Math.floor(Math.random() * colors.length)];
        if (picked) {
            setTimeout(() => { if (this.wrapper) this.wrapper.style.filter = picked; }, 50);
        }
    }
  }

  tick(dt = 1) {
    if (!this.isLoaded) return;

    if (this.isDragging) {
      this.jumperState = "CHARGING";
      this.wrapper.style.transform = `translate3d(${this.x}px, ${this.y}px, 0) scale(1.1, 0.9)`;
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
      if (this.vy > 3) {
        this.vy = -this.vy * (this.bounce * 0.5);
        this.jumperState = "IDLE_SQUISH";
        this.stateTimer = 0;
      } else {
        this.vy = 0;
        landed = true;
      }
    }

    this.x = nextX;
    this.y = nextY;

    // Custom Jumper State Machine
    if (landed) {
      this.vx *= Math.pow(0.9, dt);

      if (
        this.jumperState !== "IDLE_SQUISH" &&
        this.jumperState !== "CHARGING"
      ) {
        this.jumperState = "IDLE_SQUISH";
        this.stateTimer = 0;
      }

      this.stateTimer += dt;

      if (this.jumperState === "IDLE_SQUISH") {
        this.squishAmount = 1.2 + Math.sin(this.stateTimer * 0.2) * 0.1 * this.squishFactor;
        this.stretchAmount = 0.8 - Math.sin(this.stateTimer * 0.2) * 0.1 * this.squishFactor;

        if (this.stateTimer > this.jumpFreqTimer) {
          this.jumperState = "CHARGING";
          this.stateTimer = 0;
        }
      } else if (this.jumperState === "CHARGING") {
        this.squishAmount = 1.4 * this.squishFactor + (1 - this.squishFactor);
        this.stretchAmount = 0.6 * this.squishFactor + (1 - this.squishFactor);

        if (this.stateTimer > 15) {
          // JUMP!
          this.vy = -this.jumpPowerY - Math.random() * 9;
          this.vx = (Math.random() - 0.5) * 28;
          this.jumperState = "JUMPING";
          this.stateTimer = 0;
          if (window.ASCILINE_AUDIO) window.ASCILINE_AUDIO.play('slimeJump');
        }
      }
    } else {
      // In the air
      this.jumperState = "JUMPING";
      const stretchVel = Math.max(-1, Math.min(this.vy * 0.05, 1));
      this.squishAmount = 1 + (stretchVel * this.squishFactor);
      this.stretchAmount = 1 - (stretchVel * this.squishFactor);

      this.squishAmount = Math.max(0.6, Math.min(this.squishAmount, 1.1));
      this.stretchAmount = Math.max(0.9, Math.min(this.stretchAmount, 1.5));
    }

    // Apply scale transforms if squish is enabled
    if (this.allowSquish) {
      this.wrapper.style.transformOrigin = "50% 100%";
      this.wrapper.style.transform = `translate3d(${this.x}px, ${this.y}px, 0) scale(${this.squishAmount}, ${this.stretchAmount})`;
    } else {
      this.wrapper.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
    }

    // Animation loop
    this.animTimer += dt;
    if (this.animTimer >= this.frameDelay) {
      this.animFrame = (this.animFrame + 1) % this.frames.length;
      this.animTimer = 0;
    }

    // Flip based on velocity
    if (this.vx > 1) {
      this.pre.style.transform = "scaleX(-1)";
    } else if (this.vx < -1) {
      this.pre.style.transform = "scaleX(1)";
    }

    this.renderFrame(this.animFrame);
  }
}
