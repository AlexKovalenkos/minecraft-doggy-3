// ============================================================
// npcs.js — Единорожки, бабочки, свинки, кот, пёсик,
//           дракон, хомячки, котята
// ============================================================

const NPCs = {
    unicorns: [],
    butterflies: [],
    pigs: [],
    cats: [],
    tamedCount: 0,
    tamedButterflies: 0,
    tamedCats: 0,
    tamedPigs: 0,
    npcDogs: [],
    tamedNpcDogs: 0,
    dragons: [],
    tamedDragons: 0,
    hamsters: [],
    tamedHamsters: 0,
    kittens: [],
    stableUnicorns: [],

    init() {
        this._createUnicorn(-12, 8);
        this._createUnicorn(8, -15);
        this._createUnicorn(-5, -8);

        this._createButterfly(-5, 3, 5);
        this._createButterfly(12, 4, -8);
        this._createButterfly(-15, 2.5, -5);
    },

    // Called after World.init() sets up fenceBounds
    initFarmAnimals() {
        if (World.fenceBounds) {
            const fb = World.fenceBounds;
            const cx = (fb.minX + fb.maxX) / 2;
            const cz = (fb.minZ + fb.maxZ) / 2;
            this._createPig(cx - 1.5, cz - 1);
            this._createPig(cx + 1.5, cz + 1);
        }
        this._createCat(-25 + 6, 20);
        this._createNpcDog(12, -14);

        // New NPCs
        this._createDragon();

        // 7 hamsters near hamster house
        const hamsterColors = [
            { name: 'Рыжик',      body: 0xE8820A, wings: 0xffd700 },
            { name: 'Снежок',     body: 0xffffff, wings: 0xffe0ec },
            { name: 'Шоколадка',  body: 0x8B5E30, wings: 0xc48a5c },
            { name: 'Голубчик',   body: 0xa8c8e8, wings: 0x87ceeb },
            { name: 'Розочка',    body: 0xf5b0b0, wings: 0xff69b4 },
            { name: 'Серебряшка', body: 0xc0c0c0, wings: 0xe0e0e0 },
            { name: 'Пятнышко',   body: 0xE8820A, wings: 0xffe066, spotted: true }
        ];
        hamsterColors.forEach((hc, i) => {
            const angle = (i / 7) * Math.PI * 2;
            const hx = -70 + Math.cos(angle) * (2 + Math.random() * 3);
            const hz = -65 + Math.sin(angle) * (2 + Math.random() * 3);
            this._createHamster(hx, hz, hc);
        });

        // 2 stable unicorns in the barn
        this._createStableUnicorn(30 - 4, 35 - 3, 0);
        this._createStableUnicorn(30 + 4, 35 - 3, 1);

        // 4 kittens near cat
        const kittenColors = [0xE8820A, 0xf5f5f5, 0x333333, 0x888888];
        kittenColors.forEach((color, i) => {
            this._createKitten(-25 + 6 + (i - 1.5) * 1.2, 20 + 1.5, color, i === 3);
        });
    },

    // === UNICORN (with cuter face + timed taming) ===
    _createUnicorn(x, z) {
        const g = new THREE.Group();
        const white = new THREE.MeshStandardMaterial({ color: 0xfff5f5 });
        const hornMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x4a0080 });
        const hoofMat = new THREE.MeshStandardMaterial({ color: 0xd4a574 });

        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 1.1), white);
        body.castShadow = true;
        g.add(body);

        // Belly
        const belly = new THREE.Mesh(
            new THREE.BoxGeometry(1.8, 0.2, 0.9),
            new THREE.MeshStandardMaterial({ color: 0xffe0ec })
        );
        belly.position.set(0, -0.55, 0);
        g.add(belly);

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.9), white);
        head.position.set(1.3, 0.35, 0);
        head.castShadow = true;
        g.add(head);

        // Snout
        const snout = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.5, 0.6),
            new THREE.MeshStandardMaterial({ color: 0xffd9e8 })
        );
        snout.position.set(1.7, 0.15, 0);
        g.add(snout);

        // Nostrils (slightly bigger)
        const nostrilMat = new THREE.MeshStandardMaterial({ color: 0xf0a0b0 });
        [0.14, -0.14].forEach(zz => {
            const n = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.1), nostrilMat);
            n.position.set(1.86, 0.15, zz);
            g.add(n);
        });

        // Eyes (bigger, cuter)
        [0.25, -0.25].forEach(zz => {
            const eye = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.08), eyeMat);
            eye.position.set(1.71, 0.45, zz);
            g.add(eye);
            const hl = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.08, 0.04),
                new THREE.MeshStandardMaterial({ color: 0xffffff })
            );
            hl.position.set(1.73, 0.55, zz + 0.06 * Math.sign(zz));
            g.add(hl);
        });

        // Eyelashes (upper)
        [0.25, -0.25].forEach(zz => {
            const lash = new THREE.Mesh(
                new THREE.BoxGeometry(0.12, 0.04, 0.04),
                eyeMat
            );
            lash.position.set(1.71, 0.63, zz);
            g.add(lash);
        });

        // Lower eyelashes
        [0.25, -0.25].forEach(zz => {
            const lash = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.03, 0.03),
                eyeMat
            );
            lash.position.set(1.71, 0.28, zz);
            g.add(lash);
        });

        // Pink cheeks
        const cheekMat = new THREE.MeshStandardMaterial({ color: 0xffb6c1 });
        [0.28, -0.28].forEach(zz => {
            const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.06), cheekMat);
            cheek.position.set(1.71, 0.32, zz);
            g.add(cheek);
        });

        // Smile (two angled pieces)
        const smileMat = new THREE.MeshStandardMaterial({ color: 0xd4787a });
        [-0.08, 0.08].forEach(zz => {
            const s = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.12), smileMat);
            s.position.set(1.85, 0.05, zz);
            s.rotation.x = zz > 0 ? 0.3 : -0.3;
            g.add(s);
        });

        // Star on forehead
        const star = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), hornMat);
        star.position.set(1.3, 0.9, 0);
        g.add(star);

        // Horn (3 sections)
        [0, 0.3, 0.55].forEach((y, i) => {
            const s = 0.2 - i * 0.05;
            const h = new THREE.Mesh(
                new THREE.BoxGeometry(s, 0.3, s),
                hornMat
            );
            h.position.set(1.3, 1.05 + y, 0);
            g.add(h);
        });

        // Mane - rainbow
        const maneColors = [0xff69b4, 0xff85a2, 0xffd700, 0x87ceeb, 0xc8a2c8, 0xffb6c1];
        for (let i = 0; i < 6; i++) {
            const mane = new THREE.Mesh(
                new THREE.BoxGeometry(0.25, 0.35 + Math.random() * 0.15, 0.35),
                new THREE.MeshStandardMaterial({ color: maneColors[i % maneColors.length] })
            );
            mane.position.set(0.9 - i * 0.3, 0.85 + Math.sin(i * 0.8) * 0.1, 0);
            mane.castShadow = true;
            g.add(mane);
        }
        for (let i = 0; i < 3; i++) {
            const strand = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, 0.3, 0.1),
                new THREE.MeshStandardMaterial({ color: maneColors[(i + 2) % maneColors.length] })
            );
            strand.position.set(1.0 - i * 0.25, 0.55, 0.5);
            g.add(strand);
        }

        // Legs with hooves
        const legPivots = {};
        [
            { name: 'FL', x: 0.65, z: 0.3 },
            { name: 'FR', x: 0.65, z: -0.3 },
            { name: 'BL', x: -0.65, z: 0.3 },
            { name: 'BR', x: -0.65, z: -0.3 }
        ].forEach(lp => {
            const pivot = new THREE.Group();
            pivot.position.set(lp.x, -0.5, lp.z);
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.8, 0.25), white);
            leg.position.y = -0.4;
            leg.castShadow = true;
            pivot.add(leg);
            const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.15, 0.28), hoofMat);
            hoof.position.y = -0.8;
            pivot.add(hoof);
            g.add(pivot);
            legPivots[lp.name] = pivot;
        });

        // Tail - rainbow
        const tailColors = [0xff69b4, 0xffd700, 0xc8a2c8, 0x87ceeb];
        for (let i = 0; i < 4; i++) {
            const tPart = new THREE.Mesh(
                new THREE.BoxGeometry(0.12, 0.4 + Math.random() * 0.2, 0.12),
                new THREE.MeshStandardMaterial({ color: tailColors[i] })
            );
            tPart.position.set(-1.15 - i * 0.08, -0.1 - i * 0.15, (Math.random() - 0.5) * 0.2);
            tPart.rotation.x = 0.3 + i * 0.15;
            g.add(tPart);
        }

        // Fan (opahalo) — attached to FR leg pivot
        const fanGroup = new THREE.Group();
        const fanStick = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.0, 0.1),
            new THREE.MeshStandardMaterial({ color: 0xc48a5c }));
        fanStick.position.y = 1.0;
        fanGroup.add(fanStick);
        const fanLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2, 0.8),
            new THREE.MeshStandardMaterial({ color: 0x4a9a40 }));
        fanLeaf.position.y = 1.8;
        fanGroup.add(fanLeaf);
        fanGroup.visible = false;
        legPivots.FR.add(fanGroup);

        g.position.set(x, 1.5, z);
        g.userData = {
            tamed: false,
            tamedIndex: -1,
            tamedTimer: 0,
            aiTimer: 0,
            aiDir: Math.random() * Math.PI * 2,
            aiSpeed: 1.5 + Math.random(),
            aiMoving: true,
            legPivots: legPivots,
            isWalking: false,
            wandering: false,
            fanMode: false,
            fanMesh: fanGroup
        };

        GAME.scene.add(g);
        this.unicorns.push(g);
    },

    _createStableUnicorn(x, z, idx) {
        // Reuse the same model as regular unicorn
        const g = new THREE.Group();
        const white = new THREE.MeshStandardMaterial({ color: 0xfff5f5 });
        const hornMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x4a0080 });
        const hoofMat = new THREE.MeshStandardMaterial({ color: 0xd4a574 });

        const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 1.1), white);
        body.castShadow = true;
        g.add(body);
        const belly = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 0.9),
            new THREE.MeshStandardMaterial({ color: 0xffe0ec }));
        belly.position.set(0, -0.55, 0);
        g.add(belly);
        const head = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.9), white);
        head.position.set(1.3, 0.35, 0);
        head.castShadow = true;
        g.add(head);
        const snout = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.6),
            new THREE.MeshStandardMaterial({ color: 0xffd9e8 }));
        snout.position.set(1.7, 0.15, 0);
        g.add(snout);
        [0.25, -0.25].forEach(zz => {
            const eye = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.08), eyeMat);
            eye.position.set(1.71, 0.45, zz);
            g.add(eye);
            const hl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.04),
                new THREE.MeshStandardMaterial({ color: 0xffffff }));
            hl.position.set(1.73, 0.55, zz + 0.06 * Math.sign(zz));
            g.add(hl);
        });
        [0, 0.3, 0.55].forEach((y, i) => {
            const s = 0.2 - i * 0.05;
            const h = new THREE.Mesh(new THREE.BoxGeometry(s, 0.3, s), hornMat);
            h.position.set(1.3, 1.05 + y, 0);
            g.add(h);
        });
        const maneColors = [0xff69b4, 0xff85a2, 0xffd700, 0x87ceeb, 0xc8a2c8, 0xffb6c1];
        for (let i = 0; i < 6; i++) {
            const mane = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.35, 0.35),
                new THREE.MeshStandardMaterial({ color: maneColors[i] }));
            mane.position.set(0.9 - i * 0.3, 0.85 + Math.sin(i * 0.8) * 0.1, 0);
            g.add(mane);
        }
        const legPivots = {};
        [
            { name: 'FL', x: 0.65, z: 0.3 },
            { name: 'FR', x: 0.65, z: -0.3 },
            { name: 'BL', x: -0.65, z: 0.3 },
            { name: 'BR', x: -0.65, z: -0.3 }
        ].forEach(lp => {
            const pivot = new THREE.Group();
            pivot.position.set(lp.x, -0.5, lp.z);
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.8, 0.25), white);
            leg.position.y = -0.4;
            leg.castShadow = true;
            pivot.add(leg);
            const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.15, 0.28), hoofMat);
            hoof.position.y = -0.8;
            pivot.add(hoof);
            g.add(pivot);
            legPivots[lp.name] = pivot;
        });
        const tailColors = [0xff69b4, 0xffd700, 0xc8a2c8, 0x87ceeb];
        for (let i = 0; i < 4; i++) {
            const tPart = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.12),
                new THREE.MeshStandardMaterial({ color: tailColors[i] }));
            tPart.position.set(-1.15 - i * 0.08, -0.1 - i * 0.15, (Math.random() - 0.5) * 0.2);
            tPart.rotation.x = 0.3 + i * 0.15;
            g.add(tPart);
        }

        g.position.set(x, 1.5, z);
        g.userData = {
            stableAI: true,
            stableState: 'eating',
            stableTimer: 10 + Math.random() * 5,
            homeX: x,
            homeZ: z,
            legPivots: legPivots,
            isWalking: false,
            aiDir: Math.random() * Math.PI * 2,
            aiSpeed: 1.5
        };

        GAME.scene.add(g);
        this.stableUnicorns.push(g);
    },

    _createButterfly(x, y, z) {
        const g = new THREE.Group();
        const colors = [0xff69b4, 0xffd700, 0xff85a2, 0xffc0cb];
        const mat = new THREE.MeshStandardMaterial({
            color: colors[Math.floor(Math.random() * colors.length)],
            side: THREE.DoubleSide
        });

        const wL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.35), mat);
        wL.position.z = 0.2;
        g.add(wL);
        const wR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.35), mat);
        wR.position.z = -0.2;
        g.add(wR);

        g.add(new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.08, 0.08),
            new THREE.MeshStandardMaterial({ color: 0x3d2b1f })
        ));

        g.position.set(x, y, z);
        g.userData = {
            baseY: y, phase: Math.random() * Math.PI * 2,
            centerX: x, centerZ: z,
            radius: 2 + Math.random() * 3,
            wL, wR,
            tamed: false,
            tamedIndex: -1
        };

        GAME.scene.add(g);
        this.butterflies.push(g);
    },

    _createPig(x, z) {
        // ── Minecraft Pig proportions ───────────────────────────────
        // Scale: 1 MC pixel = 0.0625 units (×1.5 for readability)
        // Body: 14×8×8 px → 1.3125×0.75×0.75
        // Head: 8×8×8 px → 0.75×0.75×0.75
        // Legs: 4×12×4 px → 0.375×0.75×0.375 (front half only height)
        const g = new THREE.Group();
        const P = 0.09375; // 1.5 × (1/16) blocks per pixel

        const pinkMat    = new THREE.MeshStandardMaterial({ color: 0xF0ADAD }); // MC pig pink
        const darkPink   = new THREE.MeshStandardMaterial({ color: 0xC87878 });
        const snoutMat   = new THREE.MeshStandardMaterial({ color: 0xE89090 });
        const eyeMat     = new THREE.MeshStandardMaterial({ color: 0x1A0A00 });
        const nostrilMat = new THREE.MeshStandardMaterial({ color: 0xA05050 });

        // Body: 14×8×8 px
        const bW = 14*P, bH = 8*P, bD = 8*P;
        const body = new THREE.Mesh(new THREE.BoxGeometry(bW, bH, bD), pinkMat);
        body.castShadow = true;
        g.add(body);

        // Head: 8×8×8 px, at front+top of body
        const hS = 8*P;
        const head = new THREE.Mesh(new THREE.BoxGeometry(hS, hS, hS), pinkMat);
        head.position.set(bW/2 + hS/2 - 1*P, bH/2 - hS/2 + 2*P, 0);
        head.castShadow = true;
        g.add(head);

        // Snout: 6×3×4 px
        const snout = new THREE.Mesh(new THREE.BoxGeometry(3*P, 3*P, 6*P), snoutMat);
        snout.position.set(head.position.x + hS/2 + P, head.position.y - P, 0);
        g.add(snout);

        // Nostrils
        [2*P, -2*P].forEach(zz => {
            const n = new THREE.Mesh(new THREE.BoxGeometry(P, 1.5*P, 1.5*P), nostrilMat);
            n.position.set(snout.position.x + 1.5*P + 0.005, snout.position.y, zz);
            g.add(n);
        });

        // Eyes
        [3*P, -3*P].forEach(zz => {
            const eye = new THREE.Mesh(new THREE.BoxGeometry(P, 2*P, 2*P), eyeMat);
            eye.position.set(head.position.x + hS/2 + 0.005, head.position.y + 2*P, zz);
            g.add(eye);
        });

        // Ears: flat flaps on head
        [3.5*P, -3.5*P].forEach(zz => {
            const ear = new THREE.Mesh(new THREE.BoxGeometry(3*P, 3*P, P), pinkMat);
            ear.position.set(head.position.x, head.position.y + hS/2 - P, zz);
            ear.rotation.z = 0.1 * Math.sign(zz);
            g.add(ear);
        });

        // Legs: 4×12×4 px → split: 6px inner + 6px outer
        const legPivots = {};
        [
            { name: 'FL', x:  4*P, z:  2.5*P },
            { name: 'FR', x:  4*P, z: -2.5*P },
            { name: 'BL', x: -4*P, z:  2.5*P },
            { name: 'BR', x: -4*P, z: -2.5*P }
        ].forEach(lp => {
            const piv = new THREE.Group();
            piv.position.set(lp.x, -bH/2, lp.z);
            const leg = new THREE.Mesh(new THREE.BoxGeometry(4*P, 6*P, 4*P), darkPink);
            leg.position.y = -3*P;
            leg.castShadow = true;
            piv.add(leg);
            g.add(piv);
            legPivots[lp.name] = piv;
        });

        // Curly tail
        const tailPivot = new THREE.Group();
        tailPivot.position.set(-bW/2, bH/4, 0);
        const tail = new THREE.Mesh(new THREE.BoxGeometry(P, 3*P, P), pinkMat);
        tail.rotation.z = 0.8; tail.position.set(0, 1.5*P, 0);
        tailPivot.add(tail);
        g.add(tailPivot);

        const legH = 6 * P;
        g.position.set(x, legH, z);
        g.userData = {
            type: 'pig', tamed: false, tamedIndex: -1,
            aiTimer: 0, aiDir: Math.random() * Math.PI * 2,
            aiSpeed: 0.9 + Math.random() * 0.4, aiMoving: true,
            legPivots, tailPivot, isWalking: false
        };

        GAME.scene.add(g);
        this.pigs.push(g);
    },

    _createNpcDog(x, z) {
        // ── Minecraft Wolf proportions ──────────────────────────────
        // Scale: 1 MC pixel = 0.125 units
        // Body: 9×6×6 px → 1.125×0.75×0.75
        // Head: 6×6×6 px → 0.75×0.75×0.75
        // Legs: 2×8×2 px → 0.25×1.0×0.25
        // Snout: 4×3×2 px → 0.5×0.375×0.25
        const g = new THREE.Group();
        const P = 0.125; // pixels to units

        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xBFBFBF }); // MC wolf grey
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x7A7A7A });
        const eyeMat  = new THREE.MeshStandardMaterial({ color: 0x3B2F1A });
        const noseMat = new THREE.MeshStandardMaterial({ color: 0x1A1A1A });
        const muzzMat = new THREE.MeshStandardMaterial({ color: 0xE8E0C8 }); // lighter snout
        const wingMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffaa00, emissiveIntensity: 0.15 });
        const dotMat  = new THREE.MeshStandardMaterial({ color: 0x1B3A9A });

        // Body: 9×6×6 px, positioned at y=0 relative to group (group at y=groundY+legH)
        const bW = 9*P, bH = 6*P, bD = 6*P;
        const body = new THREE.Mesh(new THREE.BoxGeometry(bW, bH, bD), bodyMat);
        body.castShadow = true;
        g.add(body); // center of body at y=0 in group

        // Head: 6×6×6 px, forward (+X) at body top
        const hS = 6*P;
        const head = new THREE.Mesh(new THREE.BoxGeometry(hS, hS, hS), darkMat);
        head.position.set(bW/2 + hS/2 - 1*P, bH/2 - hS/2 + 2*P, 0);
        head.castShadow = true;
        g.add(head);

        // Snout: 4×3×2 px
        const snout = new THREE.Mesh(new THREE.BoxGeometry(4*P, 3*P, 4*P), muzzMat);
        snout.position.set(head.position.x + hS/2, head.position.y - 1*P, 0);
        g.add(snout);

        // Nose
        const nose = new THREE.Mesh(new THREE.BoxGeometry(P, 2*P, 2*P), noseMat);
        nose.position.set(snout.position.x + 2*P, snout.position.y + P, 0);
        g.add(nose);

        // Eyes
        [2*P, -2*P].forEach(zz => {
            const eye = new THREE.Mesh(new THREE.BoxGeometry(P, 2*P, 2*P), eyeMat);
            eye.position.set(head.position.x + hS/2, head.position.y + P, zz);
            g.add(eye);
            const hl = new THREE.Mesh(new THREE.BoxGeometry(P*0.6, P, P), new THREE.MeshStandardMaterial({color:0xffffff}));
            hl.position.set(head.position.x + hS/2 + 0.005, head.position.y + 2*P, zz + P*0.6);
            g.add(hl);
        });

        // Ears: 3×3×1 px, perked up (MC wolf)
        [2.5*P, -2.5*P].forEach(zz => {
            const ear = new THREE.Mesh(new THREE.BoxGeometry(2*P, 3*P, P), darkMat);
            ear.position.set(head.position.x - P, head.position.y + hS/2 + P, zz);
            g.add(ear);
        });

        // Tail: 2×8×2 px, angled up (MC wolf tail)
        const tailPivot = new THREE.Group();
        tailPivot.position.set(-bW/2, bH/4, 0);
        const tail = new THREE.Mesh(new THREE.BoxGeometry(2*P, 8*P, 2*P), darkMat);
        tail.position.set(0, 4*P, 0);
        tail.rotation.z = -0.5; // angled up like MC wolf
        tailPivot.add(tail);
        g.add(tailPivot);

        // Legs: 2×8×2 px
        const legGeo = new THREE.BoxGeometry(2*P, 8*P, 2*P);
        const legPivots = {};
        [
            { name: 'FL', x:  3*P, z:  2*P },
            { name: 'FR', x:  3*P, z: -2*P },
            { name: 'BL', x: -3*P, z:  2*P },
            { name: 'BR', x: -3*P, z: -2*P }
        ].forEach(lp => {
            const piv = new THREE.Group();
            piv.position.set(lp.x, -bH/2, lp.z);
            const leg = new THREE.Mesh(legGeo, darkMat);
            leg.position.y = -4*P;
            leg.castShadow = true;
            piv.add(leg);
            g.add(piv);
            legPivots[lp.name] = piv;
        });

        // Butterfly wings (it's a magical flying wolf!)
        [1, -1].forEach(zDir => {
            const wp = new THREE.Group();
            wp.position.set(-2*P, bH/2, 3*P * zDir);
            [
                { w: 0.7, d: 0.6, oz: 0.35 * zDir },
                { w: 0.5, d: 0.4, oz: 0.82 * zDir }
            ].forEach(seg => {
                const wm = new THREE.Mesh(new THREE.BoxGeometry(seg.w, 2*P, seg.d), wingMat);
                wm.position.set(0, 0, seg.oz);
                wp.add(wm);
            });
            [[-0.25,0.2],[0.25,0.2],[-0.1,0.6],[0.2,0.6]].forEach(([bx,bz]) => {
                const d = new THREE.Mesh(new THREE.BoxGeometry(2*P,2*P,2*P), dotMat);
                d.position.set(bx, 2*P, bz * zDir);
                wp.add(d);
            });
            g.add(wp);
        });

        // Group positioned so feet touch ground: y = groundY + legHeight = 8*P
        const legH = 8 * P;
        g.position.set(x, legH, z);
        g.userData = {
            type: 'npcDog', tamed: false, tamedIndex: -1,
            aiTimer: 0, aiDir: Math.random() * Math.PI * 2,
            aiSpeed: 1.8 + Math.random() * 0.5, aiMoving: true,
            legPivots, tailPivot, isWalking: false,
            homeX: x, homeZ: z
        };

        GAME.scene.add(g);
        this.npcDogs.push(g);
    },

    _createCat(x, z) {
        const g = new THREE.Group();
        const greyMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x44aa44 });
        const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

        const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.6), greyMat);
        body.castShadow = true;
        g.add(body);

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.55), darkMat);
        head.position.set(0.7, 0.2, 0);
        head.castShadow = true;
        g.add(head);

        [0.15, -0.15].forEach(zz => {
            const eye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.05), eyeMat);
            eye.position.set(0.96, 0.3, zz);
            g.add(eye);
            const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.03),
                new THREE.MeshStandardMaterial({ color: 0x111111 }));
            pupil.position.set(0.98, 0.3, zz);
            g.add(pupil);
        });

        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.06),
            new THREE.MeshStandardMaterial({ color: 0xf0a0b0 }));
        nose.position.set(1.0, 0.18, 0);
        g.add(nose);

        [-0.12, 0.12].forEach(zz => {
            const whisker = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.02), whiteMat);
            whisker.position.set(0.95, 0.18, zz + Math.sign(zz) * 0.15);
            g.add(whisker);
        });

        [-0.18, 0.18].forEach(zz => {
            const ear = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.1), darkMat);
            ear.position.set(0.7, 0.55, zz);
            g.add(ear);
        });

        const legPivots = {};
        [
            { name: 'FL', x: 0.35, z: 0.18 },
            { name: 'FR', x: 0.35, z: -0.18 },
            { name: 'BL', x: -0.35, z: 0.18 },
            { name: 'BR', x: -0.35, z: -0.18 }
        ].forEach(lp => {
            const pivot = new THREE.Group();
            pivot.position.set(lp.x, -0.2, lp.z);
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.12), greyMat);
            leg.position.y = -0.2;
            leg.castShadow = true;
            pivot.add(leg);
            g.add(pivot);
            legPivots[lp.name] = pivot;
        });

        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.6), darkMat);
        tail.position.set(-0.65, 0.15, 0);
        tail.rotation.y = 0.3;
        g.add(tail);

        g.position.set(x, 0.6, z);
        g.userData = {
            type: 'cat',
            tamed: false,
            tamedIndex: -1,
            aiTimer: 0,
            aiDir: Math.random() * Math.PI * 2,
            aiSpeed: 1.2 + Math.random() * 0.5,
            aiMoving: true,
            legPivots: legPivots,
            isWalking: false,
            homeX: x,
            homeZ: z,
            fleeingWater: false
        };

        GAME.scene.add(g);
        this.cats.push(g);
    },

    // === DRAGON ===
    _createDragon() {
        const g = new THREE.Group();
        const greenMat = new THREE.MeshStandardMaterial({ color: 0x2d8a4e });
        const lightGreen = new THREE.MeshStandardMaterial({ color: 0x3a9a5a });
        const darkGreen = new THREE.MeshStandardMaterial({ color: 0x1a6b3a });
        const bellyMat = new THREE.MeshStandardMaterial({ color: 0x8dd4a0 });
        const hornMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff8800 });
        const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const mouthMat = new THREE.MeshStandardMaterial({ color: 0xd4787a });
        const clawMat = new THREE.MeshStandardMaterial({ color: 0x4a3520 });

        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 2), greenMat);
        body.castShadow = true;
        g.add(body);

        // Belly
        const belly = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.3, 1.5), bellyMat);
        belly.position.set(0, -0.85, 0);
        g.add(belly);

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.5, 1.5), lightGreen);
        head.position.set(2.5, 0.5, 0);
        head.castShadow = true;
        g.add(head);

        // Mouth
        const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 1.0), mouthMat);
        mouth.position.set(3.3, -0.1, 0);
        g.add(mouth);

        // Eyes
        [0.45, -0.45].forEach(zz => {
            const eye = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.08), eyeMat);
            eye.position.set(3.2, 0.8, zz);
            g.add(eye);
            const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.05), pupilMat);
            pupil.position.set(3.25, 0.8, zz);
            g.add(pupil);
        });

        // Horns
        [-0.35, 0.35].forEach(zz => {
            const horn = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), hornMat);
            horn.position.set(2.3, 1.55, zz);
            g.add(horn);
        });

        // Wings
        const wingPivots = {};
        [1, -1].forEach(zDir => {
            const wp = new THREE.Group();
            wp.position.set(-0.5, 0.8, 1.0 * zDir);
            const main = new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, 2), darkGreen);
            main.position.set(0, 0, 1.0 * zDir);
            wp.add(main);
            const tip = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 1.5), darkGreen);
            tip.position.set(-0.5, 0, 2.2 * zDir);
            wp.add(tip);
            g.add(wp);
            wingPivots[zDir > 0 ? 'L' : 'R'] = wp;
        });

        // Legs
        const legPivots = {};
        [
            { name: 'FL', x: 1.2, z: 0.7 },
            { name: 'FR', x: 1.2, z: -0.7 },
            { name: 'BL', x: -1.2, z: 0.7 },
            { name: 'BR', x: -1.2, z: -0.7 }
        ].forEach(lp => {
            const pivot = new THREE.Group();
            pivot.position.set(lp.x, -0.8, lp.z);
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 0.5), greenMat);
            leg.position.y = -0.5;
            leg.castShadow = true;
            pivot.add(leg);
            // Claws
            const claw = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.4), clawMat);
            claw.position.set(0, -1.0, 0.15);
            pivot.add(claw);
            g.add(pivot);
            legPivots[lp.name] = pivot;
        });

        // Tail (4 segments)
        for (let i = 0; i < 4; i++) {
            const s = 0.6 - i * 0.1;
            const seg = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.8, 1.0), greenMat);
            seg.position.set(-2.5 - i * 0.9, -0.2 - i * 0.15, 0);
            seg.castShadow = true;
            g.add(seg);
        }
        // Tail tip (triangle-ish)
        const tailTip1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.3), darkGreen);
        tailTip1.position.set(-6.1, -0.5, 0);
        tailTip1.rotation.z = 0.4;
        g.add(tailTip1);
        const tailTip2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.3), darkGreen);
        tailTip2.position.set(-6.1, -0.5, 0);
        tailTip2.rotation.z = -0.4;
        g.add(tailTip2);

        g.position.set(75, 8, -60);
        g.userData = {
            type: 'dragon',
            tamed: false,
            aiTimer: 0,
            circleAngle: 0,
            homeX: 75,
            homeZ: -60,
            legPivots: legPivots,
            wingPivots: wingPivots,
            isWalking: false,
            groundY: 2.0
        };

        GAME.scene.add(g);
        this.dragons.push(g);
    },

    // === HAMSTER ===
    _createHamster(x, z, colorDef) {
        const g = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: colorDef.body });
        const wingMat = new THREE.MeshStandardMaterial({ color: colorDef.wings });
        const cheekMat = new THREE.MeshStandardMaterial({ color: 0xf5b0b0 });
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.35), bodyMat);
        body.castShadow = true;
        g.add(body);

        // Spots for Пятнышко
        if (colorDef.spotted) {
            const spotMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
            [[-0.1, 0.05, 0.15], [0.1, -0.05, -0.12], [0.0, 0.1, 0.0]].forEach(([dx, dy, dz]) => {
                const spot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.08), spotMat);
                spot.position.set(dx, dy + 0.05, dz);
                g.add(spot);
            });
        }

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.3), bodyMat);
        head.position.set(0.32, 0.08, 0);
        g.add(head);

        // Eyes
        [0.08, -0.08].forEach(zz => {
            const eye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.03), eyeMat);
            eye.position.set(0.44, 0.12, zz);
            g.add(eye);
        });

        // Cheeks
        [0.1, -0.1].forEach(zz => {
            const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.04), cheekMat);
            cheek.position.set(0.42, 0.02, zz);
            g.add(cheek);
        });

        // Ears
        [0.1, -0.1].forEach(zz => {
            const ear = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.05), bodyMat);
            ear.position.set(0.32, 0.24, zz);
            g.add(ear);
        });

        // Legs
        const legPivots = {};
        [
            { name: 'FL', x: 0.15, z: 0.1 },
            { name: 'FR', x: 0.15, z: -0.1 },
            { name: 'BL', x: -0.15, z: 0.1 },
            { name: 'BR', x: -0.15, z: -0.1 }
        ].forEach(lp => {
            const pivot = new THREE.Group();
            pivot.position.set(lp.x, -0.15, lp.z);
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.08), bodyMat);
            leg.position.y = -0.075;
            pivot.add(leg);
            g.add(pivot);
            legPivots[lp.name] = pivot;
        });

        // Tail
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.06), bodyMat);
        tail.position.set(-0.27, 0, 0);
        g.add(tail);

        // Wings (small!)
        const wingPivots = {};
        [1, -1].forEach(zDir => {
            const wp = new THREE.Group();
            wp.position.set(-0.05, 0.12, 0.17 * zDir);
            const wing = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.2), wingMat);
            wing.position.set(0, 0, 0.1 * zDir);
            wp.add(wing);
            g.add(wp);
            wingPivots[zDir > 0 ? 'L' : 'R'] = wp;
        });

        g.position.set(x, 0.35, z);
        g.userData = {
            type: 'hamster',
            name: colorDef.name,
            tamed: false,
            tamedIndex: -1,
            aiTimer: 0,
            aiDir: Math.random() * Math.PI * 2,
            aiSpeed: 1.0 + Math.random() * 0.5,
            aiMoving: true,
            legPivots: legPivots,
            wingPivots: wingPivots,
            isWalking: false,
            homeX: x,
            homeZ: z
        };

        GAME.scene.add(g);
        this.hamsters.push(g);
    },

    // === KITTEN ===
    _createKitten(x, z, color, striped) {
        const g = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: color });
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x44aa44 });
        const noseMat = new THREE.MeshStandardMaterial({ color: 0xf0a0b0 });

        // Body (60% of cat)
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.35), bodyMat);
        body.castShadow = true;
        g.add(body);

        // Stripes for tabby
        if (striped) {
            const stripeMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
            [-0.15, 0, 0.15].forEach(xOff => {
                const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.36, 0.36), stripeMat);
                stripe.position.set(xOff, 0, 0);
                g.add(stripe);
            });
        }

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.3), bodyMat);
        head.position.set(0.42, 0.1, 0);
        head.castShadow = true;
        g.add(head);

        // Eyes
        [0.08, -0.08].forEach(zz => {
            const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.03), eyeMat);
            eye.position.set(0.57, 0.16, zz);
            g.add(eye);
        });

        // Nose
        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.04), noseMat);
        nose.position.set(0.59, 0.08, 0);
        g.add(nose);

        // Ears
        [-0.1, 0.1].forEach(zz => {
            const ear = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.06), bodyMat);
            ear.position.set(0.42, 0.3, zz);
            g.add(ear);
        });

        // Legs
        const legPivots = {};
        [
            { name: 'FL', x: 0.2, z: 0.1 },
            { name: 'FR', x: 0.2, z: -0.1 },
            { name: 'BL', x: -0.2, z: 0.1 },
            { name: 'BR', x: -0.2, z: -0.1 }
        ].forEach(lp => {
            const pivot = new THREE.Group();
            pivot.position.set(lp.x, -0.12, lp.z);
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.24, 0.07), bodyMat);
            leg.position.y = -0.12;
            pivot.add(leg);
            g.add(pivot);
            legPivots[lp.name] = pivot;
        });

        // Tail
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.35), bodyMat);
        tail.position.set(-0.4, 0.08, 0);
        tail.rotation.y = 0.2;
        g.add(tail);

        g.position.set(x, 0.36, z);
        g.userData = {
            type: 'kitten',
            legPivots: legPivots,
            isWalking: false,
            phase: Math.random() * Math.PI * 2
        };

        GAME.scene.add(g);
        this.kittens.push(g);
    },

    spawnUnicorn() {
        const angle = Math.random() * Math.PI * 2;
        const dist = 12 + Math.random() * 10;
        let x = Dog.group.position.x + Math.cos(angle) * dist;
        let z = Dog.group.position.z + Math.sin(angle) * dist;
        const bound = GAME.WORLD_SIZE - 5;
        x = Math.max(-bound, Math.min(bound, x));
        z = Math.max(-bound, Math.min(bound, z));
        this._createUnicorn(x, z);
        Effects.spawnParticles(x, 2, z, 0xffd700, 12);
        Effects.showMessage('Новый единорожек появился!');
    },

    tryTame() {
        // Unicorns — timed taming
        this.unicorns.forEach(u => {
            if (u.userData.tamed) return;
            if (Dog.group.position.distanceTo(u.position) < 4) {
                u.userData.tamed = true;
                u.userData.tamedTimer = 30; // 30 seconds
                u.userData.tamedIndex = this.tamedCount;
                this.tamedCount++;
                document.getElementById('tamedCount').textContent = this.tamedCount;
                Effects.spawnHearts(u.position.x, u.position.y + 1, u.position.z);
                Sounds.tame();
                Effects.showMessage('Единорожек приручён на 30 сек!');
            }
        });
        this.butterflies.forEach(b => {
            if (b.userData.tamed) return;
            if (Dog.group.position.distanceTo(b.position) < 3) {
                b.userData.tamed = true;
                b.userData.tamedIndex = this.tamedButterflies;
                this.tamedButterflies++;
                Effects.spawnParticles(b.position.x, b.position.y, b.position.z, 0xff69b4, 8);
                Sounds.tame();
                Effects.showMessage('Бабочка приручена!');
            }
        });
        this.cats.forEach(c => {
            if (c.userData.tamed) return;
            if (Dog.group.position.distanceTo(c.position) < 3) {
                c.userData.tamed = true;
                c.userData.tamedIndex = this.tamedCats;
                this.tamedCats++;
                Effects.spawnHearts(c.position.x, c.position.y + 0.5, c.position.z);
                Sounds.tame();
                Effects.showMessage('Котик приручён! Мяу!');
            }
        });
        this.pigs.forEach(p => {
            if (p.userData.tamed) return;
            if (Dog.group.position.distanceTo(p.position) < 3) {
                p.userData.tamed = true;
                p.userData.tamedIndex = this.tamedPigs;
                this.tamedPigs++;
                Effects.spawnHearts(p.position.x, p.position.y + 0.5, p.position.z);
                Sounds.tame();
                Effects.showMessage('Свинка приручена! Хрю!');
            }
        });
        this.npcDogs.forEach(nd => {
            if (nd.userData.tamed) return;
            if (Dog.group.position.distanceTo(nd.position) < 3) {
                nd.userData.tamed = true;
                nd.userData.tamedIndex = this.tamedNpcDogs;
                this.tamedNpcDogs++;
                Effects.spawnHearts(nd.position.x, nd.position.y + 0.5, nd.position.z);
                Sounds.tame();
                Effects.showMessage('Пёсик приручён! Гав!');
            }
        });
        // Dragon
        this.dragons.forEach(dr => {
            if (dr.userData.tamed) return;
            if (Dog.group.position.distanceTo(dr.position) < 6) {
                dr.userData.tamed = true;
                this.tamedDragons++;
                Effects.spawnHearts(dr.position.x, dr.position.y + 1, dr.position.z);
                Sounds.roar();
                Effects.showMessage('Дракон приручён! Рррр!');
            }
        });
        // Hamsters
        this.hamsters.forEach(h => {
            if (h.userData.tamed) return;
            if (Dog.group.position.distanceTo(h.position) < 2.5) {
                h.userData.tamed = true;
                h.userData.tamedIndex = this.tamedHamsters;
                this.tamedHamsters++;
                Effects.spawnHearts(h.position.x, h.position.y + 0.3, h.position.z);
                Sounds.squeak();
                Effects.showMessage(h.userData.name + ' приручён(а)!');
            }
        });
    },

    _shortAngleDist(from, to) {
        const diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
        return diff < -Math.PI ? diff + Math.PI * 2 : diff;
    },

    update(dt, t) {
        const bound = GAME.WORLD_SIZE - 2;

        // === Unicorn AI (timed taming + throne fan) ===
        const totalTamed = this.unicorns.filter(u => u.userData.tamed).length;

        this.unicorns.forEach(u => {
            const d = u.userData;

            // Timed taming countdown
            if (d.tamed && d.tamedTimer > 0) {
                d.tamedTimer -= dt;
                if (d.tamedTimer <= 0) {
                    d.tamed = false;
                    d.wandering = true;
                    d.aiTimer = 0;
                }
            }

            if (d.tamed) {
                // Throne fan mode
                if (Dog.onThrone) {
                    const tp = World.thronePos;
                    const dx = tp.x - u.position.x;
                    const dz = tp.z - u.position.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    if (dist < 20) {
                        d.fanMode = true;
                        if (dist > 4) {
                            d.isWalking = true;
                            const speed = Math.min(dist, 4);
                            u.position.x += (dx / dist) * speed * dt;
                            u.position.z += (dz / dist) * speed * dt;
                        } else {
                            d.isWalking = false;
                        }
                        u.rotation.y = Math.atan2(dx, dz);
                        u.rotation.z = 0;
                        // Fan animation with front legs + visible fan
                        if (d.legPivots && dist < 5) {
                            if (d.fanMesh) d.fanMesh.visible = true;
                            d.legPivots.FL.rotation.z = Math.sin(t * 4) * 0.8;
                            d.legPivots.FR.rotation.z = Math.sin(t * 4 + Math.PI) * 0.8;
                            d.legPivots.BL.rotation.z = 0;
                            d.legPivots.BR.rotation.z = 0;
                        } else if (d.fanMesh) {
                            d.fanMesh.visible = false;
                        }
                    } else {
                        d.fanMode = false;
                        if (d.fanMesh) d.fanMesh.visible = false;
                    }
                } else {
                    d.fanMode = false;
                }

                if (!d.fanMode) {
                    if (d.fanMesh) d.fanMesh.visible = false;
                    const dogFlying = !Dog.onGround && Dog.group.position.y > 2.5;
                    const wasLookingUp = d.lookingUp;
                    d.lookingUp = dogFlying;

                    if (wasLookingUp && !dogFlying) {
                        Effects.spawnHearts(u.position.x, u.position.y + 1, u.position.z);
                        if (d.tamedIndex === 0) {
                            Effects.showMessage('Единорожки рады — хозяин вернулся!');
                        }
                    }

                    if (dogFlying) {
                        d.isWalking = false;
                        const dxLook = Dog.group.position.x - u.position.x;
                        const dzLook = Dog.group.position.z - u.position.z;
                        u.rotation.y = Math.atan2(dxLook, dzLook);
                        u.rotation.z = 0.65;
                        if (d.legPivots) {
                            d.legPivots.FL.rotation.z = 1.5;
                            d.legPivots.FR.rotation.z = 1.5;
                            d.legPivots.BL.rotation.z = -0.3;
                            d.legPivots.BR.rotation.z = -0.3;
                        }
                    } else {
                        u.rotation.z = 0;
                        const followDist = 3.5 + d.tamedIndex * 2.0;
                        const angleOffset = totalTamed > 1
                            ? d.tamedIndex * (Math.PI * 2 / totalTamed)
                            : 0;
                        let behindX = Dog.group.position.x - Math.sin(Dog.yaw + angleOffset) * followDist;
                        let behindZ = Dog.group.position.z - Math.cos(Dog.yaw + angleOffset) * followDist;

                        this.unicorns.forEach(other => {
                            if (other === u || !other.userData.tamed) return;
                            const sx = u.position.x - other.position.x;
                            const sz = u.position.z - other.position.z;
                            const sDist = Math.sqrt(sx * sx + sz * sz);
                            if (sDist < 3 && sDist > 0.01) {
                                const pushStrength = (3 - sDist) * 0.5;
                                behindX += (sx / sDist) * pushStrength;
                                behindZ += (sz / sDist) * pushStrength;
                            }
                        });

                        const dx = behindX - u.position.x;
                        const dz = behindZ - u.position.z;
                        const dist = Math.sqrt(dx * dx + dz * dz);

                        d.isWalking = dist > 1;
                        if (d.isWalking) {
                            const speed = Math.min(dist * 2, 5);
                            u.position.x += (dx / dist) * speed * dt;
                            u.position.z += (dz / dist) * speed * dt;
                            u.rotation.y = Math.atan2(dx, dz);
                        }
                    }
                }
            } else {
                // Wander
                d.aiTimer -= dt;
                if (d.aiTimer <= 0) {
                    d.aiTimer = 2 + Math.random() * 3;
                    d.aiDir = Math.random() * Math.PI * 2;
                    d.aiMoving = Math.random() > 0.3;
                }
                d.isWalking = d.aiMoving;
                if (d.aiMoving) {
                    const mx = Math.sin(d.aiDir) * d.aiSpeed * dt;
                    const mz = Math.cos(d.aiDir) * d.aiSpeed * dt;
                    u.position.x += mx;
                    u.position.z += mz;
                    const targetY = Math.atan2(mx, mz);
                    u.rotation.y += this._shortAngleDist(u.rotation.y, targetY) * 5 * dt;
                    if (Math.abs(u.position.x) > bound) d.aiDir += Math.PI;
                    if (Math.abs(u.position.z) > bound) d.aiDir += Math.PI;
                    u.position.x = Math.max(-bound, Math.min(bound, u.position.x));
                    u.position.z = Math.max(-bound, Math.min(bound, u.position.z));
                }
                u.rotation.z = 0;
            }
            // Leg animation (skip if fan mode or looking up)
            if (d.legPivots && !d.lookingUp && !d.fanMode) {
                if (d.isWalking) {
                    const a = Math.sin(t * 8) * 0.4;
                    d.legPivots.FL.rotation.z = a;
                    d.legPivots.BR.rotation.z = a;
                    d.legPivots.FR.rotation.z = -a;
                    d.legPivots.BL.rotation.z = -a;
                    // Walk sway
                    u.rotation.z = Math.sin(t * 6) * 0.03;
                } else {
                    ['FL', 'FR', 'BL', 'BR'].forEach(k => {
                        d.legPivots[k].rotation.z *= 0.9;
                    });
                }
            }
            // Breathing + base Y
            u.position.y = 1.5 + (d.isWalking ? 0 : Math.sin(t * 1.5) * 0.02);
        });

        // === Butterflies ===
        this.butterflies.forEach(b => {
            const d = b.userData;
            const bt = t + d.phase;

            if (d.tamed) {
                const offset = d.tamedIndex * 2.1;
                b.position.x = Dog.group.position.x + Math.sin(bt * 1.2 + offset) * 2;
                b.position.z = Dog.group.position.z + Math.cos(bt * 1.2 + offset) * 2;
                b.position.y = Dog.group.position.y + 1.5 + Math.sin(bt * 2) * 0.5;
            } else {
                b.position.x = d.centerX + Math.sin(bt * 0.7) * d.radius;
                b.position.z = d.centerZ + Math.cos(bt * 0.5) * d.radius;
                b.position.y = d.baseY + Math.sin(bt * 1.5) * 0.8;
            }

            b.rotation.y = bt * 0.7;
            d.wL.rotation.x = Math.sin(bt * 12) * 0.5;
            d.wR.rotation.x = -Math.sin(bt * 12) * 0.5;
        });

        // === Pigs AI ===
        const fb = World.fenceBounds;
        this.pigs.forEach(p => {
            const d = p.userData;
            if (d.tamed) {
                const followDist = 3.0 + d.tamedIndex * 1.5;
                const angleOffset = Math.PI * 0.8 + d.tamedIndex * 0.6;
                const behindX = Dog.group.position.x - Math.sin(Dog.yaw + angleOffset) * followDist;
                const behindZ = Dog.group.position.z - Math.cos(Dog.yaw + angleOffset) * followDist;
                const dx = behindX - p.position.x;
                const dz = behindZ - p.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                d.isWalking = dist > 1;
                if (d.isWalking) {
                    const speed = Math.min(dist * 2, 5);
                    p.position.x += (dx / dist) * speed * dt;
                    p.position.z += (dz / dist) * speed * dt;
                    p.rotation.y = Math.atan2(dx, dz);
                }

                // Pig tail spins faster in water
                if (d.tailPivot) {
                    const tailSpeed = Dog.inWater ? 12 : 6;
                    d.tailPivot.rotation.z = Math.sin(t * tailSpeed) * 0.5;
                    d.tailPivot.rotation.x = 0.5;
                }
            } else {
                d.aiTimer -= dt;
                if (d.aiTimer <= 0) {
                    d.aiTimer = 2 + Math.random() * 4;
                    d.aiDir = Math.random() * Math.PI * 2;
                    d.aiMoving = Math.random() > 0.4;
                }
                d.isWalking = d.aiMoving;
                if (d.aiMoving && fb) {
                    const mx = Math.sin(d.aiDir) * d.aiSpeed * dt;
                    const mz = Math.cos(d.aiDir) * d.aiSpeed * dt;
                    const nx = p.position.x + mx;
                    const nz = p.position.z + mz;
                    if (nx > fb.minX && nx < fb.maxX) p.position.x = nx;
                    else d.aiDir += Math.PI;
                    if (nz > fb.minZ && nz < fb.maxZ) p.position.z = nz;
                    else d.aiDir += Math.PI;
                    p.rotation.y = Math.atan2(mx, mz);
                }
            }
            if (d.legPivots) {
                if (d.isWalking) {
                    const a = Math.sin(t * 8) * 0.3;
                    d.legPivots.FL.rotation.z = a;
                    d.legPivots.BR.rotation.z = a;
                    d.legPivots.FR.rotation.z = -a;
                    d.legPivots.BL.rotation.z = -a;
                } else {
                    ['FL', 'FR', 'BL', 'BR'].forEach(k => {
                        d.legPivots[k].rotation.z *= 0.9;
                    });
                }
            }
            // Sit on terrain (leg height = 6*0.09375 ≈ 0.56)
            p.position.y = (World.getTerrainY ? World.getTerrainY(p.position.x, p.position.z) : 0) + 0.5625;
        });

        // === Cat AI (flees water) ===
        this.cats.forEach(c => {
            const d = c.userData;

            // Check if cat is near water
            let catNearWater = false;
            World.waterZones.forEach(wz => {
                const dx = c.position.x - wz.cx;
                const dz = c.position.z - wz.cz;
                if (Math.abs(dx) < wz.halfW + 3 && Math.abs(dz) < wz.halfD + 3) {
                    catNearWater = true;
                    if (Math.abs(dx) < wz.halfW + 1 && Math.abs(dz) < wz.halfD + 1) {
                        // Too close! Flee!
                        d.fleeingWater = true;
                        d.aiDir = Math.atan2(c.position.x - wz.cx, c.position.z - wz.cz);
                        d.aiSpeed = 4;
                    }
                }
            });
            if (!catNearWater) {
                d.fleeingWater = false;
                d.aiSpeed = 1.2 + Math.random() * 0.5;
            }

            if (d.tamed && !d.fleeingWater) {
                const followDist = 2.5;
                const behindX = Dog.group.position.x - Math.sin(Dog.yaw) * followDist - 1.5;
                const behindZ = Dog.group.position.z - Math.cos(Dog.yaw) * followDist;
                const dx = behindX - c.position.x;
                const dz = behindZ - c.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                d.isWalking = dist > 1;
                if (d.isWalking) {
                    const speed = Math.min(dist * 2.5, 6);
                    c.position.x += (dx / dist) * speed * dt;
                    c.position.z += (dz / dist) * speed * dt;
                    c.rotation.y = Math.atan2(dx, dz);
                }
            } else {
                d.aiTimer -= dt;
                if (d.aiTimer <= 0 && !d.fleeingWater) {
                    d.aiTimer = 2 + Math.random() * 3;
                    d.aiDir = Math.random() * Math.PI * 2;
                    d.aiMoving = Math.random() > 0.3;
                }
                d.isWalking = d.aiMoving || d.fleeingWater;
                if (d.isWalking) {
                    const mx = Math.sin(d.aiDir) * d.aiSpeed * dt;
                    const mz = Math.cos(d.aiDir) * d.aiSpeed * dt;
                    c.position.x += mx;
                    c.position.z += mz;
                    c.rotation.y = Math.atan2(mx, mz);
                    if (!d.tamed) {
                        const hDist = Math.sqrt(
                            (c.position.x - d.homeX) ** 2 + (c.position.z - d.homeZ) ** 2
                        );
                        if (hDist > 6) {
                            d.aiDir = Math.atan2(d.homeX - c.position.x, d.homeZ - c.position.z);
                        }
                    }
                }
            }
            if (d.legPivots) {
                if (d.isWalking) {
                    const a = Math.sin(t * 10) * 0.3;
                    d.legPivots.FL.rotation.z = a;
                    d.legPivots.BR.rotation.z = a;
                    d.legPivots.FR.rotation.z = -a;
                    d.legPivots.BL.rotation.z = -a;
                } else {
                    ['FL', 'FR', 'BL', 'BR'].forEach(k => {
                        d.legPivots[k].rotation.z *= 0.9;
                    });
                }
            }
            c.position.y = (World.getTerrainY ? World.getTerrainY(c.position.x, c.position.z) : 0) + 0.6;
        });

        // === NPC Dogs AI ===
        this.npcDogs.forEach(nd => {
            const d = nd.userData;
            if (d.tamed) {
                const followDist = 2.5;
                const behindX = Dog.group.position.x - Math.sin(Dog.yaw) * followDist + 1.5;
                const behindZ = Dog.group.position.z - Math.cos(Dog.yaw) * followDist;
                const dx = behindX - nd.position.x;
                const dz = behindZ - nd.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                d.isWalking = dist > 1;
                if (d.isWalking) {
                    const speed = Math.min(dist * 2.5, 7);
                    nd.position.x += (dx / dist) * speed * dt;
                    nd.position.z += (dz / dist) * speed * dt;
                    nd.rotation.y = Math.atan2(dx, dz);
                }
            } else {
                d.aiTimer -= dt;
                if (d.aiTimer <= 0) {
                    d.aiTimer = 1.5 + Math.random() * 3;
                    d.aiDir = Math.random() * Math.PI * 2;
                    d.aiMoving = Math.random() > 0.25;
                }
                d.isWalking = d.aiMoving;
                if (d.aiMoving) {
                    const mx = Math.sin(d.aiDir) * d.aiSpeed * dt;
                    const mz = Math.cos(d.aiDir) * d.aiSpeed * dt;
                    nd.position.x += mx;
                    nd.position.z += mz;
                    nd.rotation.y = Math.atan2(mx, mz);
                    const hDist = Math.sqrt(
                        (nd.position.x - d.homeX) ** 2 + (nd.position.z - d.homeZ) ** 2
                    );
                    if (hDist > 8) {
                        d.aiDir = Math.atan2(d.homeX - nd.position.x, d.homeZ - nd.position.z);
                    }
                }
            }
            if (d.legPivots) {
                if (d.isWalking) {
                    const a = Math.sin(t * 10) * 0.35;
                    d.legPivots.FL.rotation.z = a;
                    d.legPivots.BR.rotation.z = a;
                    d.legPivots.FR.rotation.z = -a;
                    d.legPivots.BL.rotation.z = -a;
                } else {
                    ['FL', 'FR', 'BL', 'BR'].forEach(k => {
                        d.legPivots[k].rotation.z *= 0.9;
                    });
                }
            }
            if (d.tailPivot) {
                d.tailPivot.rotation.z = Math.sin(t * 6) * 0.35;
                d.tailPivot.rotation.x = -0.2 + Math.sin(t * 3) * 0.1;
            }
            // Sit on terrain (MC wolf leg height = 8*0.125 = 1.0)
            nd.position.y = (World.getTerrainY ? World.getTerrainY(nd.position.x, nd.position.z) : 0) + 1.0;
        });

        // === Dragon AI ===
        this.dragons.forEach(dr => {
            const d = dr.userData;
            if (Dog.ridingDragon === dr) {
                // Being ridden — controlled by controls.js
                // Wing flap fast
                if (d.wingPivots) {
                    d.wingPivots.L.rotation.x = Math.sin(t * 8) * 0.4;
                    d.wingPivots.R.rotation.x = -Math.sin(t * 8) * 0.4;
                }
                return;
            }

            if (d.tamed) {
                // Follow dog on ground
                const followDist = 4;
                const behindX = Dog.group.position.x - Math.sin(Dog.yaw) * followDist;
                const behindZ = Dog.group.position.z - Math.cos(Dog.yaw) * followDist;
                const dx = behindX - dr.position.x;
                const dz = behindZ - dr.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                // Descend to ground
                if (dr.position.y > d.groundY + 0.1) {
                    dr.position.y -= 3 * dt;
                    if (dr.position.y < d.groundY) dr.position.y = d.groundY;
                }

                d.isWalking = dist > 2;
                if (d.isWalking) {
                    const speed = Math.min(dist * 1.5, 6);
                    dr.position.x += (dx / dist) * speed * dt;
                    dr.position.z += (dz / dist) * speed * dt;
                    dr.rotation.y = Math.atan2(dx, dz);
                }

                // Slow wing flap on ground
                if (d.wingPivots) {
                    d.wingPivots.L.rotation.x = Math.sin(t * 2) * 0.15;
                    d.wingPivots.R.rotation.x = -Math.sin(t * 2) * 0.15;
                }
            } else {
                // Fly in circles
                d.circleAngle += dt * 0.5;
                const radius = 15;
                const flyHeight = 6 + Math.sin(t * 0.3) * 3;
                dr.position.x = d.homeX + Math.cos(d.circleAngle) * radius;
                dr.position.z = d.homeZ + Math.sin(d.circleAngle) * radius;
                dr.position.y = flyHeight;
                dr.rotation.y = d.circleAngle + Math.PI / 2;
                // Banking tilt in turns
                dr.rotation.z = Math.sin(d.circleAngle) * 0.15;

                // Slow wing flap
                if (d.wingPivots) {
                    d.wingPivots.L.rotation.x = Math.sin(t * 3) * 0.3;
                    d.wingPivots.R.rotation.x = -Math.sin(t * 3) * 0.3;
                }
            }

            // Leg animation
            if (d.legPivots) {
                if (d.isWalking && dr.position.y < 3) {
                    const a = Math.sin(t * 6) * 0.3;
                    d.legPivots.FL.rotation.z = a;
                    d.legPivots.BR.rotation.z = a;
                    d.legPivots.FR.rotation.z = -a;
                    d.legPivots.BL.rotation.z = -a;
                } else {
                    ['FL', 'FR', 'BL', 'BR'].forEach(k => {
                        d.legPivots[k].rotation.z *= 0.9;
                    });
                }
            }
        });

        // === Hamsters AI ===
        const tamedHamCount = this.hamsters.filter(h => h.userData.tamed).length;
        this.hamsters.forEach((h, hIdx) => {
            const d = h.userData;
            if (d.tamed) {
                // Follow dog in circle formation
                const angleOffset = tamedHamCount > 1
                    ? d.tamedIndex * (Math.PI * 2 / tamedHamCount)
                    : 0;
                const followDist = 2.0;
                const behindX = Dog.group.position.x + Math.cos(Dog.yaw + angleOffset) * followDist;
                const behindZ = Dog.group.position.z + Math.sin(Dog.yaw + angleOffset) * followDist;
                const dx = behindX - h.position.x;
                const dz = behindZ - h.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                d.isWalking = dist > 0.5;
                if (d.isWalking) {
                    const speed = Math.min(dist * 3, 8);
                    h.position.x += (dx / dist) * speed * dt;
                    h.position.z += (dz / dist) * speed * dt;
                    h.rotation.y = Math.atan2(dx, dz);
                }

                // Flying with dog
                if (!Dog.onGround) {
                    h.position.y = Dog.group.position.y - 0.5 + Math.sin(t * 3 + hIdx) * 0.3;
                    if (d.wingPivots) {
                        d.wingPivots.L.rotation.x = Math.sin(t * 12) * 0.5;
                        d.wingPivots.R.rotation.x = -Math.sin(t * 12) * 0.5;
                    }
                } else {
                    h.position.y = 0.35;
                    if (d.wingPivots) {
                        d.wingPivots.L.rotation.x *= 0.9;
                        d.wingPivots.R.rotation.x *= 0.9;
                    }
                }
            } else {
                // Wander near home
                d.aiTimer -= dt;
                if (d.aiTimer <= 0) {
                    d.aiTimer = 1.5 + Math.random() * 2;
                    d.aiDir = Math.random() * Math.PI * 2;
                    d.aiMoving = Math.random() > 0.3;
                }
                d.isWalking = d.aiMoving;
                if (d.aiMoving) {
                    const mx = Math.sin(d.aiDir) * d.aiSpeed * dt;
                    const mz = Math.cos(d.aiDir) * d.aiSpeed * dt;
                    h.position.x += mx;
                    h.position.z += mz;
                    h.rotation.y = Math.atan2(mx, mz);
                    const hDist = Math.sqrt(
                        (h.position.x - d.homeX) ** 2 + (h.position.z - d.homeZ) ** 2
                    );
                    if (hDist > 8) {
                        d.aiDir = Math.atan2(d.homeX - h.position.x, d.homeZ - h.position.z);
                    }
                }
                h.position.y = 0.35;
            }
            // Leg animation (hamsters scurry faster)
            if (d.legPivots) {
                if (d.isWalking) {
                    const a = Math.sin(t * 16) * 0.3;
                    d.legPivots.FL.rotation.z = a;
                    d.legPivots.BR.rotation.z = a;
                    d.legPivots.FR.rotation.z = -a;
                    d.legPivots.BL.rotation.z = -a;
                } else {
                    ['FL', 'FR', 'BL', 'BR'].forEach(k => {
                        d.legPivots[k].rotation.z *= 0.9;
                    });
                }
            }
        });

        // === Kittens — follow mom cat ===
        if (this.cats.length > 0) {
            const mom = this.cats[0];
            this.kittens.forEach((k, i) => {
                const d = k.userData;
                const phase = d.phase + t * 0.5;
                const followDist = 1.5 + (i % 2) * 0.5;
                const angleOff = (i / this.kittens.length) * Math.PI * 2 + phase * 0.3;

                let targetX, targetZ;
                if (mom.userData.isWalking) {
                    // Follow behind mom
                    targetX = mom.position.x - Math.sin(mom.rotation.y) * followDist + Math.cos(angleOff) * 0.5;
                    targetZ = mom.position.z - Math.cos(mom.rotation.y) * followDist + Math.sin(angleOff) * 0.5;
                } else {
                    // Play around mom
                    targetX = mom.position.x + Math.cos(phase * 1.2 + i * 1.5) * followDist;
                    targetZ = mom.position.z + Math.sin(phase * 1.2 + i * 1.5) * followDist;
                }

                const dx = targetX - k.position.x;
                const dz = targetZ - k.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                d.isWalking = dist > 0.3;
                if (d.isWalking) {
                    const speed = Math.min(dist * 3, 5);
                    k.position.x += (dx / dist) * speed * dt;
                    k.position.z += (dz / dist) * speed * dt;
                    k.rotation.y = Math.atan2(dx, dz);
                }

                if (d.legPivots) {
                    if (d.isWalking) {
                        const a = Math.sin(t * 12) * 0.3;
                        d.legPivots.FL.rotation.z = a;
                        d.legPivots.BR.rotation.z = a;
                        d.legPivots.FR.rotation.z = -a;
                        d.legPivots.BL.rotation.z = -a;
                    } else {
                        ['FL', 'FR', 'BL', 'BR'].forEach(key => {
                            d.legPivots[key].rotation.z *= 0.9;
                        });
                    }
                }
                k.position.y = 0.36;
            });
        }

        // === Stable Unicorns AI ===
        this.stableUnicorns.forEach(u => {
            const d = u.userData;
            d.stableTimer -= dt;

            if (d.stableTimer <= 0) {
                if (d.stableState === 'eating') {
                    d.stableState = 'resting';
                    d.stableTimer = 12 + Math.random() * 6;
                } else if (d.stableState === 'resting') {
                    d.stableState = 'walking';
                    d.stableTimer = 15 + Math.random() * 10;
                    d.aiDir = Math.random() * Math.PI * 2;
                } else if (d.stableState === 'walking') {
                    d.stableState = 'returning';
                    d.stableTimer = 30; // safety timeout
                } else if (d.stableState === 'returning') {
                    d.stableState = 'eating';
                    d.stableTimer = 10 + Math.random() * 5;
                }
            }

            if (d.stableState === 'eating') {
                d.isWalking = false;
                u.position.y = 1.5;
                // Head nod (eating animation)
                u.rotation.z = Math.sin(t * 3) * 0.05;
                if (d.legPivots) {
                    ['FL', 'FR', 'BL', 'BR'].forEach(k => { d.legPivots[k].rotation.z *= 0.9; });
                }
            } else if (d.stableState === 'resting') {
                d.isWalking = false;
                // Lying down
                u.position.y = 0.8;
                u.rotation.z = 0;
                if (d.legPivots) {
                    d.legPivots.FL.rotation.z = 1.2;
                    d.legPivots.FR.rotation.z = 1.2;
                    d.legPivots.BL.rotation.z = -1.2;
                    d.legPivots.BR.rotation.z = -1.2;
                }
            } else if (d.stableState === 'walking') {
                u.position.y = 1.5;
                u.rotation.z = 0;
                d.isWalking = true;
                const mx = Math.sin(d.aiDir) * d.aiSpeed * dt;
                const mz = Math.cos(d.aiDir) * d.aiSpeed * dt;
                u.position.x += mx;
                u.position.z += mz;
                u.rotation.y = Math.atan2(mx, mz);
                // Stay within radius 15 of home
                const hDist = Math.sqrt((u.position.x - d.homeX) ** 2 + (u.position.z - d.homeZ) ** 2);
                if (hDist > 15) {
                    d.aiDir = Math.atan2(d.homeX - u.position.x, d.homeZ - u.position.z);
                }
                // Occasional direction change
                if (Math.random() < dt * 0.3) d.aiDir += (Math.random() - 0.5) * 1.5;
                if (d.legPivots) {
                    const a = Math.sin(t * 8) * 0.4;
                    d.legPivots.FL.rotation.z = a;
                    d.legPivots.BR.rotation.z = a;
                    d.legPivots.FR.rotation.z = -a;
                    d.legPivots.BL.rotation.z = -a;
                }
            } else if (d.stableState === 'returning') {
                u.position.y = 1.5;
                u.rotation.z = 0;
                const dx = d.homeX - u.position.x;
                const dz = d.homeZ - u.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist < 2) {
                    d.stableState = 'eating';
                    d.stableTimer = 10 + Math.random() * 5;
                    d.isWalking = false;
                } else {
                    d.isWalking = true;
                    u.position.x += (dx / dist) * d.aiSpeed * dt;
                    u.position.z += (dz / dist) * d.aiSpeed * dt;
                    u.rotation.y = Math.atan2(dx, dz);
                }
                if (d.legPivots) {
                    if (d.isWalking) {
                        const a = Math.sin(t * 8) * 0.4;
                        d.legPivots.FL.rotation.z = a;
                        d.legPivots.BR.rotation.z = a;
                        d.legPivots.FR.rotation.z = -a;
                        d.legPivots.BL.rotation.z = -a;
                    } else {
                        ['FL', 'FR', 'BL', 'BR'].forEach(k => { d.legPivots[k].rotation.z *= 0.9; });
                    }
                }
            }
        });

        // === Hints ===
        let hint = '';
        this.unicorns.forEach(u => {
            if (!u.userData.tamed && Dog.group.position.distanceTo(u.position) < 5) {
                hint = 'Нажми E чтобы приручить единорожка!';
            }
        });
        this.butterflies.forEach(b => {
            if (!b.userData.tamed && Dog.group.position.distanceTo(b.position) < 4) {
                hint = 'Нажми E чтобы приручить бабочку!';
            }
        });
        this.cats.forEach(c => {
            if (!c.userData.tamed && Dog.group.position.distanceTo(c.position) < 4) {
                hint = 'Нажми E чтобы приручить котика!';
            }
        });
        this.pigs.forEach(p => {
            if (!p.userData.tamed && Dog.group.position.distanceTo(p.position) < 4) {
                hint = 'Нажми E чтобы приручить свинку!';
            }
        });
        this.npcDogs.forEach(nd => {
            if (!nd.userData.tamed && Dog.group.position.distanceTo(nd.position) < 4) {
                hint = 'Нажми E чтобы приручить пёсика!';
            }
        });
        this.dragons.forEach(dr => {
            if (!dr.userData.tamed && Dog.group.position.distanceTo(dr.position) < 6) {
                hint = 'Нажми E чтобы приручить дракона!';
            }
            if (dr.userData.tamed && !Dog.ridingDragon && Dog.group.position.distanceTo(dr.position) < 4) {
                hint = 'Нажми R чтобы сесть на дракона!';
            }
        });
        this.hamsters.forEach(h => {
            if (!h.userData.tamed && Dog.group.position.distanceTo(h.position) < 3) {
                hint = 'Нажми E чтобы приручить ' + h.userData.name + '!';
            }
        });
        const el = document.getElementById('hint');
        el.textContent = hint;
        el.style.display = hint ? 'block' : 'none';
    }
};

NPCs.init();
NPCs.initFarmAnimals();
