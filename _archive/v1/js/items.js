// ============================================================
// items.js — Косточки и строительство блоков
// ============================================================

const Items = {
    bones: [],
    placedBlocks: [],
    bonesCollected: 0,
    blockColors: [0xff69b4, 0xffd700, 0x87ceeb, 0xffffff, 0xc48a5c],

    raycaster: new THREE.Raycaster(),
    pointerCenter: new THREE.Vector2(0, 0),

    init() {
        this._createBones();
    },

    _createBones() {
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        for (let i = 0; i < 12; i++) {
            let x, z;
            do {
                x = (Math.random() - 0.5) * GAME.WORLD_SIZE * 1.5;
                z = (Math.random() - 0.5) * GAME.WORLD_SIZE * 1.5;
            } while (Math.abs(x - 10) < 6 && Math.abs(z - 10) < 6);

            const g = new THREE.Group();
            const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.15), mat);
            g.add(shaft);
            const end1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.35, 0.15), mat);
            end1.position.x = 0.4;
            g.add(end1);
            const end2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.35, 0.15), mat);
            end2.position.x = -0.4;
            g.add(end2);

            g.position.set(x, 0.5, z);
            g.userData.collected = false;
            GAME.scene.add(g);
            this.bones.push(g);
        }
    },

    placeBlock() {
        this.raycaster.setFromCamera(this.pointerCenter, GAME.camera);
        const targets = [GAME.ground, ...this.placedBlocks.map(b => b.mesh)];
        const hits = this.raycaster.intersectObjects(targets);
        if (hits.length > 0 && hits[0].distance < 8) {
            const hit = hits[0];
            const pos = hit.point.clone().add(hit.face.normal.clone().multiplyScalar(0.5));
            pos.x = Math.round(pos.x * 2) / 2;
            pos.y = Math.max(0.5, Math.round(pos.y * 2) / 2);
            pos.z = Math.round(pos.z * 2) / 2;

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
        this.raycaster.setFromCamera(this.pointerCenter, GAME.camera);
        const hits = this.raycaster.intersectObjects(this.placedBlocks.map(b => b.mesh));
        if (hits.length > 0 && hits[0].distance < 8) {
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
            bone.position.y = 0.5 + Math.sin(t * 3 + bone.position.x) * 0.15;

            if (Dog.group.position.distanceTo(bone.position) < 2) {
                bone.userData.collected = true;
                GAME.scene.remove(bone);
                this.bonesCollected++;
                document.getElementById('boneCount').textContent = this.bonesCollected;
                Effects.spawnParticles(bone.position.x, bone.position.y, bone.position.z, 0xffd700);
                Sounds.pickup();
            }
        });
    }
};

Items.init();
