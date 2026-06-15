// ============================================================
// save.js — Сохранение / загрузка прогресса (localStorage)
// KEY: 'super_tyopa_v3', version: 3
// ============================================================

const Save = {
    KEY: 'super_tyopa_v3',
    autoSaveInterval: 10,
    _timer: 0,

    save() {
        const data = {
            version: 3,
            dog: {
                x: Dog.group.position.x,
                y: Dog.group.position.y,
                z: Dog.group.position.z,
                yaw: Dog.yaw
            },
            bones: {
                collected: Items.bonesCollected,
                collectedIndices: Items.bones
                    .map((b, i) => b.userData.collected ? i : -1)
                    .filter(i => i >= 0)
            },
            tamed: NPCs.unicorns
                .map((u, i) => u.userData.tamed ? i : -1)
                .filter(i => i >= 0),
            blocks: Items.placedBlocks.map(b => ({
                x: b.mesh.position.x,
                y: b.mesh.position.y,
                z: b.mesh.position.z,
                color: b.mesh.material.color.getHex()
            }))
        };

        try {
            localStorage.setItem(this.KEY, JSON.stringify(data));
        } catch (e) {
            // localStorage unavailable
        }
    },

    load() {
        try {
            const raw = localStorage.getItem(this.KEY);
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (!data || data.version !== 3) return false;

            if (data.dog) {
                const safeY = Math.max(1.6, data.dog.y);
                Dog.group.position.set(data.dog.x, safeY, data.dog.z);
                Dog.yaw = data.dog.yaw || 0;
            }

            if (data.bones) {
                Items.bonesCollected = data.bones.collected || 0;
                document.getElementById('boneCount').textContent = Items.bonesCollected;
                (data.bones.collectedIndices || []).forEach(idx => {
                    if (Items.bones[idx]) {
                        Items.bones[idx].userData.collected = true;
                        GAME.scene.remove(Items.bones[idx]);
                    }
                });
            }

            if (data.tamed) {
                data.tamed.forEach((idx, order) => {
                    if (NPCs.unicorns[idx]) {
                        NPCs.unicorns[idx].userData.tamed = true;
                        NPCs.unicorns[idx].userData.tamedIndex = order;
                    }
                });
                NPCs.tamedCount = data.tamed.length;
                document.getElementById('tamedCount').textContent = NPCs.tamedCount;
            }

            if (data.blocks) {
                data.blocks.forEach(bd => {
                    const mesh = new THREE.Mesh(
                        new THREE.BoxGeometry(GAME.BLOCK_SIZE, GAME.BLOCK_SIZE, GAME.BLOCK_SIZE),
                        new THREE.MeshStandardMaterial({ color: bd.color })
                    );
                    mesh.position.set(bd.x, bd.y, bd.z);
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    GAME.scene.add(mesh);
                    Items.placedBlocks.push({ mesh });
                });
            }

            return true;
        } catch (e) {
            return false;
        }
    },

    update(dt) {
        if (!GAME.started) return;
        this._timer += dt;
        if (this._timer >= this.autoSaveInterval) {
            this._timer = 0;
            this.save();
        }
    },

    init() {
        window.addEventListener('beforeunload', () => {
            if (GAME.started) this.save();
        });

        const loaded = this.load();
        if (loaded) {
            console.log('Супер Тёпа: прогресс загружен!');
        }
    }
};
