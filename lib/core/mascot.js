/**
 * ASCILINE PHYSICS MASCOT (DESKTOP PET)
 * =========================================
 * Multi-pet object-oriented architecture.
 * Supports physics, collisions, drag & throw, and custom behaviors.
 */

// ── GLOBAL CONFIGURATION ──
// Developers using this library can overwrite these selectors for their own websites
window.ASCILINE_CONFIG = window.ASCILINE_CONFIG || {
    platformSelectors: 'h1, h2, h3, h4, h5, h6, p, li, button, section, article, div.price-card, div.mascot-btn-group, .asciline-platform',
    destructibleSelectors: 'h1, h2, h3, h4, h5, h6, p, li, button, .asciline-destructible',
    debug: {
        dragBoxes: false,   // Show mascot outer wrapper & drag boundary
        hitboxes: false,    // Show custom authored points / circles / rects
        platforms: false    // Show floor / platform collision rectangles
    }
};

let hasShownFirstMascotHint = false;

// ── HYBRID COLLISION CACHE ──
let cachedStaticPlatforms = [];
let cachedDynamicElements = [];
let _dynamicCacheAge = 0;
const DYNAMIC_CACHE_TTL = 120; // refresh every ~2 seconds at 60fps

function buildCollisionCache() {
    cachedStaticPlatforms = [];
    const textContainers = document.querySelectorAll(window.ASCILINE_CONFIG.platformSelectors);
    
    textContainers.forEach(container => {
        if (container.closest('#overlay-container') || container.closest('.checkout-overlay')) return;
        // Universal platform exclusion rules
        if (container.closest('.asciline-ignore-platform') || container.closest('[data-asciline-ignore]') || container.closest('.asciline-ignore-zone')) return;
        // Legacy fallback exclusions
        if (container.closest('#excalibur-zone') || container.closest('.excalibur-section') || container.closest('.aquarium-wrapper') || container.closest('.asciline-water')) return;
        if (container.classList.contains('shattered-platform') || container.closest('.shattered-platform')) return;
        if (container.style.opacity === '0' || container.style.visibility === 'hidden') return;
        
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
        let textNode;
        while (textNode = walker.nextNode()) {
            if (textNode.textContent.trim().length > 0) {
                const parent = textNode.parentElement;
                if (parent && (parent.classList.contains('shattered-platform') || parent.closest('.shattered-platform') || parent.style.opacity === '0' || parent.style.visibility === 'hidden')) {
                    continue;
                }
                const range = document.createRange();
                range.selectNodeContents(textNode);
                const rects = range.getClientRects();
                for (let i = 0; i < rects.length; i++) {
                    const rect = rects[i];
                    if (rect.height > 0 && rect.width > 0) {
                        cachedStaticPlatforms.push({
                            left: rect.left + window.scrollX,
                            right: rect.right + window.scrollX,
                            top: rect.top + window.scrollY,
                            bottom: rect.bottom + window.scrollY,
                            node: parent || container
                        });
                    }
                }
            }
        }
    });
    // Also refresh dynamic cache on full rebuild
    _refreshDynamicCache();
}

function removePlatformFromCache(platformEl) {
    if (!platformEl) return;
    cachedStaticPlatforms = cachedStaticPlatforms.filter(rect => 
        rect.node !== platformEl && 
        !platformEl.contains(rect.node) && 
        !rect.node.contains(platformEl)
    );
    cachedDynamicElements = cachedDynamicElements.filter(el => 
        el !== platformEl && 
        !platformEl.contains(el)
    );
}

function _refreshDynamicCache() {
    cachedDynamicElements = Array.from(document.getElementsByClassName('ascii-dynamic'))
        .concat(Array.from(document.getElementsByClassName('widget-player')))
        .filter(el => !el.closest('#overlay-container') && 
                      !el.classList.contains('shattered-platform') && 
                      !el.closest('.shattered-platform') && 
                      el.style.opacity !== '0' && 
                      el.style.visibility !== 'hidden');
    _dynamicCacheAge = 0;
}

// We no longer need to mutate the DOM (injecting spans).
function preprocessTextNodes() {
    // This is intentionally left blank. 
    // We now use the Range API in buildCollisionCache.
}

// ── BASE MASCOT CLASS ──
class Mascot {
    constructor(wrapperId, preId, width = 50, height = 27) {
        this.wrapper = document.getElementById(wrapperId);
        this.pre = document.getElementById(preId);
        
        this.width = width;
        this.height = height;
        
        this.x = Math.random() * (window.innerWidth - this.width - 50) + 25;
        this.y = 100 + Math.random() * 50;
        this.vx = 0;
        this.vy = 0;
        
        this.gravity = 1.33;  // Tuned for 60fps-reference dt physics (matches original 200fps feel)
        this.bounce = 0.3;
        this.friction = 0.935; // Per-step friction at 60fps-reference (equivalent to 0.98^200fps original)
        
        this.isDragging = false;
        this.mouseX = 0;
        this.mouseY = 0;
        this.dragHistory = [];
        
        this.customPoints = [];
        this.metadata = null;
        this._hitboxOverlaySvg = null;
        
        this.currentState = 'FALL';
        this.animFrame = 0;
        this.animTimer = 0;
        this.stateTimer = 0;
        
        this.wrapper.style.width = `${this.width}px`;
        this.wrapper.style.height = `${this.height}px`;

        // Strictly prevent Google Translate / browser auto-translate from observing or translating ASCII DOM nodes
        if (this.wrapper) {
            this.wrapper.classList.add('notranslate');
            this.wrapper.setAttribute('translate', 'no');
        }
        if (this.pre) {
            this.pre.classList.add('notranslate');
            this.pre.setAttribute('translate', 'no');
        }

        // Interactive hint badge ONLY for the first spawned mascot
        if (!hasShownFirstMascotHint && !this.wrapper.querySelector('.mascot-drag-hint')) {
            hasShownFirstMascotHint = true;
            this.hintEl = document.createElement('div');
            this.hintEl.className = 'mascot-drag-hint';
            this.hintEl.textContent = '[ DRAG & TOSS ME ]';
            this.wrapper.appendChild(this.hintEl);

            this.wrapper.classList.add('show-hint');
            setTimeout(() => {
                if (this.wrapper) {
                    this.wrapper.classList.remove('show-hint');
                    if (this.hintEl) this.hintEl.remove();
                }
            }, 4500);
        }
        
        this.updateDOMPosition();
        this.initEvents();
    }
    
    initEvents() {
        const getPointerPos = (e) => {
            if (e.touches && e.touches.length > 0) {
                return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY, pageX: e.touches[0].pageX, pageY: e.touches[0].pageY };
            }
            return { clientX: e.clientX, clientY: e.clientY, pageX: e.pageX, pageY: e.pageY };
        };

        this._boundPointerDown = (e) => {
            if (e.button !== undefined && e.button !== 0) return; // Only primary clicks
            if (e.altKey) return; // Allow text selection when Alt key is held
            this.isDragging = true;
            this.currentState = 'DRAG';
            this.vx = 0;
            this.vy = 0;
            
            const pos = getPointerPos(e);
            // Use the logical translation coordinates (this.x / this.y) directly.
            // These are the values fed into translate3d(), so they are rotation-agnostic
            // and always in sync with the physics state — avoiding the rotated-BoundingRect bug.
            this.mouseX = pos.pageX - this.x;
            this.mouseY = pos.pageY - this.y;
            
            this.dragHistory = [];
            this.wrapper.style.transition = 'none';

            if (e.pointerId !== undefined && this.wrapper.setPointerCapture) {
                try { this.wrapper.setPointerCapture(e.pointerId); } catch(err) {}
            }

            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
        };

        this._boundPointerMove = (e) => {
            if (!this.isDragging) return;
            const pos = getPointerPos(e);
            this.x = pos.pageX - this.mouseX;
            this.y = pos.pageY - this.mouseY;
            this.dragHistory.push({ x: pos.pageX, y: pos.pageY, time: performance.now() });
            if (this.dragHistory.length > 5) this.dragHistory.shift();
            this.updateDOMPosition();
            if (e.cancelable) e.preventDefault();
        };

        this._boundPointerUp = (e) => {
            if (!this.isDragging) return;
            this.isDragging = false;
            this.currentState = 'FALL';

            if (e && e.pointerId !== undefined && this.wrapper.releasePointerCapture) {
                try { this.wrapper.releasePointerCapture(e.pointerId); } catch(err) {}
            }
            
            if (this.dragHistory.length >= 2) {
                const first = this.dragHistory[0];
                const last = this.dragHistory[this.dragHistory.length - 1];
                const now = performance.now();
                
                if (now - last.time > 100) {
                    this.vx = 0;
                    this.vy = 0;
                } else {
                    let dt = last.time - first.time;
                    if (dt < 10) dt = 10;
                    
                    this.vx = ((last.x - first.x) / dt) * 16.6 * 0.65; 
                    this.vy = ((last.y - first.y) / dt) * 16.6 * 0.65 * 1.5;
                    
                    this.vx = Math.max(-60, Math.min(this.vx, 60));
                    this.vy = Math.max(-67, Math.min(this.vy, 67));
                }
            }
        };

        if (window.PointerEvent) {
            this.wrapper.addEventListener('pointerdown', this._boundPointerDown);
            window.addEventListener('pointermove', this._boundPointerMove);
            window.addEventListener('pointerup', this._boundPointerUp);
            window.addEventListener('pointercancel', this._boundPointerUp);
        } else {
            this.wrapper.addEventListener('mousedown', this._boundPointerDown);
            this.wrapper.addEventListener('touchstart', this._boundPointerDown, { passive: false });
            window.addEventListener('mousemove', this._boundPointerMove);
            window.addEventListener('touchmove', this._boundPointerMove, { passive: false });
            window.addEventListener('mouseup', this._boundPointerUp);
            window.addEventListener('touchend', this._boundPointerUp);
            window.addEventListener('touchcancel', this._boundPointerUp);
        }
    }
    
    destroy() {
        if (window.PointerEvent) {
            if (this._boundPointerDown) this.wrapper.removeEventListener('pointerdown', this._boundPointerDown);
            if (this._boundPointerMove) window.removeEventListener('pointermove', this._boundPointerMove);
            if (this._boundPointerUp) {
                window.removeEventListener('pointerup', this._boundPointerUp);
                window.removeEventListener('pointercancel', this._boundPointerUp);
            }
        } else {
            if (this._boundPointerDown) {
                this.wrapper.removeEventListener('mousedown', this._boundPointerDown);
                this.wrapper.removeEventListener('touchstart', this._boundPointerDown);
            }
            if (this._boundPointerMove) {
                window.removeEventListener('mousemove', this._boundPointerMove);
                window.removeEventListener('touchmove', this._boundPointerMove);
            }
            if (this._boundPointerUp) {
                window.removeEventListener('mouseup', this._boundPointerUp);
                window.removeEventListener('touchend', this._boundPointerUp);
                window.removeEventListener('touchcancel', this._boundPointerUp);
            }
        }
        
        if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.parentNode.removeChild(this.wrapper);
        }
    }
    
    setCustomHitboxes(metadataOrPoints) {
        if (Array.isArray(metadataOrPoints)) {
            this.customPoints = metadataOrPoints;
        } else if (metadataOrPoints && typeof metadataOrPoints === 'object') {
            this.metadata = metadataOrPoints;
            this.customPoints = metadataOrPoints.customPoints || [];
        }
        this.renderHitboxOverlay();
    }

    renderHitboxOverlay() {
        if (!this.customPoints || this.customPoints.length === 0 || !this.wrapper) return;
        
        if (!this._hitboxOverlaySvg) {
            this._hitboxOverlaySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            this._hitboxOverlaySvg.setAttribute('class', 'hitbox-overlay-svg');
            this._hitboxOverlaySvg.style.position = 'absolute';
            this._hitboxOverlaySvg.style.top = '0';
            this._hitboxOverlaySvg.style.left = '0';
            this._hitboxOverlaySvg.style.width = '100%';
            this._hitboxOverlaySvg.style.height = '100%';
            this._hitboxOverlaySvg.style.pointerEvents = 'none';
            this._hitboxOverlaySvg.style.zIndex = '10000';
            this._hitboxOverlaySvg.style.transformOrigin = 'center center';
            this.wrapper.appendChild(this._hitboxOverlaySvg);
        }
        
        this._hitboxOverlaySvg.innerHTML = '';
        
        const gridW = (this.metadata && this.metadata.width) || 50;
        const gridH = (this.metadata && this.metadata.height) || 25;
        const width = this.width || this.wrapper.offsetWidth || 100;
        const height = this.height || this.wrapper.offsetHeight || 100;
        
        const singlePoints = [];
        
        this.customPoints.forEach(pt => {
            if (pt.type === 'rect') {
                const rx = (pt.ax / gridW) * width;
                const ry = (pt.ay / gridH) * height;
                const rw = (pt.aw / gridW) * width;
                const rh = (pt.ah / gridH) * height;
                
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', rx.toFixed(1));
                rect.setAttribute('y', ry.toFixed(1));
                rect.setAttribute('width', rw.toFixed(1));
                rect.setAttribute('height', rh.toFixed(1));
                rect.setAttribute('fill', 'rgba(255, 0, 85, 0.2)');
                rect.setAttribute('stroke', '#ff0055');
                rect.setAttribute('stroke-width', '2');
                rect.setAttribute('stroke-dasharray', '4,3');
                this._hitboxOverlaySvg.appendChild(rect);
            } else if (pt.type === 'circle') {
                const cx = (pt.ax / gridW) * width;
                const cy = (pt.ay / gridH) * height;
                const cr = ((pt.ar || 5) / gridW) * width;
                
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', cx.toFixed(1));
                circle.setAttribute('cy', cy.toFixed(1));
                circle.setAttribute('r', cr.toFixed(1));
                circle.setAttribute('fill', 'rgba(0, 255, 204, 0.2)');
                circle.setAttribute('stroke', '#00ffcc');
                circle.setAttribute('stroke-width', '2');
                circle.setAttribute('stroke-dasharray', '4,3');
                this._hitboxOverlaySvg.appendChild(circle);
            } else {
                const px = (pt.ax / gridW) * width;
                const py = (pt.ay / gridH) * height;
                singlePoints.push({ x: px, y: py });
                
                const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                dot.setAttribute('cx', px.toFixed(1));
                dot.setAttribute('cy', py.toFixed(1));
                dot.setAttribute('r', '4');
                dot.setAttribute('fill', '#ff00cc');
                dot.setAttribute('stroke', '#ffffff');
                dot.setAttribute('stroke-width', '1.5');
                this._hitboxOverlaySvg.appendChild(dot);
            }
        });
        
        if (singlePoints.length > 1) {
            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const pointsStr = singlePoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
            polygon.setAttribute('points', pointsStr);
            polygon.setAttribute('fill', 'rgba(255, 0, 204, 0.18)');
            polygon.setAttribute('stroke', '#ff00cc');
            polygon.setAttribute('stroke-width', '1.5');
            polygon.setAttribute('stroke-dasharray', '3,3');
            this._hitboxOverlaySvg.insertBefore(polygon, this._hitboxOverlaySvg.firstChild);
        }

        if (this.pre) {
            this._hitboxOverlaySvg.style.transform = this.pre.style.transform;
        }
    }
    
    updateDOMPosition() {
        this.wrapper.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
    }
    
    findPlatformCollision() {
        const mascotBottom = this.y + this.height;
        const mascotCenterX = this.x + this.width / 2;
        const docHeight = Math.max(document.body.scrollHeight, window.innerHeight);
        let highestPlatformTop = docHeight;
        let highestPlatform = null;

        // Viewport cull: only check platforms within ±200px of the mascot's vertical position
        const cullMin = this.y - 200;
        const cullMax = mascotBottom + 20;
        
        // 1. Static Memory Scan (viewport-culled for mobile perf)
        for (const plat of cachedStaticPlatforms) {
            if (!plat.node || !plat.node.isConnected) continue;
            if (plat.node.classList.contains('shattered-platform') || plat.node.closest('.shattered-platform')) continue;
            if (plat.node.style.opacity === '0' || plat.node.style.visibility === 'hidden' || plat.node.style.display === 'none') continue;

            const curRect = plat.node.getBoundingClientRect();
            if (curRect.height === 0 || curRect.width === 0) continue;
            const curTop = curRect.top + window.scrollY;
            if (Math.abs(curTop - plat.top) > 5) {
                plat.top = curTop;
                plat.bottom = curRect.bottom + window.scrollY;
                plat.left = curRect.left + window.scrollX;
                plat.right = curRect.right + window.scrollX;
            }

            if (plat.top < cullMin || plat.top > cullMax) continue;

            if (mascotCenterX >= plat.left && mascotCenterX <= plat.right) {
                if (mascotBottom >= plat.top && this.y + this.height - this.vy <= plat.top + 8 && this.vy >= 0) {
                    if (plat.top < highestPlatformTop) {
                        highestPlatformTop = plat.top;
                        highestPlatform = plat.node;
                    }
                }
            }
        }
        
        // 2. Dynamic Object Scan — uses cached list (refreshed every ~2s in physicsLoop, never querySelectorAll in hot path!)
        for (const el of cachedDynamicElements) {
            if (el.classList.contains('shattered-platform') || el.closest('.shattered-platform')) continue;
            if (el.style.opacity === '0' || el.style.visibility === 'hidden') continue;

            const rect = el.getBoundingClientRect();
            if (rect.height === 0) continue;
            const absTop = rect.top + window.scrollY;
            if (absTop < cullMin || absTop > cullMax) continue;
            const absLeft = rect.left + window.scrollX;
            const absRight = rect.right + window.scrollX;
            
            if (mascotCenterX >= absLeft && mascotCenterX <= absRight) {
                if (mascotBottom >= absTop && this.y + this.height - this.vy <= absTop + 8 && this.vy >= 0) {
                    if (absTop < highestPlatformTop) {
                        highestPlatformTop = absTop;
                        highestPlatform = el;
                    }
                }
            }
        }
        
        return { platform: highestPlatform, top: highestPlatformTop };
    }
    
    findCeilingCollision() {
        const mascotTop = this.y;
        const mascotCenterX = this.x + this.width / 2;
        
        for (const plat of cachedStaticPlatforms) {
            if (mascotCenterX >= plat.left && mascotCenterX <= plat.right) {
                if (mascotTop <= plat.bottom && mascotTop - this.vy >= plat.bottom - 8) {
                    return plat.node;
                }
            }
        }
        
        for (const el of cachedDynamicElements) {
            if (el.classList.contains('shattered-platform') || el.closest('.shattered-platform')) continue;
            if (el.style.opacity === '0' || el.style.visibility === 'hidden') continue;
            if (el.closest('#overlay-container')) continue;

            const rect = el.getBoundingClientRect();
            if (rect.height === 0) continue;
            const absBottom = rect.bottom + window.scrollY;
            const absLeft = rect.left + window.scrollX;
            const absRight = rect.right + window.scrollX;
            
            if (mascotCenterX >= absLeft && mascotCenterX <= absRight) {
                if (mascotTop <= absBottom && mascotTop - this.vy >= absBottom - 8) {
                    return el;
                }
            }
        }
        return null;
    }

    findCeilingAbove() {
        const mascotCenterX = this.x + this.width / 2;
        let lowestCeilingBottom = 0;
        
        for (const plat of cachedStaticPlatforms) {
            if (mascotCenterX >= plat.left && mascotCenterX <= plat.right) {
                if (plat.bottom < this.y && plat.bottom > lowestCeilingBottom) {
                    lowestCeilingBottom = plat.bottom;
                }
            }
        }
        
        for (const el of cachedDynamicElements) {
            if (el.classList.contains('shattered-platform') || el.closest('.shattered-platform')) continue;
            if (el.style.opacity === '0' || el.style.visibility === 'hidden') continue;
            if (el.closest('#overlay-container')) continue;

            const rect = el.getBoundingClientRect();
            if (rect.height === 0) continue;
            const absBottom = rect.bottom + window.scrollY;
            const absLeft = rect.left + window.scrollX;
            const absRight = rect.right + window.scrollX;
            
            if (mascotCenterX >= absLeft && mascotCenterX <= absRight) {
                if (absBottom < this.y && absBottom > lowestCeilingBottom) {
                    lowestCeilingBottom = absBottom;
                }
            }
        }
        return lowestCeilingBottom;
    }
    
    tick() {
        // To be overridden by subclasses
    }
}


// Global Asset Base URL configuration
const DEFAULT_ASSET_BASE = '/assets/mascots/';

function resolveAssetUrl(pathOrFilename) {
    if (!pathOrFilename || typeof pathOrFilename !== 'string') return pathOrFilename;
    // If it's already an absolute path, data URI, or full URL, return as is
    if (pathOrFilename.startsWith('http://') || pathOrFilename.startsWith('https://') || pathOrFilename.startsWith('/') || pathOrFilename.startsWith('data:')) {
        return pathOrFilename;
    }
    const base = (typeof window !== 'undefined' && window.ASCILINE && window.ASCILINE.baseAssetUrl) 
        ? window.ASCILINE.baseAssetUrl 
        : DEFAULT_ASSET_BASE;
    
    // Normalize base prefix to check if already prefixed
    const cleanBase = base.replace(/^\/+|\/+$/g, '');
    if (cleanBase && (pathOrFilename === cleanBase || pathOrFilename.startsWith(cleanBase + '/'))) {
        return pathOrFilename;
    }
    
    return base.endsWith('/') ? base + pathOrFilename : base + '/' + pathOrFilename;
}

// We use getter functions for classes to avoid script load order issues.
const MASCOT_REGISTRY = {
    'cat': {
        get_class: () => WalkingSpriteMascot,
        get_args: () => [resolveAssetUrl('secondcat_coloranim.json'), 80, 50, 15, 2],
        args: [resolveAssetUrl('secondcat_coloranim.json'), 80, 50, 15, 2]
    },
    'walker_cat': {
        get_class: () => WalkingSpriteMascot,
        get_args: () => [resolveAssetUrl('secondcat_coloranim.json'), 80, 50, 15, 2],
        args: [resolveAssetUrl('secondcat_coloranim.json'), 80, 50, 15, 2]
    },
    'flying_cat': {
        get_class: () => typeof FlyingMascot !== 'undefined' ? FlyingMascot : FlyerMascot,
        get_args: () => [resolveAssetUrl('secondcat_coloranim.json'), 80, 50, 15, 1.5],
        args: [resolveAssetUrl('secondcat_coloranim.json'), 80, 50, 15, 1.5]
    },
    'speedy_cat': {
        get_class: () => RunnerMascot,
        get_args: () => [resolveAssetUrl('secondcat_coloranim.json'), 80, 50, 15, 3],
        args: [resolveAssetUrl('secondcat_coloranim.json'), 80, 50, 15, 3]
    },
    'jumping_cat': {
        get_class: () => JumperPhysics,
        get_args: () => [resolveAssetUrl('secondcat_coloranim.json'), 80, 50, 15],
        args: [resolveAssetUrl('secondcat_coloranim.json'), 80, 50, 15]
    },
    'swimming_cat': {
        get_class: () => SwimmerMascot,
        get_args: () => [resolveAssetUrl('secondcat_coloranim.json'), { width: 80, height: 50, fps: 15 }],
        args: [resolveAssetUrl('secondcat_coloranim.json'), { width: 80, height: 50, fps: 15 }]
    },
    'bouncy_cat': {
        get_class: () => BouncerMascot,
        get_args: () => [resolveAssetUrl('secondcat_coloranim.json'), 80, 50, 15],
        args: [resolveAssetUrl('secondcat_coloranim.json'), 80, 50, 15]
    },
    'static_cat': {
        get_class: () => StaticMascot,
        get_args: () => [resolveAssetUrl('secondcat_coloranim.json'), 80, 50],
        args: [resolveAssetUrl('secondcat_coloranim.json'), 80, 50]
    },
    'bomb': {
        get_class: () => typeof BombPhysics !== 'undefined' ? BombPhysics : null,
        get_args: () => [resolveAssetUrl('secondcat_coloranim.json'), 80, 50],
        args: [resolveAssetUrl('secondcat_coloranim.json'), 80, 50]
    },
    'spider': {
        get_class: () => SpiderMascot,
        args: []
    }
};

// ── ENGINE INITIALIZATION & API ──
let mascots = [];
let _lastFrameTime = 0;

// ── DEBUG TELEMETRY (FPS, DT, VELOCITY) ──
let _fpsEl = null;
let _fpsFrameCount = 0;
let _fpsLastSec = 0;
let _fpsDisplay = 60;
let _dtDisplay = 1.0;

function _updateFpsOverlay(dt, rawDt, isFpsTick) {
    const showFps = !!(window.ASCILINE_CONFIG && window.ASCILINE_CONFIG.debug && window.ASCILINE_CONFIG.debug.fps);
    if (!showFps) {
        if (_fpsEl) _fpsEl.style.display = 'none';
        return;
    }

    if (!_fpsEl) {
        _fpsEl = document.createElement('div');
        _fpsEl.id = 'mascot-fps-debug';
        _fpsEl.style.cssText = `
            position: fixed; bottom: 15px; right: 15px; z-index: 99999;
            background: rgba(15, 15, 20, 0.88); color: #00ffcc;
            font: 12px/1.4 'Consolas', 'Courier New', monospace; padding: 8px 12px;
            border: 1px solid rgba(0, 255, 204, 0.4); border-radius: 6px;
            pointer-events: none; backdrop-filter: blur(4px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.5); min-width: 170px;
        `;
        _fpsEl.innerHTML = `
            <div style="font-weight:bold; color:#00ffcc;">⚡ FPS: <span id="_agy_fps">--</span> <span id="_agy_cnt" style="color:#888; font-weight:normal;"></span></div>
            <div style="color:#ffd700; font-size:11px;">dt: <span id="_agy_dt">-</span> <span id="_agy_rdt" style="color:#666;"></span></div>
            <div id="_agy_mascot" style="color:#aaa; font-size:11px; margin-top:3px; border-top:1px solid #333; padding-top:3px;"></div>
        `;
        document.body.appendChild(_fpsEl);
    }
    _fpsEl.style.display = 'block';

    // Every frame: update dt cheaply
    const dtEl = document.getElementById('_agy_dt');
    const rdtEl = document.getElementById('_agy_rdt');
    if (dtEl) dtEl.textContent = dt.toFixed(2);
    if (rdtEl) rdtEl.textContent = `| raw: ${rawDt.toFixed(2)}`;

    // Once per second: update FPS, count, mascot telemetry
    if (!isFpsTick) return;
    const activeMascots = mascots.filter(m => m && !m.isShatterShard);
    const fpsEl = document.getElementById('_agy_fps');
    const cntEl = document.getElementById('_agy_cnt');
    const mascotEl = document.getElementById('_agy_mascot');
    if (fpsEl) fpsEl.textContent = _fpsDisplay;
    if (cntEl) cntEl.textContent = `(${activeMascots.length} pets)`;
    if (mascotEl) {
        if (activeMascots.length > 0) {
            const m = activeMascots[activeMascots.length - 1];
            const state = m.currentState || 'IDLE';
            const vx = (m.vx || 0).toFixed(2);
            const vy = (m.vy || 0).toFixed(2);
            const x = Math.round(m.x || 0);
            const y = Math.round(m.y || 0);
            mascotEl.innerHTML = `State: <span style="color:#ff0055;">${state}</span> | v: (${vx}, ${vy})<br>Pos: (${x}px, ${y}px)`;
        } else {
            mascotEl.textContent = '';
        }
    }
}

function physicsLoop(timestamp) {
    const rawDt = _lastFrameTime ? (timestamp - _lastFrameTime) / 16.667 : 1.0;
    const dt = Math.min(rawDt, 3.0);
    _lastFrameTime = timestamp;

    _fpsFrameCount++;
    let isFpsTick = false;
    if (timestamp - _fpsLastSec >= 1000) {
        _fpsDisplay = _fpsFrameCount;
        _fpsFrameCount = 0;
        _fpsLastSec = timestamp;
        isFpsTick = true;
    }

    _updateFpsOverlay(dt, rawDt, isFpsTick);

    _dynamicCacheAge += dt;
    if (_dynamicCacheAge >= DYNAMIC_CACHE_TTL) _refreshDynamicCache();

    for (const mascot of mascots) {
        if (!mascot.isPaused) {
            mascot.tick(dt);
        }
    }
    requestAnimationFrame(physicsLoop);
}

// ── CREDIT & COUNT-BASED SPAWN SYSTEM ──
window.ASCILINE_CREDIT_TABLE = {
    'cat': 1,
    'secondcat': 2,
    'spider': 1,
    'confetycat': 1,
    'dragon': 4, // Updated to 4 credits
    'dolphin': 2,
    'dolphin2': 2,
    'slime': 2,
    'blackhole': 2,
    'blackhole2': 2,
    'bomb': 3,
    'hand': 3,
    'flyerpokemon': 3,
    'bouncer': 3.5,
    'sword': 3.5,
    'pokeball': 4,
    'pikachu': 4,
    'jumpluff': 4,
    'launcher': 4.5
};

const _isMobileDevice = typeof window !== 'undefined' && (window.innerWidth <= 768 || ('ontouchstart' in window && window.navigator.maxTouchPoints > 0));
window.ASCILINE_MAX_CREDITS = _isMobileDevice ? 12 : 20;
window.ASCILINE_MAX_COUNT = _isMobileDevice ? 8 : 12; // Dual safety count limit

// Global ASCILINE API (Factory Pattern)
window.ASCILINE = {
    getMascots: function() {
        return mascots;
    },
    
    removeMascot: function(mascotToRemove) {
        if (!mascotToRemove) return;
        if (typeof mascotToRemove.destroy === 'function') {
            mascotToRemove.destroy();
        }
        const idx = mascots.indexOf(mascotToRemove);
        if (idx > -1) {
            mascots.splice(idx, 1);
        }
    },
    
    spawn: function(mascot_name, custom_x = null, custom_y = null, silent = false) {
        const config = MASCOT_REGISTRY[mascot_name];
        
        if (!config) {
            console.error(`[ASCILINE] Error: Unknown mascot name '${mascot_name}'`);
            return null;
        }

        // Dynamically compute args first to determine actual variant cost (e.g. secondcat)
        const args = config.get_args ? config.get_args() : config.args;
        let cost = window.ASCILINE_CREDIT_TABLE[mascot_name] || 1;
        if (mascot_name === 'cat' && args[0] && args[0].includes('secondcat')) {
            cost = window.ASCILINE_CREDIT_TABLE['secondcat'] || 2;
        }
        
        // Dual Budget Management (Recycle oldest if credits > MAX_CREDITS OR count >= MAX_COUNT)
        const getActiveMascots = () => mascots.filter(m => m && !m.isShatterShard && !m.isProjectile);
        let activeList = getActiveMascots();
        let totalCredits = activeList.reduce((sum, m) => sum + (m.creditCost || 1), 0);
        
        while ((totalCredits + cost > window.ASCILINE_MAX_CREDITS || activeList.length >= window.ASCILINE_MAX_COUNT) && activeList.length > 0) {
            const oldest = activeList.shift();
            this.removeMascot(oldest);
            activeList = getActiveMascots();
            totalCredits = activeList.reduce((sum, m) => sum + (m.creditCost || 1), 0);
        }
        
        const MascotClass = config.get_class();
        const new_mascot = new MascotClass(...args);
        new_mascot.creditCost = cost;
        
        // Apply custom coordinates if provided
        if (custom_x !== null) new_mascot.x = custom_x;
        if (custom_y !== null) new_mascot.y = custom_y;
        
        mascots.push(new_mascot);
        
        if (window.ASCILINE_AUDIO && !silent) {
            if (mascot_name.includes('cat')) {
                window.ASCILINE_AUDIO.play('catSpawn');
            } else if (mascot_name.includes('dolphin')) {
                if (!window._dolphinSpawnedSinceClear) {
                    window.ASCILINE_AUDIO.play('dolphinSpawn');
                    window._dolphinSpawnedSinceClear = true;
                } else {
                    window.ASCILINE_AUDIO.play('defaultClick');
                }
            } else if (mascot_name.includes('dragon')) {
                window.ASCILINE_AUDIO.play('dragonSpawn');
            } else {
                window.ASCILINE_AUDIO.play('defaultClick');
            }
        }

        console.log(`[ASCILINE] Successfully spawned: ${mascot_name} (Cost: ${cost} | Total Credits: ${totalCredits + cost}/${window.ASCILINE_MAX_CREDITS})`);
        return new_mascot;
    },
    
    repairElement: function(container) {
        if (!container) return;
        delete container.dataset.shattered;
        container.classList.remove("shattered-platform", "shattered-source-span");
        container.style.opacity = "1";
        container.style.pointerEvents = "";
        container.style.visibility = "";
        container.style.filter = "";

        const wrappers = container.querySelectorAll('.shattered-text-wrapper, .shattered-word-span');
        wrappers.forEach(w => {
            w.style.opacity = "1";
            w.style.visibility = "";
        });
    },

    repairAll: function() {
        const allShattered = document.querySelectorAll('[data-shattered="true"], .shattered-platform, .shattered-text-wrapper, .shattered-source-span');
        allShattered.forEach(el => this.repairElement(el));
        if (typeof buildCollisionCache === "function") buildCollisionCache();
    },

    clear_all: function() {
        window._dolphinSpawnedSinceClear = false;
        this.repairAll();
        if (window.restoreShatteredDOM) {
            window.restoreShatteredDOM();
        }
        for (const mascot of mascots) {
            try {
                if (mascot && typeof mascot.destroy === 'function') mascot.destroy();
            } catch (e) {
                console.error("[ASCILINE] Error destroying mascot:", e);
            }
        }
        mascots = [];
        const aqWrap = document.getElementById('aquarium-wrapper');
        if (aqWrap) {
            aqWrap.classList.remove('visible');
        }
        console.log(`[ASCILINE] All mascots cleared.`);
    },
    
    // Asset and Registry Management
    baseAssetUrl: DEFAULT_ASSET_BASE,
    resolveAssetUrl: resolveAssetUrl,
    registerMascot: function(name, config) {
        if (!name || !config) return;
        MASCOT_REGISTRY[name] = config;
        console.log(`[ASCILINE] Registered custom mascot: '${name}'`);
    },
    unregisterMascot: function(name) {
        if (name && MASCOT_REGISTRY[name]) {
            delete MASCOT_REGISTRY[name];
            console.log(`[ASCILINE] Unregistered mascot: '${name}'`);
            return true;
        }
        return false;
    },
    getRegisteredMascots: function() {
        return Object.keys(MASCOT_REGISTRY);
    },
    MASCOT_REGISTRY: MASCOT_REGISTRY
};

// Global exports for developers and runtime access
window.ASCILINE = ASCILINE;
window.Mascot = Mascot;
window.MASCOT_REGISTRY = MASCOT_REGISTRY;

// Initialize core systems on load
window.addEventListener('DOMContentLoaded', () => {
    preprocessTextNodes();
    buildCollisionCache();
    window.addEventListener('resize', buildCollisionCache);
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            if (typeof buildCollisionCache === 'function') buildCollisionCache();
        });
    }
    // _initFpsOverlay(); // DEBUG: remove after diagnosis
    
    // Start the physics engine loop
    requestAnimationFrame(physicsLoop);
    
    // Smart Selection: Allow text selection during Ctrl+A or while holding Alt key
    const styleEl = document.createElement('style');
    styleEl.textContent = `
        body.mascot-select-mode .ascii-mascot-wrapper,
        body.mascot-select-mode .ascii-mascot-pre,
        body.mascot-select-mode .colored-mascot-pre span {
            user-select: text !important;
            -webkit-user-select: text !important;
        }
    `;
    document.head.appendChild(styleEl);

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Alt') {
            document.body.classList.add('mascot-select-mode');
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
            document.body.classList.add('mascot-select-mode');
            setTimeout(() => {
                document.body.classList.remove('mascot-select-mode');
            }, 1000);
        }
    });
    window.addEventListener('keyup', (e) => {
        if (e.key === 'Alt') {
            document.body.classList.remove('mascot-select-mode');
        }
    });
});

// ── UNIFIED DEBUG SYSTEM ──
(function() {
    const debugStyle = document.createElement('style');
    debugStyle.id = 'asciline-debug-styles';
    debugStyle.textContent = `
        body.asciline-debug-drag-boxes .ascii-mascot-wrapper {
            outline: 2px solid #ff0055 !important;
            background: rgba(255, 0, 85, 0.08) !important;
        }
        body.asciline-debug-drag-boxes .ascii-mascot-wrapper::after {
            content: "Drag Box";
            position: absolute;
            top: -16px;
            left: 0;
            font-size: 10px;
            font-family: monospace;
            background: #ff0055;
            color: #fff;
            padding: 1px 4px;
            border-radius: 2px;
            pointer-events: none;
            z-index: 10000;
        }
        #asciline-platform-debug-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 9998;
            overflow: visible;
        }
    `;
    document.head.appendChild(debugStyle);

    function updatePlatformDebugOverlay() {
        let overlay = document.getElementById('asciline-platform-debug-overlay');
        const showPlatforms = window.ASCILINE_CONFIG && window.ASCILINE_CONFIG.debug && window.ASCILINE_CONFIG.debug.platforms;

        if (!showPlatforms) {
            if (overlay) overlay.remove();
            return;
        }

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'asciline-platform-debug-overlay';
            document.body.appendChild(overlay);
        }

        let svgHtml = `<svg width="100%" height="${Math.max(document.body.scrollHeight, window.innerHeight)}" style="position:absolute; top:0; left:0;">`;
        if (typeof cachedStaticPlatforms !== 'undefined' && Array.isArray(cachedStaticPlatforms)) {
            cachedStaticPlatforms.forEach(p => {
                const w = p.right - p.left;
                const h = p.bottom - p.top;
                svgHtml += `<rect x="${p.left}" y="${p.top}" width="${w}" height="${h}" fill="rgba(0, 210, 255, 0.2)" stroke="#00d2ff" stroke-width="1.5" stroke-dasharray="4,2" />`;
            });
        }
        svgHtml += `</svg>`;
        overlay.innerHTML = svgHtml;
    }

    window.ASCILINE = window.ASCILINE || {};
    window.ASCILINE.setDebug = function(options = {}) {
        window.ASCILINE_CONFIG.debug = window.ASCILINE_CONFIG.debug || {};
        if (options.dragBoxes !== undefined) window.ASCILINE_CONFIG.debug.dragBoxes = options.dragBoxes;
        if (options.hitboxes !== undefined) window.ASCILINE_CONFIG.debug.hitboxes = options.hitboxes;
        if (options.platforms !== undefined) window.ASCILINE_CONFIG.debug.platforms = options.platforms;
        if (options.fps !== undefined) window.ASCILINE_CONFIG.debug.fps = options.fps;

        // Apply drag boxes
        if (window.ASCILINE_CONFIG.debug.dragBoxes) {
            document.body.classList.add('asciline-debug-drag-boxes');
        } else {
            document.body.classList.remove('asciline-debug-drag-boxes');
        }

        // Apply hitboxes to all active SpriteMascots
        const mascots = (typeof ASCILINE.getMascots === 'function') ? ASCILINE.getMascots() : [];
        mascots.forEach(m => {
            if (typeof m.renderHitboxOverlay === 'function') m.renderHitboxOverlay();
        });

        // Apply platform colliders overlay
        updatePlatformDebugOverlay();
    };

    window.ASCILINE.toggleDebug = function(type) {
        window.ASCILINE_CONFIG.debug = window.ASCILINE_CONFIG.debug || {};
        if (type === 'dragBoxes') {
            window.ASCILINE.setDebug({ dragBoxes: !window.ASCILINE_CONFIG.debug.dragBoxes });
        } else if (type === 'hitboxes') {
            window.ASCILINE.setDebug({ hitboxes: !window.ASCILINE_CONFIG.debug.hitboxes });
        } else if (type === 'platforms') {
            window.ASCILINE.setDebug({ platforms: !window.ASCILINE_CONFIG.debug.platforms });
        } else if (type === 'fps') {
            window.ASCILINE.setDebug({ fps: !window.ASCILINE_CONFIG.debug.fps });
        }
    };
})();
