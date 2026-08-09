// Global mouse tracker for aiming
window.ascilineMouseX = window.innerWidth / 2;
window.ascilineMouseY = window.innerHeight / 2;
window.addEventListener("mousemove", (e) => {
  window.ascilineMouseX = e.pageX;
  window.ascilineMouseY = e.pageY;
});

class ProjectilePhysics extends SpriteMascot {
  constructor(x, y, vx, vy) {
    super("assets/mascots/pea_coloranim.json", 25, 25, 10, 0, null);

    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;

    this.gravity = 0.2; // Gravity for normal bullets
    this.bounce = 0.5;
    this.friction = 0.99;
    this.rotation = 0;
    this.lifeTimer = 240; // ~4 seconds at 60fps (was 1200 / 20s)

    this.isProjectile = true;

    // Physics Mechanics
    // 'gravity': Arcs down and bounces (Classic)
    // 'glide': Zero gravity, travels straight like a laser or hover orb
    this.flightMode = "gravity";

    // Merminin kendi ekseni etrafında dönüp dönmeyeceği (takla atması) center
    this.spin = false;

    // Base starting position to calculate sine wave for glide
    this.startY = y;
    this.distanceTraveled = 0;
  }

  tick(dt = 1) {
    if (!this.isLoaded) return;

    this.lifeTimer -= dt;
    if (this.lifeTimer <= 0) {
      if (typeof this.destroy === "function") this.destroy();
      const idx = mascots.indexOf(this);
      if (idx > -1) mascots.splice(idx, 1);
      return;
    }

    // Smooth fade out in the last 1 second before removal
    if (this.wrapper) {
      if (this.lifeTimer < 60) {
        this.wrapper.style.opacity = (this.lifeTimer / 60).toFixed(2);
      } else if (this.wrapper.style.opacity !== "1" && !this.wrapper.classList.contains("mascot-loading")) {
        this.wrapper.style.opacity = "1";
      }
    }

    if (this.isDragging) {
      this.wrapper.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
      return;
    }

    let wobble = 0;

    if (this.flightMode === "gravity") {
      this.vy += this.gravity * dt;
      if (dt === 1) {
        this.vx *= this.friction;
        this.vy *= this.friction;
      } else {
        this.vx *= Math.pow(this.friction, dt);
        this.vy *= Math.pow(this.friction, dt);
      }
    } else if (this.flightMode === "glide") {
      this.distanceTraveled += Math.sqrt(this.vx * this.vx + this.vy * this.vy) * dt;
      wobble = Math.sin(this.distanceTraveled * 0.05) * 8;
    }

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

    if (collision && collision.platform) {
      floorY = collision.top - this.height;
    }

    if (nextY >= floorY) {
      nextY = floorY;
      if (this.vy > 1) {
        this.vy = -this.vy * this.bounce;
        this.vx *= 0.8;
      } else {
        this.vy = 0;
        this.vx *= 0.8;
      }
    }

    this.x = nextX;
    this.y = nextY;

    if (this.spin) {
      this.rotation += this.vx * 2 * dt;
    }

    this.wrapper.style.transform = `translate3d(${this.x}px, ${this.y + wobble}px, 0) rotate(${this.rotation}deg)`;

    this.animTimer += dt;
    if (this.animTimer >= this.frameDelay) {
      this.animFrame = (this.animFrame + 1) % this.frames.length;
      this.animTimer = 0;
    }
    this.renderFrame(this.animFrame);
  }

  // Radius-Culled Collision Detection (Only checks 60px radius around bullet for 95% CPU savings)
  findPlatformCollision() {
    const mascotBottom = this.y + this.height;
    const mascotCenterX = this.x + this.width / 2;
    const docHeight = Math.max(document.body.scrollHeight, window.innerHeight);
    let highestPlatformTop = docHeight;
    let highestPlatform = null;

    const radius = 60;
    const minX = mascotCenterX - radius;
    const maxX = mascotCenterX + radius;
    const minY = this.y - radius;
    const maxY = mascotBottom + 30;

    if (typeof cachedStaticPlatforms !== "undefined") {
      for (const plat of cachedStaticPlatforms) {
        if (!plat.node || !plat.node.isConnected) continue;
        if (plat.top < minY || plat.top > maxY) continue;
        if (plat.right < minX || plat.left > maxX) continue;

        if (
          plat.node.classList.contains("shattered-platform") ||
          plat.node.closest(".shattered-platform")
        )
          continue;
        if (
          plat.node.style.opacity === "0" ||
          plat.node.style.visibility === "hidden" ||
          plat.node.style.display === "none"
        )
          continue;

        if (mascotCenterX >= plat.left && mascotCenterX <= plat.right) {
          if (
            mascotBottom >= plat.top &&
            mascotBottom - Math.max(10, Math.abs(this.vy) * 1.5) <= plat.top + 16 &&
            this.vy >= 0
          ) {
            if (plat.top < highestPlatformTop) {
              highestPlatformTop = plat.top;
              highestPlatform = plat.node;
            }
          }
        }
      }
    }

    if (typeof cachedDynamicElements !== "undefined") {
      for (const el of cachedDynamicElements) {
        if (
          el.classList.contains("shattered-platform") ||
          el.closest(".shattered-platform")
        )
          continue;
        if (el.style.opacity === "0" || el.style.visibility === "hidden")
          continue;

        const rect = el.getBoundingClientRect();
        if (rect.height === 0) continue;
        const absTop = rect.top + window.scrollY;
        if (absTop < minY || absTop > maxY) continue;
        const absLeft = rect.left + window.scrollX;
        const absRight = rect.right + window.scrollX;
        if (absRight < minX || absLeft > maxX) continue;

        if (mascotCenterX >= absLeft && mascotCenterX <= absRight) {
          if (
            mascotBottom >= absTop &&
            mascotBottom - Math.max(10, Math.abs(this.vy) * 1.5) <= absTop + 16 &&
            this.vy >= 0
          ) {
            if (absTop < highestPlatformTop) {
              highestPlatformTop = absTop;
              highestPlatform = el;
            }
          }
        }
      }
    }

    return { platform: highestPlatform, top: highestPlatformTop };
  }
}

class LauncherPhysics extends SpriteMascot {
  constructor(x = 0, y = 0) {
    super("assets/mascots/peashooter_coloranim.json", 60, 60, 33, 0, null); // fps scaled 10*3.33 to match original 200fps animation feel

    this.x = x || window.innerWidth / 2 - 30;
    this.y = y || 100;

    this.gravity = 1.67;  // 0.5 * 3.33 (dt-scaled)
    this.bounce = 0.2;
    this.friction = 0.97;  // dt-scaled equivalent of 0.9 at 200fps

    // Merminin tam olarak fırlatılacağı animasyon karesi (Frame)
    // Eğer GIF'e bağlı atış istenmiyorsa null yapılabilir.
    this.animShootFrame = 33;
    this.hasShotThisLoop = false;

    // Bağımsız Sayaç (Fallback): Eğer animShootFrame null ise veya GIF çok kısaysa bu kullanılır
    this.shootTimer = 0;
    this.shootInterval = 120;

    // Configuration
    // Rotation modes:
    // 'none' : Only flips left/right. (Best for Tanks, Catapults, ground turrets)
    // 'flip' : 360 rotation WITH vertical mirroring so it doesn't go upside-down. (Best for UFOs, Wands, Guns)
    // 'full' : Pure 360 rotation WITHOUT mirroring. (Best for Spheres, Fireballs, Shurikens)
    // 'fixed': No rotation and no flipping at all. Stays perfectly still.
    this.rotationMode = "none";

    // Aiming modes:
    // 'free' : Shoots exactly towards the cursor (360 degrees).
    // 'horizontal' : Shoots only straight left or right, depending on where the cursor is.
    this.aimMode = "horizontal";

    this.isStatic = false; // If true, it hovers/floats where spawned and ignores gravity.
  }

  tick(dt = 1) {
    if (!this.isLoaded) return;

    if (this.isDragging) {
      this.wrapper.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
      return;
    }

    if (!this.isStatic) {
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

      if (collision && collision.platform) {
        floorY = collision.top - this.height;
      }

      if (nextY >= floorY) {
        nextY = floorY;
        if (this.vy > 1) {
          this.vy = -this.vy * this.bounce;
        } else {
          this.vy = 0;
        }
      }

      this.x = nextX;
      this.y = nextY;
    }

    this.wrapper.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;

    this.animTimer += dt;
    if (this.animTimer >= this.frameDelay) {
      this.animFrame = (this.animFrame + 1) % this.frames.length;
      this.animTimer = 0;

      if (this.animFrame === 0) {
        this.hasShotThisLoop = false;
      }
    }

    // Atış Mantığı (Hibrit Sistem)
    // Kullanıcı geçerli bir kare girmişse o karede at, girmemişse sayaca (timer) dön
    if (
      this.animShootFrame !== null &&
      this.animShootFrame < this.frames.length
    ) {
      if (this.animFrame === this.animShootFrame && !this.hasShotThisLoop) {
        this.shoot();
        this.hasShotThisLoop = true;
      }
    } else {
      this.shootTimer += dt;
      if (this.shootTimer >= this.shootInterval) {
        this.shootTimer = 0;
        this.shoot();
      }
    }

    // Aiming visual effect
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const dx = window.ascilineMouseX - cx;
    const dy = window.ascilineMouseY - cy;

    // Calculate angle in degrees
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const flipX = dx < 0 ? "scaleX(-1)" : "scaleX(1)";

    if (this.rotationMode === "flip") {
      const flipY = dx < 0 ? "scaleY(-1)" : "scaleY(1)";
      this.pre.style.transform = `rotate(${angle}deg) ${flipY}`;
    } else if (this.rotationMode === "full") {
      this.pre.style.transform = `rotate(${angle}deg)`;
    } else if (this.rotationMode === "fixed") {
      this.pre.style.transform = `scale(1)`;
    } else {
      // 'none'
      this.pre.style.transform = flipX;
    }

    this.renderFrame(this.animFrame);
  }

  shoot() {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;

    const dx = window.ascilineMouseX - cx;
    const dy = window.ascilineMouseY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    const force = 73.0; // 22.0 * 3.33 — dt-scaled bullet force
    let vx, vy;

    if (this.aimMode === "horizontal") {
      // Tamamen düz atmak yerine, fareye doğru en fazla 15 derece eğimle (yukarı/aşağı) atış yap
      const maxTilt = 14 * (Math.PI / 180); // 14 derece sınır
      let trueAngle = Math.atan2(dy, dx);
      let finalAngle = trueAngle;

      if (dx >= 0) {
        // Sağa bakarken: Açıyı -15 ile +15 arasında sınırla
        finalAngle = Math.max(-maxTilt, Math.min(maxTilt, trueAngle));
      } else {
        // Sola bakarken: Açıyı 165 ile 195 (veya -165 ile -195) arasında sınırla
        if (trueAngle < 0) {
          finalAngle = Math.min(-Math.PI + maxTilt, trueAngle);
        } else {
          finalAngle = Math.max(Math.PI - maxTilt, trueAngle);
        }
      }

      vx = Math.cos(finalAngle) * force;
      vy = Math.sin(finalAngle) * force;
    } else {
      // Fare neredeyse oraya serbest ateş et
      vx = (dx / dist) * force;
      vy = (dy / dist) * force;
    }

    // Pop effect on launcher (Visual feedback while maintaining rotation)
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const flipX = dx < 0 ? "scaleX(-1)" : "scaleX(1)";

    this.pre.style.transition = "transform 0.1s ease-out";

    if (this.rotationMode === "flip") {
      const flipY = dx < 0 ? "scaleY(-1)" : "scaleY(1)";
      this.pre.style.transform = `rotate(${angle}deg) ${flipY} scale(1.3)`;
      setTimeout(() => {
        if (this.pre) {
          this.pre.style.transition = "none";
          this.pre.style.transform = `rotate(${angle}deg) ${flipY} scale(1)`;
        }
      }, 100);
    } else if (this.rotationMode === "full") {
      this.pre.style.transform = `rotate(${angle}deg) scale(1.3)`;
      setTimeout(() => {
        if (this.pre) {
          this.pre.style.transition = "none";
          this.pre.style.transform = `rotate(${angle}deg) scale(1)`;
        }
      }, 100);
    } else if (this.rotationMode === "fixed") {
      this.pre.style.transform = `scale(1.3)`;
      setTimeout(() => {
        if (this.pre) {
          this.pre.style.transition = "none";
          this.pre.style.transform = `scale(1)`;
        }
      }, 100);
    } else {
      // 'none'
      this.pre.style.transform = `${flipX} scale(1.3)`;
      setTimeout(() => {
        if (this.pre) {
          this.pre.style.transition = "none";
          this.pre.style.transform = `${flipX} scale(1)`;
        }
      }, 100);
    }

    // Active Bullet Cap: Keep max 20 projectiles active on screen to protect CPU/memory
    if (typeof mascots !== "undefined") {
      const activeBullets = mascots.filter((m) => m && m.isProjectile);
      if (activeBullets.length >= 20) {
        const oldest = activeBullets[0];
        if (oldest) {
          if (typeof oldest.destroy === "function") oldest.destroy();
          const idx = mascots.indexOf(oldest);
          if (idx > -1) mascots.splice(idx, 1);
        }
      }
    }

    // Spawn bullet
    const bullet = new ProjectilePhysics(cx - 12, cy - 20, vx, vy);
    mascots.push(bullet);
  }
}
