<div align="center">

# 🐱 ASCILINE Mascots

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

**Bringing Spatial Awareness & Physics to HTML DOM Elements.**

[![Vanilla JS](https://img.shields.io/badge/Dependencies-Zero%20Vanilla%20JS-brightgreen)](https://github.com/YusufB5/ASCILINE-Mascots)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Architecture](https://img.shields.io/badge/Architecture-Spatial%20DOM%20Kinematics-blue)](https://github.com/YusufB5/ASCILINE-Mascots)

</div>

---

## 🌟 The Essence of ASCILINE

Traditional web applications consist of three fundamental layers: **HTML** (Structure), **CSS** (Presentation), and **JavaScript** (Behavior/Events). In this traditional model, DOM elements (`<h1>`, `<p>`, `<button>`) are static, two-dimensional nodes unaware of spatial physics.

**ASCILINE introduces a 4th Layer to the Web: The Physical & Spatial Interaction Layer.**

ASCILINE turns standard DOM text nodes and UI components into solid physical platforms. Any ASCII, color matrix, or sprite entity can fall, walk, land, bounce, and interact with the actual typography and layout of your website in real-time.

---

## 🏗️ Technical Architecture

ASCILINE is built with a modular, 4-tier object-oriented architecture designed for maximum performance, 60fps physics, and zero external dependencies.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      4. Hitbox & Overlay Layer                         │
│       (SVG Polygon / Point / Rect / Circle Overlay & Alignment)        │
├────────────────────────────────────────────────────────────────────────┤
│                 3. Walking & Kinematics State Machine                  │
│       (Walk, Idle Modes, Auto-Facing Flip, Friction & Gravity)         │
├────────────────────────────────────────────────────────────────────────┤
│                     2. Sprite & Rendering Engine                       │
│     (Matrix Serialization, HTML Span Formatter, Frame Caching)         │
├────────────────────────────────────────────────────────────────────────┤
│                     1. Base Physics Engine & Spatial DOM               │
│    (Range API Platform Scanning, BoundingBox Culling, Drag Dynamics)   │
└────────────────────────────────────────────────────────────────────────┘
```

### Layer 1: Base Physics Engine (`lib/core/mascot.js`)
* **Kinematic Core**: Implements real-time gravity, velocity vectors (`vx`, `vy`), bouncing, ground friction, and dynamic toss throwing based on pointer drag history.
* **Spatial DOM Sensing**: Uses the native browser **Range API** and `getClientRects()` to map non-destructive text nodes into solid collision platforms without injecting extra DOM wrappers.
* **Universal Hitbox System**: Hosts the base `setCustomHitboxes()` and `renderHitboxOverlay()` methods, enabling any mascot subclass to possess custom spatial hitboxes.

### Layer 2: Sprite & Rendering Engine (`lib/core/sprite.js`)
* **Matrix Format Processing**: Parses 2D character arrays or HTML color matrix frames exported from GIF Studio.
* **HTML Frame Caching**: Converts matrix rows into efficient HTML `<span>` blocks with inline colors, caching processed HTML strings to minimize garbage collection (GC) pauses.

### Layer 3: Walking Kinematics (`lib/physics/pure/walking_sprite.js`)
* **State Machine**: Handles animation state transitions (Walk, Idle Freeze, Idle Play, Fall, Drag).
* **Directional Flip Sync**: Automatically syncs character sprite orientation (`scaleX(-1)`) and SVG hitbox overlays when the mascot changes direction.

### Layer 4: Hitbox Overlay System
* **Dynamic SVG Layer**: Renders high-precision custom hitboxes over the mascot.
* **Supported Hitbox Types**:
  - `point`: Connected polygon boundary with glowing anchor dots.
  - `rect`: Dashed rectangle boundary.
  - `circle`: Dashed circular boundary.

---

## 🧬 Class Inheritance Hierarchy

```text
Mascot  (core/mascot.js)
└── SpriteMascot  (core/sprite.js)
    │
    ├── [physics/pure/motion/]   — Locomotion & movement behaviors (directly extend core)
    │   ├── WalkingSpriteMascot   (walking_sprite.js)
    │   ├── StaticMascot          (static_mascot.js)
    │   ├── FlyingMascot          (flyer.js)
    │   ├── SwimmerMascot         (swimmer.js)
    │   ├── SpiderMascot          (spider.js)   ← extends Mascot directly
    │   ├── BouncerMascot         (bouncer.js)
    │   ├── JumperPhysics         (jumper_physics.js)
    │   └── RunnerMascot          (runner_physics.js)
    │
    ├── [physics/pure/action/]   — Weapon, explosion & interaction behaviors (directly extend core)
    │   ├── GodHand               (hand.js)
    │   ├── PokeballMascot        (pokeball.js)
    │   ├── ProjectilePhysics     (launcher_physics.js)
    │   ├── BombPhysics           (bomb_physics.js)
    │   └── SwordMascot           (sword_physics.js)
    │
    ├── [physics/pure/helpers/]  — Pure utility classes used by other physics
    │   └── DomPhysicsObject      (physics_text.js)
    │
    └── [physics/derived/]       — Physics that extend another pure physics class
        └── BlackholePhysics      (blackhole_physics.js) ← extends StaticMascot
```

---

## 🛠️ Studio Editor & CLI Tools (`tools/`)

ASCILINE provides both an in-browser GUI Studio and a suite of Python CLI conversion tools:

* **GIF Studio GUI (`tools/gif_studio.html`)**: Standalone browser editor with live canvas preview, color quantization, crop controls, and visual hitbox designer.
* **CLI Converters (`tools/gif2color.py` & `tools/gif2mascot.py`)**: Command-line converters to turn GIFs into colored HTML matrices or text ASCII JSON files.
* **GIF Utilities (`tools/gif_inspector.py` & `tools/gif_trimmer.py`)**: CLI tools to inspect frame delays, dimensions, and trim frame sequences.
* **Studio Builder (`tools/build_studio.py`)**: Tool for bundling and building standalone Studio assets.

---

## 🚀 Quick Start

### 1. Include ASCILINE Engine Scripts

```html
<!-- Core Engine (always required) -->
<script src="lib/core/mascot.js"></script>
<script src="lib/core/sprite.js"></script>

<!-- Pick a physics behavior (e.g. motion/walking_sprite.js) -->
<script src="lib/physics/pure/motion/walking_sprite.js"></script>
```

### 2. Load Mascot Animation Data

```html
<!-- Load exported ASCII animation data -->
<script src="example/assets/secondcat_data.js"></script>
```

### 3. Initialize Mascot Instance

```javascript
// Configure target platform elements (Optional)
window.ASCILINE_CONFIG = {
    platformSelectors: 'h1, h2, h3, p, button, .platform-card'
};

// Spawn a walking mascot with custom JSON data
const mascot = new WalkingSpriteMascot(window.SECOND_CAT_DATA, 80, 50, 15);

// Add to global physics loop
ASCILINE.getMascots().push(mascot);
```

---

## 📂 Repository Structure

```text
ASCILINE-Mascots/
├── lib/
│   ├── core/                       # Absolute base parent classes (always load first)
│   │   ├── mascot.js               # Kinematic engine, Spatial DOM sensing, Hitbox system
│   │   └── sprite.js               # Matrix renderer, HTML span formatter, Frame caching
│   │
│   ├── physics/
│   │   ├── pure/                   # Directly extend core (Mascot / SpriteMascot)
│   │   │   ├── motion/             # Locomotion behaviors (walk, run, fly, swim, climb, bounce)
│   │   │   ├── action/             # Interactive & combat behaviors (bomb, sword, ball, hand)
│   │   │   └── helpers/            # Shared particle utilities (DomPhysicsObject)
│   │   │
│   │   └── derived/                # Extended from another pure physics class
│   │       └── blackhole_physics.js
│   │
│   ├── interactive/                # Fixed environmental zones (sword_zone.js, water_zone.js)
│   │
│   └── effects/                    # Visual & Audio Effect Managers
│       └── audio/
│           └── audio_manager.js    # Global Audio & Event Bridge
│
├── tools/                          # GIF Studio GUI & Python CLI Tools
└── example/                        # Live interactive demo showcase & assets
```

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for details.
