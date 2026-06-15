// ============================================================
// world.js — Деревья, цветы, озеро, камни, облака
// ============================================================

const World = {
    clouds: [],

    init() {
        this._createTrees();
        this._createFlowers();
        this._createLake();
        this._createRocks();
        this._createClouds();
    },

    _createTrees() {
        const positions = [
            [-15, -12], [18, 8], [-8, 20], [12, -18],
            [-20, 5], [5, -22], [22, 22], [-18, -22]
        ];
        const foliageColors = [0xff69b4, 0xffd700, 0xff85a2, 0xffe066];

        positions.forEach(([x, z]) => {
            const g = new THREE.Group();
            const trunkH = 3 + Math.random() * 2;

            const trunk = new THREE.Mesh(
                new THREE.BoxGeometry(0.8, trunkH, 0.8),
                new THREE.MeshStandardMaterial({ color: 0xc48a5c })
            );
            trunk.position.y = trunkH / 2;
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            g.add(trunk);

            const count = 5 + Math.floor(Math.random() * 4);
            for (let i = 0; i < count; i++) {
                const s = 1.2 + Math.random() * 1.2;
                const leaf = new THREE.Mesh(
                    new THREE.BoxGeometry(s, s, s),
                    new THREE.MeshStandardMaterial({ color: foliageColors[Math.floor(Math.random() * foliageColors.length)] })
                );
                leaf.position.set(
                    (Math.random() - 0.5) * 2,
                    trunkH + (Math.random() - 0.3) * 2,
                    (Math.random() - 0.5) * 2
                );
                leaf.castShadow = true;
                g.add(leaf);
            }

            g.position.set(x, 0, z);
            GAME.scene.add(g);
        });
    },

    _createFlowers() {
        const colors = [0xff69b4, 0xffd700, 0xff85a2, 0xffe066, 0xffb6c1];
        for (let i = 0; i < 30; i++) {
            const x = (Math.random() - 0.5) * GAME.WORLD_SIZE * 1.6;
            const z = (Math.random() - 0.5) * GAME.WORLD_SIZE * 1.6;
            if (Math.abs(x - 10) < 6 && Math.abs(z - 10) < 6) continue;

            const g = new THREE.Group();
            const stem = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.4, 0.08),
                new THREE.MeshStandardMaterial({ color: 0x7dba5c })
            );
            stem.position.y = 0.2;
            g.add(stem);

            const petal = new THREE.Mesh(
                new THREE.BoxGeometry(0.3, 0.3, 0.3),
                new THREE.MeshStandardMaterial({ color: colors[Math.floor(Math.random() * colors.length)] })
            );
            petal.position.y = 0.5;
            g.add(petal);

            g.position.set(x, 0, z);
            GAME.scene.add(g);
        }
    },

    _createLake() {
        const lake = new THREE.Mesh(
            new THREE.BoxGeometry(10, 0.3, 10),
            new THREE.MeshStandardMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.6, roughness: 0.1, metalness: 0.1 })
        );
        lake.position.set(10, 0.05, 10);
        lake.receiveShadow = true;
        GAME.scene.add(lake);

        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const r = 5.5 + Math.random();
            const rock = new THREE.Mesh(
                new THREE.BoxGeometry(0.5 + Math.random() * 0.5, 0.3 + Math.random() * 0.3, 0.5 + Math.random() * 0.5),
                new THREE.MeshStandardMaterial({ color: 0xd4a574 })
            );
            rock.position.set(10 + Math.cos(angle) * r, 0.15, 10 + Math.sin(angle) * r);
            rock.castShadow = true;
            GAME.scene.add(rock);
        }
    },

    _createRocks() {
        [[-10, -15], [20, -10], [-5, 15], [15, -5]].forEach(([x, z]) => {
            const s = 0.8 + Math.random() * 1.2;
            const rock = new THREE.Mesh(
                new THREE.BoxGeometry(s, s * 0.6, s),
                new THREE.MeshStandardMaterial({ color: 0xd4a574 })
            );
            rock.position.set(x, s * 0.3, z);
            rock.castShadow = true;
            GAME.scene.add(rock);
        });
    },

    _createClouds() {
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
        for (let i = 0; i < 6; i++) {
            const g = new THREE.Group();
            const count = 3 + Math.floor(Math.random() * 3);
            for (let j = 0; j < count; j++) {
                const part = new THREE.Mesh(
                    new THREE.BoxGeometry(2 + Math.random() * 3, 1 + Math.random(), 2 + Math.random() * 2),
                    mat
                );
                part.position.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 2);
                g.add(part);
            }
            g.position.set(
                (Math.random() - 0.5) * 120,
                25 + Math.random() * 15,
                (Math.random() - 0.5) * 120
            );
            g.userData.speed = 0.3 + Math.random() * 0.5;
            GAME.scene.add(g);
            this.clouds.push(g);
        }
    },

    update(dt) {
        this.clouds.forEach(c => {
            c.position.x += c.userData.speed * dt;
            if (c.position.x > 80) c.position.x = -80;
        });
    }
};

World.init();
