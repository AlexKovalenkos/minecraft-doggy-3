// ============================================================
// items.js — Кости + строительство блоков (MC snap-to-grid)
// ============================================================

const Items = {
    bones: [],
    placedBlocks: [],
    bonesCollected: 0,
    _respawnTimers: [],
    _boneMat: null,

    // MC block size = 1.0 unit (grid aligned)
    BLOCK: 1.0,

    // 5 block types matching hotbar slots
    _blockDefs: [
        { name: 'Grass',  color: 0x5c9a2c, emissive: null },
        { name: 'Gold',   color: 0xffd700, emissive: 0x443300 },
        { name: 'Glass',  color: 0x88ccff, transparent: true, opacity: 0.65 },
        { name: 'Snow',   color: 0xf0f5ff, emissive: null },
        { name: 'Plank',  color: 0xc48a5c, emissive: null },
    ],

    _ghostMesh: null,
    raycaster: new THREE.Raycaster(),

    init() {
        this._boneMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

        // Ghost preview block (semi-transparent white outline)
        const ghostMat = new THREE.MeshStandardMaterial({
            color: 0xffffff, transparent: true, opacity: 0.3,
            depthWrite: false
        });
        this._ghostMesh = new THREE.Mesh(
            new THREE.BoxGeometry(this.BLOCK, this.BLOCK, this.BLOCK),
            ghostMat
        );
        this._ghostMesh.visible = false;
        GAME.scene.add(this._ghostMesh);

        for (let i = 0; i < 12; i++) this._spawnBone();
    },

    _makeMat(slot) {
        const def = this._blockDefs[slot] || this._blockDefs[0];
        const mat = new THREE.MeshStandardMaterial({ color: def.color });
        if (def.emissive) { mat.emissive.set(def.emissive); mat.emissiveIntensity = 0.15; }
        if (def.transparent) { mat.transparent = true; mat.opacity = def.opacity || 0.65; }
        return mat;
    },

    _snapToGrid(v) {
        // Snap to 1-unit grid
        return Math.round(v / this.BLOCK) * this.BLOCK;
    },

    _getPlacePos() {
        const B = this.BLOCK;
        const dir = new THREE.Vector3();
        GAME.camera.getWorldDirection(dir);
        const origin = Dog.group.position.clone();
        origin.y += 0.5;
        this.raycaster.set(origin, dir);
        this.raycaster.far = 6; // MC reach = 4-5 blocks

        // Raycast against ground + placed blocks
        const targets = this.placedBlocks.map(b => b.mesh);
        if (GAME.ground) targets.push(GAME.ground);

        const hits = this.raycaster.intersectObjects(targets);
        if (hits.length === 0) return null;

        const hit = hits[0];
        if (hit.distance > 6) return null;

        // Place adjacent to hit face (MC mechanic)
        const pos = hit.point.clone().add(hit.face.normal.clone().multiplyScalar(B * 0.5));
        pos.x = this._snapToGrid(pos.x);
        pos.z = this._snapToGrid(pos.z);
        // Y: snap to block grid, minimum half-block above terrain
        const terrainY = World.getTerrainY ? World.getTerrainY(pos.x, pos.z) : 0;
        pos.y = this._snapToGrid(pos.y - B/2) + B/2;
        pos.y = Math.max(terrainY + B/2, pos.y);

        return pos;
    },

    placeBlock() {
        const pos = this._getPlacePos();
        if (!pos) return;

        const slot = Controls.selectedSlot;
        const mat = this._makeMat(slot);
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(this.BLOCK, this.BLOCK, this.BLOCK), mat
        );
        mesh.position.copy(pos);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        GAME.scene.add(mesh);
        this.placedBlocks.push({ mesh, slot });
        Sounds.place();

        // Small place particles
        Effects.spawnParticles(pos.x, pos.y, pos.z, this._blockDefs[slot].color, 4);
    },

    removeBlock() {
        const B = this.BLOCK;
        const dir = new THREE.Vector3();
        GAME.camera.getWorldDirection(dir);
        const origin = Dog.group.position.clone();
        origin.y += 0.5;
        this.raycaster.set(origin, dir);
        this.raycaster.far = 6;

        const hits = this.raycaster.intersectObjects(this.placedBlocks.map(b => b.mesh));
        if (hits.length > 0) {
            const mesh = hits[0].object;
            Effects.spawnParticles(mesh.position.x, mesh.position.y, mesh.position.z, 0xd4a574, 5);
            GAME.scene.remove(mesh);
            const idx = this.placedBlocks.findIndex(b => b.mesh === mesh);
            if (idx >= 0) this.placedBlocks.splice(idx, 1);
            Sounds.break();
        }
    },

    _spawnBone() {
        let x, z, valid;
        do {
            x = (Math.random() - 0.5) * GAME.WORLD_SIZE * 1.5 * 2;
            z = (Math.random() - 0.5) * GAME.WORLD_SIZE * 1.5 * 2;
            valid = true;
            if (Math.abs(x - 10)  < 10 && Math.abs(z - 10)  < 10) valid = false;
            if (Math.abs(x + 25)  < 8  && Math.abs(z - 20)  < 7)  valid = false;
            if (Math.abs(x - 85)  < 15 && Math.abs(z - 80)  < 12) valid = false;
            if (Math.abs(x - 30)  < 9  && Math.abs(z - 35)  < 7)  valid = false;
            if (Math.abs(x + 60)  < 7  && Math.abs(z + 50)  < 7)  valid = false;
        } while (!valid);

        const g = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 0.2), this._boneMat);
        g.add(shaft);
        [[0.5], [-0.5]].forEach(([xo]) => {
            const end = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 0.2), this._boneMat);
            end.position.x = xo;
            g.add(end);
        });

        const terrainY = World.getTerrainY ? World.getTerrainY(x, z) : 0;
        g.position.set(x, terrainY + 0.8, z);
        g.userData.collected = false;
        GAME.scene.add(g);
        this.bones.push(g);
    },

    update(dt, t) {
        // Update ghost preview block
        if (GAME.started && !GAME.paused) {
            const pos = this._getPlacePos();
            if (pos) {
                this._ghostMesh.visible = true;
                this._ghostMesh.position.copy(pos);
                // Tint ghost by selected block color
                const col = this._blockDefs[Controls.selectedSlot]?.color || 0xffffff;
                this._ghostMesh.material.color.setHex(col);
            } else {
                this._ghostMesh.visible = false;
            }
        }

        // Bones
        this.bones.forEach(bone => {
            if (bone.userData.collected) return;
            bone.rotation.y = t * 2;
            const terrainY = World.getTerrainY ? World.getTerrainY(bone.position.x, bone.position.z) : 0;
            bone.position.y = terrainY + 0.8 + Math.sin(t * 3 + bone.position.x) * 0.2;

            const dx = Dog.group.position.x - bone.position.x;
            const dz = Dog.group.position.z - bone.position.z;
            if (Math.sqrt(dx*dx + dz*dz) < 2.5) {
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
