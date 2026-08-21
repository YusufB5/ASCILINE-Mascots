# ASCILINE Developer Guide: Creating Custom Mascot Physics

This guide covers how to develop custom motion behaviors, actions, and physics mechanics for the ASCILINE Mascot Engine.

---

## 1. Architecture Overview: Choosing Your Base Class

Every physics entity in ASCILINE inherits from one of two core classes:

```text
               +-----------------------+
               |     class Mascot      |  (lib/core/mascot.js)
               +-----------+-----------+
                           |
             +-------------+-------------+
             |                         |
             v                         v
+-------------------------+  +-------------------------+
|  Procedural / Standalone|  |   class SpriteMascot    |  (lib/core/sprite.js)
|  (No JSON Asset Needed) |  |  (JSON Animation Based)  |
|  e.g., SpiderMascot     |  |  e.g., Walker, Flyer... |
+-------------------------+  +-------------------------+
```

### When to extend SpriteMascot (Recommended for most mascots)
* Use this when your character uses an exported JSON animation file (color blocks or ASCII text frames).
* Automatically handles frame timing, HTML span rendering, isColored matrix formatting, and SVG <polygon> hitbox rendering.
* Examples: WalkingSpriteMascot, FlyingMascot, JumperPhysics, RunnerMascot, BombPhysics.

### When to extend Mascot directly (Procedural characters)
* Use this when your mascot renders its visual appearance dynamically via mathematical algorithms or pure string generation in JavaScript.
* Rule: Must include @architecture Procedural Standalone ASCII Mascot in the file header JSDoc.
* Example: SpiderMascot (draws procedural ASCII web lines and dynamic leg angles).

---

## 2. Core Physics Lifecycle and Variables

When extending SpriteMascot or Mascot, your class inherits these core state variables:

| Variable | Type | Default | Description |
|---|---|---|---|
| this.x | Number | 0 | Current absolute X position in pixels |
| this.y | Number | 0 | Current absolute Y position in pixels |
| this.vx | Number | 0 | Horizontal velocity vector (pixels/frame) |
| this.vy | Number | 0 | Vertical velocity vector (pixels/frame) |
| this.gravity | Number | 1.33 | Downward gravity acceleration applied during FALL |
| this.bounce | Number | 0.3 | Bouncing energy preservation factor upon collision |
| this.friction | Number | 0.95 | Ground/Air drag deceleration multiplier |
| this.facing | String | 'right' | Orientation: 'left' or 'right' |
| this.isDragging | Boolean | false | true when the user is holding/dragging the mascot |
| this.currentState | String | 'FALL' | State machine state ('IDLE', 'WALK', 'FALL', 'DRAG') |

---

## 3. Spatial DOM Collision API

The engine provides optimized, cached collision detection methods that you can call in your tick() loop:

### Ground / Platform Collision
```javascript
const hit = this.findPlatformCollision();
if (hit.platform) {
    // hit.platform -> The DOM element the mascot landed on
    // hit.top -> The exact absolute top Y coordinate of the surface
    this.y = hit.top - this.height;
    this.vy = 0;
    this.currentState = 'IDLE';
}
```

### Ceiling Collision
```javascript
const ceilingEl = this.findCeilingCollision();
if (ceilingEl) {
    // Mascot bumped head against a ceiling or button
    this.vy = 1.0; // Reverse vertical momentum
}

// Check highest open ceiling space above the mascot
const ceilingY = this.findCeilingAbove();
```

### Viewport and Boundary Constraints
```javascript
// Clamp within screen boundaries
const minX = 0;
const maxX = window.innerWidth - this.width;
if (this.x <= minX) {
    this.x = minX;
    this.vx = Math.abs(this.vx); // Bounce right
    this.facing = 'right';
} else if (this.x >= maxX) {
    this.x = maxX;
    this.vx = -Math.abs(this.vx); // Bounce left
    this.facing = 'left';
}
```

---

## 4. Directional Orientation and Sprite Flipping

To flip your character horizontally without breaking SVG hitboxes or DOM coordinates:

```javascript
// Correct way: set transform on this.wrapper
if (this.facing === 'left') {
    this.wrapper.style.transform = 'scaleX(-1)';
} else {
    this.wrapper.style.transform = 'none';
}
```

---

## 5. Complete Boilerplate: Creating a Hovering Ghost Mascot

```javascript
/**
 * @class HoveringGhostMascot
 * @extends SpriteMascot
 * @description Floats smoothly across DOM elements with gentle sinusoidal hovering.
 */
class HoveringGhostMascot extends SpriteMascot {
    constructor(jsonUrlOrData, width = 80, height = 50, fps = 15, hoverSpeed = 2.0) {
        super(jsonUrlOrData, width, height, fps);
        
        this.hoverSpeed = hoverSpeed;
        this.hoverAngle = 0;
        this.baseHoverY = this.y;
        this.facing = 'right';
    }

    tick(dt = 1) {
        // Skip physics while user is dragging
        if (this.isDragging) {
            this.baseHoverY = this.y;
            return;
        }

        // Horizontal patrol movement
        this.x += (this.facing === 'right' ? this.hoverSpeed : -this.hoverSpeed) * dt;

        // Sinusoidal floating wave
        this.hoverAngle += 0.05 * dt;
        this.y = this.baseHoverY + Math.sin(this.hoverAngle) * 15;

        // Screen edge bounce
        if (this.x <= 0) {
            this.x = 0;
            this.facing = 'right';
            this.wrapper.style.transform = 'none';
        } else if (this.x + this.width >= window.innerWidth) {
            this.x = window.innerWidth - this.width;
            this.facing = 'left';
            this.wrapper.style.transform = 'scaleX(-1)';
        }

        // Commit position to DOM
        this.updateDOMPosition();
    }
}
```

---

## 6. Registering and Spawning Your Custom Physics

Register your new class into `ASCILINE.Physics` and `MASCOT_REGISTRY` dynamically:

### Step 1: Attach to `ASCILINE.Physics` (Best Practice)
At the bottom of your custom physics file, register the class onto the `ASCILINE.Physics` namespace so it is globally discoverable:

```javascript
(window.ASCILINE = window.ASCILINE || {}).Physics = window.ASCILINE.Physics || {};
window.ASCILINE.Physics.Ghost = HoveringGhostMascot;
```

### Step 2: Register into `MASCOT_REGISTRY`
```javascript
ASCILINE.registerMascot('ghost', {
    get_class: () => ASCILINE.Physics.Ghost,
    args: ['ghost_coloranim.json', 80, 50, 15, 2.5]
});

// Spawn instantly anywhere on your site!
ASCILINE.spawn('ghost');
```

---

## 7. Best Practice: Animation FPS & Kinematic Velocity Sync

### Asset Compilation FPS (Data Shell) vs. Runtime Engine FPS
* **Compilation FPS (Temporal Subsampling):** When exporting from GIF Studio or CLI tools (`gif2color.py`, `gif2text.py`), target FPS dictates frame decimation.
  - Setting a **lower FPS (e.g. 5 FPS)** drops redundant frames to drastically reduce JSON file size while preserving motion duration (retro / stop-motion aesthetic).
  - Setting a **higher FPS than original (e.g. 40 FPS on a 10-frame GIF)** causes the engine to cycle through all available frames in a fraction of a second, producing an ultra-fast (hyper-speed) playback loop.
* **Synchronize Step Rate with `walkSpeed`:** If you increase the animation playback rate (`fps = 30`), proportionally scale your movement speed (`this.vx = 4.0`) to avoid "ice-skating" (foot-sliding) visual artifacts.
* **Dynamic Speed Transitions:** When accelerating or sprinting (e.g., in `RunnerMascot`), dynamically scale the internal animation frame timer:
  ```javascript
  // Proportional animation speed matching current horizontal momentum
  const currentSpeed = Math.abs(this.vx);
  this.frameInterval = Math.max(30, 1000 / (this.fps * (currentSpeed / this.baseSpeed)));
  ```
* **State Decoupling:** Keep physics velocity updates (`this.x += this.vx * dt`) tied to the 60fps game loop, while letting visual frame switches advance on their independent FPS timer.