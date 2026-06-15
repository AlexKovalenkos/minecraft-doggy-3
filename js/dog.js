// ============================================================
// dog.js — Модель Тёпы v3 и анимации
// Все части на this.group напрямую, без inner model
// Модель смотрит в +X, компенсация rotation.y = yaw - PI/2
// Крылья бабочки (YZ плоскость), полосатое тело, висячие уши
// ============================================================

const Dog = {
    group: new THREE.Group(),
    pivots: {},
    bMesh: [],

    // Physics — Minecraft-like values
    vy: 0,
    speed: 7,          // Minecraft walk speed feels ~4.3 m/s; scaled
    flySpeed: 5,       // wing-flap upward speed
    gravity: -22,      // MC gravity feels snappy (~9.8 blocks/s² × 2.25 scale)
    isFlying: false,
    onGround: true,

    // Direction
    yaw: 0,

    // Riding
    ridingUnicorn: null,
    ridingDragon: null,

    // State
    onThrone: false,
    inWater: false,

    init() {
        // ── Тёпа: почти MC Wolf + крылья бабочки ────────────────────
        // Scale: 1 MC pixel = 0.125 units
        // Body:  9×6×6 px → 1.125 × 0.75 × 0.75
        // Head:  6×6×6 px → 0.75 cube
        // Legs:  2×8×2 px → 0.25 × 1.0 × 0.25
        const P = 0.125;
        this._PX = P;
        const g = this.group;

        function mt(c, em, ei) {
            const m = new THREE.MeshStandardMaterial({ color: c });
            if (em) { m.emissive = new THREE.Color(em); m.emissiveIntensity = ei || 0.1; }
            return m;
        }
        function bx(w, h, d, mat) {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            mesh.castShadow = true;
            return mesh;
        }

        const grey   = mt(0xBFBFBF);   // MC wolf grey body
        const dark   = mt(0x7A7A7A);   // darker fur (head, legs)
        const white  = mt(0xF0F0F0);   // chest patch
        const eyeM   = mt(0x3B2F1A);   // brown eyes
        const eyeHM  = mt(0xFFFFFF);   // eye highlight
        const noseM  = mt(0x111111);   // black nose
        const muzzM  = mt(0xE0D8C0);   // lighter snout
        const collarM = mt(0xCC2222, 0x880000, 0.3);  // red collar (glowing)
        const wingY  = mt(0xE8C028, 0xCC9900, 0.15);  // wing yellow
        const wingB  = mt(0x1B3A7A);   // wing blue dots
        const tailM  = mt(0x999999);   // tail tip white

        const bW = 9*P, bH = 6*P, bD = 6*P;

        // ── BODY ──
        const body = bx(bW, bH, bD, grey);
        body.position.set(0, 0, 0);
        g.add(body);
        this.bMesh.push(body);

        // White chest patch
        const chest = bx(4*P, 3*P, bD+0.01, white);
        chest.position.set(3*P, -1.5*P, 0);
        g.add(chest);
        this.bMesh.push(chest);

        // ── HEAD ──
        const hS = 6*P;
        const headX = bW/2 + hS/2 - P;
        const headY = bH/2 - hS/2 + 2*P;

        const head = bx(hS, hS, hS, dark);
        head.position.set(headX, headY, 0);
        g.add(head);

        // Snout / muzzle
        const snout = bx(4*P, 3*P, 4*P, muzzM);
        snout.position.set(headX + hS/2, headY - P, 0);
        g.add(snout);

        // Nose
        const nose = bx(P*0.8, P*1.5, P*2, noseM);
        nose.position.set(snout.position.x + 2*P, snout.position.y + 0.5*P, 0);
        g.add(nose);

        // Eyes
        [2.2*P, -2.2*P].forEach(z => {
            const eye = bx(P*0.5, 2*P, 2*P, eyeM);
            eye.position.set(headX + hS/2 + 0.01, headY + P, z);
            g.add(eye);
            const hl = bx(P*0.3, P, P, eyeHM);
            hl.position.set(headX + hS/2 + 0.02, headY + 1.5*P, z + 0.5*P);
            g.add(hl);
        });

        // Ears — perked up (MC wolf style)
        [2.5*P, -2.5*P].forEach(z => {
            const ear = bx(2*P, 3*P, P, dark);
            ear.position.set(headX - P, headY + hS/2 + P, z);
            g.add(ear);
        });

        // Red collar
        const collar = bx(bW*0.7, P*1.5, bD+0.02, collarM);
        collar.position.set(headX - hS/2, headY - hS/2, 0);
        g.add(collar);

        // ── LEGS ──
        // pivotY = -0.6 so feet reach exactly y = -groundOffset = -1.6
        // (pivot -0.6) + (leg center -4*P=-0.5) + (leg bottom -4*P=-0.5) = -1.6 ✓
        const legGeo = new THREE.BoxGeometry(2*P, 8*P, 2*P);
        [
            { n: 'FL', x:  3*P, z:  2.2*P },
            { n: 'FR', x:  3*P, z: -2.2*P },
            { n: 'BL', x: -3*P, z:  2.2*P },
            { n: 'BR', x: -3*P, z: -2.2*P },
        ].forEach(d => {
            const piv = new THREE.Group();
            piv.position.set(d.x, -0.6, d.z);
            const leg = new THREE.Mesh(legGeo, dark);
            leg.position.y = -4*P;
            leg.castShadow = true;
            piv.add(leg);
            g.add(piv);
            this.pivots['leg' + d.n] = piv;
        });

        // ── TAIL — upward curve like MC wolf ──
        const tailP = new THREE.Group();
        tailP.position.set(-bW/2, bH/4, 0);
        [
            { r: -0.4, y: 2*P },
            { r: -0.8, y: 4.5*P },
            { r: -1.1, y: 6.5*P },
        ].forEach((s, i) => {
            const seg = new THREE.Mesh(new THREE.BoxGeometry(2*P, 2.5*P, 2*P),
                i === 2 ? tailM : dark);
            seg.position.set(0, s.y, 0);
            seg.rotation.z = s.r;
            seg.castShadow = true;
            tailP.add(seg);
        });
        g.add(tailP);
        this.pivots.tail = tailP;

        // ── BUTTERFLY WINGS (уникальность Тёпы) ──
        this._buildWing('L', P, wingY, wingB, 1);
        this._buildWing('R', P, wingY, wingB, -1);

        g.position.set(0, 5 * PX, 0); // 5*0.32 = 1.6 = groundOffset
        GAME.scene.add(g);
    },

    _buildWing(side, PX, wingMat, dotMat, zs) {
        const wingThick = 0.2 * PX;
        const wingGap = 0.3;
        const wp = new THREE.Group();
        wp.position.set(0.5 * PX, 2 * PX, 2 * PX * zs);

        const wg = new THREE.Group();
        // Diamond shape in YZ plane
        [[3, 1], [2, 3], [1, 4], [0, 3]].forEach(([y, w]) => {
            const block = new THREE.Mesh(
                new THREE.BoxGeometry(wingThick, 1 * PX, w * PX),
                wingMat
            );
            block.position.set(0, y * PX, (w / 2 + wingGap) * PX * zs);
            block.castShadow = true;
            wg.add(block);
        });

        // Blue dots
        const ds = 0.4 * PX;
        const dt = 0.08 * PX;
        const dotX = wingThick / 2 + 0.005;
        [[0.5, 1.0], [0.5, 2.3], [1.5, 1.3], [1.5, 3.0], [2.5, 1.2], [2.5, 2.3]].forEach(([dy, dz]) => {
            const dot = new THREE.Mesh(
                new THREE.BoxGeometry(dt, ds, ds), dotMat
            );
            dot.position.set(dotX, dy * PX, dz * PX * zs);
            wg.add(dot);
        });

        wp.add(wg);
        this.group.add(wp);
        this.pivots['wing' + side] = wp;
    },

    animate(dt, t, isMoving) {
        const flying   = this.isFlying || !this.onGround;
        const sitting  = this.sitting && this.onGround && !flying;
        const wSpread  = 0.15;

        // ── SITTING animation ─────────────────────────────────────────
        // Don't touch group.position (physics handles it) — only animate parts
        if (sitting) {
            // Back legs fold under body
            this.pivots.legBL.rotation.z =  1.0;
            this.pivots.legBR.rotation.z =  1.0;
            this.pivots.legFL.rotation.z = -0.15;
            this.pivots.legFR.rotation.z = -0.15;
            // Body meshes sink slightly (visual only, no Y change)
            this.bMesh.forEach(m => {
                m.position.y = m.position.y * 0.92 - 0.02 * dt;
                m.position.y = Math.max(m.position.y, -0.35);
            });
            // Tail wags happily
            this.pivots.tail.rotation.z = Math.sin(t * 6) * 0.5;
            this.pivots.tail.rotation.x = -0.3;
            // Wings gentle breathe
            const breath = Math.sin(t * 1.5) * 0.05;
            this.pivots.wingL.rotation.x = wSpread + breath;
            this.pivots.wingR.rotation.x = -(wSpread + breath);
            return;
        }

        // ── LEGS ─────────────────────────────────────────────────────
        if (this.inWater && this.onGround) {
            const a = Math.sin(t * 14) * 0.5;
            this.pivots.legFL.rotation.z =  a;
            this.pivots.legBR.rotation.z =  a;
            this.pivots.legFR.rotation.z = -a;
            this.pivots.legBL.rotation.z = -a;
        } else if (isMoving && this.onGround) {
            const speed = Controls && Controls._sprinting ? 14 : 10;
            const amp   = Controls && Controls._sprinting ? 0.5 : 0.4;
            const a = Math.sin(t * speed) * amp;
            this.pivots.legFL.rotation.z =  a;
            this.pivots.legBR.rotation.z =  a;
            this.pivots.legFR.rotation.z = -a;
            this.pivots.legBL.rotation.z = -a;
        } else if (flying) {
            this.pivots.legFL.rotation.z =  0.2;
            this.pivots.legFR.rotation.z =  0.2;
            this.pivots.legBL.rotation.z = -0.2;
            this.pivots.legBR.rotation.z = -0.2;
        } else {
            ['legFL','legFR','legBL','legBR'].forEach(k => {
                this.pivots[k].rotation.z *= 0.85;
            });
        }

        // ── BUTTERFLY WINGS ──────────────────────────────────────────
        if (flying) {
            const wa = wSpread + Math.abs(Math.sin(t * 8)) * 0.7;
            this.pivots.wingL.rotation.x =  wa;
            this.pivots.wingR.rotation.x = -wa;
        } else if (isMoving) {
            this.pivots.wingL.rotation.x =  wSpread + Math.sin(t * 3) * 0.08;
            this.pivots.wingR.rotation.x = -(wSpread + Math.sin(t * 3) * 0.08);
        } else {
            const breath = Math.sin(t * 1.5) * 0.06;
            this.pivots.wingL.rotation.x =  wSpread + breath;
            this.pivots.wingR.rotation.x = -(wSpread + breath);
        }

        // ── TAIL ─────────────────────────────────────────────────────
        const tailSpeed = flying ? 8 : isMoving ? 5 : 2;
        const tailAmp   = isMoving ? 0.3 : 0.12;
        this.pivots.tail.rotation.z = Math.sin(t * tailSpeed) * tailAmp;
        // MC wolf tail stays up — base upward offset
        this.pivots.tail.rotation.x = -0.5;

        // ── BODY BOB ─────────────────────────────────────────────────
        if (isMoving && this.onGround && !this.inWater) {
            const bob = Math.sin(t * 20) * 0.015;
            this.bMesh.forEach(m => { m.position.y += (bob - m.position.y) * 0.3; });
        } else if (!flying) {
            this.bMesh.forEach(m => { m.position.y *= 0.9; });
        }
    }
};

Dog.init();
