class BlackholePhysics extends StaticMascot {
    constructor(jsonUrl, width = 150, height = 150, x = window.innerWidth / 2, y = window.innerHeight / 2, fps = 12) {
        super(jsonUrl, width, height, x, y, fps);
        
        // Massive Gravitational Attraction Radius (600px circular radius around center)
        this.pullRadius = 600;
        this.pullForceBase = 5.2; // ~40% force boost over original base 4.0
        this.eventHorizonRadius = 50; // Swallow distance
        this.isBlackhole = true;

        // Dynamic Growth & Critical Mass Explosion Mechanics
        this.swallowCount = 0;
        this.maxSwallows = 10; // Reaches critical mass and explodes after 10 swallows
        this.currentScale = 1.0;
        this.isExploding = false;
    }

    onSwallow(m, cx, cy) {
        if (this.isExploding) return;
        this.swallowCount++;

        // Dynamic Growth: Scale increases by +12% for each swallowed mascot
        this.currentScale = 1.0 + this.swallowCount * 0.12;

        if (this.pre) {
            this.pre.style.transition = 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.27)';
            this.pre.style.transform = `scale(${this.currentScale * 1.25})`; // Punchy swallow bounce
            setTimeout(() => {
                if (this.pre && !this.isExploding) {
                    this.pre.style.transform = `scale(${this.currentScale})`;
                }
            }, 150);
        }

        // Satisfying Gravitational Shockwave Effect
        this.triggerShockwave(cx, cy);

        // Check Critical Mass Explosion Threshold
        if (this.swallowCount >= this.maxSwallows) {
            this.triggerExplosion(cx, cy);
        }
    }

    triggerShockwave(cx, cy) {
        const ring = document.createElement('div');
        ring.style.cssText = `
            position: absolute;
            left: ${cx - 40}px;
            top: ${cy - 40}px;
            width: 80px;
            height: 80px;
            border: 3px solid rgba(190, 80, 255, 0.95);
            border-radius: 50%;
            box-shadow: 0 0 35px rgba(190, 80, 255, 0.85), inset 0 0 20px rgba(190, 80, 255, 0.5);
            pointer-events: none;
            z-index: 99990;
            opacity: 1;
            transform: scale(1);
            transition: transform 0.55s ease-out, opacity 0.55s ease-out;
        `;
        document.body.appendChild(ring);

        requestAnimationFrame(() => {
            ring.style.transform = `scale(${6 + this.currentScale * 2.5})`;
            ring.style.opacity = '0';
        });

        setTimeout(() => ring.remove(), 580);
    }

    triggerExplosion(cx, cy) {
        this.isExploding = true;

        // Shake violently before collapsing & exploding
        if (this.pre) {
            this.pre.style.transition = 'filter 0.2s ease-out, transform 0.05s ease-in-out';
            this.pre.style.filter = 'drop-shadow(0 0 45px #b040ff) hue-rotate(180deg) brightness(1.5)';
        }

        let shakeFrames = 0;
        const shakeInterval = setInterval(() => {
            shakeFrames++;
            const ox = (Math.random() - 0.5) * 18;
            const oy = (Math.random() - 0.5) * 18;
            if (this.pre) {
                this.pre.style.transform = `scale(${this.currentScale}) translate3d(${ox}px, ${oy}px, 0)`;
            }

            if (shakeFrames >= 14) {
                clearInterval(shakeInterval);
                this.explodeParticles(cx, cy);
            }
        }, 30);
    }

    explodeParticles(cx, cy) {
        if (window.ASCILINE_AUDIO) window.ASCILINE_AUDIO.play('blackholeExplode');
        
        // Shockwave burst
        this.triggerShockwave(cx, cy);

        // Smooth collapse animation for the blackhole element itself
        if (this.pre) {
            this.pre.style.transition = 'transform 0.25s ease-in, opacity 0.25s ease-in, filter 0.25s ease-in';
            this.pre.style.transform = 'scale(0) rotate(720deg)';
            this.pre.style.opacity = '0';
        }

        // Explode into 32 cosmic ASCII particles flying 360° outward
        const chars = ['✦', '✧', '★', '⚙', '🌀', '✦', '°', '@', '#', '░', '▒'];
        const numParticles = 32;

        for (let i = 0; i < numParticles; i++) {
            const angle = (i / numParticles) * Math.PI * 2 + (Math.random() * 0.2);
            const speed = 8 + Math.random() * 12;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;

            const p = document.createElement('span');
            p.textContent = chars[Math.floor(Math.random() * chars.length)];
            p.style.cssText = `
                position: absolute;
                left: ${cx}px;
                top: ${cy}px;
                font: bold 18px monospace;
                color: ${i % 2 === 0 ? '#b040ff' : '#00e5ff'};
                text-shadow: 0 0 12px ${i % 2 === 0 ? '#b040ff' : '#00e5ff'};
                pointer-events: none;
                z-index: 99999;
                opacity: 1;
                transform: translate3d(0,0,0);
                transition: transform 0.8s cubic-bezier(0.1, 0.8, 0.3, 1), opacity 0.8s ease-out;
            `;
            document.body.appendChild(p);

            requestAnimationFrame(() => {
                p.style.transform = `translate3d(${vx * 25}px, ${vy * 25}px, 0) scale(${0.5 + Math.random() * 1.5}) rotate(${Math.random() * 720}deg)`;
                p.style.opacity = '0';
            });

            setTimeout(() => p.remove(), 850);
        }

        // Destroy blackhole after collapse animation finishes
        setTimeout(() => {
            if (typeof this.destroy === 'function') this.destroy();
            const idx = mascots.indexOf(this);
            if (idx > -1) mascots.splice(idx, 1);
        }, 260);
    }

    tick(dt = 1) {
        if (!this.isLoaded || this.isExploding) return;
        super.tick(dt);

        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;

        const allMascots = typeof window.ASCILINE !== 'undefined' && window.ASCILINE.getMascots ? window.ASCILINE.getMascots() : mascots;
        if (!allMascots || !Array.isArray(allMascots)) return;

        for (let i = allMascots.length - 1; i >= 0; i--) {
            const m = allMascots[i];
            if (!m || m === this || m.isBlackhole || m instanceof BlackholePhysics) continue;
            // Don't pull Excalibur sword or shatter shards
            if (m.isShatterShard || (m.constructor && m.constructor.name === 'SwordMascot')) continue;

            const mcx = m.x + (m.width || 30) / 2;
            const mcy = m.y + (m.height || 30) / 2;

            const dx = cx - mcx;
            const dy = cy - mcy;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Dynamic event horizon distance based on current scale
            const currentEventHorizon = this.eventHorizonRadius * this.currentScale;

            if (dist < this.pullRadius && dist > 1) {
                // Event Horizon Swallow check
                if (dist <= currentEventHorizon) {
                    if (m.isSwallowing) continue;
                    m.isSwallowing = true;

                    // Spiral suck animation into blackhole singularity
                    if (m.wrapper) {
                        m.wrapper.style.transition = 'transform 0.25s ease-in, opacity 0.25s ease-in';
                        m.wrapper.style.transform = `translate3d(${cx}px, ${cy}px, 0) scale(0.05) rotate(720deg)`;
                        m.wrapper.style.opacity = '0';
                    }

                    setTimeout(() => {
                        if (typeof m.destroy === 'function') m.destroy();
                        const idx = mascots.indexOf(m);
                        if (idx > -1) mascots.splice(idx, 1);
                    }, 250);

                    // Trigger growth & shockwave
                    this.onSwallow(m, cx, cy);
                    continue;
                }

                // Gravitational pull force curve (Inverse quadratic)
                const pullFactor = (1 - dist / this.pullRadius);
                const force = pullFactor * pullFactor * this.pullForceBase * dt * (0.9 + this.currentScale * 0.1);

                const nx = dx / dist;
                const ny = dy / dist;

                if (typeof m.vx !== 'undefined') {
                    m.vx += nx * force * 2.5;
                } else {
                    m.x += nx * force * 3.5;
                }

                if (typeof m.vy !== 'undefined') {
                    m.vy += ny * force * 2.5;
                } else {
                    m.y += ny * force * 3.5;
                }

                // Swirling rotation effect for pulled mascots
                if (m.wrapper && dist < 220) {
                    m.rotation = (m.rotation || 0) + (6 * (220 - dist) / 220) * dt;
                }
            }
        }
    }
}

(window.ASCILINE = window.ASCILINE || {}).Physics = window.ASCILINE.Physics || {};
window.ASCILINE.Physics.BlackHole = BlackholePhysics;
