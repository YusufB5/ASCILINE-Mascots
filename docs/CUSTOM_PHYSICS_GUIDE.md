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

Here is a working example of a custom floating ghost physics behavior:

``���م͍ɥ��(���(�������́!�ٕɥ������5�͍��(�����ѕ��́M�ɥѕ5�͍��(�����͍ɥ�ѥ�������́͵��ѡ�䁅�ɽ�́=4��������́ݥѠ����ѱ��ͥ��ͽ�������ٕɥ���(���)����́!�ٕɥ������5�͍�Ё��ѕ��́M�ɥѕ5�͍�Ё�(����������Սѽȡ�ͽ�Uɱ=��ф��ݥ�Ѡ�����������Ѐ�������̀��԰���ٕ�M������ȸ����(������������ȡ�ͽ�Uɱ=��ф��ݥ�Ѡ�������а���̤�(��������(��������ѡ�̹��ٕ�M�����􁡽ٕ�M�����(��������ѡ�̹��ٕ���������(��������ѡ�̹��͕!�ٕ�d��ѡ�̹��(��������ѡ�̹��������ɥ��М�(�����((����ѥ����Ѐ�Ĥ��(�����������M�������ͥ�́ݡ�����͕ȁ�́�Ʌ�����(������������ѡ�̹��Ʌ��������(������������ѡ�̹��͕!�ٕ�d��ѡ�̹��(������������ɕ��ɸ�(���������((�����������!�ɥ齹х�����ɽ����ٕ����(��������ѡ�̹����ѡ�̹����������ɥ��М���ѡ�̹��ٕ�M�����耵ѡ�̹��ٕ�M�����������((�����������M���ͽ���������ѥ���݅ٔ(��������ѡ�̹��ٕ�����������Ԁ�����(��������ѡ�̹��ѡ�̹��͕!�ٕ�d���5�Ѡ�ͥ��ѡ�̹��ٕ������������((�����������M�ɕ����������չ��(������������ѡ�̹��������(������������ѡ�̹�����(������������ѡ�̹��������ɥ��М�(������������ѡ�̹�Ʌ���ȹ��屔��Ʌ�͙�ɴ�􀝹�����(��������􁕱͔�����ѡ�̹����ѡ�̹ݥ�Ѡ���ݥ���ܹ�����]��Ѡ���(������������ѡ�̹���ݥ���ܹ�����]��Ѡ���ѡ�̹ݥ�Ѡ�(������������ѡ�̹�������􀝱��М�(������������ѡ�̹�Ʌ���ȹ��屔��Ʌ�͙�ɴ��͍���`��Ĥ��(���������((���������������Ё��ͥѥ���Ѽ�=4(��������ѡ�̹����ѕ=5A�ͥѥ�����(�����)�)���((���((���ظ�I����ѕɥ�������M��ݹ����e��ȁ��ѽ��A��ͥ��()I����ѕȁ��ȁ��܁����́��Ѽ�5M=Q}I%MQId��幅��������()�����م͍ɥ��)M%1%9�ɕ���ѕ�5�͍�Р�����М���(�������}�����耠�����!�ٕɥ������5�͍�а(�����ɝ��l������}����Ʌ�����ͽ�������������԰�ȸ�t)���((���M��ݸ����х�ѱ䁅��ݡ�ɔ������ȁͥє)M%1%9����ݸ������М��)���(