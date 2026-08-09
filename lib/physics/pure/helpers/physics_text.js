class DomPhysicsObject extends Mascot {
    constructor(htmlContent, x, y, width, height, originalStyles, initialVx = null, initialVy = null) {
        // Trick the Mascot base class by generating temporary unique IDs
        const uniqueId = Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
        const tempWrapperId = 'physics-wrapper-' + uniqueId;
        const tempPreId = 'physics-pre-' + uniqueId;
        
        const wrapper = document.createElement('div');
        wrapper.id = tempWrapperId;
        wrapper.className = 'ascii-mascot-wrapper';
        wrapper.style.position = 'absolute';
        wrapper.style.zIndex = '9999';
        wrapper.style.pointerEvents = 'auto'; // Required for drag and drop
        
        const pre = document.createElement('div'); // Using div instead of pre since it contains HTML
        pre.id = tempPreId;
        pre.className = 'ascii-mascot-pre'; 
        pre.style.margin = '0';
        pre.style.whiteSpace = 'nowrap'; // Prevent text wrapping
        pre.style.fontWeight = 'bold';
        pre.innerHTML = htmlContent;
        
        if (originalStyles) {
            pre.style.color = originalStyles.color || 'var(--accent-color)';
            if (originalStyles.fontSize) {
                const isMobile = window.innerWidth <= 768;
                if (isMobile) {
                    const parsedSize = parseFloat(originalStyles.fontSize);
                    const unit = originalStyles.fontSize.replace(/[0-9.]/g, '') || 'px';
                    pre.style.fontSize = `${(parsedSize * 1.2).toFixed(1)}${unit}`;
                } else {
                    pre.style.fontSize = originalStyles.fontSize;
                }
            }
            if (originalStyles.fontFamily) pre.style.fontFamily = originalStyles.fontFamily;
            if (originalStyles.letterSpacing) pre.style.letterSpacing = originalStyles.letterSpacing;
            if (originalStyles.fontWeight) pre.style.fontWeight = originalStyles.fontWeight;
            if (originalStyles.textTransform) pre.style.textTransform = originalStyles.textTransform;
            if (originalStyles.lineHeight) pre.style.lineHeight = originalStyles.lineHeight;
            if (originalStyles.background) pre.style.background = originalStyles.background;
            if (originalStyles.webkitBackgroundClip) pre.style.webkitBackgroundClip = originalStyles.webkitBackgroundClip;
            if (originalStyles.webkitTextFillColor) pre.style.webkitTextFillColor = originalStyles.webkitTextFillColor;
            pre.style.padding = '0';
        } else {
            pre.style.color = 'var(--accent-color)';
        }
        
        wrapper.appendChild(pre);
        document.body.appendChild(wrapper);
        
        // Initialize base class to activate physics and drag-drop events
        super(tempWrapperId, tempPreId, width, height);
        
        // Assign real positions with strict viewport bounds clamping
        this.x = Math.max(0, Math.min(x, window.innerWidth - (width || 20)));
        this.y = y;
        
        // Custom velocities or default uppercut
        this.gravity = 1.85; // Increased gravity for punchier impact
        this.vy = initialVy !== null ? initialVy : (-12 - Math.random() * 5);
        this.vx = initialVx !== null ? initialVx : ((Math.random() - 0.5) * 20);
        
        // Add rotational velocity
        this.rotation = 0;
        this.vr = (Math.random() - 0.5) * 15;
        
        // Make text fragments a bit heavier and bouncier
        this.bounce = 0.5; 
        
        // Clean up temporary IDs
        this.wrapper.removeAttribute('id');
        this.pre.removeAttribute('id');
        
        this.updateDOMPosition();
    }
    
    // Override tick to only calculate physics (no animation frames needed for static text)
    tick(dt = 1) {
        if (this.isDragging) {
            this.wrapper.style.transform = `translate3d(${this.x}px, ${this.y}px, 0) rotate(${this.rotation}deg)`;
            return;
        }

        if (this.currentState === 'FALL') {
            this.vy += this.gravity * dt;
            this.vx *= Math.pow(this.friction, dt);
            this.vy *= Math.pow(this.friction, dt);
            
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            
            // Wall bounce (tightly clamped to document clientWidth to prevent horizontal scroll overflow)
            const maxRight = Math.max(0, document.documentElement.clientWidth - this.width - 2);
            if (this.x <= 0) {
                this.x = 0;
                this.vx *= -this.bounce;
            } else if (this.x >= maxRight) {
                this.x = maxRight;
                this.vx *= -this.bounce;
            }
            
            // Floor / Platform collision
            const scrollY = window.pageYOffset || document.documentElement.scrollTop;
            const absoluteBottom = scrollY + window.innerHeight - this.height;
            
            if (this.y >= absoluteBottom) {
                // Bottom of the page bounds
                this.y = absoluteBottom;
                if (Math.abs(this.vy) > 1.5) {
                    this.vy *= -this.bounce;
                    this.vr *= 0.6; // Dampen spin speed on bounce
                } else {
                    this.vy = 0;
                    this.vx *= Math.pow(0.7, dt); // Ground friction
                    this.vr *= Math.pow(0.3, dt); // Rapidly stop spin on ground to prevent pinwheel effect
                    if (Math.abs(this.vx) < 0.1) this.vx = 0;
                    if (Math.abs(this.vr) < 0.1) this.vr = 0;
                }
            }
            
            // Apply rotation while spinning
            if (Math.abs(this.vr) > 0.05) {
                this.rotation += this.vr * dt;
            }
        }
        
        // We override updateDOMPosition here to include rotation
        this.wrapper.style.transform = `translate3d(${this.x}px, ${this.y}px, 0) rotate(${this.rotation}deg)`;
    }
}
