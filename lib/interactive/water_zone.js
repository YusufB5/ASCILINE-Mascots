/**
 * ASCILINE ASCII AQUARIUM & DYNAMIC WATER ENGINE
 * ===============================================
 * Auto-calculates columns and rows to fill 100% of the container box edge-to-edge.
 */

class AsciiAquarium {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.fps = options.fps || 20;

        // Render target <pre>
        this.pre = this.container.querySelector('pre') || document.createElement('pre');
        if (!this.pre.parentElement) {
            this.container.appendChild(this.pre);
        }
        this.pre.className = 'ascii-aquarium-render';

        // Particles
        this.particles = []; // {x, y, vx, vy, char, color, life, maxLife}
        this.time = 0;

        // Water bounds in page coordinates
        this.bounds = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
        this.updateBounds();

        window.addEventListener('resize', () => this.updateBounds());
        // REMOVED window.addEventListener('scroll') because it forces layout calculation every scroll frame causing massive lag, and bounds don't change on scroll for fixed DOM.

        // Start Loop
        this.start();
    }

    updateBounds() {
        if (!this.container) return;
        const rect = this.container.getBoundingClientRect();
        this.bounds = {
            left: rect.left + window.scrollX,
            top: rect.top + window.scrollY,
            right: rect.right + window.scrollX,
            bottom: rect.bottom + window.scrollY,
            width: rect.width,
            height: rect.height
        };

        // Determine font size dynamically based on mobile vs desktop
        const isMobile = window.innerWidth <= 640;
        const fontSize = isMobile ? 6 : 9.5;
        const lineHeight = isMobile ? 6.5 : 10;

        if (this.currentFontSize !== fontSize) {
            this.currentFontSize = fontSize;
            this.pre.style.fontSize = `${fontSize}px`;
            this.pre.style.lineHeight = `${lineHeight}px`;
        }

        const charW = fontSize * 0.6; // exact ratio for Courier New / JetBrains Mono
        const charH = lineHeight;

        // Calculate fixed target dimensions independent of CSS height/scale animations
        const targetW = isMobile ? Math.max(280, window.innerWidth - 32) : Math.min(1200, Math.max(300, window.innerWidth - 64));
        const targetH = isMobile ? 280 : 420;

        this.cols = Math.max(30, Math.floor(targetW / charW));
        this.rows = Math.max(10, Math.floor(targetH / charH));
    }

    isInside(pageX, pageY) {
        return (
            pageX >= this.bounds.left &&
            pageX <= this.bounds.right &&
            pageY >= this.bounds.top &&
            pageY <= this.bounds.bottom
        );
    }

    // Add splash particles when breaking surface
    addSplash(pageX, pageY, intensity = 12) {
        const localX = (pageX - this.bounds.left) / this.bounds.width * this.cols;
        const localY = (pageY - this.bounds.top) / this.bounds.height * this.rows;

        const chars = ['°', '*', '.', 'o', '≈', '`', 'v', '^'];
        const colors = ['#00ffff', '#00d2d3', '#54a0ff', '#ffffff'];

        for (let i = 0; i < intensity; i++) {
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
            const speed = 0.6 + Math.random() * 1.4;
            this.particles.push({
                x: localX + (Math.random() - 0.5) * 4,
                y: localY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: 0.12,
                char: chars[Math.floor(Math.random() * chars.length)],
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 0,
                maxLife: 22 + Math.floor(Math.random() * 15)
            });
        }
    }

    // Add bubble particles floating up from mascot position
    addBubble(pageX, pageY) {
        const localX = (pageX - this.bounds.left) / this.bounds.width * this.cols;
        const localY = (pageY - this.bounds.top) / this.bounds.height * this.rows;

        const chars = ['o', 'O', '°', '.'];
        this.particles.push({
            x: localX + (Math.random() - 0.5) * 2,
            y: localY,
            vx: (Math.random() - 0.5) * 0.25,
            vy: -0.45 - Math.random() * 0.35,
            gravity: 0,
            char: chars[Math.floor(Math.random() * chars.length)],
            color: '#00ffff',
            life: 0,
            maxLife: 35 + Math.floor(Math.random() * 20)
        });
    }

    start() {
        setInterval(() => this.render(), 1000 / this.fps);
    }

    render() {
        this.time += 0.15;
        this.updateBounds();

        if (!this.cols || !this.rows) return;

        // Build 2D grid of organic static block-shaded aquarium scene (Zero animation CPU load)
        let grid = [];

        for (let r = 0; r < this.rows; r++) {
            let rowChars = [];
            const depth = r / Math.max(1, this.rows - 1);

            for (let c = 0; c < this.cols; c++) {
                // Organic wave/contour curve for natural depth contours instead of flat horizontal lines
                const organicOffset = Math.sin(c * 0.08) * 0.05 + Math.cos(c * 0.04 + r * 0.1) * 0.03;
                const effectiveDepth = depth + organicOffset;

                let char, color;

                if (r === 0) {
                    // Surface crest
                    char = (c % 4 === 0) ? '^' : '~';
                    color = '#00ffff';
                } else if (effectiveDepth < 0.20) {
                    // Shallow clear water
                    char = (c % 3 === 0) ? '≈' : '~';
                    color = '#00d2d3';
                } else if (effectiveDepth < 0.42) {
                    // Light dither & caustics
                    char = ((c + r) % 5 === 0) ? '░' : ((c % 2 === 0) ? '~' : '≈');
                    color = '#0abde3';
                } else if (effectiveDepth < 0.68) {
                    // Mid-depth block shading
                    char = ((c + r) % 3 === 0) ? '▒' : '░';
                    color = '#01a3a4';
                } else if (effectiveDepth < 0.88) {
                    // Deep water shading
                    char = ((c + r) % 2 === 0) ? '█' : '▒';
                    color = '#007a87';
                } else {
                    // Ocean floor / seabed
                    char = '█';
                    color = '#004650';
                }

                rowChars.push({ char, color });
            }
            grid.push(rowChars);
        }


        // Overlay & update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life++;
            p.x += p.vx;
            p.y += p.vy;
            if (p.gravity) p.vy += p.gravity;

            if (p.life >= p.maxLife || p.x < 0 || p.x >= this.cols || p.y < 0 || p.y >= this.rows) {
                this.particles.splice(i, 1);
                continue;
            }

            const gx = Math.floor(p.x);
            const gy = Math.floor(p.y);
            if (gy >= 0 && gy < this.rows && gx >= 0 && gx < this.cols) {
                grid[gy][gx] = { char: p.char, color: p.color };
            }
        }

        // Convert grid to HTML string
        let html = '';
        for (let r = 0; r < this.rows; r++) {
            let rowStr = '';
            let currentColor = null;
            let run = '';

            for (let c = 0; c < this.cols; c++) {
                const cell = grid[r][c];
                if (cell.color !== currentColor) {
                    if (run) {
                        rowStr += `<span style="color:${currentColor}">${run}</span>`;
                    }
                    currentColor = cell.color;
                    run = cell.char;
                } else {
                    run += cell.char;
                }
            }
            if (run) {
                rowStr += `<span style="color:${currentColor}">${run}</span>`;
            }
            html += rowStr + '\n';
        }

        this.pre.innerHTML = html;
    }
}

// Global initialization helper
window.initAsciiAquarium = function (containerId) {
    window.AsciiAquariumInstance = new AsciiAquarium(containerId);
};
