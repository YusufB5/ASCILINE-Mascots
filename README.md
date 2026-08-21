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

<p align="center">
  <a href="https://github.com/YusufB5/ASCILINE-Mascots"><img src="https://img.shields.io/badge/Dependencies-Zero%20Vanilla%20JS-brightgreen" alt="Vanilla JS" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <a href="https://github.com/YusufB5/ASCILINE-Mascots"><img src="https://img.shields.io/badge/Architecture-Spatial%20DOM%20Kinematics-blue" alt="Architecture" /></a>
</p>

<p align="center">
  <a href="https://yusufb5.github.io/ASCILINE-Mascots/example/"><strong>🎮 Try Live Interactive Demo</strong></a>
</p>

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
|                 3. Kinematics & Locomotion State Machine               |
|   (Modular Lifecycle, State Machine, Organic Acceleration & Velocity)  |
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
* **Matrix Format Processing:** Parses 2D character arrays and HTML color matrix frames generated via the in-browser GIF Studio or Python CLI conversion tools.
* **Frame Compositing:** Pre-composites GIF frames to prevent ghosting artifacts across frame disposal states.
* **Feature-Preserving Resampling:** Prioritizes micro-details (e.g., character eyes) during grid downscaling.
* **HTML Frame Caching:** Converts matrix rows into efficient HTML `<span>` blocks with inline colors, caching processed HTML strings to minimize garbage collection pauses.

### Layer 3: Kinematics & Locomotion State Machine
* **Modular Physics Lifecycle (`tick(dt)`):** Provides a standardized, delta-time aware loop that subclasses override to implement custom behaviors.
* **State Machine Transitions:** Manages fluid transitions across `IDLE`, `WALK`, `FALL`, `DRAG`, and action states with organic acceleration and friction.
* **Directional Synchronization:** Automatically aligns horizontal velocity vectors (`vx`), orientation state (`facing`), sprite transformations (`scaleX(-1)`), and attached SVG overlays.

### Layer 4: Hitbox Overlay System
* Renders real-time SVG overlays (`<polygon>`, `<rect>`, `<circle>`) that mirror automatically on direction change (`scaleX(-1)`).

---

## 3. Quick Start

### 1. Include the Engine (Single-File Bundle)

```html
<!-- Include all core engines & physics behaviors in one line -->
<script src="dist/asciline.bundle.min.js"></script>
```

*(Alternatively, include individual modular scripts from `lib/core/` and `lib/physics/`).*

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

## 4. Tooling & Custom Mascot Creation

ASCILINE provides both a browser-based visual studio and a suite of Python command-line conversion tools.

### Method A: Browser-Based GIF Studio (`tools/gif_studio.html`)

An all-in-one browser tool for importing, optimizing, and designing hitboxes on animated GIFs:

1. **Import:** Open `tools/gif_studio.html` and drag & drop any animated GIF.
2. **Resolution & Sampling:** Adjust the **Columns (Resolution)** slider (e.g., `80` cols). The engine uses **Feature-Preserving Smart Resampling** to protect micro-details like character eyes and pupil contrast.
3. **Disposal & Idle Modes:** Configure GIF frame disposal methods to eliminate ghosting artifacts and select idle behaviors (`Freeze Frame`, `Play Loop`).
4. **Visual Hitbox Designer:** Click **Polygon Area** to define custom closed boundary points with real-time SVG preview.
5. **Export:** Click **Export Mascot JSON** to download the optimized color-matrix JSON file.

```javascript
// Register your exported mascot in your application
ASCILINE.registerMascot('my_mascot', {
    get_class: () => WalkingSpriteMascot,
    args: ['my_mascot_coloranim.json', 80, 50, 15, 2]
});

ASCILINE.spawn('my_mascot');
```

### Method B: Python CLI Conversion Pipeline (`tools/`)

For headless automated pipelines, batch conversions, or server-side workflows:

* **Color Matrix Converter (`tools/gif2color.py`):** Converts animated GIFs into colored HTML span matrix JSON files with aspect-ratio preservation.
  ```bash
  python tools/gif2color.py input.gif --cols 80 --fps 15 -o mascot_coloranim.json
  ```
* **Pure Text ASCII Converter (`tools/gif2mascot.py`):** Converts GIFs into pure monochrome ASCII text matrix JSON files.
  ```bash
  python tools/gif2mascot.py input.gif --cols 60 --fps 12 -o mascot_textanim.json
  ```
* **GIF Inspector & Trimmer (`tools/gif_inspector.py` & `tools/gif_trimmer.py`):** Analyze frame delays, dimensions, color palettes, and trim frame sequences.
  ```bash
  python tools/gif_inspector.py input.gif
  python tools/gif_trimmer.py input.gif --start 0 --end 10 -o trimmed.gif
  ```

### Method C: Developing Custom Physics Behaviors

To create entirely new kinematic behaviors (e.g., wall climbing, gravitational orbits, teleportation), read the developer guide:

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
