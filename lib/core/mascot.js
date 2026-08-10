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
    destructibleSelectors: 'h1, h2, h3, h4, h5, h6, p, li, button, .asciline-destructible'
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
        
        const dynamicElements = document.getElementsByClassName('ascii-dynamic');
        for (const el of dynamicElements) {
            if (el.closest('#overlay-container') || el.getBoundingClientRect().height === 0) continue;
            const rect = el.getBoundingClientRect();
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
        
        const dynamicElements = document.getElementsByClassName('ascii-dynamic');
        for (const el of dynamicElements) {
            if (el.closest('#overlay-container') || el.getBoundingClientRect().height === 0) continue;
            const rect = el.getBoundingClientRect();
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


// ── MASCOT REGISTRY ──
// Defines configurations for dynamically spawnable mascots.
// We use getter functions for classes to avoid script load order issues.
const MASCOT_REGISTRY = {
    'bomb': {
        get_class: () => BombPhysics,
        args: []
    },
    'slime': {
        get_class: () => JumperPhysics,
        args: []
    },
    'launcher': {
        get_class: () => LauncherPhysics,
        args: []
    },
    'cat': {
        get_class: () => WalkingSpriteMascot,
        get_args: () => {
            const isMobile = typeof window !== 'undefined' && (window.innerWidth <= 768 || ('ontouchstart' in window && window.navigator.maxTouchPoints > 0));
            const isSecondCat = !isMobile && Math.random() < 0.3;
            const jsonPath = isSecondCat ? '/assets/mascots/secondcat_coloranim.json' : '/assets/mascots/whitecat_coloranim.json';
            return [jsonPath, 80, 50, 15, 2];
        },
        args: ['/assets/mascots/whitecat_coloranim.json', 80, 50, 15, 2]
    },
    'whitecat': {
        get_class: () => WalkingSpriteMascot,
        args: ['/assets/mascots/whitecat_coloranim.json', 80, 50, 15, 2]
    },
    'secondcat': {
        get_class: () => WalkingSpriteMascot,
        args: ['/assets/mascots/secondcat_coloranim.json', 80, 50, 15, 2]
    },
    'dragon': {
        get_class: () => FlyingMascot,
        args: ['/assets/mascots/dragon2_coloranim.json', 100, 50, 33, 8.3] // fps*3.33 + flySpeed*3.33 for dt physics
    },
    'dolphin': {
        get_class: () => SwimmerMascot,
        args: ['/assets/mascots/dolphin2_coloranim.json', 70, 38, 20, 10, true]
    },
    'blackhole': {
        get_class: () => BlackholePhysics,
        args: ['/assets/mascots/blackhole_coloranim.json', 150, 150, 200, 200, 12]
    },
    'blackhole2': {
        get_class: () => BlackholePhysics,
        args: ['/assets/mascots/blackhole2_coloranim.json', 200, 200, 250, 250, 15] // larger size for apocalypse
    },
    'spider': {
        get_class: () => SpiderMascot,
        args: []
    },
    'confetycat': {
        get_class: () => WalkingSpriteMascot,
        args: ['/assets/mascots/confetycat_coloranim.json', 80, 50, 15, 2]
    },
    'dolphin2': {
        get_class: () => SwimmerMascot,
        args: ['/assets/mascots/dolphin2_coloranim.json', 70, 38, 20, 10, true]
    },
    'bouncer': {
        get_class: () => BouncerMascot,
        args: []
    },
    'pokeball': {
        get_class: () => PokeballMascot,
        args: []
    },
    'pikachu': {
        get_class: () => RunnerMascot,
        args: ['/assets/mascots/pikachu_coloranim.json', 100, 70, 15, 3]
    },
    'flyerpokemon': {
        get_class: () => FlyingMascot,
        // Passing 'bottom' as spawnLoc argument (index 6) to not spawn too high up
        args: ['/assets/mascots/flyerpokemon_coloranim.json', 100, 50, 15, 6.0, null, 'bottom']
    },
    'jumpluff': {
        get_class: () => JumperPhysics,
        // jumpPowerY: 45 (jumps much higher than slime's 33)
        // jumpFreqTimer: 26 (1.5x more frequent than slime's 40)
        // squishFactor: 0.7 (30% less vertical squish)
        args: ['/assets/mascots/jumpluff-pokemon_coloranim.json', 120, 120, 15, 'center', 'bottom', { jumpPowerY: 45, jumpFreqTimer: 26, squishFactor: 0.7 }]
    },
    'sword': {
        get_class: () => SwordMascot,
        args: ['/assets/mascots/sword_coloranim.json', 90, 90, 12]
    },
    'stone': {
        get_class: () => StaticMascot,
        args: ['/assets/mascots/stone_coloranim.json', 120, 90, 10]
    },
    'honoredcats': {
        get_class: () => WalkingSpriteMascot,
        args: ['/assets/mascots/honoredCats_coloranim.json', 260, 200, 12, 2]
    },
    'hand': {
        get_class: () => GodHand,
        args: ['/assets/mascots/hand_coloranim.json', 120, 120, 15, 4, 'hunter']
    }
};

// ── ENGINE INITIALIZATION & API ──
let mascots = [];
let _lastFrameTime = 0;

// ── DEBUG FPS OVERLAY ──
let _fpsEl = null;
let _fpsFrameCount = 0;
let _fpsLastSec = 0;
let _fpsDisplay = 0;
let _dtDisplay = 0;

function _initFpsOverlay() {
    _fpsEl = document.createElement('div');
    _fpsEl.id = 'mascot-fps-debug';
    _fpsEl.style.cssText = `
        position: fixed; top: 60px; right: 10px; z-index: 99999;
        background: rgba(0,0,0,0.85); color: #00ff41;
        font: bold 13px monospace; padding: 6px 10px;
        border: 1px solid #00ff41; border-radius: 4px;
        pointer-events: none;
    `;
    document.body.appendChild(_fpsEl);
}

function physicsLoop(timestamp) {
    const rawDt = _lastFrameTime ? (timestamp - _lastFrameTime) / 16.667 : 1.0;
    const dt = Math.min(rawDt, 3.0);
    _lastFrameTime = timestamp;

    _fpsFrameCount++;
    _dtDisplay = rawDt;
    if (timestamp - _fpsLastSec >= 1000) {
        _fpsDisplay = _fpsFrameCount;
        _fpsFrameCount = 0;
        _fpsLastSec = timestamp;
        if (_fpsEl) {
            _fpsEl.textContent = `FPS: ${_fpsDisplay} | rawDt: ${_dtDisplay.toFixed(2)} | dt: ${dt.toFixed(2)}`;
        }
    }

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
    }
};

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
