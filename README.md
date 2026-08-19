<div align="center">

# ASCILINE Mascots

<pre>
       _                        
       \`*-.                    
        )  _`-.                 
       .  : `. .                
       : _   '  \               
       ; *` _.   `*-._          
       `-.-'          `-.       
         ;       `       `.     
         :.       .        \    
         . \  .   :   .-'   .   
         '  `+.;  ;  '      :   
         :  '  |    ;       ;-. 
         ; '   : :`-:     _.`* ;
      .*' /  .*' ; .*`- +'  `*' 
      `*-*   `*-*  `*-*'
</pre>

**Bringing Spatial Awareness and Kinematics to HTML DOM Elements.**

[![Vanilla JS](https://img.shields.io/badge/Dependencies-Zero%20Vanilla%20JS-brightgreen)](https://github.com/YusufB5/ASCILINE-Mascots)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Architecture](https://img.shields.io/badge/Architecture-Spatial%20DOM%20Kinematics-blue)](https://github.com/YusufB5/ASCILINE-Mascots)

</div>

---

## 1. Philosophy: The Living Interaction Layer of the Web

Traditional web applications consist of three fundamental layers:
* **HTML:** Structure and semantics.
* **CSS:** Visual styling and responsive layout.
* **JavaScript:** Behavior, logic, and event handling.

In this standard model, DOM elements (`<h1>`, `<p>`, `<button>`) are static, two-dimensional surfaces oblivious to physical space and entity interactions.

**ASCILINE Mascots introduces The Living Interaction Layer to the Web.**

The engine turns standard text nodes and UI components into solid physical collision platforms using non-destructive browser APIs (`Range API`) without injecting wrapper tags or altering page SEO. Mascots patrol headings, jump across buttons, fall with real-time gravity, bounce off boundaries, and can be tossed via pointer momentum.

---

## 2. Technical Architecture

ASCILINE Mascot Engine is built on a modular 4-tier object-oriented architecture designed for 60fps execution and zero external runtime dependencies.

```text
+------------------------------------------------------------------------+
|                      4. Hitbox & Overlay Layer                         |
|   (SVG Closed Polygon / Multi-Point / Rect / Circle Adaptive Overlay)  |
+------------------------------------------------------------------------+
|                 3. Kinematics & Locomotion Behaviors                   |
|   (Walker AI, Flyer, Jumper, Runner, Swimmer, Bouncer, Bomb, Spider)   |
+------------------------------------------------------------------------+
|                     2. Sprite & Rendering Engine                       |
| (Feature-Preserving Block Resampling, Frame Compositing, Span Cache)   |
+------------------------------------------------------------------------+
|                  1. Core Engine & Spatial DOM Kinematics               |
| (Range API Platform Sensing, Dynamic Cache Culling, Momentum Drag)     |
+------------------------------------------------------------------------+
```

### Layer 1: Base Physics Engine (`lib/core/mascot.js`)
* **Spatial DOM Sensing:** Uses native `document.createRange()` and `getClientRects()` to map non-destructive text nodes into solid collision platforms.
* **Dynamic Platform Caching:** Maintains `cachedStaticPlatforms` and `cachedDynamicElements` arrays with automatic `window.resize` recalculation.
* **Momentum Kinematics:** Tracks pointer movement in `dragHistory` (last 5 points) to compute dynamic release velocity vectors (`vx`, `vy`).
* **Accessibility Shield:** Holding `Alt` or pressing `Ctrl+A` activates `mascot-select-mode` to preserve underlying text selection.
* **Dual Budget Shield:** Prevents performance degradation via configurable credit and count limits (`ASCILINE_MAX_CREDITS`, `ASCILINE_MAX_COUNT`).

### Layer 2: Sprite & Matrix Renderer (`lib/core/sprite.js`)
* **Matrix Format Processing:** Parses 2D character arrays and HTML color matrix frames exported from GIF Studio.
* **Frame Compositing:** Pre-composites GIF frames to prevent ghosting artifacts across frame disposal states.
* **Feature-Preserving Resampling:** Prioritizes micro-details (e.g., character eyes) during grid downscaling.
* **HTML Frame Caching:** Converts matrix rows into efficient HTML `<span>` blocks with inline colors, caching processed HTML strings to minimize garbage collection pauses.

### Layer 3: Locomotion Spectrum
* **Walking AI (`WalkingSpriteMascot`):** Smooth acceleration, platform edge awareness, turn states, and step speed synchronization.
* **Flight (`FlyingMascot`):** Sinusoidal altitude drift, boundary reflection, and dynamic banking.
* **Jumping (`JumperPhysics`):** Charge squish and ballistic parabolic arcs.
* **Running (`RunnerMascot`):** High-speed sprints with extended stopping friction.
* **Swimming (`SwimmerMascot`):** Buoyancy stabilization and water surface detection.
* **Bouncing (`BouncerMascot`):** High kinetic restitution rebounds.
* **Combat & Action (`BombPhysics`):** Velocity-activated fuse timers and DOM shattering (`DomPhysicsObject`).
* **Procedural (`SpiderMascot`):** Real-time procedural ASCII web lines and trigonometric crawling physics.

### Layer 4: Hitbox Overlay System
* Renders real-time SVG overlays (`<polygon>`, `<rect>`, `<circle>`) that mirror automatically on direction change (`scaleX(-1)`).

---

## 3. Quick Start

### 1. Include Engine Scripts

```html
<!-- Core Engine -->
<script src="lib/core/mascot.js"></script>
<script src="lib/core/sprite.js"></script>

<!-- Locomotion Behaviors -->
<script src="lib/physics/pure/motion/walking_sprite.js"></script>
<script src="lib/physics/pure/motion/flyer.js"></script>
```

### 2. Configure and Spawn Mascots

```javascript
// 1. Configure asset directory
ASCILINE.baseAssetUrl = 'assets/mascots/';

// 2. Configure collision platforms (Optional)
window.ASCILINE_CONFIG = {
    platformSelectors: 'h1, h2, h3, p, button, .platform-card'
};

// 3. Spawn registered mascots
ASCILINE.spawn('walker_cat');
ASCILINE.spawn('flying_cat');
```

---

## 4. Creating Custom Mascots

### Method A: Creating Sprite Mascots (via GIF Studio)

1. Open `tools/gif_studio.html` in any browser.
2. Drag and drop your animated GIF.
3. Configure column resolution (e.g., `80` cols) and Idle frame settings.
4. Select **Polygon Area** and click character outlines to define closed hitboxes.
5. Click **Export Mascot JSON**.
6. Register and spawn in your application:

```javascript
ASCILINE.registerMascot('my_mascot', {
    get_class: () => WalkingSpriteMascot,
    args: ['my_mascot_coloranim.json', 80, 50, 15, 2]
});

ASCILINE.spawn('my_mascot');
```

### Method B: Writing Custom Physics Behaviors

To implement novel physics (e.g., floating ghosts, wall climbing, gravity inversion), read the developer guide:

👉 [**Custom Physics Developer Guide (docs/CUSTOM_PHYSICS_GUIDE.md)**](docs/CUSTOM_PHYSICS_GUIDE.md)

---

## 5. Repository Structure

```text
ASCILINE-Mascots/
├── lib/
│   ├── core/                       # Core engine classes (mascot.js, sprite.js)
│   ├── physics/
│   │   ├── pure/
│   │   │   ├── motion/             # Locomotion (walking_sprite, flyer, jumper, runner, spider...)
│   │   │   ├── action/             # Interactive & combat (bomb_physics, sword_physics, pokeball...)
│   │   │   └── helpers/            # Particle & DOM shatter utilities (physics_text.js)
│   │   └── derived/                # Extended physics zones (blackhole_physics.js)
│   ├── interactive/                # Environmental trigger zones (sword_zone.js)
│   └── effects/                    # Audio & visual effect bridges
├── tools/                          # GIF Studio GUI and Python CLI tools
├── docs/                           # Developer guides (CUSTOM_PHYSICS_GUIDE.md)
└── example/                        # Interactive demo sandbox & assets
```

---

## 6. License

Distributed under the **MIT License**. See `LICENSE` for details.
