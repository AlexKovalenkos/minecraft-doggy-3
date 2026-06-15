// ============================================================
// npcs.js — Единорожки и бабочки
// ============================================================

const NPCs = {
    unicorns: [],
    butterflies: [],
    tamedCount: 0,

    init() {
        this._createUnicorn(-12, 8);
        this._createUnicorn(8, -15);
        this._createUnicorn(-5, -8);

        this._createButterfly(-5, 3, 5);
        this._createButterfly(12, 4, -8);
        this._createButterfly(-15, 2.5, -5);
    },

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

        // Nostrils
        const nostrilMat = new THREE.MeshStandardMaterial({ color: 0xf0a0b0 });
        [0.12, -0.12].forEach(zz => {
            const n = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.08), nostrilMat);
            n.position.set(1.86, 0.15, zz);
            g.add(n);
        });

        // Eyes
        [0.25, -0.25].forEach(zz => {
            const eye = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.25, 0.08), eyeMat);
            eye.position.set(1.71, 0.45, zz);
            g.add(eye);
            const hl = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.08, 0.04),
                new THREE.MeshStandardMaterial({ color: 0xffffff })
            );
            hl.position.set(1.73, 0.52, zz + 0.06 * Math.sign(zz));
            g.add(hl);
        });

        // Eyelashes
        [0.25, -0.25].forEach(zz => {
            const lash = new THREE.Mesh(
                new THREE.BoxGeometry(0.12, 0.04, 0.04),
                eyeMat
            );
            lash.position.set(1.71, 0.6, zz);
            g.add(lash);
        });

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
        // Side strand
        for (let i = 0; i < 3; i++) {
            const strand = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, 0.3, 0.1),
                new THREE.MeshStandardMaterial({ color: maneColors[(i + 2) % maneColors.length] })
            );
            strand.position.set(1.0 - i * 0.25, 0.55, 0.5);
            g.add(strand);
        }

        // Legs with hooves
        [0.65, -0.65].forEach(lx => {
            [0.3, -0.3].forEach(lz => {
                const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.8, 0.25), white);
                leg.position.set(lx, -0.9, lz);
                leg.castShadow = true;
                g.add(leg);
                const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.15, 0.28), hoofMat);
                hoof.position.set(lx, -1.3, lz);
                g.add(hoof);
            });
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

        g.position.set(x, 1.5, z);
        g.userData = {
            tamed: false,
            tamedIndex: -1,
            aiTimer: 0,
            aiDir: Math.random() * Math.PI * 2,
            aiSpeed: 1.5 + Math.random(),
            aiMoving: true
        };

        GAME.scene.add(g);
        this.unicorns.push(g);
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
            wL, wR
        };

        GAME.scene.add(g);
        this.butterflies.push(g);
    },

    tryTame() {
        this.unicorns.forEach(u => {
            if (u.userData.tamed) return;
            if (Dog.group.position.distanceTo(u.position) < 4) {
                u.userData.tamed = true;
                u.userData.tamedIndex = this.tamedCount;
                this.tamedCount++;
                document.getElementById('tamedCount').textContent = this.tamedCount;
                Effects.spawnHearts(u.position.x, u.position.y + 1, u.position.z);
                Sounds.tame();
                Effects.showMessage('Единорожек приручён! (' + this.tamedCount + '/3)');
            }
        });
    },

    update(dt, t) {
        const bound = GAME.WORLD_SIZE - 2;

        // Unicorn AI
        this.unicorns.forEach(u => {
            const d = u.userData;
            if (d.tamed) {
                const followDist = 3.5 + d.tamedIndex * 2.5;
                const angleOffset = d.tamedIndex * 1.2;

                const behindX = Dog.group.position.x - Math.sin(Dog.yaw + angleOffset) * followDist;
                const behindZ = Dog.group.position.z - Math.cos(Dog.yaw + angleOffset) * followDist;

                const dx = behindX - u.position.x;
                const dz = behindZ - u.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (dist > 1) {
                    const speed = Math.min(dist * 2, 5);
                    u.position.x += (dx / dist) * speed * dt;
                    u.position.z += (dz / dist) * speed * dt;
                    u.rotation.y = Math.atan2(dx, dz);
                }
            } else {
                // Wander
                d.aiTimer -= dt;
                if (d.aiTimer <= 0) {
                    d.aiTimer = 2 + Math.random() * 3;
                    d.aiDir = Math.random() * Math.PI * 2;
                    d.aiMoving = Math.random() > 0.3;
                }
                if (d.aiMoving) {
                    const mx = Math.sin(d.aiDir) * d.aiSpeed * dt;
                    const mz = Math.cos(d.aiDir) * d.aiSpeed * dt;
                    u.position.x += mx;
                    u.position.z += mz;
                    u.rotation.y = Math.atan2(mx, mz);
                    if (Math.abs(u.position.x) > bound) d.aiDir += Math.PI;
                    if (Math.abs(u.position.z) > bound) d.aiDir += Math.PI;
                    u.position.x = Math.max(-bound, Math.min(bound, u.position.x));
                    u.position.z = Math.max(-bound, Math.min(bound, u.position.z));
                }
            }
            u.position.y = 1.5;
        });

        // Butterflies
        this.butterflies.forEach(b => {
            const d = b.userData;
            const bt = t + d.phase;
            b.position.x = d.centerX + Math.sin(bt * 0.7) * d.radius;
            b.position.z = d.centerZ + Math.cos(bt * 0.5) * d.radius;
            b.position.y = d.baseY + Math.sin(bt * 1.5) * 0.8;
            b.rotation.y = bt * 0.7;
            d.wL.rotation.x = Math.sin(bt * 12) * 0.5;
            d.wR.rotation.x = -Math.sin(bt * 12) * 0.5;
        });

        // Hint
        let hint = '';
        this.unicorns.forEach(u => {
            if (!u.userData.tamed && Dog.group.position.distanceTo(u.position) < 5) {
                hint = 'Нажми E чтобы приручить единорожка!';
            }
        });
        const el = document.getElementById('hint');
        el.textContent = hint;
        el.style.display = hint ? 'block' : 'none';
    }
};

NPCs.init();
