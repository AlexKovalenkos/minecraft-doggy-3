// ============================================================
// save.js — Сохранение / загрузка прогресса (localStorage)
// KEY: 'super_tyopa_v4', version: 4
// ============================================================

const Save = {
    KEY: 'super_tyopa_v4',
    autoSaveInterval: 10,
    _timer: 0,

    save() {
        const data = {
            version: 4,
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
            tamedCount: NPCs.tamedCount,
            blocks: Items.placedBlocks.map(b => ({
                x: b.mesh.position.x,
                y: b.mesh.position.y,
                z: b.mesh.position.z,
                color: b.mesh.material.color.getHex()
            })),
            dragonTamed: NPCs.dragons.length > 0 && NPCs.dragons[0].userData.tamed,
            catTamed: NPCs.cats.length > 0 && NPCs.cats[0].userData.tamed,
            pigsTamed: NPCs.pigs
                .map((p, i) => p.userData.tamed ? i : -1)
                .filter(i => i >= 0),
            npcDogTamed: NPCs.npcDogs.length > 0 && NPCs.npcDogs[0].userData.tamed,
            hamstersTamed: NPCs.hamsters
                .map((h, i) => h.userData.tamed ? i : -1)
                .filter(i => i >= 0)
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
            if (!data || (data.version !== 4 && data.version !== 3)) return false;

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
                        NPCs.unicorns[idx].userData.tamedTimer = 30; // Reset timer on load
                    }
                });
                NPCs.tamedCount = data.tamedCount || data.tamed.length;
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

            // v4 additions
            if (data.version === 4) {
                if (data.dragonTamed && NPCs.dragons[0]) {
                    NPCs.dragons[0].userData.tamed = true;
                    NPCs.tamedDragons = 1;
                }
                if (data.catTamed && NPCs.cats[0]) {
                    NPCs.cats[0].userData.tamed = true;
                    NPCs.tamedCats = 1;
                }
                if (data.pigsTamed) {
                    data.pigsTamed.forEach((idx, order) => {
                        if (NPCs.pigs[idx]) {
                            NPCs.pigs[idx].userData.tamed = true;
                            NPCs.pigs[idx].userData.tamedIndex = order;
                        }
                    });
                    NPCs.tamedPigs = data.pigsTamed.length;
                }
                if (data.npcDogTamed && NPCs.npcDogs[0]) {
                    NPCs.npcDogs[0].userData.tamed = true;
                    NPCs.tamedNpcDogs = 1;
                }
                if (data.hamstersTamed) {
                    data.hamstersTamed.forEach((idx, order) => {
                        if (NPCs.hamsters[idx]) {
                            NPCs.hamsters[idx].userData.tamed = true;
                            NPCs.hamsters[idx].userData.tamedIndex = order;
                        }
                    });
                    NPCs.tamedHamsters = data.hamstersTamed.length;
                }
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
            console.log('Супер Тёпа 2: прогресс загружен!');
        }
    }
};
