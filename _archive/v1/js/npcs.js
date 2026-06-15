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
        const white = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const hornMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x4a0080 });

        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 1), white);
        body.castShadow = true;
        g.add(body);

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.8), white);
        head.position.set(1.2, 0.3, 0);
        head.castShadow = true;
        g.add(head);

        // Eyes
        [0.25, -0.25].forEach(zz => {
            const eye = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.08), eyeMat);
            eye.position.set(1.55, 0.4, zz);
            g.add(eye);
        });

        // Horn
        const horn = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.8, 0.15), hornMat);
        horn.position.set(1.2, 1.1, 0);
        g.add(horn);

        // Mane
        [0xff69b4, 0xffd700, 0x87ceeb, 0xc8a2c8].forEach((col, i) => {
            const mane = new THREE.Mesh(
                new THREE.BoxGeometry(0.3, 0.4, 0.3),
                new THREE.MeshStandardMaterial({ color: col })
            );
            mane.position.set(0.8 - i * 0.35, 0.85, 0);
            g.add(mane);
        });

        // Legs
        [0.6, -0.6].forEach(lx => {
            [0.25, -0.25].forEach(lz => {
                const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.8, 0.25), white);
                leg.position.set(lx, -0.9, lz);
                leg.castShadow = true;
                g.add(leg);
            });
        });

        // Tail
        const tail = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.6, 0.15),
            new THREE.MeshStandardMaterial({ color: 0xff69b4 })
        );
        tail.position.set(-1.1, 0.2, 0);
        g.add(tail);

        g.position.set(x, 1.2, z);
        g.userData = {
            tamed: false,
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
                this.tamedCount++;
                document.getElementById('tamedCount').textContent = this.tamedCount;
                Effects.spawnHearts(u.position.x, u.position.y + 1, u.position.z);
                Sounds.tame();
                Effects.showMessage('Единорожек приручён!');
            }
        });
    },

    update(dt, t) {
        const bound = GAME.WORLD_SIZE - 2;

        // Unicorn AI
        this.unicorns.forEach(u => {
            const d = u.userData;
            if (d.tamed) {
                const dir = new THREE.Vector3().subVectors(Dog.group.position, u.position);
                dir.y = 0;
                if (dir.length() > 3) {
                    dir.normalize();
                    u.position.x += dir.x * 3 * dt;
                    u.position.z += dir.z * 3 * dt;
                    u.rotation.y = Math.atan2(dir.x, dir.z);
                }
            } else {
                d.aiTimer -= dt;
                if (d.aiTimer <= 0) {
                    d.aiTimer = 2 + Math.random() * 3;
                    d.aiDir = Math.random() * Math.PI * 2;
                    d.aiMoving = Math.random() > 0.3;
                }
                if (d.aiMoving) {
                    const dx = Math.sin(d.aiDir) * d.aiSpeed * dt;
                    const dz = Math.cos(d.aiDir) * d.aiSpeed * dt;
                    u.position.x += dx;
                    u.position.z += dz;
                    u.rotation.y = Math.atan2(dx, dz);
                    if (Math.abs(u.position.x) > bound) d.aiDir += Math.PI;
                    if (Math.abs(u.position.z) > bound) d.aiDir += Math.PI;
                    u.position.x = Math.max(-bound, Math.min(bound, u.position.x));
                    u.position.z = Math.max(-bound, Math.min(bound, u.position.z));
                }
            }
            u.position.y = 1.2;
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
