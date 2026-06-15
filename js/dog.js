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
        // PX=0.32 so that 5*PX = 1.6 = groundOffset
        const PX = 0.32;
        this._PX = PX;
        const g = this.group;

        function mt(c) { return new THREE.MeshStandardMaterial({ color: c }); }
        function bx(w, h, d, m) {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
            mesh.castShadow = true;
            return mesh;
        }

        const C = {
            b1: mt(0xC9A06F), b2: mt(0xAD8050), b3: mt(0x8B5E30), b4: mt(0x6B3A1A),
            cap: mt(0x5C3320), face: mt(0xA07550), snout: mt(0xBB8E5E),
            eye: mt(0x111111), eyeH: mt(0xFFFFFF), nose: mt(0x1A0A00),
            wY: mt(0xE8C028), wD: mt(0x1B3A7A),
            leg: mt(0x8B5E30), tail: mt(0x6B3A1A),
        };

        // ── BODY: 4 stripes ──
        const bMats = [C.b1, C.b2, C.b3, C.b4];
        for (let i = 0; i < 4; i++) {
            const s = bx(10 * PX, 1 * PX, 4 * PX, bMats[i]);
            s.position.set(0, (-1.5 + i) * PX, 0);
            g.add(s);
            this.bMesh.push(s);
        }

        // ── HEAD ──
        const hx = 6.5 * PX;

        const faceM = bx(3 * PX, 2 * PX, 4 * PX, C.face);
        faceM.position.set(hx, 1 * PX, 0);
        g.add(faceM);

        const capM = bx(3 * PX, 2 * PX, 4 * PX, C.cap);
        capM.position.set(hx, 3 * PX, 0);
        g.add(capM);

        // Snout line
        const snM = bx(0.05, 1 * PX, 1.2 * PX, C.snout);
        snM.position.set(hx + 1.5 * PX, 0.5 * PX, 0);
        g.add(snM);

        // ── EYES ──
        const eF = hx + 1.5 * PX + 0.01;
        const eS = 1.1 * PX;

        const eyL = bx(0.12, eS, eS, C.eye);
        eyL.position.set(eF, 1.6 * PX, 0.75 * PX);
        g.add(eyL);
        const eyR = bx(0.12, eS, eS, C.eye);
        eyR.position.set(eF, 1.6 * PX, -0.75 * PX);
        g.add(eyR);

        // Eye highlights
        const hlS = 0.3 * PX;
        const hlL = bx(0.06, hlS, hlS, C.eyeH);
        hlL.position.set(eF + 0.02, 1.9 * PX, 1.05 * PX);
        g.add(hlL);
        const hlR = bx(0.06, hlS, hlS, C.eyeH);
        hlR.position.set(eF + 0.02, 1.9 * PX, -0.45 * PX);
        g.add(hlR);

        // ── MUZZLE ──
        const muzzleB = bx(1 * PX, 1 * PX, 1.5 * PX, C.snout);
        muzzleB.position.set(hx + 2 * PX, 0.5 * PX, 0);
        g.add(muzzleB);

        // Nose tip
        const noseM = bx(0.12, 0.4 * PX, 0.5 * PX, C.nose);
        noseM.position.set(hx + 2.5 * PX + 0.01, 0.7 * PX, 0);
        g.add(noseM);

        // Smile
        const smF = hx + 2.5 * PX + 0.01;
        [0.15, -0.15].forEach(zz => {
            const sm = bx(0.06, 0.06, 0.3 * PX, C.nose);
            sm.position.set(smF, 0.2 * PX, zz * PX);
            sm.rotation.x = zz > 0 ? 0.4 : -0.4;
            g.add(sm);
        });

        // ── EARS (hanging down) ──
        [1, -1].forEach(zs => {
            const ear = bx(1 * PX, 2 * PX, 1 * PX, C.cap);
            ear.position.set(hx, 2.5 * PX, 2.3 * PX * zs);
            ear.rotation.x = -0.3 * zs;
            g.add(ear);
        });

        // ── LEGS ──
        const legG = new THREE.BoxGeometry(1 * PX, 3 * PX, 1 * PX);
        [
            { n: 'FL', x: 3.5, z: 1.2 },
            { n: 'FR', x: 3.5, z: -1.2 },
            { n: 'BL', x: -3.5, z: 1.2 },
            { n: 'BR', x: -3.5, z: -1.2 },
        ].forEach(d => {
            const p = new THREE.Group();
            p.position.set(d.x * PX, -2 * PX, d.z * PX);
            const leg = new THREE.Mesh(legG, C.leg);
            leg.position.y = -1.5 * PX;
            leg.castShadow = true;
            p.add(leg);
            g.add(p);
            this.pivots['leg' + d.n] = p;
        });

        // ── TAIL (3-segment curved) ──
        const tailP = new THREE.Group();
        tailP.position.set(-5 * PX, 1 * PX, 0);
        [
            { w: 0.7, h: 1.3, x: 0, y: 0.4, r: 0.2 },
            { w: 0.6, h: 1.3, x: -0.5, y: 1.4, r: 0.6 },
            { w: 0.5, h: 1.0, x: -1.2, y: 2.1, r: 1.0 },
        ].forEach(s => {
            const seg = bx(s.w * PX, s.h * PX, 0.6 * PX, C.tail);
            seg.position.set(s.x * PX, s.y * PX, 0);
            seg.rotation.z = s.r;
            tailP.add(seg);
        });
        g.add(tailP);
        this.pivots.tail = tailP;

        // ── BUTTERFLY WINGS ──
        this._buildWing('L', PX, C.wY, C.wD, 1);
        this._buildWing('R', PX, C.wY, C.wD, -1);

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
        const flying = this.isFlying || !this.onGround;
        const PX = this._PX;
        const wSpread = 0.15;

        // Swimming animation
        if (this.inWater && this.onGround) {
            // Legs paddle fast
            const a = Math.sin(t * 14) * 0.5;
            this.pivots.legFL.rotation.z = a;
            this.pivots.legBR.rotation.z = a;
            this.pivots.legFR.rotation.z = -a;
            this.pivots.legBL.rotation.z = -a;
            // Body bob in water
            const bob = Math.sin(t * 3) * 0.03;
            this.bMesh.forEach((m, i) => {
                m.position.y = (-1.5 + i) * PX + bob;
            });
        } else if (isMoving && this.onGround) {
            const a = Math.sin(t * 10) * 0.4;
            this.pivots.legFL.rotation.z = a;
            this.pivots.legBR.rotation.z = a;
            this.pivots.legFR.rotation.z = -a;
            this.pivots.legBL.rotation.z = -a;
        } else if (flying) {
            this.pivots.legFL.rotation.z = 0.2;
            this.pivots.legFR.rotation.z = 0.2;
            this.pivots.legBL.rotation.z = -0.2;
            this.pivots.legBR.rotation.z = -0.2;
        } else {
            ['legFL', 'legFR', 'legBL', 'legBR'].forEach(k => {
                this.pivots[k].rotation.z *= 0.9;
            });
        }

        // Butterfly wings
        if (flying) {
            const wa = wSpread + Math.abs(Math.sin(t * 8)) * 0.7;
            this.pivots.wingL.rotation.x = wa;
            this.pivots.wingR.rotation.x = -wa;
        } else if (isMoving) {
            this.pivots.wingL.rotation.x = wSpread + Math.sin(t * 3) * 0.08;
            this.pivots.wingR.rotation.x = -(wSpread + Math.sin(t * 3) * 0.08);
        } else {
            const breath = Math.sin(t * 1.5) * 0.06;
            this.pivots.wingL.rotation.x = wSpread + breath;
            this.pivots.wingR.rotation.x = -(wSpread + breath);
        }

        // Tail — speed depends on state
        const tailSpeed = flying ? 8 : isMoving ? 5 : 2;
        const tailAmp = isMoving ? 0.25 : 0.1;
        this.pivots.tail.rotation.z = Math.sin(t * tailSpeed) * tailAmp;

        // Breathing (idle body scale pulse)
        if (!isMoving && !flying && !this.inWater) {
            this.bMesh[1].scale.x = 1 + Math.sin(t * 1.5) * 0.02;
        } else {
            this.bMesh[1].scale.x = 1;
        }

        // Body bob when walking (not swimming — handled above)
        if (isMoving && this.onGround && !this.inWater) {
            const bob = Math.sin(t * 20) * 0.015;
            this.bMesh.forEach((m, i) => {
                m.position.y = (-1.5 + i) * PX + bob;
            });
        }
    }
};

Dog.init();
