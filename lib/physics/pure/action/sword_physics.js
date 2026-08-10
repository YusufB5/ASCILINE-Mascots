/**
 * SwordMascot v6
 * ===============
 * • Tutulunca mevcut açı korunur.
 * • Bırakılınca hız vektörüne SNAP OLMAZ — mevcut açıdan devam eder,
 *   sadece yatay hıza göre döndürme hızı (rotVel) verilir.
 * • Yerde naturel yavaşlar, rotasyon durduğu yerde kalır.
 * • Slash: altın parıltı kıvılcımları (canvas, performanslı).
 */
class SwordMascot extends SpriteMascot {
  constructor(
    jsonUrl = "assets/mascots/sword_coloranim.json",
    width = 90,
    height = 90,
    fps = 12,
  ) {
    super(jsonUrl, width, height, fps, 0, null);

    this.bounce = 0.12;
    this.airFriction = 0.997; // havada neredeyse sürtünme yok
    this.groundFriction = 0.86; // zemine değince hızlı durur
    this.friction = 0.997; // base class compatibility
    this.rotation = 0;
    this._rotVel = 0;
    this._onGround = false;
    this._wasHeld = false;
    this._frozenRot = 0;
    this._slashCD = 0;
    this._isStuck = false; // Yere saplanma durumu
    this._stuckPlatform = null; // Hangi yüzeye saplandığı
    this._stuckTimer = 0; // Saplanma süresi (frame)
    this.isLevitating = false; // Havada asılı durma (ilk çekildiğinde)
    this._levitateTimer = 0;
    this._dominoCD = 0; // Domino throttle: max 1 shatter per N frames

    // Sürükleme hızı (pointermove'da ölçülür)
    this._dragVX = 0;
    this._dragVY = 0;
    this._prevPX = 0;
    this._prevPY = 0;

    // Custom points from new sword_coloranim.json (14 points)
    this.customPoints = [
      { name: "hitbox_3", ax: 26, ay: 0 },
      { name: "hitbox_4", ax: 23, ay: 1 },
      { name: "hitbox_5", ax: 24, ay: 2 },
      { name: "hitbox_6", ax: 24, ay: 4 },
      { name: "hitbox_7", ax: 20, ay: 5 },
      { name: "hitbox_8", ax: 23, ay: 6 },
      { name: "hitbox_9", ax: 24, ay: 22 },
      { name: "hitbox_10", ax: 26, ay: 24 },
      { name: "hitbox_11", ax: 28, ay: 22 },
      { name: "hitbox_12", ax: 28, ay: 6 },
      { name: "hitbox_13", ax: 31, ay: 5 },
      { name: "hitbox_14", ax: 27, ay: 4 },
      { name: "hitbox_15", ax: 28, ay: 2 },
      { name: "hitbox_16", ax: 28, ay: 0 },
    ];

    this._patchHandlers();

    // Debug: collider gorunurlugu icin overlay
    this._debugEl = null;
  }

  _createDebugOverlay() {
    if (this._debugEl) return;
    if (!this.wrapper || !this.wrapper.isConnected) return; // DOM'a henuz eklenmedi
    this._debugEl = document.createElement("div");
    this._debugEl.id = "sword-debug-overlay";
    this._debugEl.style.cssText = [
      "position:absolute",
      "top:0",
      "left:0",
      "width:100%",
      "height:100%",
      "pointer-events:none",
      "overflow:visible",
      "z-index:999999",
    ].join(";");

    this._debugCanvas = document.createElement("canvas");
    this._debugCanvas.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;";
    this._debugEl.appendChild(this._debugCanvas);
    this.wrapper.appendChild(this._debugEl);
  }

  _drawDebugHitbox() {
    if (!window.SWORD_DEBUG) {
      if (this._debugEl) {
        this._debugEl.remove();
        this._debugEl = null;
        this._debugCanvas = null;
      }
      return;
    }
    if (!this._debugEl) this._createDebugOverlay();
    if (!this._debugEl) return;
    if (!this._debugCanvas) return;
    if (!this.customPoints || this.customPoints.length === 0) return;
    if (!this.width || !this.height) return;

    // Eger canvas boyutu wrapper ile eslesmiyorsa guncelle
    if (
      this._debugCanvas.width !== this.width ||
      this._debugCanvas.height !== this.height
    ) {
      this._debugCanvas.width = this.width;
      this._debugCanvas.height = this.height;
    }

    const ctx = this._debugCanvas.getContext("2d");
    ctx.clearRect(0, 0, this.width, this.height);

    const pts = this.customPoints;
    const meta = this.metadata || {};
    const mw = meta.width || 50;
    const mh = meta.height || 25;

    // Blade Poligonu
    ctx.fillStyle = "rgba(0, 240, 255, 0.4)";
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";

    ctx.beginPath();
    pts.forEach((p, i) => {
      const cx = (p.ax / mw) * this.width;
      const cy = (p.ay / mh) * this.height;
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Noktalar
    ctx.fillStyle = "#ff007f";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    pts.forEach((p) => {
      const cx = (p.ax / mw) * this.width;
      const cy = (p.ay / mh) * this.height;
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  // DOM güncellemelerinde temel sınıfı (SpriteMascot) eziyoruz
  // Böylece pointermove sırasında çalışan updateDOMPosition, rotasyonu sıfırlamadan uygular ve titremeyi (stutter) engeller.
  updateDOMPosition() {
    if (!this.wrapper) return;
    this.wrapper.style.transform = `translate3d(${this.x}px, ${this.y}px, 0) rotate(${this.isDragging ? this._frozenRot : this.rotation}deg)`;
    this._drawDebugHitbox();
  }

  _patchHandlers() {
    const origDown = this._boundPointerDown;
    this._boundPointerDown = (e) => {
      origDown(e);
      this.isLevitating = false; // Dokunulunca/tutulunca havada durma biter, fizik başlar!
      this._frozenRot = this.rotation; // mevcut açıyı kilitle
      this._wasHeld = true;
      this._isStuck = false; // Tutulunca saplanma biter
      this._stuckTimer = 0;
      this._rotVel = 0;
      this._dragVX = 0;
      this._dragVY = 0;
      const p = e.touches ? e.touches[0] : e;
      this._prevPX = p.pageX;
      this._prevPY = p.pageY;
    };

    const origMove = this._boundPointerMove;
    this._boundPointerMove = (e) => {
      const p = e.touches ? e.touches[0] : e;
      this._dragVX = p.pageX - this._prevPX;
      this._dragVY = p.pageY - this._prevPY;
      this._prevPX = p.pageX;
      this._prevPY = p.pageY;
      origMove(e);
    };

    const origUp = this._boundPointerUp;
    this._boundPointerUp = (e) => {
      origUp(e);
      // Base class'ın hız dampingini override et — kılıç için daha güçlü fırlatma
      this.vx *= 1.55; // yatay hızı artır
      this.vy *= 1.3; // dikey hızı artır
      // Yatay hıza göre döndürme hızı (sağa atılırsa saat yönünde)
      this._rotVel = this.vx * 0.4;
      this._rotVel = Math.max(-22, Math.min(22, this._rotVel));
    };

    if (window.PointerEvent) {
      this.wrapper.removeEventListener("pointerdown", origDown);
      this.wrapper.addEventListener("pointerdown", this._boundPointerDown);
      window.removeEventListener("pointermove", origMove);
      window.addEventListener("pointermove", this._boundPointerMove);
      window.removeEventListener("pointerup", origUp);
      window.addEventListener("pointerup", this._boundPointerUp);
      window.removeEventListener("pointercancel", origUp);
      window.addEventListener("pointercancel", this._boundPointerUp);
    } else {
      this.wrapper.removeEventListener("mousedown", origDown);
      this.wrapper.removeEventListener("touchstart", origDown);
      this.wrapper.addEventListener("mousedown", this._boundPointerDown);
      this.wrapper.addEventListener("touchstart", this._boundPointerDown, {
        passive: false,
      });
      window.removeEventListener("mousemove", origMove);
      window.addEventListener("mousemove", this._boundPointerMove);
      window.removeEventListener("mouseup", origUp);
      window.addEventListener("mouseup", this._boundPointerUp);
      window.removeEventListener("touchend", origUp);
      window.addEventListener("touchend", this._boundPointerUp);
    }
  }

  tick(dt = 1) {
    if (!this.isLoaded) return;

    if (this._slashCD > 0) this._slashCD -= dt;
    if (this._dominoCD > 0) this._dominoCD -= dt;

    // İlk fırlamada havada süzülüp bekleme durumu (kullanıcı dokunana kadar)
    if (this.isLevitating) {
      this._levitateTimer = (this._levitateTimer || 0) + 0.05 * dt;
      const floatY = Math.sin(this._levitateTimer) * 5; // Tatlı hafif süzülme
      if (this.wrapper) {
        this.wrapper.style.transform = `translate3d(${this.x}px, ${this.y + floatY}px, 0) rotate(${this.rotation}deg)`;
      }
      this.animTimer += dt;
      if (this.animTimer >= this.frameDelay) {
        this.animFrame = (this.animFrame + 1) % this.frames.length;
        this.animTimer = 0;
      }
      this.renderFrame(this.animFrame);
      return;
    }

    if (this.isDragging) {
      this.renderFrame(this.animFrame);
      // Sürüklerken updateDOMPosition temel sınıfça çağrıldığı için transform güncelleniyor, titreme bitti.
      this._checkSlash(dt, true);
      return;
    }

    // Yere saplanmışsa hiç hareket etmez, bekler
    if (this._isStuck) {
      // Eğer gerçek bir HTML elementine değil de direkt ekranın altına saplandıysa
      // ve kullanıcı scroll yapıp ekranın alt sınırını değiştirdiyse saplanmayı boz!
      if (!this._stuckPlatform) {
        const rad = ((this.rotation || 0) * Math.PI) / 180;
        const effectiveHeight =
          this.height / 2 +
          (this.height / 2) * Math.abs(Math.cos(rad)) +
          (this.width / 2) * Math.abs(Math.sin(rad));
        let currentFloorY =
          window.scrollY + window.innerHeight - effectiveHeight - 60;
        if (Math.abs(this.y - (currentFloorY + 18)) > 2) {
          this._isStuck = false;
          this._stuckTimer = 0;
        }
      } else {
        // Gerçek bir platforma saplandıysa zamanla parçala
        this._stuckTimer += dt;

        // 1.8 saniye (yaklaşık 108 frame) civarı titreme başlasın
        if (this._stuckTimer > 108 && this._stuckTimer < 120) {
          const shakeX = (Math.random() - 0.5) * 4;
          const shakeY = (Math.random() - 0.5) * 4;
          this.wrapper.style.transform = `translate3d(${this.x + shakeX}px, ${this.y + shakeY}px, 0) rotate(${this.rotation}deg)`;
        }
        // 2 saniye (120 frame) dolduğunda platformu parçala
        else if (this._stuckTimer >= 120) {
          this._shatterPlatform(this._stuckPlatform);
          this._isStuck = false;
          this._stuckTimer = 0;
          this._stuckPlatform = null;
          // Cache'i aninda sifirla: hayali platform kalmasi
          if (typeof removePlatformFromCache === "function")
            removePlatformFromCache(this._stuckPlatform);
          else if (typeof buildCollisionCache === "function")
            buildCollisionCache();
          // Dusme ivmesi ver
          this.vy = 2;
          this.vx *= 0.3;
        }
      }

      if (this._isStuck) {
        this.renderFrame(this.animFrame);
        // Titreşim yapmıyorsak normal pozisyonu koru
        if (this._stuckTimer <= 108) this.updateDOMPosition();
        return;
      }
    }

    // İlk bırakılma: frozenRot'tan devam, rotVel pointerUp patch'te set edildi
    if (this._wasHeld) {
      this._wasHeld = false;
      this.rotation = this._frozenRot;
    }

    // ── Fizik: hava ve zemin için ayrı sürtünme ──
    this.vy += this.gravity * dt;

    if (this._onGround) {
      this.vx *= Math.pow(this.groundFriction, dt);
    } else {
      this.vx *= Math.pow(this.airFriction, dt); // havada hemen hemen serbest
    }

    let nX = this.x + this.vx * dt;
    let nY = this.y + this.vy * dt;

    // Duvar
    if (nX < 0) {
      nX = 0;
      this.vx = Math.abs(this.vx) * this.bounce;
      this._rotVel *= -0.55;
    } else if (nX + this.width > window.innerWidth) {
      nX = window.innerWidth - this.width;
      this.vx = -Math.abs(this.vx) * this.bounce;
      this._rotVel *= -0.55;
    }

    // Dynamic Effective Height based on rotation angle (Zero lag calculation)
    const rad = ((this.rotation || 0) * Math.PI) / 180;
    const effectiveHeight =
      this.height / 2 +
      (this.height / 2) * Math.abs(Math.cos(rad)) +
      (this.width / 2) * Math.abs(Math.sin(rad));

    // Zemin
    let floorY = window.scrollY + window.innerHeight - effectiveHeight;
    const col = this.findPlatformCollision();
    if (col.platform) floorY = col.top - effectiveHeight;

    if (nY >= floorY) {
      nY = floorY;
      this._onGround = true;

      // --- YERE SAPLANMA (STUCK) VE DOMINO YIKIM KONTROLÜ ---
      // Açı 0'a yakınsa (kılıcın ucu/bıçağı aşağı bakıyorsa, handle üstte)
      let currentRot = ((this.rotation % 360) + 360) % 360; // 0-360 arası
      if ((currentRot < 45 || currentRot > 315) && Math.abs(this.vy) > 8) {
        if (col.platform) {
          // Domino Efekti: Throttled — max 1 shatter per 5 frames to prevent FPS nuke
          if (this._dominoCD <= 0) {
            this._shatterPlatform(col.platform);
            this._goldSparks(this.x + this.width / 2, this.y + this.height);
            this._dominoCD = 5;
          }
          this.vy *= 0.9; // Hızı çok az kes
          this.vx *= 0.5;
          this._onGround = false; // Düşmeye devam
          nY = this.y + this.vy * dt; // y'yi güncelle
        } else {
          // Sadece ekranın en altına (gerçek zemine) çarptıysa saplanıp kal
          this._isStuck = true;
          this._stuckPlatform = null;
          this._stuckTimer = 0;
          this.vy = 0;
          this.vx = 0;
          this._rotVel = 0;
          this.y = floorY + 18; // Ucu biraz zemine girsin
          this.x = nX;
          this.updateDOMPosition();
          this._goldSparks(this.x + this.width / 2, this.y + this.height);
          return; // Fiziği burada kes
        }
      }

      if (Math.abs(this.vy) > 2.5) {
        this.vy = -this.vy * this.bounce;
        this._rotVel *= 0.3;
      } else {
        this.vy = 0;
      }
      this.vx *= 0.6;
    } else {
      this._onGround = false;
    }

    this.x = nX;
    this.y = nY;

    // ── Rotasyon ──
    // Havada: rotVel ile serbestçe döner
    // Yerde + hareket çok azsa: rotVel 0'a iner, açı olduğu yerde kalır
    this.rotation += this._rotVel * dt;

    if (this._onGround) {
      // Zeminde: rotasyon sürtünmesiyle doğal sönümlenir, açı olduğu yerde kalır
      this._rotVel *= Math.pow(0.8, dt);
    } else {
      // Havada: çok az sonuçlanma (gerçekçi tumbling)
      this._rotVel *= Math.pow(0.992, dt);
    }

    // Mikro titremeyi önle
    if (Math.abs(this._rotVel) < 0.03) this._rotVel = 0;

    this.updateDOMPosition();

    this.animTimer += dt;
    if (this.animTimer >= this.frameDelay) {
      this.animFrame = (this.animFrame + 1) % this.frames.length;
      this.animTimer = 0;
    }
    this._checkSlash(dt, false);
  }

  // Dynamic rotated platform collision detection for 360° sword rotation
  findPlatformCollision() {
    const rad = ((this.rotation || 0) * Math.PI) / 180;
    const effectiveH =
      this.height / 2 +
      (this.height / 2) * Math.abs(Math.cos(rad)) +
      (this.width / 2) * Math.abs(Math.sin(rad));
    const effectiveW =
      this.width / 2 +
      (this.width / 2) * Math.abs(Math.cos(rad)) +
      (this.height / 2) * Math.abs(Math.sin(rad));

    const mascotBottom = this.y + effectiveH;
    const docHeight = Math.max(document.body.scrollHeight, window.innerHeight);
    let highestPlatformTop = docHeight;
    let highestPlatform = null;

    const cullMin = this.y - 200;
    const cullMax = mascotBottom + 40;

    const checkLeft = this.x + this.width / 2 - effectiveW / 2;
    const checkRight = this.x + this.width / 2 + effectiveW / 2;

    if (typeof cachedStaticPlatforms !== "undefined") {
      for (const plat of cachedStaticPlatforms) {
        if (!plat.node || !plat.node.isConnected) continue;
        if (
          plat.node.classList.contains("shattered-platform") ||
          plat.node.closest(".shattered-platform")
        )
          continue;
        if (
          plat.node.style.opacity === "0" ||
          plat.node.style.visibility === "hidden" ||
          plat.node.style.display === "none"
        )
          continue;

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

        if (checkRight >= plat.left && checkLeft <= plat.right) {
          const vyCheck = Math.max(16, Math.abs(this.vy) * 1.5 + 10);
          if (
            mascotBottom >= plat.top &&
            mascotBottom - vyCheck <= plat.top + 24
          ) {
            if (plat.top < highestPlatformTop) {
              highestPlatformTop = plat.top;
              highestPlatform = plat.node;
            }
          }
        }
      }
    }

    if (typeof cachedDynamicElements !== "undefined") {
      for (const el of cachedDynamicElements) {
        if (
          el.classList.contains("shattered-platform") ||
          el.closest(".shattered-platform")
        )
          continue;
        if (el.style.opacity === "0" || el.style.visibility === "hidden")
          continue;

        const rect = el.getBoundingClientRect();
        if (rect.height === 0) continue;
        const absTop = rect.top + window.scrollY;
        if (absTop < cullMin || absTop > cullMax) continue;
        const absLeft = rect.left + window.scrollX;
        const absRight = rect.right + window.scrollX;

        if (checkRight >= absLeft && checkLeft <= absRight) {
          const vyCheck = Math.max(16, Math.abs(this.vy) * 1.5 + 10);
          if (
            mascotBottom >= absTop &&
            mascotBottom - vyCheck <= absTop + 24
          ) {
            if (absTop < highestPlatformTop) {
              highestPlatformTop = absTop;
              highestPlatform = el;
            }
          }
        }
      }
    }

    return { platform: highestPlatform, top: highestPlatformTop };
  }

  // ─────────────── Slash ───────────────
  _checkSlash(dt, isDrag) {
    if (this._slashCD > 0) return;

    const speed = isDrag
      ? Math.sqrt(this._dragVX ** 2 + this._dragVY ** 2)
      : Math.sqrt(this.vx ** 2 + this.vy ** 2);
    if (speed < (isDrag ? 5 : 4)) return;

    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;

    // DOM rotation is clockwise. 0 deg = tip is at bottom.
    const rotRad = (-this.rotation * Math.PI) / 180;
    const h2 = this.height / 2;
    const tipX = cx + Math.sin(rotRad) * (h2 * 0.9);
    const tipY = cy + Math.cos(rotRad) * (h2 * 0.9);
    const q3X = cx + Math.sin(rotRad) * (h2 * 0.67);
    const q3Y = cy + Math.cos(rotRad) * (h2 * 0.67);
    const midX = cx + Math.sin(rotRad) * (h2 * 0.45);
    const midY = cy + Math.cos(rotRad) * (h2 * 0.45);
    const q1X = cx + Math.sin(rotRad) * (h2 * 0.22);
    const q1Y = cy + Math.cos(rotRad) * (h2 * 0.22);

    const checkPoints = [
      { x: cx, y: cy },
      { x: q1X, y: q1Y },
      { x: midX, y: midY },
      { x: q3X, y: q3Y },
      { x: tipX, y: tipY },
    ];

    let slashedSomething = false;

    // 1. Check Platform Slash (only during drag)
    if (
      isDrag &&
      typeof cachedStaticPlatforms !== "undefined" &&
      this._dominoCD <= 0
    ) {
      for (let i = 0; i < cachedStaticPlatforms.length; i++) {
        const plat = cachedStaticPlatforms[i];
        if (
          !plat.node ||
          !plat.node.isConnected ||
          plat.node.classList.contains("shattered-platform") ||
          plat.node.style.opacity === "0" ||
          plat.node.style.visibility === "hidden" ||
          plat.node.style.display === "none"
        )
          continue;

        const curRect = plat.node.getBoundingClientRect();
        if (curRect.height === 0 || curRect.width === 0) continue;
        const curTop = curRect.top + window.scrollY;
        if (Math.abs(curTop - plat.top) > 5) {
          plat.top = curTop;
          plat.bottom = curRect.bottom + window.scrollY;
          plat.left = curRect.left + window.scrollX;
          plat.right = curRect.right + window.scrollX;
        }

        let hit = false;
        const m = 15; // 15px margin for forgiving hitbox
        for (const p of checkPoints) {
          if (
            p.x >= plat.left - m &&
            p.x <= plat.right + m &&
            p.y >= plat.top - m &&
            p.y <= plat.bottom + m
          ) {
            hit = true;
            break;
          }
        }

        if (hit) {
          this._shatterPlatform(plat.node);
          this._goldSparks(cx, cy);
          this._dominoCD = 10; // throttle domino slightly more when dragging
          slashedSomething = true;
          break;
        }
      }
    }

    // 2. Check Mascot Slash
    if (!slashedSomething && typeof mascots !== "undefined") {
      for (let mi = mascots.length - 1; mi >= 0; mi--) {
        const m = mascots[mi];
        if (m === this || m.isShatterShard || m.x == null) continue;
        const mw = m.width || 60,
          mh = m.height || 60;
        const mx = m.x + mw / 2,
          my = m.y + mh / 2;

        let hit = false;
        const margin = 15;
        for (const p of checkPoints) {
          if (
            p.x >= m.x - margin &&
            p.x <= m.x + mw + margin &&
            p.y >= m.y - margin &&
            p.y <= m.y + mh + margin
          ) {
            hit = true;
            break;
          }
        }

        if (hit) {
          this._killMascot(m, mx, my);
          this._slashCD = 40;
          slashedSomething = true;
          break;
        }
      }
    }
  }

  _killMascot(target, mx, my) {
    // Mascot kaldır
    if (typeof target.destroy === "function") target.destroy();
    const idx = mascots.indexOf(target);
    if (idx > -1) mascots.splice(idx, 1);

    // Beyaz + altın flash
    const flash = document.createElement("div");
    const fx = mx - window.scrollX,
      fy = my - window.scrollY;
    flash.style.cssText = `
            position:fixed;left:0;top:0;right:0;bottom:0;
            background:radial-gradient(circle at ${fx}px ${fy}px,
                rgba(255,255,220,0.98) 0%,
                rgba(255,200,40,0.7)  14%,
                rgba(255,130,0,0.3)   30%,
                transparent           52%);
            pointer-events:none;z-index:99998;
            opacity:1;transition:opacity 0.28s ease-out;
        `;
    document.body.appendChild(flash);
    requestAnimationFrame(() => {
      flash.style.opacity = "0";
    });
    setTimeout(() => flash.remove(), 320);

    // Altın kıvılcımlar
    this._goldSparks(mx, my);
  }

  _goldSparks(cx, cy) {
    let canvas = document.getElementById("asciline-spark-canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "asciline-spark-canvas";
      canvas.style.cssText =
        "position:absolute;top:0;left:0;pointer-events:none;z-index:99999;";
      document.body.appendChild(canvas);
    }
    // Use viewport width to avoid horizontal scroll leak on mobile
    const targetW = Math.min(
      document.documentElement.scrollWidth,
      window.innerWidth,
    );
    const targetH = document.documentElement.scrollHeight;
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
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

    const particles = Array.from({ length: 18 }, () => {
      const a = Math.random() * Math.PI * 2;
      const s = 7 + Math.random() * 24;
      return {
        x: cx,
        y: cy,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 5,
        char: CHARS[Math.floor(Math.random() * CHARS.length)],
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 9 + Math.random() * 14,
        rot: Math.random() * 360,
        vr: (Math.random() - 0.5) * 22,
        life: 1.0,
      };
    });

    // Push to GLOBAL particle array on canvas and start SINGLE loop
    canvas._swordParticles = canvas._swordParticles || [];
    canvas._swordParticles.push(...particles);

    if (!canvas._swordLoopRunning) {
      canvas._swordLoopRunning = true;
      let last = performance.now();

      const animate = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000) * 60;
        last = now;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let alive = 0;
        const active = canvas._swordParticles;
        for (let i = 0; i < active.length; i++) {
          const p = active[i];
          if (p.life <= 0) continue;
          p.life -= 0.022 * dt; // Same decay rate as shatter
          if (p.life <= 0) continue;

          alive++;
          p.vy += 0.8 * dt; // gravity
          p.x += p.vx * dt * 0.6;
          p.y += p.vy * dt * 0.6;
          p.rot += p.vr;

          ctx.save();
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.color;
          ctx.font = `bold ${p.size}px monospace`;
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rot * Math.PI) / 180);
          ctx.fillText(p.char, -p.size * 0.3, p.size * 0.3);
          ctx.restore();
        }

        if (alive > 0) {
          if (Math.random() < 0.02) {
            canvas._swordParticles = active.filter((p) => p.life > 0);
          }
          requestAnimationFrame(animate);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          canvas._swordLoopRunning = false;
          canvas._swordParticles = [];
        }
      };
      requestAnimationFrame(animate);
    }
  }

  // ─────────────── Platform Shatter (Optimized DOM, Red Effect) ───────────────
  destroy() {
    if (this._flashEl && this._flashEl.parentNode) {
      this._flashEl.parentNode.removeChild(this._flashEl);
      this._flashEl = null;
    }
    if (this._flashTimer) {
      clearTimeout(this._flashTimer);
    }
    if (typeof super.destroy === "function") super.destroy();
  }

  _doFlash(cx, cy) {
    // Reuse a single flash element to prevent DOM bloat during domino cascade
    if (!this._flashEl) {
      this._flashEl = document.createElement("div");
      this._flashEl.style.cssText =
        "position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:99999;opacity:0;transition:opacity 0.25s ease-out;";
      document.body.appendChild(this._flashEl);
    }
    const fx = cx - window.scrollX,
      fy = cy - window.scrollY;
    this._flashEl.style.background = `radial-gradient(circle at ${fx}px ${fy}px,
            rgba(255,255,255,0.9) 0%, rgba(255,200,50,0.5) 20%, transparent 60%)`;
    this._flashEl.style.opacity = "1";
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => {
      if (this._flashEl) this._flashEl.style.opacity = "0";
    }, 80);
  }

  _shatterPlatform(platformEl) {
    if (!platformEl || !platformEl.getBoundingClientRect) return;
    const rect = platformEl.getBoundingClientRect();
    const cx = rect.left + window.scrollX + rect.width / 2;
    const cy = rect.top + window.scrollY + rect.height / 2;

    // 1. Flash effect
    this._doFlash(cx, cy);

    // Special case: If it's an ASCII video player, trigger the custom shred effect
    if (platformEl.classList.contains("widget-player")) {
      if (typeof window.triggerRealAsciiSpill === "function") {
        window.triggerRealAsciiSpill(platformEl);
      }
      if (typeof removePlatformFromCache === "function")
        removePlatformFromCache(platformEl);
      else if (typeof buildCollisionCache === "function") buildCollisionCache();
      return;
    }

    // 2. Fast estimation of character positions BEFORE hiding platform
    const textParticles = [];
    const rawText = platformEl.innerText || platformEl.textContent || "";
    const printable = rawText.replace(/\s/g, "").slice(0, 30); // Hard cap at 30

    let textRect = rect;
    const walker = document.createTreeWalker(
      platformEl,
      NodeFilter.SHOW_TEXT,
      null,
      false,
    );
    let firstTextNode;
    while ((firstTextNode = walker.nextNode())) {
      if (firstTextNode.textContent.trim().length > 0) break;
    }
    if (firstTextNode) {
      const range = document.createRange();
      range.selectNodeContents(firstTextNode);
      const r = range.getClientRects();
      if (r.length > 0 && r[0].width > 0 && r[0].height > 0) textRect = r[0];
    }

    const compStyle = window.getComputedStyle(platformEl);
    const fontSize = parseFloat(compStyle.fontSize) || 14;
    const charW = fontSize * 0.6;
    const charH = fontSize * 1.2;
    const pW = textRect.width || rect.width || 100;
    const charsPerRow = Math.max(1, Math.floor(pW / charW));

    // Fallback if coordinates evaluate to (0,0) or invalid
    const basePX = (textRect.left === 0 && textRect.top === 0) ? cx : (textRect.left + window.scrollX);
    const basePY = (textRect.left === 0 && textRect.top === 0) ? cy : (textRect.top + window.scrollY);

    for (let i = 0; i < printable.length; i++) {
      const ch = printable[i];
      const col = i % charsPerRow;
      const row = Math.floor(i / charsPerRow);
      textParticles.push({
        char: ch,
        x: basePX + col * charW,
        y: basePY + row * charH,
        width: charW,
        height: charH,
      });
    }

    // 3. Hide original platform cleanly AFTER measuring
    platformEl.classList.add("shattered-platform");
    platformEl.style.transition = "opacity 0.1s ease-out, filter 0.1s ease-out";
    platformEl.style.opacity = "0";
    platformEl.style.filter = "blur(8px)";
    platformEl.style.pointerEvents = "none";

    if (typeof removePlatformFromCache === "function")
      removePlatformFromCache(platformEl);
    else if (typeof buildCollisionCache === "function") buildCollisionCache();

    // 4. Create floating particle spans (THE RED EFFECT)
    const particleContainer = document.createElement("div");
    particleContainer.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99990;";
    document.body.appendChild(particleContainer);

    const activeParticles = [];
    const frag = document.createDocumentFragment();

    textParticles.forEach((p) => {
      const span = document.createElement("span");
      span.textContent = p.char;
      span.style.cssText = `
                position: absolute;
                left: ${p.x}px;
                top: ${p.y}px;
                font: inherit;
                color: #ff3232;
                font-weight: bold;
                pointer-events: none;
                transition: transform 1s cubic-bezier(0.1, 1, 0.1, 1), opacity 1s;
                will-change: transform, opacity;
            `;
      frag.appendChild(span);

      const scx = p.x + p.width / 2;
      const scy = p.y + p.height / 2;
      const dx = scx - cx;
      const dy = scy - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (Math.random() * 15 + 10) / (dist * 0.05);
      const vx = (dx / dist) * force + (Math.random() - 0.5) * 10;
      const vy = (dy / dist) * force - Math.random() * 15;
      const rot = (Math.random() - 0.5) * 720;

      activeParticles.push({ span, vx, vy, rot });
    });

    particleContainer.appendChild(frag);

    // Trigger explosion in next frame and remove particle container after animation finishes
    requestAnimationFrame(() => {
      activeParticles.forEach((item) => {
        item.span.style.transform = `translate3d(${item.vx}px, ${item.vy}px, 0) rotate(${item.rot}deg)`;
        item.span.style.opacity = "0";
      });
    });

    // Clean up particles from DOM after explosion (1.2s) so they don't linger or drift on zoom/resize
    setTimeout(() => {
      if (particleContainer && particleContainer.parentNode) {
        particleContainer.parentNode.removeChild(particleContainer);
      }
    }, 1200);

    // 5. 5 SECONDS LATER: CLEAN REPAIR AT REAL LIVE DOM POSITION
    setTimeout(() => {
      if (!platformEl) return;

      // Restore platformEl with smooth fade-in
      platformEl.style.transition = "opacity 0.6s ease-in, filter 0.6s ease-in";
      platformEl.classList.remove("shattered-platform");
      platformEl.style.opacity = "1";
      platformEl.style.filter = "blur(0px)";
      platformEl.style.pointerEvents = "";

      if (typeof buildCollisionCache === "function") buildCollisionCache();

      // Localized magic repair glow box centered tightly around platformEl
      const liveRect = platformEl.getBoundingClientRect();
      const repairFlash = document.createElement("div");
      repairFlash.style.cssText = `
          position: absolute;
          left: ${liveRect.left + window.scrollX - 10}px;
          top: ${liveRect.top + window.scrollY - 6}px;
          width: ${Math.max(40, liveRect.width + 20)}px;
          height: ${Math.max(20, liveRect.height + 12)}px;
          background: radial-gradient(ellipse at center, rgba(100, 255, 170, 0.7) 0%, rgba(100, 255, 170, 0.2) 60%, transparent 100%);
          box-shadow: 0 0 15px rgba(100, 255, 170, 0.5);
          border-radius: 6px;
          pointer-events: none;
          z-index: 99998;
          opacity: 1;
          transition: opacity 0.5s ease-out;
      `;
      document.body.appendChild(repairFlash);
      requestAnimationFrame(() => {
        repairFlash.style.opacity = "0";
      });
      setTimeout(() => repairFlash.remove(), 550);
    }, 5000);
  }
}
