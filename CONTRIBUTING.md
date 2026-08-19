# Contributing to ASCILINE Mascots

Thank you for your interest in contributing to ASCILINE! We welcome bug reports, feature requests, new physics behaviors, and mascot animations.

---

## Development Principles

1. **Zero External Dependencies:** The core engine must remain 100% vanilla JavaScript with zero runtime frameworks or libraries.
2. **Non-Destructive DOM Spatiality:** Always use native browser APIs (Range API, getBoundingClientRect) without injecting unnecessary HTML wrappers into the host page.
3. **Performance First (60fps):** Avoid layout thrashing. Use cached platform arrays (`cachedStaticPlatforms`, `cachedDynamicElements`) instead of queryink the DOM in every frame.

---

## Architecture Classification Rules

When contributing new physics or mascot classes, you must adhere to these hierarchical guidelines:

### 1. Sprite-Based Behaviors (`lib/physics/pure/motion/` or `action/`)
* Must extend `SpriteMascot`.
* Uses JSON animation assets generated from GIF Studio (`tools/gif_studio.html`) or `gif2color.py`.
* Examples: `WalkingSpriteMascot`, `FlyingMascot`, `BombPhysics`.

### 2. Procedural ASCII Mascots (`lib/physics/pure/motion/`)
* Must extend `Mascot` directly.
* Does not require any external JSON files. Renders ASCII graphics via real-time mathematical calculations.
* **Mandatory JSDoc Header:** Must include this tag in the file header:

  ```javascript
  /**
   * @class YourMascotName
   * @extends Mascot
   * @architecture Procedural Standalone ASCII Mascot
   */
  ```

---

## Testing & Verification

1. **Local Sandbox Testing:** Open `example/index.html` via a local web server (e.g. `python -m http.server 8000`) and test your mascot/physics behavior.
2. **Debug Layers:** Use the built-in telemetry buttons (Drag Boxes, Custom Hitboxes, Platforms, FPS) to verify boundary alignments and 60fps stability.
3. **Architecture Guide:** Refer to [docs/CUSTOM_PHYSICS_GUIDE.md](docs/CUSTOM_PHYSICS_GUIDE.md) for full lifecycle details and boilerplate templates.

---

## Pull Request Guidelines

- Keep pull requests focused on a single feature or bug fix.
- Format commit messages using Conventional Commits (e.g., `feat(physics): add wall-climbing behavior`, `fix(core): correct ceiling bounding rect`).
- Ensure no console errors or 404 asset failures occur in `example/index.html`.
