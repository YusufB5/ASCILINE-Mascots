/**
 * EXCALIBUR - The Sword in the Stone
 * =====================================
 * Interactive easter egg. User drags the sword upward to pull it free.
 * On success: screen shakes, stone breaks, conquest banner shows,
 * sword becomes a physics mascot, and a knight mascot spawns to fight.
 */
(function () {
  "use strict";

  const isMobile =
    typeof window !== "undefined" &&
    (window.innerWidth <= 768 ||
      ("ontouchstart" in window && window.navigator.maxTouchPoints > 0));
  const PULL_THRESHOLD = isMobile ? 150 : 250; // 150px on mobile for smoother experience, 250px on desktop

  const swordWrapper = document.getElementById("sword-wrapper");
  const swordEl = document.getElementById("excalibur-sword");
  const stoneEl = document.getElementById("excalibur-stone");
  const hintEl = document.getElementById("excalibur-hint");

  if (!swordWrapper) return;

  // Helper to fetch json safely (fallback relative path)
  function fetchJson(url) {
    return fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Not ok");
        return res.json();
      })
      .catch(() => fetch(url.replace(/^\//, "")).then((res) => res.json()));
  }

  // Load detailed coloranim sword asset into the stone wrapper
  fetchJson("assets/mascots/sword_coloranim.json")
    .then((data) => {
      if (data && data.frames && data.frames[0] && swordEl) {
        swordEl.classList.add("colored-mascot-pre");
        const html =
          typeof SpriteMascot !== "undefined" && SpriteMascot.formatFrameToHTML
            ? SpriteMascot.formatFrameToHTML(data.frames[0])
            : data.frames[0];
        swordEl.innerHTML = html;
      }
    })
    .catch((err) => console.warn("Could not load detailed sword preview", err));

  // Load detailed coloranim stone asset
  fetchJson("assets/mascots/stone2_coloranim.json")
    .then((data) => {
      if (
        data &&
        data.frames &&
        data.frames.length > 0 &&
        stoneEl &&
        !stoneEl.classList.contains("broken")
      ) {
        stoneEl.classList.add("colored-mascot-pre");
        let frameIdx = 0;
        const updateStone = () => {
          if (stoneEl.classList.contains("broken")) return;
          const frameData = data.frames[frameIdx];
          stoneEl.innerHTML =
            typeof SpriteMascot !== "undefined" &&
            SpriteMascot.formatFrameToHTML
              ? SpriteMascot.formatFrameToHTML(frameData)
              : frameData;
          frameIdx = (frameIdx + 1) % data.frames.length;
        };
        updateStone();
        if (data.idleMode === "play" && data.frames.length > 1) {
          setInterval(updateStone, 150);
        }
      }
    })
    .catch((err) => console.warn("Could not load detailed stone preview", err));

  // ── Drag & Click state ──
  let isDragging = false;
  let startY = 0;
  let targetPull = 0;
  let currentPull = 0;
  let animationFrameId = null;

  const SINK_OFFSET = 80; // Sword initial stone embed depth
  const BASE_X = -31;                   // Horizontal offset base (-31px shift)
  const MAX_PULL_SPEED = isMobile ? 0.8 : 0.4; // Mobile pull speed limit

  // Set initial embed depth
  if (swordWrapper) {
    swordWrapper.style.transform = `translate(${BASE_X}px, ${SINK_OFFSET}px)`;
  }

  function getClientY(e) {
    return e.touches ? e.touches[0].clientY : e.clientY;
  }

  swordWrapper.addEventListener("mousedown", onDragStart, { passive: false });
  swordWrapper.addEventListener("touchstart", onDragStart, { passive: false });

  function updatePhysics() {
    if (!isDragging && currentPull <= 0) {
      animationFrameId = null;
      return; // Stop loop
    }

    // currentPull smoothly lerps towards targetPull
    const diff = targetPull - currentPull;
    if (diff > 0) {
      // Speed limit while pulling (resistance feel)
      currentPull += Math.min(diff, MAX_PULL_SPEED);
    } else {
      // Return speed when released
      currentPull += diff * 0.2;
    }

    if (currentPull < 0) currentPull = 0;

    // Visual calculations
    const resistance = 0.5; // Resistance factor for sword release
    let visualLift = currentPull * resistance;
    let finalY = SINK_OFFSET - visualLift; // Sword moves upward from SINK_OFFSET

    // Shake effect on heavy pull
    let shakeX = 0;
    if (currentPull > 30 && isDragging) {
      shakeX = (Math.random() - 0.5) * (currentPull / 25);
    }

    if (swordWrapper) {
      swordWrapper.style.transform = `translate(${BASE_X + shakeX}px, ${finalY}px)`;
    }

    if (swordEl) {
      const t = Math.min(currentPull / PULL_THRESHOLD, 1);
      swordEl.style.color = interpolateColor("#c9aa54", "#ffd700", t);
      const glowSize = 6 + t * 25;
      swordEl.style.textShadow = `0 0 ${glowSize}px rgba(255, 215, 0, ${0.4 + t * 0.6})`;
    }

    // Success check
    if (currentPull >= PULL_THRESHOLD) {
      onPullSuccess();
      return; // Stop animation loop
    }

    // Stop loop when returned to stone to prevent memory leaks
    if (!isDragging && currentPull < 0.5) {
      currentPull = 0;
      animationFrameId = null;
      // Son bir kez yeri resetle
      if (swordWrapper) swordWrapper.style.transform = `translate(${BASE_X}px, ${SINK_OFFSET}px)`;
      return;
    }

    animationFrameId = requestAnimationFrame(updatePhysics);
  }

  function onDragStart(e) {
    if (stoneEl && stoneEl.classList.contains("broken")) return;
    if (e.cancelable) e.preventDefault();

    isDragging = true;
    startY = getClientY(e);
    targetPull = 0;

    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";

    swordWrapper.classList.add("pulling");
    if (hintEl) hintEl.classList.add("hidden");
    
    if (window.ASCILINE_AUDIO) {
        window.ASCILINE_AUDIO.play('excaliburRumble');
    }

    if (swordEl) {
      swordEl.style.transition = "none";
      swordWrapper.style.transition = "none";
    }

    if (!animationFrameId) {
      animationFrameId = requestAnimationFrame(updatePhysics);
    }

    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("touchmove", onDragMove, { passive: false });
    document.addEventListener("mouseup", onDragEnd);
    document.addEventListener("touchend", onDragEnd);
  }

  function onDragMove(e) {
    if (!isDragging) return;
    if (e.cancelable) e.preventDefault();
    if (window.getSelection) {
      window.getSelection().removeAllRanges();
    }

    const y = getClientY(e);
    const dy = startY - y;
    targetPull = Math.max(0, dy); // Farenin/parmağın gitmek istediği yer
  }

  function onDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    targetPull = 0; // Hedef sıfırlanır, kılıç physics döngüsünde yavaşça düşer

    document.body.style.userSelect = "";
    document.body.style.webkitUserSelect = "";

    swordWrapper.classList.remove("pulling");
    if (swordEl) {
      swordEl.style.transition = "color 0.4s, text-shadow 0.4s";
      swordEl.style.color = "#c9aa54";
      swordEl.style.textShadow = "0 0 6px rgba(255, 215, 0, 0.4)";
    }
    if (hintEl) hintEl.classList.remove("hidden");

    document.removeEventListener("mousemove", onDragMove);
    document.removeEventListener("touchmove", onDragMove);
    document.removeEventListener("mouseup", onDragEnd);
    document.removeEventListener("touchend", onDragEnd);
  }

  function onPullSuccess() {
    // Immediately rebuild collision cache so old positions are flushed
    if (typeof buildCollisionCache === "function") buildCollisionCache();

    // Stop listening immediately
    isDragging = false;
    document.body.style.userSelect = "";
    document.body.style.webkitUserSelect = "";

    document.removeEventListener("mousemove", onDragMove);
    document.removeEventListener("touchmove", onDragMove);
    document.removeEventListener("mouseup", onDragEnd);
    document.removeEventListener("touchend", onDragEnd);
    swordWrapper.style.pointerEvents = "none";

    if (window.ASCILINE_AUDIO) {
        window.ASCILINE_AUDIO.play('excaliburSlide');
        window.ASCILINE_AUDIO.play('honoredCatsDrums');
        setTimeout(() => {
            window.ASCILINE_AUDIO.play('excaliburSuccess');
        }, 800);
    }

    // 1. Fly the sword off the top
    swordWrapper.style.transition =
      "transform 0.4s cubic-bezier(0.2, 0.8, 0.4, 1.4), opacity 0.4s";
    swordWrapper.style.transform = `translate(${BASE_X}px, -200px)`;
    swordWrapper.style.opacity = "0";

    // 2. Stone explodes — simplified on mobile for performance
    if (stoneEl) {
      stoneEl.classList.add("broken");
      if (!isMobile) {
        _explodeStone(stoneEl);
      } else {
        // Mobile: just hide the stone instantly with a flash, no heavy canvas
        stoneEl.style.transition = "opacity 0.3s ease-out, transform 0.3s ease-out";
        stoneEl.style.opacity = "0";
        stoneEl.style.transform = "scale(1.3)";
        setTimeout(() => { stoneEl.style.display = "none"; }, 350);
      }
    }

    // 3. Screen shake
    document.body.classList.add("excalibur-shaking");
    setTimeout(() => document.body.classList.remove("excalibur-shaking"), 500);

    // 4. Mascot Spawns: Desktop gets the physics sword & honored cats; Mobile skips mascots for 60fps performance
    if (!isMobile) {
      setTimeout(() => {
        _spawnSwordMascot();
        setTimeout(_spawnHonoredCats, 600);
      }, 300);
    }

    // 5. Inline celebration banner
    setTimeout(() => {
      _showInlineCelebration();
    }, 500);

    // Update hint
    if (hintEl) {
      hintEl.classList.remove("hidden");
      hintEl.classList.add("conquered");
      hintEl.textContent = "⚔ THE STONE HAS BEEN BROKEN — EXCALIBUR IS YOURS ⚔";
      // Inline stilleri kaldırıyoruz çünkü css class devralacak
      hintEl.style.color = "";
      hintEl.style.animation = "";
      hintEl.style.opacity = "";
      hintEl.style.letterSpacing = "";
    }
  }

  function _getContainerRect() {
    const container = document.getElementById("excalibur-container");
    if (container) {
      const r = container.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return r;
    }
    return {
      left: window.innerWidth / 2 - 100,
      right: window.innerWidth / 2 + 100,
      top: window.innerHeight * 0.4,
      bottom: window.innerHeight * 0.7,
      width: 200,
      height: 200,
    };
  }

  function _spawnSwordMascot() {
    if (!window.ASCILINE) return;
    const cRect = _getContainerRect();
    const spawnX = cRect.left + cRect.width / 2 - 45;
    const spawnY = cRect.top + window.scrollY - 35;
    try {
      const m = window.ASCILINE.spawn("sword", spawnX, spawnY);
      if (m) {
        m.vx = 0;
        m.vy = 0;
        m.isLevitating = true; // Havada sihirli süzülme! İlk dokunuşa kadar sabit kalır.
      }
    } catch (e) {
      console.warn("Excalibur: sword mascot spawn failed", e);
    }
  }

  function _spawnSparks(cx, cy) {
    let canvas = document.getElementById("asciline-spark-canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "asciline-spark-canvas";
      canvas.style.cssText =
        "position:absolute;top:0;left:0;pointer-events:none;z-index:99999;";
      document.body.appendChild(canvas);
    }
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");

    const COLORS = [
      "#ffe566",
      "#ffa500",
      "#ffdd00",
      "#ffffff",
      "#ffcc44",
      "#ff8800",
    ];
    const CHARS = ["✦", "★", "⚡", "◆", "*", "#"];

    const particles = Array.from({ length: 35 }, () => {
      const a = Math.random() * Math.PI * 2;
      const s = 4 + Math.random() * 16;
      return {
        x: cx,
        y: cy,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 3,
        char: CHARS[Math.floor(Math.random() * CHARS.length)],
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 10 + Math.random() * 14,
        rot: Math.random() * 360,
        vr: (Math.random() - 0.5) * 20,
        life: 1.0,
      };
    });

    let last = performance.now();
    const draw = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000) * 60;
      last = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = 0;
      for (const p of particles) {
        if (p.life <= 0) continue;
        p.life -= 0.025 * dt;
        if (p.life <= 0) continue;
        alive++;
        p.vy += 0.8 * dt;
        p.x += p.vx * dt * 0.6;
        p.y += p.vy * dt * 0.6;
        p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.font = `bold ${p.size}px monospace`;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillText(p.char, 0, 0);
        ctx.restore();
      }
      if (alive > 0) requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    requestAnimationFrame(draw);
  }

  function _spawnHonoredCats() {
    if (!window.ASCILINE) return;
    const isMobile =
      window.innerWidth <= 768 ||
      ("ontouchstart" in window && window.navigator.maxTouchPoints > 0);
    const cRect = _getContainerRect();
    const cCenter = cRect.left + cRect.width / 2;
    const cBottom = cRect.bottom + window.scrollY;

    const CAT_W = 260; // mascot.js kayıt genişliği

    if (isMobile) {
      // Mobilde ASCILINE CONQUERED altında ortada tek bir kedi spawnla
      const centerX = Math.max(
        10,
        Math.min(window.innerWidth - CAT_W - 10, cCenter - CAT_W / 2),
      );
      const spawnY = cBottom - 40;
      let catSingle = null;
      try {
        catSingle = window.ASCILINE.spawn("honoredcats", centerX, spawnY, true);
      } catch (e) {
        console.warn("Excalibur: honoredcats single mobile spawn failed", e);
      }

      setTimeout(() => {
        if (!catSingle || !catSingle.wrapper) return;
        const cx = catSingle.x + (catSingle.width || 200) / 2;
        const cy = catSingle.y + (catSingle.height || 100) / 2;
        _spawnSparks(cx, cy);

        catSingle.wrapper.style.transition =
          "opacity 1.3s ease-out, filter 1.3s ease-out, transform 1.3s ease-out";
        catSingle.wrapper.style.opacity = "0";
        catSingle.wrapper.style.filter =
          "blur(8px) brightness(2.0) drop-shadow(0 0 20px #ffd700)";

        setTimeout(() => {
          if (!catSingle) return;
          if (typeof catSingle.destroy === "function") catSingle.destroy();
          if (typeof mascots !== "undefined") {
            const idx = mascots.indexOf(catSingle);
            if (idx > -1) mascots.splice(idx, 1);
          }
        }, 1400);
      }, 3600);
      return;
    }

    const GAP = 120; // merkezden uzaklık

    const leftX = Math.max(10, cCenter - CAT_W - GAP - 320);
    const rightX = Math.min(
      window.innerWidth - CAT_W - 10,
      cCenter + GAP + 150,
    );
    const spawnY = cBottom - 120;

    let catL = null,
      catR = null;

    try {
      catL = window.ASCILINE.spawn("honoredcats", leftX, spawnY, true);
      if (catL && catL.walkDir !== undefined) catL.walkDir = 1;
    } catch (e) {
      console.warn("Excalibur: honoredcats left spawn failed", e);
    }

    try {
      catR = window.ASCILINE.spawn("honoredcats", rightX, spawnY, true);
      if (catR && catR.walkDir !== undefined) catR.walkDir = -1;
    } catch (e) {
      console.warn("Excalibur: honoredcats right spawn failed", e);
    }

    // 5 Saniye içinde parıldayarak yok olma
    setTimeout(() => {
      [catL, catR].forEach((cat) => {
        if (!cat || !cat.wrapper) return;
        const cx = cat.x + (cat.width || 200) / 2;
        const cy = cat.y + (cat.height || 100) / 2;
        _spawnSparks(cx, cy);

        cat.wrapper.style.transition =
          "opacity 1.3s ease-out, filter 1.3s ease-out, transform 1.3s ease-out";
        cat.wrapper.style.opacity = "0";
        cat.wrapper.style.filter =
          "blur(8px) brightness(2.0) drop-shadow(0 0 20px #ffd700)";
      });

      setTimeout(() => {
        [catL, catR].forEach((cat) => {
          if (!cat) return;
          if (typeof cat.destroy === "function") cat.destroy();
          if (typeof mascots !== "undefined") {
            const idx = mascots.indexOf(cat);
            if (idx > -1) mascots.splice(idx, 1);
          }
        });
      }, 1400);
    }, 3600);
  }

  /** Popup yok — Excalibur bölgesinin içinde inline kutlama */
  function _showInlineCelebration() {
    const zone = document.getElementById("excalibur-container");
    if (!zone) return;

    const isMobileDev = window.innerWidth <= 768;
    const cel = document.createElement("div");
    cel.className = "excalibur-inline-celebration";

    if (!isMobileDev) {
      // Desktop: altın yıldız yağmuru — salt CSS ile
      const starsHTML = Array.from({ length: 18 }, (_, i) => {
        const left = (5 + i * 5.5) % 95;
        const delay = (i * 0.12).toFixed(2);
        const dur = (0.8 + Math.random() * 0.6).toFixed(2);
        const size = 10 + Math.floor(Math.random() * 14);
        return `<span class="exc-star" style="left:${left}%;animation-delay:${delay}s;animation-duration:${dur}s;font-size:${size}px">✦</span>`;
      }).join("");
      cel.innerHTML = `
          <div class="exc-stars">${starsHTML}</div>
          <div class="exc-conquest-text">⚔ ASCILINE CONQUERED ⚔</div>
      `;
    } else {
      // Mobile: sadece metin, animasyon yok
      cel.innerHTML = `<div class="exc-conquest-text">⚔ ASCILINE CONQUERED ⚔</div>`;
    }

    zone.appendChild(cel);

    if (!isMobile) {
      setTimeout(() => {
        const starsEl = cel.querySelector('.exc-stars');
        if (starsEl) starsEl.remove();
      }, 10000);
    }

    // Layout değiştiği için çarpışma haritasını defer et!
    if (typeof buildCollisionCache === "function") {
      requestAnimationFrame(buildCollisionCache);
      setTimeout(buildCollisionCache, 300);
      setTimeout(buildCollisionCache, 600);
      setTimeout(buildCollisionCache, 1200);
    }
  }

  function _explodeStone(targetEl) {
    if (!targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    // viewport-relative center (canvas is fixed, coords are relative to viewport)
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Hide original stone element immediately
    targetEl.style.display = "none";

    // Taş yok olduğu için (layout yukarı kaydı) çarpışma haritasını defer et!
    if (typeof buildCollisionCache === "function") {
      requestAnimationFrame(buildCollisionCache);
      setTimeout(buildCollisionCache, 300);
      setTimeout(buildCollisionCache, 600);
      setTimeout(buildCollisionCache, 1200);
    }

    // Stone2 ASCII characters & color palette
    const shardChars = ["█", "▓", "▒", "░", "▲", "◆", "▞", "▚", "▼", "▪", "✦"];
    const colors = [
      "#d0cecc",
      "#b7b6b6",
      "#a4a3a3",
      "#707070",
      "#535353",
      "#888787",
      "#e5e2df",
      "#6e6e6e",
    ];

    const isMobileDevice = window.innerWidth <= 768;

    // Use a FIXED canvas — stays aligned to viewport, no scrollWidth/scrollHeight needed
    let canvas = document.getElementById("asciline-spark-canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "asciline-spark-canvas";
      // position:fixed keeps it aligned to viewport regardless of scroll
      canvas.style.cssText =
        "position:fixed;top:0;left:0;pointer-events:none;z-index:99999;";
      document.body.appendChild(canvas);
    } else {
      // Switch to fixed if it was absolute before
      canvas.style.position = "fixed";
      canvas.style.top = "0";
      canvas.style.left = "0";
    }
    // Only viewport size — much smaller GPU surface
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");

    const particleCount = isMobileDevice ? 22 : 45;
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      // Natural outward arc explosion, then gravity pull
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI * 0.85);
      const speed = (isMobileDevice ? 3 : 4) + Math.random() * (isMobileDevice ? 10 : 16);
      particles.push({
        char: shardChars[Math.floor(Math.random() * shardChars.length)],
        color: colors[Math.floor(Math.random() * colors.length)],
        size: (isMobileDevice ? 8 : 11) + Math.random() * (isMobileDevice ? 10 : 15),
        x: centerX + (Math.random() - 0.5) * 30,
        y: centerY + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 12,
        life: 1.0,
      });
    }

    let lastTime = performance.now();
    function draw(now) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = 0;

      for (const p of particles) {
        if (p.life <= 0) continue;
        p.life -= 0.8 * dt;
        if (p.life <= 0) continue;
        alive++;

        p.vy += 32 * dt; // Gravity
        p.x += p.vx * 60 * dt;
        p.y += p.vy * 60 * dt;
        p.rot += p.vr * dt;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.font = `bold ${p.size}px monospace`;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillText(p.char, 0, 0);
        ctx.restore();
      }

      if (alive > 0) {
        requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Restore canvas to absolute for sword spark reuse
        canvas.style.position = "absolute";
        canvas.style.top = "0";
        canvas.style.left = "0";
      }
    }
    requestAnimationFrame(draw);
  }

  // Color interpolation helper
  function interpolateColor(hex1, hex2, t) {
    const parse = (h) => [
      parseInt(h.slice(1, 3), 16),
      parseInt(h.slice(3, 5), 16),
      parseInt(h.slice(5, 7), 16),
    ];
    const [r1, g1, b1] = parse(hex1);
    const [r2, g2, b2] = parse(hex2);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r},${g},${b})`;
  }
})();
