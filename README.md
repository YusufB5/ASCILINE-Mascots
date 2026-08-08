## ASCILINE Mascots 
```text
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

```

> **Bringing Spatial Awareness & Physics to HTML DOM Elements.**

[![Vanilla JS](https://img.shields.io/badge/Dependencies-Zero%20Vanilla%20JS-brightgreen)](https://github.com/YusufB5/ASCILINE-Mascots)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Architecture](https://img.shields.io/badge/Architecture-Spatial%20DOM%20Kinematics-blue)](https://github.com/YusufB5/ASCILINE-Mascots)

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

### Layer 1: Base Physics Engine (`lib/mascot.js`)
* **Kinematic Core**: Implements real-time gravity, velocity vectors (`vx`, `vy`), bouncing, ground friction, and dynamic toss throwing based on pointer drag history.
* **Spatial DOM Sensing**: Uses the native browser **Range API** and `getClientRects()` to map non-destructive text nodes into solid collision platforms without injecting extra DOM wrappers.
* **Universal Hitbox System**: Hosts the base `setCustomHitboxes()` and `renderHitboxOverlay()` methods, enabling any mascot subclass to possess custom spatial hitboxes.

### Layer 2: Sprite & Rendering Engine (`lib/sprite.js`)
* **Matrix Format Processing**: Parses 2D character arrays or HTML color matrix frames exported from GIF Studio.
* **HTML Frame Caching**: Converts matrix rows into efficient HTML `<span>` blocks with inline colors, caching processed HTML strings to minimize garbage collection (GC) pauses.

### Layer 3: Walking Kinematics (`lib/walking_sprite.js`)
* **State Machine**: Handles animation state transitions (Walk, Idle Freeze, Idle Play, Fall, Drag).
* **Directional Flip Sync**: Automatically syncs character sprite orientation (`scaleX(-1)`) and SVG hitbox overlays when the mascot changes direction.

### Layer 4: Hitbox Overlay System
* **Dynamic SVG Layer**: Renders high-precision custom hitboxes over the mascot.
* **Supported Hitbox Types**:
  - `point`: Connected polygon boundary with glowing anchor dots.
  - `rect`: Dashed rectangle boundary.
  - `circle`: Dashed circular boundary.

---

## 🛠️ Studio Editor (`tools/gif_studio.html`)

ASCILINE includes a standalone, browser-based studio editor:

* **Image & GIF Converter**: Import animated GIFs or image sequences directly in the browser.
* **Color Quantization**: Map image colors to custom ASCII character matrices.
* **Interactive Hitbox Designer**: Draw point-by-point polygons, rectangles, or circles directly on top of animation frames.
* **Multi-Format Export**: Export directly to compact `.json` or `.js` data files ready for web integration.

---

## 🚀 Quick Start

### 1. Include ASCILINE Engine Scripts

```html
<!-- Core Engine Scripts -->
<script src="lib/mascot.js"></script>
<script src="lib/sprite.js"></script>
<script src="lib/walking_sprite.js"></script>
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
│   ├── mascot.js          # Base Physics Engine & Spatial DOM Sensing
│   ├── sprite.js          # Matrix Renderer & HTML Frame Formatter
│   ├── walking_sprite.js  # Kinematics State Machine & Directional Flip
│   └── static_mascot.js   # Static Image/Text Mascot Subclass
├── tools/
│   └── gif_studio.html    # GIF-to-ASCII Converter & Hitbox Studio Editor
└── example/
    ├── index.html         # Live Interactive Demo Showcase
    └── assets/            # Exported Mascot Animations & Data
```

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for details.
