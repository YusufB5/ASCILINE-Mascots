# Contributing to ASCILINE Mascots

Thank you for your interest in contributing to ASCILINE! We welcome bug reports, feature requests, new physics behaviors, and mascot animations.

---

## Development Principles

1. **Zero External Dependencies:** The core engine must remain 100% vanilla JavaScript with zero runtime frameworks or libraries.
2. **Non-Destructive DOM Spatiality:** Always use native browser APIs (Range API, getBoundingClientRect) without injecting unnecessary HTML wrappers into the host page.
3. **Performance First (60fps):** Avoid layout thrashing. Use cached platform arrays (`cachedStaticPlatforms`, `cachedDynamicElements`) instead of querying the DOM in every frame.

---

## Architecture Classification Rules

When contributing new physics or mascot classes, you must adhere to these hierarchical guidelines:

### 1. Sprite-Based Behaviors (`lib/physics/pure/motion/` or `action/`)
* Must extend `SpriteMascot`.
* Uses JSON animation assets generated from GIF Studio (`tools/gif_studio.html`) or CLI tools (`gif2color.py`, `gif2text.py`).
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

### 3. Namespace Registration (`ASCILINE.Physics.*`)
Every new physics file must register its class onto the global `ASCILINE.Physics` namespace at the end of the file:

```javascript
(window.ASCILINE = window.ASCILINE || {}).Physics = window.ASCILINE.Physics || {};
window.ASCILINE.Physics.YourPhysicsName = YourPhysicsClass;
```

---

## Testing & Verification

1. **Local Sandbox Testing:** Open `example/index.html` via a local web server (e.g. `python -m http.server 8000`) and test your mascot/physics behavior.
2. **Rebuild Production Bundles:** Run the bundler script to ensure distribution builds compile cleanly:
   ```bash
   node tools/bundle.js
   ```
3. **Debug Layers:** Use the built-in telemetry buttons (Drag Boxes, Custom Hitboxes, Platforms, FPS) to verify boundary alignments and 60fps stability.
4. **Architecture Guide:** Refer to [docs/CUSTOM_PHYSICS_GUIDE.md](docs/CUSTOM_PHYSICS_GUIDE.md) for full lifecycle details and boilerplate templates.

---

## Pull Request Guidelines

- Keep pull requests focused on a single feature or bug fix.
- Always run `node tools/bundle.js` so that `dist/asciline.bundle.js` and `dist/asciline.bundle.min.js` are updated.
- Format commit messages using Conventional Commits (e.g., `feat(physics): add wall-climbing behavior`, `fix(core): correct ceiling bounding rect`).
- Ensure no console errors or 404 asset failures occur in `example/index.html`.
