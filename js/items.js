// ============================================================
// items.js — Косточки и строительство блоков
// ============================================================

const Items = {
    bones: [],
    placedBlocks: [],
    bonesCollected: 0,
    blockColors: [0xff69b4, 0xffd700, 0x87ceeb, 0xffffff, 0xc48a5c],
    _respawnTimers: [],
    _boneMat: null,

    raycaster: new THREE.Raycaster(),
    pointerCenter: new THREE.Vector2(0, 0),

    init() {
        this._boneMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        for (let i = 0; i < 12; i++) this._spawnBone();
    },

    _spawnBone() {
        let x, z, valid;
        do {
            x = (Math.random() - 0.5) * GAME.WORLD_SIZE * 1.5 * 2;
            z = (Math.random() - 0.5) * GAME.WORLD_SIZE * 1.5 * 2;
            valid = true;
            // Exclude lake area
            if (Math.abs(x - 10) < 10 && Math.abs(z - 10) < 10) valid = false;
            // Exclude house area
            if (Math.abs(x - (-25)) < 8 && Math.abs(z - 20) < 7) valid = false;
            // Exclude mountain zones
            if (Math.abs(x - 38) < 10 && Math.abs(z - 35) < 10) valid = false;
            if (Math.abs(x - (-37)) < 10 && Math.abs(z - (-38)) < 10) valid = false;
            if (Math.abs(x - 40) < 9 && Math.abs(z - (-30)) < 9) valid = false;
            if (Math.abs(x - (-35)) < 9 && Math.abs(z - 32) < 9) valid = false;
            // Exclude castle
            if (Math.abs(x - 85) < 15 && Math.abs(z - 80) < 12) valid = false;
            // Exclude stable
            if (Math.abs(x - 30) < 9 && Math.abs(z - 35) < 7) valid = false;
            // Exclude cat house
            if (Math.abs(x - (-20)) < 4 && Math.abs(z - 25) < 4) valid = false;
            // Exclude hamster house
            if (Math.abs(x - (-70)) < 5 && Math.abs(z - (-65)) < 5) valid = false;
            // Exclude second pond
            if (Math.abs(x - (-60)) < 7 && Math.abs(z - (-50)) < 7) valid = false;
        } while (!valid);

        const g = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 0.2), this._boneMat);
        g.add(shaft);
        const end1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 0.2), this._boneMat);
        end1.position.x = 0.5;
        g.add(end1);
        const end2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 0.2), this._boneMat);
        end2.position.x = -0.5;
        g.add(end2);

        g.position.set(x, 0.8, z);
        g.userData.collected = false;
        GAME.scene.add(g);
        this.bones.push(g);
    },

    placeBlock() {
        const dir = new THREE.Vector3();
        GAME.camera.getWorldDirection(dir);
        const origin = Dog.group.position.clone();
        origin.y += 0.5;
        this.raycaster.set(origin, dir);
        const targets = [GAME.ground, ...this.placedBlocks.map(b => b.mesh)];
        const hits = this.raycaster.intersectObjects(targets);
        if (hits.length > 0 && hits[0].distance < 10) {
            const hit = hits[0];
            const BS = GAME.BLOCK_SIZE;
            const pos = hit.point.clone().add(hit.face.normal.clone().multiplyScalar(BS / 2));
            pos.x = Math.round(pos.x / BS) * BS;
            pos.y = Math.round((pos.y - BS / 2) / BS) * BS + BS / 2;
            pos.y = Math.max(BS / 2, pos.y);
            pos.z = Math.round(pos.z / BS) * BS;

            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(GAME.BLOCK_SIZE, GAME.BLOCK_SIZE, GAME.BLOCK_SIZE),
                new THREE.MeshStandardMaterial({ color: this.blockColors[Controls.selectedSlot] })
            );
            mesh.position.copy(pos);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            GAME.scene.add(mesh);
            this.placedBlocks.push({ mesh });
            Sounds.place();
        }
    },

    removeBlock() {
        const dir = new THREE.Vector3();
        GAME.camera.getWorldDirection(dir);
        const origin = Dog.group.position.clone();
        origin.y += 0.5;
        this.raycaster.set(origin, dir);
        const hits = this.raycaster.intersectObjects(this.placedBlocks.map(b => b.mesh));
        if (hits.length > 0 && hits[0].distance < 10) {
            const mesh = hits[0].object;
            GAME.scene.remove(mesh);
            const idx = this.placedBlocks.findIndex(b => b.mesh === mesh);
            if (idx >= 0) this.placedBlocks.splice(idx, 1);
            Sounds.break();
        }
    },

    update(dt, t) {
        this.bones.forEach(bone => {
            if (bone.userData.collected) return;
            bone.rotation.y = t * 2;
            bone.position.y = 0.8 + Math.sin(t * 3 + bone.position.x) * 0.2;

            const dx = Dog.group.position.x - bone.position.x;
            const dz = Dog.group.position.z - bone.position.z;
            if (Math.sqrt(dx * dx + dz * dz) < 2.5) {
                bone.userData.collected = true;
                GAME.scene.remove(bone);
                this.bonesCollected++;
                document.getElementById('boneCount').textContent = this.bonesCollected;
                Effects.spawnParticles(bone.position.x, bone.position.y, bone.position.z, 0xffd700);
                Sounds.pickup();
                NPCs.spawnUnicorn();
                this._respawnTimers.push(5.0);
            }
        });

        for (let i = this._respawnTimers.length - 1; i >= 0; i--) {
            this._respawnTimers[i] -= dt;
            if (this._respawnTimers[i] <= 0) {
                this._respawnTimers.splice(i, 1);
                this._spawnBone();
            }
        }
    }
};

Items.init();
