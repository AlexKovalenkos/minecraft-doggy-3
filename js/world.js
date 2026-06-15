// ============================================================
// world.js — Minecraft-style terrain + все объекты мира
// ============================================================

const World = {
    clouds: [],
    collidables: [],
    waterZones: [],
    bridge: null,

    // ============================================================
    // TERRAIN SYSTEM
    // ============================================================

    getTerrainY(wx, wz) {
        if (!this._hmap) return 0;
        const gx = Math.floor((wx + this._tHALF) / this._tCELL);
        const gz = Math.floor((wz + this._tHALF) / this._tCELL);
        if (gx < 0 || gz < 0 || gx >= this._tGRID || gz >= this._tGRID) return 0;
        return this._hmap[gx][gz] * this._tBSIZE;
    },

    _pixTex(sz, fn) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = sz;
        const ctx = cv.getContext('2d');
        for (let y = 0; y < sz; y++) for (let x = 0; x < sz; x++) {
            ctx.fillStyle = fn(x, y);
            ctx.fillRect(x, y, 1, 1);
        }
        const t = new THREE.CanvasTexture(cv);
        t.magFilter = t.minFilter = THREE.NearestFilter; // crisp pixel art
        return t;
    },

    _buildTerrain() {
        const GRID = 72, CELL = 2.5, BSIZE = 1.0, MAX_H = 8;
        const HALF = GRID * CELL / 2;
        this._tGRID = GRID; this._tCELL = CELL;
        this._tBSIZE = BSIZE; this._tHALF = HALF;

        // Build heightmap
        const hmap = [];
        for (let gx = 0; gx < GRID; gx++) {
            hmap[gx] = [];
            for (let gz = 0; gz < GRID; gz++) {
                hmap[gx][gz] = this._calcTerrH(gx, gz, GRID, MAX_H);
            }
        }

        // Flatten terrain under all known structures
        const flat = (wx, wz, r) => {
            const gc  = Math.round((wx + HALF) / CELL);
            const gcz = Math.round((wz + HALF) / CELL);
            const gr  = Math.ceil(r / CELL) + 1;
            for (let dx = -gr; dx <= gr; dx++) for (let dz = -gr; dz <= gr; dz++) {
                const gx2 = gc + dx, gz2 = gcz + dz;
                if (gx2 < 0 || gz2 < 0 || gx2 >= GRID || gz2 >= GRID) continue;
                if (Math.sqrt(((gx2-gc)*CELL)**2 + ((gz2-gcz)*CELL)**2) < r)
                    hmap[gx2][gz2] = 0;
            }
        };
        flat(0, 0, 32);       // spawn + bridge
        flat(-25, 20, 22);    // house
        flat(10, 10, 18);     // lake
        flat(30, 35, 18);     // stable
        flat(85, 80, 30);     // castle
        flat(-25+6, 20, 14);  // cat house area
        flat(-70, -65, 18);   // hamster house
        flat(12, -14, 12);    // NPC dog spawn
        flat(-12, 8, 12);     // unicorn spawns
        flat(8, -15, 12);
        flat(-5, -8, 10);
        flat(75, -60, 22);    // dragon home
        flat(-60, -50, 14);   // second pond
        flat(0, -15, 12);     // rainbow bridge

        this._hmap = hmap;

        // ── Pixel textures ──────────────────────────────────────────
        const tGT = this._pixTex(16, (x, y) => {
            const v = (Math.sin(x*3.7+y*2.3)*0.4 + Math.cos(x*1.1-y*3.9)*0.15 + 0.65) / 1.0;
            const r = Math.max(0,Math.min(255, Math.round(86*v)));
            const g = Math.max(0,Math.min(255, Math.round(158*v)));
            const b = Math.max(0,Math.min(255, Math.round(44*v)));
            return `rgb(${r},${g},${b})`;
        });
        const tGS = this._pixTex(16, (x, y) => {
            if (y < 3) {
                const v = Math.sin(x*4.3)*0.15 + 0.85;
                return `rgb(${Math.round(76*v)},${Math.round(142*v)},${Math.round(38*v)})`;
            }
            const v = Math.sin(x*2.9+y*1.3)*0.12 + 0.88;
            return `rgb(${Math.round(129*v)},${Math.round(89*v)},${Math.round(56*v)})`;
        });
        const tDirt = this._pixTex(16, (x, y) => {
            const v = Math.sin(x*3.1+y*2.7)*0.1 + Math.cos(x*1.9-y*3.3)*0.08 + 0.88;
            return `rgb(${Math.round(134*v)},${Math.round(92*v)},${Math.round(58*v)})`;
        });
        const tStone = this._pixTex(16, (x, y) => {
            const v = Math.sin(x*4.1+y*3.7)*0.08 + Math.cos(x*2.3-y*5.1)*0.07 + 0.87;
            const c = Math.round(115*v);
            return `rgb(${c},${c},${c+4})`;
        });
        [tGT, tGS, tDirt, tStone].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });

        this._texGrassTop  = tGT;
        this._texGrassSide = tGS;
        this._texDirt      = tDirt;
        this._texStone     = tStone;

        // ── Base floor ──────────────────────────────────────────────
        const floorM = new THREE.MeshStandardMaterial({ map: tGT });
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(GRID*CELL + 60, GRID*CELL + 60), floorM
        );
        floor.rotation.x = -Math.PI/2;
        floor.position.y = -0.02;
        floor.receiveShadow = true;
        GAME.scene.add(floor);
        GAME.ground = floor;

        // ── Terrain block columns via InstancedMesh ─────────────────
        const cnt = new Array(MAX_H + 1).fill(0);
        for (let gx = 0; gx < GRID; gx++) for (let gz = 0; gz < GRID; gz++) cnt[hmap[gx][gz]]++;

        const dummy = new THREE.Object3D();

        for (let h = 1; h <= MAX_H; h++) {
            if (!cnt[h]) continue;
            const hW = h * BSIZE;

            // Side texture: repeat V×h so bricks tile per block
            const st = tGS.clone();
            st.wrapT = THREE.RepeatWrapping;
            st.repeat.set(1, h);
            st.needsUpdate = true;

            // Stone for deeper layers when h >= 4
            const useStoneSide = h >= 5;
            const stoneT = tStone.clone();
            stoneT.wrapT = THREE.RepeatWrapping;
            stoneT.repeat.set(1, h - 2);
            stoneT.needsUpdate = true;

            const sideMat = new THREE.MeshStandardMaterial({ map: st });
            const mats = [sideMat, sideMat,
                new THREE.MeshStandardMaterial({ map: tGT }),
                new THREE.MeshStandardMaterial({ map: tDirt }),
                sideMat, sideMat
            ];

            const geo = new THREE.BoxGeometry(CELL, hW, CELL);
            const im  = new THREE.InstancedMesh(geo, mats, cnt[h]);
            im.receiveShadow = true;

            let idx = 0;
            for (let gx = 0; gx < GRID; gx++) for (let gz = 0; gz < GRID; gz++) {
                if (hmap[gx][gz] !== h) continue;
                const wx = -HALF + gx*CELL + CELL/2;
                const wz = -HALF + gz*CELL + CELL/2;
                dummy.position.set(wx, hW/2, wz);
                dummy.updateMatrix();
                im.setMatrixAt(idx++, dummy.matrix);
            }
            im.instanceMatrix.needsUpdate = true;
            GAME.scene.add(im);
        }
    },

    _calcTerrH(gx, gz, GRID, MAX_H) {
        const nx = (gx / GRID) * 2 - 1;
        const nz = (gz / GRID) * 2 - 1;
        const d  = Math.sqrt(
            ((gx - GRID/2)/(GRID/2))**2 + ((gz - GRID/2)/(GRID/2))**2
        );

        if (d < 0.10) return 0; // totally flat center

        // Multi-octave sine noise
        let h = Math.sin(nx*5.1+1.4) * Math.cos(nz*4.3-0.9) * 0.38
              + Math.cos((nx+nz)*5.9+0.7) * 0.22
              + Math.sin(nx*9.7-nz*7.8+1.9) * 0.11
              + Math.cos(nx*14.3+nz*11.7) * 0.05;
        h = (h + 0.76) / 1.52; // → 0..1
        h = Math.max(0, Math.min(1, h));

        // Blend: distance from center boosts height
        const edgeF = Math.max(0, d - 0.10) / 0.90;
        h = h * 0.30 + edgeF * 0.70;
        h = h * h * 1.15; // sharper peaks
        h = Math.max(0, Math.min(1, h));

        return Math.round(h * MAX_H);
    },

    // ============================================================
    // MC-STYLE TREE TEXTURES
    // ============================================================
    _mkOakLog() {
        return this._pixTex(16, (x, y) => {
            const edge = (x === 0 || x === 15) ? 0.72 : 1.0;
            const grain = Math.sin(y * 1.4 + x * 0.3) * 0.06 + 0.94;
            const v = edge * grain;
            return `rgb(${Math.round(162*v)},${Math.round(126*v)},${Math.round(75*v)})`;
        });
    },
    _mkOakLeaves() {
        return this._pixTex(16, (x, y) => {
            const v = Math.sin(x*4.1+y*3.3)*0.12 + Math.cos(x*2.3-y*4.7)*0.1 + 0.78;
            return `rgb(${Math.round(68*v)},${Math.round(174*v)},${Math.round(50*v)})`;
        });
    },

    // ============================================================

    init() {
        this._buildTerrain(); // ← FIRST: sets up heightmap + base floor
        this._createTrees();
        this._createFlowers();
        this._createLake();
        this._createRocks();
        this._createClouds();
        this._createRainbowBridge();
        this._createMountains();
        this._createHouse();
        this._createHills();
        this._createPaths();
        this._createWoodenBridges();
        this._createCastle();
        this._createStable();
        this._createCatHouse();
        this._createHamsterHouse();
        this._createTerrainVariety();
    },

    _createTrees() {
        // All tree positions [x, z, trunkBlocks]
        const treeList = [
            [-15,-12,4],[18,8,4],[-8,20,5],[12,-18,4],
            [-20,5,5],[5,-22,4],[22,22,5],[-18,-22,4],
            [55,40,6],[-60,45,6],[70,-30,5],[-50,-55,6],
            [45,-65,5],[-70,35,6],[80,20,5],[-55,-30,5],
            [-30,-15,6],[25,-30,5],[-10,-35,6],[35,15,5],
            [-40,10,6],[50,-20,5],[-65,-15,6],[40,50,6],
            [65,-50,6],[-55,50,6],[15,45,5],[-35,-60,6],
            [75,40,6],[-45,25,5],[30,-45,6],[-20,-45,5],
            [-50,-25,7],[60,25,6],[-30,45,6],[50,-45,6],
            [-75,-35,7],[75,-15,6],[-60,55,7],[65,60,7],
            [-40,-55,7],[45,55,6],[-70,0,7],[80,-40,6]
        ];

        // Minecraft oak log texture (pixel art)
        const logTex = this._mkOakLog();
        logTex.wrapS = logTex.wrapT = THREE.RepeatWrapping;
        const logMat = new THREE.MeshStandardMaterial({ map: logTex });

        const leavesTex = this._mkOakLeaves();
        leavesTex.wrapS = leavesTex.wrapT = THREE.RepeatWrapping;
        const leafMat = new THREE.MeshStandardMaterial({ map: leavesTex });

        const B = 1.0; // 1 Minecraft block = 1 unit

        treeList.forEach(([x, z, trunkBlocks]) => {
            const groundY = this.getTerrainY(x, z);
            const trunkH  = trunkBlocks * B;
            const g = new THREE.Group();

            // Trunk — square oak log (1×1 block cross-section)
            const trunk = new THREE.Mesh(
                new THREE.BoxGeometry(B, trunkH, B), logMat
            );
            trunk.position.y = trunkH / 2;
            trunk.castShadow = true;
            g.add(trunk);

            // Leaves — Minecraft oak pattern: 2 wide layers (5×5) + 1 narrow top (3×3)
            const leafW = 5 * B;
            for (let ly = 0; ly < 2; ly++) {
                const layer = new THREE.Mesh(
                    new THREE.BoxGeometry(leafW, B, leafW), leafMat
                );
                layer.position.y = trunkH + ly * B + B * 0.5;
                layer.castShadow = true;
                g.add(layer);
            }
            const topLeaf = new THREE.Mesh(
                new THREE.BoxGeometry(3 * B, B * 1.5, 3 * B), leafMat
            );
            topLeaf.position.y = trunkH + 2 * B + B * 0.75;
            topLeaf.castShadow = true;
            g.add(topLeaf);

            g.position.set(x, groundY, z);
            GAME.scene.add(g);

            // Trunk collision
            const hw = B / 2;
            this.collidables.push({ box: new THREE.Box3(
                new THREE.Vector3(x - hw, groundY, z - hw),
                new THREE.Vector3(x + hw, groundY + trunkH, z + hw)
            )});
            // Leaves block (can land on top)
            const lhw = leafW / 2;
            this.collidables.push({ box: new THREE.Box3(
                new THREE.Vector3(x - lhw, groundY + trunkH - 0.5, z - lhw),
                new THREE.Vector3(x + lhw, groundY + trunkH + 2 * B + B * 1.5, z + lhw)
            )});
        });
    },

    _createFlowers() {
        const colors = [0xff69b4, 0xffd700, 0xff85a2, 0xffe066, 0xffb6c1];
        const greenShades = [0x5a9a40, 0x6daa50, 0x4a8a35, 0x7dba5c, 0x3d8030];
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x7dba5c });

        // Small flowers
        for (let i = 0; i < 60; i++) {
            const x = (Math.random() - 0.5) * GAME.WORLD_SIZE * 3.2;
            const z = (Math.random() - 0.5) * GAME.WORLD_SIZE * 3.2;
            if (Math.abs(x - 10) < 6 && Math.abs(z - 10) < 6) continue;

            const g = new THREE.Group();
            const stem = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), stemMat);
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

        // Tall flowers (stems 0.6-1.2 high)
        for (let i = 0; i < 35; i++) {
            const x = (Math.random() - 0.5) * GAME.WORLD_SIZE * 3;
            const z = (Math.random() - 0.5) * GAME.WORLD_SIZE * 3;
            if (Math.abs(x - 10) < 6 && Math.abs(z - 10) < 6) continue;
            const g = new THREE.Group();
            const h = 0.6 + Math.random() * 0.6;
            const stem = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.06), stemMat);
            stem.position.y = h / 2;
            g.add(stem);
            const petal = new THREE.Mesh(
                new THREE.BoxGeometry(0.35, 0.35, 0.35),
                new THREE.MeshStandardMaterial({ color: colors[Math.floor(Math.random() * colors.length)] })
            );
            petal.position.y = h + 0.15;
            g.add(petal);
            g.position.set(x, 0, z);
            GAME.scene.add(g);
        }

        // Low grass tufts (0.15-0.3 high)
        for (let i = 0; i < 80; i++) {
            const x = (Math.random() - 0.5) * GAME.WORLD_SIZE * 3.5;
            const z = (Math.random() - 0.5) * GAME.WORLD_SIZE * 3.5;
            const h = 0.15 + Math.random() * 0.15;
            const w = 0.3 + Math.random() * 0.4;
            const tuft = new THREE.Mesh(
                new THREE.BoxGeometry(w, h, w),
                new THREE.MeshStandardMaterial({ color: greenShades[Math.floor(Math.random() * greenShades.length)] })
            );
            tuft.position.set(x, h / 2, z);
            GAME.scene.add(tuft);
        }

        // Medium bushes (0.5-1.2 high, round clusters)
        for (let i = 0; i < 40; i++) {
            const x = (Math.random() - 0.5) * GAME.WORLD_SIZE * 3;
            const z = (Math.random() - 0.5) * GAME.WORLD_SIZE * 3;
            if (Math.abs(x - 10) < 8 && Math.abs(z - 10) < 8) continue;
            const g = new THREE.Group();
            const bushH = 0.5 + Math.random() * 0.7;
            const bushW = 0.6 + Math.random() * 0.8;
            const col = greenShades[Math.floor(Math.random() * greenShades.length)];
            const bushMat = new THREE.MeshStandardMaterial({ color: col });
            // Main body
            const main = new THREE.Mesh(new THREE.BoxGeometry(bushW, bushH, bushW), bushMat);
            main.position.y = bushH / 2;
            main.castShadow = true;
            g.add(main);
            // Top lump
            const topS = bushW * 0.7;
            const top = new THREE.Mesh(new THREE.BoxGeometry(topS, bushH * 0.5, topS), bushMat);
            top.position.y = bushH + bushH * 0.2;
            top.castShadow = true;
            g.add(top);
            // Optional flower on top
            if (Math.random() > 0.5) {
                const fl = new THREE.Mesh(
                    new THREE.BoxGeometry(0.2, 0.2, 0.2),
                    new THREE.MeshStandardMaterial({ color: colors[Math.floor(Math.random() * colors.length)] })
                );
                fl.position.y = bushH + bushH * 0.5;
                g.add(fl);
            }
            g.position.set(x, 0, z);
            GAME.scene.add(g);
        }

        // Tall shrubs (1.5-2.5 high, like small hedges)
        for (let i = 0; i < 20; i++) {
            const x = (Math.random() - 0.5) * GAME.WORLD_SIZE * 2.8;
            const z = (Math.random() - 0.5) * GAME.WORLD_SIZE * 2.8;
            if (Math.abs(x - 10) < 8 && Math.abs(z - 10) < 8) continue;
            const shrubH = 1.5 + Math.random();
            const shrubW = 0.8 + Math.random() * 0.6;
            const col = greenShades[Math.floor(Math.random() * greenShades.length)];
            const g = new THREE.Group();
            // Trunk
            const trunk = new THREE.Mesh(
                new THREE.BoxGeometry(0.2, shrubH * 0.5, 0.2),
                new THREE.MeshStandardMaterial({ color: 0x8a6540 })
            );
            trunk.position.y = shrubH * 0.25;
            g.add(trunk);
            // Foliage layers
            for (let j = 0; j < 3; j++) {
                const s = shrubW * (1 - j * 0.15);
                const leaf = new THREE.Mesh(
                    new THREE.BoxGeometry(s, shrubH * 0.3, s),
                    new THREE.MeshStandardMaterial({ color: col })
                );
                leaf.position.set(
                    (Math.random() - 0.5) * 0.3,
                    shrubH * 0.4 + j * shrubH * 0.22,
                    (Math.random() - 0.5) * 0.3
                );
                leaf.castShadow = true;
                g.add(leaf);
            }
            g.position.set(x, 0, z);
            GAME.scene.add(g);
        }
    },

    _createLake() {
        // Main lake — expanded to 16x16
        const lake = new THREE.Mesh(
            new THREE.BoxGeometry(16, 0.3, 16),
            new THREE.MeshStandardMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.6, roughness: 0.1, metalness: 0.1 })
        );
        lake.position.set(10, 0.05, 10);
        lake.receiveShadow = true;
        GAME.scene.add(lake);

        this.waterZones.push({ cx: 10, cz: 10, halfW: 8, halfD: 8 });

        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            const r = 8.5 + Math.random();
            const rock = new THREE.Mesh(
                new THREE.BoxGeometry(0.5 + Math.random() * 0.5, 0.3 + Math.random() * 0.3, 0.5 + Math.random() * 0.5),
                new THREE.MeshStandardMaterial({ color: 0xd4a574 })
            );
            rock.position.set(10 + Math.cos(angle) * r, 0.15, 10 + Math.sin(angle) * r);
            rock.castShadow = true;
            GAME.scene.add(rock);
        }

        // Lilies on main lake
        for (let i = 0; i < 6; i++) {
            const lily = new THREE.Mesh(
                new THREE.BoxGeometry(0.4, 0.05, 0.4),
                new THREE.MeshStandardMaterial({ color: 0x4a9a40 })
            );
            lily.position.set(
                10 + (Math.random() - 0.5) * 12,
                0.22,
                10 + (Math.random() - 0.5) * 12
            );
            GAME.scene.add(lily);
        }

        // Second pond near hill
        const pond = new THREE.Mesh(
            new THREE.BoxGeometry(10, 0.3, 10),
            new THREE.MeshStandardMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.6, roughness: 0.1, metalness: 0.1 })
        );
        pond.position.set(-60, 0.05, -50);
        pond.receiveShadow = true;
        GAME.scene.add(pond);

        this.waterZones.push({ cx: -60, cz: -50, halfW: 5, halfD: 5 });

        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2;
            const r = 5.5 + Math.random() * 0.5;
            const rock = new THREE.Mesh(
                new THREE.BoxGeometry(0.4 + Math.random() * 0.3, 0.25, 0.4 + Math.random() * 0.3),
                new THREE.MeshStandardMaterial({ color: 0xd4a574 })
            );
            rock.position.set(-60 + Math.cos(angle) * r, 0.12, -50 + Math.sin(angle) * r);
            rock.castShadow = true;
            GAME.scene.add(rock);
        }

        // Lilies on pond
        for (let i = 0; i < 4; i++) {
            const lily = new THREE.Mesh(
                new THREE.BoxGeometry(0.4, 0.05, 0.4),
                new THREE.MeshStandardMaterial({ color: 0x4a9a40 })
            );
            lily.position.set(
                -60 + (Math.random() - 0.5) * 7,
                0.22,
                -50 + (Math.random() - 0.5) * 7
            );
            GAME.scene.add(lily);
        }
    },

    _createRocks() {
        const rockDefs = [
            [-10, -15, 'flat',    1.0, 0x8a7d6b],
            [20, -10,  'tall',    1.3, 0x6d5a4a],
            [-5, 15,   'pile',    0.9, 0xb0a090],
            [15, -5,   'boulder', 1.0, 0x5a4d3a],
            [-18, -5,  'slab',    1.2, 0x9a7560],
            [25, 15,   'tall',    0.7, 0x787070],
            [8, -20,   'pile',    1.1, 0x8a6d5a],
            [-12, 22,  'boulder', 1.4, 0xa09585],
            [0, -12,   'stepped', 1.0, 0x6a6560],
            [-20, -20, 'flat',    1.5, 0x7a6040]
        ];

        rockDefs.forEach(([x, z, type, scale, color]) => {
            const g = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color });
            let maxH = 0;
            let maxW = 0;
            let maxD = 0;

            if (type === 'flat') {
                const w = (2.0 + Math.random() * 1.0) * scale;
                const h = (0.6 + Math.random() * 0.4) * scale;
                const d = (1.8 + Math.random() * 0.8) * scale;
                const r1 = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
                r1.position.y = h / 2;
                r1.rotation.y = Math.random() * 0.8;
                r1.castShadow = true;
                g.add(r1);
                const w2 = w * 0.55, h2 = h * 0.6, d2 = d * 0.4;
                const r2 = new THREE.Mesh(new THREE.BoxGeometry(w2, h2, d2), mat);
                r2.position.set((Math.random() - 0.5) * w * 0.3, h + h2 / 2, (Math.random() - 0.5) * d * 0.3);
                r2.rotation.y = Math.random() * 0.5;
                r2.castShadow = true;
                g.add(r2);
                maxH = h + h2; maxW = w / 2; maxD = d / 2;
            } else if (type === 'tall') {
                const w = (0.8 + Math.random() * 0.6) * scale;
                const h = (2.5 + Math.random() * 1.5) * scale;
                const d = (0.7 + Math.random() * 0.5) * scale;
                const r1 = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
                r1.position.y = h / 2;
                r1.rotation.y = Math.random() * 0.6;
                r1.castShadow = true;
                g.add(r1);
                const r2 = new THREE.Mesh(new THREE.BoxGeometry(w * 1.3, 0.4 * scale, d * 1.3), mat);
                r2.position.y = h + 0.2 * scale;
                r2.castShadow = true;
                g.add(r2);
                const bw = w * 0.6, bh = h * 0.2;
                const base = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bw), mat);
                base.position.set(w * 0.4, bh / 2, d * 0.3);
                base.rotation.y = 0.5;
                base.castShadow = true;
                g.add(base);
                maxH = h + 0.4 * scale; maxW = w * 0.65 + bw; maxD = d * 0.65;
            } else if (type === 'pile') {
                const pileColors = [color, color - 0x111111, color + 0x0a0a0a];
                const count = 3 + Math.floor(Math.random() * 3);
                for (let i = 0; i < count; i++) {
                    const sw = (0.5 + Math.random() * 0.7) * scale;
                    const sh = (0.4 + Math.random() * 0.6) * scale;
                    const sd = (0.4 + Math.random() * 0.6) * scale;
                    const pMat = new THREE.MeshStandardMaterial({
                        color: pileColors[i % pileColors.length]
                    });
                    const r = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sd), pMat);
                    r.position.set(
                        (Math.random() - 0.5) * 1.5 * scale,
                        sh / 2 + (i > 1 ? 0.3 * scale : 0),
                        (Math.random() - 0.5) * 1.2 * scale
                    );
                    r.rotation.y = Math.random() * Math.PI;
                    r.rotation.z = (Math.random() - 0.5) * 0.4;
                    r.castShadow = true;
                    g.add(r);
                    maxH = Math.max(maxH, r.position.y + sh / 2);
                }
                maxW = 1.2 * scale; maxD = 1.0 * scale;
            } else if (type === 'slab') {
                const w = (2.5 + Math.random() * 1.0) * scale;
                const h = (0.4 + Math.random() * 0.3) * scale;
                const d = (1.5 + Math.random() * 0.8) * scale;
                const r1 = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
                r1.position.y = h / 2 + 0.3 * scale;
                r1.rotation.z = 0.15 + Math.random() * 0.15;
                r1.rotation.y = Math.random() * 0.6;
                r1.castShadow = true;
                g.add(r1);
                const sw = w * 0.3, sh = 0.5 * scale;
                const support = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sw), mat);
                support.position.set(-w * 0.15, sh / 2, 0);
                support.castShadow = true;
                g.add(support);
                maxH = h + 0.5 * scale; maxW = w / 2; maxD = d / 2;
            } else if (type === 'stepped') {
                for (let i = 0; i < 3; i++) {
                    const layerS = (1.8 - i * 0.5) * scale;
                    const layerH = (0.6 + Math.random() * 0.3) * scale;
                    const step = new THREE.Mesh(
                        new THREE.BoxGeometry(layerS, layerH, layerS * 0.9), mat
                    );
                    step.position.y = maxH + layerH / 2;
                    step.rotation.y = i * 0.4;
                    step.castShadow = true;
                    g.add(step);
                    maxH += layerH;
                    if (i === 0) { maxW = layerS / 2; maxD = layerS * 0.45; }
                }
            } else {
                const s = (1.2 + Math.random() * 0.8) * scale;
                const r1 = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.8, s * 0.9), mat);
                r1.position.y = s * 0.4;
                r1.rotation.y = Math.random() * 1.0;
                r1.castShadow = true;
                g.add(r1);
                const s2 = s * 0.55;
                const r2 = new THREE.Mesh(new THREE.BoxGeometry(s2, s2 * 0.8, s2 * 0.7), mat);
                r2.position.set(s * 0.45, s2 * 0.4, s * 0.35);
                r2.rotation.y = 1.2 + Math.random() * 0.5;
                r2.castShadow = true;
                g.add(r2);
                const s3 = s * 0.25;
                const r3 = new THREE.Mesh(new THREE.BoxGeometry(s3, s3 * 0.6, s3), mat);
                r3.position.set(-s * 0.4, s3 * 0.3, -s * 0.3);
                r3.rotation.y = Math.random();
                r3.castShadow = true;
                g.add(r3);
                maxH = s * 0.8; maxW = s / 2 + s2; maxD = s * 0.45 + s2;
            }

            g.position.set(x, 0, z);
            GAME.scene.add(g);

            this.collidables.push({
                box: new THREE.Box3(
                    new THREE.Vector3(x - maxW, 0, z - maxD),
                    new THREE.Vector3(x + maxW, maxH, z + maxD)
                )
            });
        });
    },

    _createClouds() {
        // Minecraft-style flat block clouds
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
        for (let i = 0; i < 18; i++) {
            const g = new THREE.Group();
            // Each cloud = 2-4 flat rectangular blocks arranged randomly in XZ
            const blockCount = 2 + Math.floor(Math.random() * 3);
            const W = 8 + Math.random() * 16;
            const D = 6 + Math.random() * 10;
            // Main rectangle
            g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(W, 1.5, D), mat), {
                position: { x: 0, y: 0, z: 0 }
            }));
            // Extra side blocks for irregular shape
            for (let j = 1; j < blockCount; j++) {
                const bw = 4 + Math.random() * 8;
                const bd = 3 + Math.random() * 6;
                const part = new THREE.Mesh(new THREE.BoxGeometry(bw, 1.5, bd), mat);
                part.position.set(
                    (Math.random() - 0.5) * W * 0.8,
                    0,
                    (Math.random() - 0.5) * D * 0.8
                );
                g.add(part);
            }
            g.position.set(
                (Math.random() - 0.5) * 280,
                28 + Math.random() * 12,
                (Math.random() - 0.5) * 280
            );
            g.userData.speed = 1.5 + Math.random() * 2.0; // faster, more MC-like
            GAME.scene.add(g);
            this.clouds.push(g);
        }
    },

    _createRainbowBridge() {
        const R = 20, cx = 0, cz = -15;
        const segments = 28;
        const bridgeWidth = 3;
        const colors = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3];
        const stripeW = bridgeWidth / 7;
        const segLen = (Math.PI * R) / segments * 1.15;

        for (let i = 0; i < segments; i++) {
            const angle = (i + 0.5) * Math.PI / segments;
            const x = cx + R * Math.cos(angle);
            const y = R * Math.sin(angle);

            const segGroup = new THREE.Group();
            segGroup.position.set(x, y, cz);
            segGroup.rotation.z = angle - Math.PI / 2;

            colors.forEach((color, ci) => {
                const stripe = new THREE.Mesh(
                    new THREE.BoxGeometry(segLen, 0.3, stripeW),
                    new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.85 })
                );
                stripe.position.z = (ci - 3) * stripeW;
                stripe.receiveShadow = true;
                segGroup.add(stripe);
            });

            GAME.scene.add(segGroup);
        }

        this.bridge = { cx, cz, R, halfW: bridgeWidth / 2 };
    },

    _createMountains() {
        const mountains = [
            { x: 60, z: -60, height: 12, base: 8 },
            { x: -45, z: -40, height: 14, base: 9 },
            { x: -80, z: 60, height: 10, base: 7 },
            { x: -80, z: -20, height: 11, base: 8 }
        ];

        const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a7d6b });
        const snowMat = new THREE.MeshStandardMaterial({ color: 0xf0f0ff });

        mountains.forEach(m => {
            const g = new THREE.Group();
            const levels = 6 + Math.floor(Math.random() * 3);
            const layerH = m.height / levels;

            for (let i = 0; i < levels; i++) {
                const fraction = i / levels;
                const size = m.base * (1 - fraction * 0.7);
                const isSnow = fraction > 0.6;
                const block = new THREE.Mesh(
                    new THREE.BoxGeometry(size, layerH, size),
                    isSnow ? snowMat : rockMat
                );
                block.position.y = i * layerH + layerH / 2;
                block.castShadow = true;
                block.receiveShadow = true;
                g.add(block);
            }

            const capSize = m.base * 0.15;
            const cap = new THREE.Mesh(
                new THREE.BoxGeometry(capSize, layerH * 0.8, capSize),
                snowMat
            );
            cap.position.y = levels * layerH + layerH * 0.4;
            cap.castShadow = true;
            g.add(cap);

            g.position.set(m.x, 0, m.z);
            GAME.scene.add(g);

            for (let i = 0; i < levels; i++) {
                const fraction = i / levels;
                const size = m.base * (1 - fraction * 0.7);
                const halfS = size / 2;
                const yBottom = i * layerH;
                const yTop = (i + 1) * layerH;
                this.collidables.push({
                    box: new THREE.Box3(
                        new THREE.Vector3(m.x - halfS, yBottom, m.z - halfS),
                        new THREE.Vector3(m.x + halfS, yTop, m.z + halfS)
                    )
                });
            }
        });
    },

    _createHouse() {
        const hx = -25, hz = 20;
        const g = new THREE.Group();
        const W = 10, H = 4, D = 8;
        const wallT = 0.4;
        const doorW = 3, doorH = 3;

        const wallMat = new THREE.MeshStandardMaterial({ color: 0xc48a5c });
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x6b3a2a });
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xb44444, side: THREE.DoubleSide });
        const winMat = new THREE.MeshStandardMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.7 });

        const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.2, D), floorMat);
        floor.position.y = 0.1;
        floor.receiveShadow = true;
        g.add(floor);

        const backWall = new THREE.Mesh(new THREE.BoxGeometry(W, H, wallT), wallMat);
        backWall.position.set(0, H / 2, -D / 2 + wallT / 2);
        backWall.castShadow = true;
        backWall.receiveShadow = true;
        g.add(backWall);

        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, H, D), wallMat);
        leftWall.position.set(-W / 2 + wallT / 2, H / 2, 0);
        leftWall.castShadow = true;
        leftWall.receiveShadow = true;
        g.add(leftWall);

        const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, H, D), wallMat);
        rightWall.position.set(W / 2 - wallT / 2, H / 2, 0);
        rightWall.castShadow = true;
        rightWall.receiveShadow = true;
        g.add(rightWall);

        const frontSideW = (W - doorW) / 2;
        const frontL = new THREE.Mesh(new THREE.BoxGeometry(frontSideW, H, wallT), wallMat);
        frontL.position.set(-W / 2 + frontSideW / 2, H / 2, D / 2 - wallT / 2);
        frontL.castShadow = true;
        g.add(frontL);
        const frontR = new THREE.Mesh(new THREE.BoxGeometry(frontSideW, H, wallT), wallMat);
        frontR.position.set(W / 2 - frontSideW / 2, H / 2, D / 2 - wallT / 2);
        frontR.castShadow = true;
        g.add(frontR);
        const frontTop = new THREE.Mesh(new THREE.BoxGeometry(doorW, H - doorH, wallT), wallMat);
        frontTop.position.set(0, doorH + (H - doorH) / 2, D / 2 - wallT / 2);
        frontTop.castShadow = true;
        g.add(frontTop);

        const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 1, 0.5, D + 1), roofMat);
        roof.position.y = H + 0.25;
        roof.castShadow = true;
        g.add(roof);

        const winSize = 1.2;
        const winL = new THREE.Mesh(new THREE.BoxGeometry(0.1, winSize, winSize), winMat);
        winL.position.set(-W / 2 + wallT / 2 - 0.05, H * 0.55, 0);
        g.add(winL);
        const winR = new THREE.Mesh(new THREE.BoxGeometry(0.1, winSize, winSize), winMat);
        winR.position.set(W / 2 - wallT / 2 + 0.05, H * 0.55, 0);
        g.add(winR);

        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#c48a5c';
        ctx.fillRect(0, 0, 256, 64);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Домик Тёплый', 128, 42);
        const signTex = new THREE.CanvasTexture(canvas);
        const signBoard = new THREE.Mesh(
            new THREE.BoxGeometry(3, 0.6, 0.3),
            new THREE.MeshStandardMaterial({ color: 0xc48a5c })
        );
        signBoard.position.set(0, doorH + 0.5, D / 2 + 0.2);
        g.add(signBoard);
        const signFace = new THREE.Mesh(
            new THREE.PlaneGeometry(3, 0.6),
            new THREE.MeshBasicMaterial({ map: signTex })
        );
        signFace.position.set(0, doorH + 0.5, D / 2 + 0.36);
        g.add(signFace);

        g.position.set(hx, 0, hz);
        GAME.scene.add(g);

        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(hx - W / 2, 0, hz - D / 2),
                new THREE.Vector3(hx + W / 2, H, hz - D / 2 + wallT)
            )
        });
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(hx - W / 2, 0, hz - D / 2),
                new THREE.Vector3(hx - W / 2 + wallT, H, hz + D / 2)
            )
        });
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(hx + W / 2 - wallT, 0, hz - D / 2),
                new THREE.Vector3(hx + W / 2, H, hz + D / 2)
            )
        });
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(hx - W / 2, 0, hz + D / 2 - wallT),
                new THREE.Vector3(hx - W / 2 + frontSideW, H, hz + D / 2)
            )
        });
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(hx + W / 2 - frontSideW, 0, hz + D / 2 - wallT),
                new THREE.Vector3(hx + W / 2, H, hz + D / 2)
            )
        });
        // Roof collision — can land on top
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(hx - (W + 1) / 2, H, hz - (D + 1) / 2),
                new THREE.Vector3(hx + (W + 1) / 2, H + 0.5, hz + (D + 1) / 2)
            )
        });

        this._createFence(hx, hz);
    },

    _createFence(hx, hz) {
        const fenceMat = new THREE.MeshStandardMaterial({ color: 0xd4a574 });
        const hw = 7, hd = 6;
        const postH = 1.2;

        const corners = [
            [hx - hw, hz - hd], [hx + hw, hz - hd],
            [hx + hw, hz + hd], [hx - hw, hz + hd]
        ];
        const sides = [
            [corners[0], corners[1]], [corners[1], corners[2]],
            [corners[2], corners[3]], [corners[3], corners[0]]
        ];

        sides.forEach(([start, end]) => {
            const dx = end[0] - start[0];
            const dz = end[1] - start[1];
            const len = Math.sqrt(dx * dx + dz * dz);
            const count = Math.round(len / 2);
            for (let i = 0; i <= count; i++) {
                const t = i / count;
                const px = start[0] + dx * t;
                const pz = start[1] + dz * t;
                if (Math.abs(px - hx) < 2.0 && Math.abs(pz - (hz + hd)) < 0.5) continue;

                const post = new THREE.Mesh(
                    new THREE.BoxGeometry(0.15, postH, 0.15),
                    fenceMat
                );
                post.position.set(px, postH / 2, pz);
                post.castShadow = true;
                GAME.scene.add(post);
            }

            const rail = new THREE.Mesh(
                new THREE.BoxGeometry(
                    Math.abs(dx) > 0.1 ? len : 0.1,
                    0.1,
                    Math.abs(dz) > 0.1 ? len : 0.1
                ),
                fenceMat
            );
            rail.position.set(
                (start[0] + end[0]) / 2,
                postH * 0.7,
                (start[1] + end[1]) / 2
            );
            GAME.scene.add(rail);
        });

        this.fenceBounds = {
            minX: hx - hw + 0.5,
            maxX: hx + hw - 0.5,
            minZ: hz - hd + 0.5,
            maxZ: hz + hd - 0.5
        };
    },

    // === PHASE 1: Hills ===
    _createHills() {
        const hills = [
            { x: 70, z: 60, height: 5, base: 8 },
            { x: -65, z: 70, height: 4, base: 7 },
            { x: 80, z: -50, height: 6, base: 9 },
            { x: -75, z: -60, height: 4, base: 6 },
            { x: 60, z: -75, height: 5, base: 7 },
            { x: -50, z: 55, height: 3, base: 6 }
        ];

        const hillColors = [0x5a9a40, 0x6daa50];

        hills.forEach(h => {
            const g = new THREE.Group();
            const layers = 3 + Math.floor(Math.random() * 2);
            const layerH = h.height / layers;

            for (let i = 0; i < layers; i++) {
                const fraction = i / layers;
                const size = h.base * (1 - fraction * 0.6);
                const block = new THREE.Mesh(
                    new THREE.BoxGeometry(size, layerH, size),
                    new THREE.MeshStandardMaterial({ color: hillColors[i % 2] })
                );
                block.position.y = i * layerH + layerH / 2;
                block.castShadow = true;
                block.receiveShadow = true;
                g.add(block);
            }

            g.position.set(h.x, 0, h.z);
            GAME.scene.add(g);

            // Per-level collision
            for (let i = 0; i < layers; i++) {
                const fraction = i / layers;
                const size = h.base * (1 - fraction * 0.6);
                const halfS = size / 2;
                this.collidables.push({
                    box: new THREE.Box3(
                        new THREE.Vector3(h.x - halfS, i * layerH, h.z - halfS),
                        new THREE.Vector3(h.x + halfS, (i + 1) * layerH, h.z + halfS)
                    )
                });
            }
        });
    },

    // === PHASE 1: Paths ===
    _createPaths() {
        const pathMat = new THREE.MeshStandardMaterial({ color: 0xd4a574 });

        // Path segments: arrays of [x1,z1, x2,z2]
        const paths = [
            // From house (-25,20) toward castle (85,80)
            { points: [[-20, 24], [-10, 30], [0, 40], [20, 55], [40, 65], [60, 72], [78, 78]] },
            // From lake (10,10) toward stable (30,35)
            { points: [[14, 14], [20, 20], [25, 28], [28, 33]] },
            // From start (0,0) toward bridge (0,-15)
            { points: [[0, -2], [0, -6], [0, -10]] }
        ];

        paths.forEach(path => {
            for (let i = 0; i < path.points.length - 1; i++) {
                const [x1, z1] = path.points[i];
                const [x2, z2] = path.points[i + 1];
                const dx = x2 - x1;
                const dz = z2 - z1;
                const len = Math.sqrt(dx * dx + dz * dz);
                const angle = Math.atan2(dx, dz);

                const seg = new THREE.Mesh(
                    new THREE.BoxGeometry(2, 0.1, len + 0.5),
                    pathMat
                );
                seg.position.set((x1 + x2) / 2, 0.05, (z1 + z2) / 2);
                seg.rotation.y = angle;
                seg.receiveShadow = true;
                GAME.scene.add(seg);
            }
        });
    },

    // === PHASE 1: Wooden Bridges ===
    _createWoodenBridges() {
        const woodMat = new THREE.MeshStandardMaterial({ color: 0xb08050 });
        const railMat = new THREE.MeshStandardMaterial({ color: 0x8a6540 });

        const bridges = [
            { x: -55, z: -45, length: 12, angle: 0.3 },
            { x: 65, z: 55, length: 10, angle: -0.5 }
        ];

        bridges.forEach(b => {
            const g = new THREE.Group();
            const planks = Math.floor(b.length / 0.9);

            // Planks
            for (let i = 0; i < planks; i++) {
                const plank = new THREE.Mesh(
                    new THREE.BoxGeometry(2, 0.15, 0.8),
                    woodMat
                );
                plank.position.set(0, 0.3, -b.length / 2 + i * 0.9 + 0.45);
                plank.castShadow = true;
                g.add(plank);
            }

            // Railings — left and right
            [-1.1, 1.1].forEach(xOff => {
                // Posts
                for (let i = 0; i < 4; i++) {
                    const post = new THREE.Mesh(
                        new THREE.BoxGeometry(0.15, 1.0, 0.15),
                        railMat
                    );
                    post.position.set(xOff, 0.8, -b.length / 2 + (i + 0.5) * (b.length / 4));
                    post.castShadow = true;
                    g.add(post);
                }
                // Top rail
                const rail = new THREE.Mesh(
                    new THREE.BoxGeometry(0.1, 0.1, b.length),
                    railMat
                );
                rail.position.set(xOff, 1.2, 0);
                g.add(rail);
            });

            g.position.set(b.x, 0, b.z);
            g.rotation.y = b.angle;
            GAME.scene.add(g);

            // Collision: walkable surface
            this.collidables.push({
                box: new THREE.Box3(
                    new THREE.Vector3(b.x - 1.5, 0, b.z - b.length / 2 - 1),
                    new THREE.Vector3(b.x + 1.5, 0.45, b.z + b.length / 2 + 1)
                )
            });
        });
    },

    // === PHASE 3: Castle (Disney-style) ===
    _createCastle() {
        const cx = 85, cz = 80;
        const g = new THREE.Group();
        const W = 24, H = 12, D = 20;
        const wallT = 0.6;
        const doorW = 5, doorH = 8;

        // Multi-layer stone materials
        const wallMatLow = new THREE.MeshStandardMaterial({ color: 0x7a7a8a });
        const wallMatMid = new THREE.MeshStandardMaterial({ color: 0x8a8a9a });
        const wallMatTop = new THREE.MeshStandardMaterial({ color: 0x9a9aa5 });
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x6b3a2a });
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a0082, side: THREE.DoubleSide });
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
        const redMat = new THREE.MeshStandardMaterial({ color: 0xcc2222 });
        const winMat = new THREE.MeshStandardMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.7 });
        const pinkMat = new THREE.MeshStandardMaterial({ color: 0xff69b4 });
        const stoneGrey = new THREE.MeshStandardMaterial({ color: 0x8a8a9a });

        // Floor
        const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.15, D), floorMat);
        floor.position.y = 0.075;
        floor.receiveShadow = true;
        g.add(floor);

        // Walls — 3 layers by height (low/mid/top)
        const layerH = H / 3;
        const wallLayers = [
            { mat: wallMatLow, yBase: 0 },
            { mat: wallMatMid, yBase: layerH },
            { mat: wallMatTop, yBase: layerH * 2 }
        ];
        wallLayers.forEach(wl => {
            // Back wall
            const bw = new THREE.Mesh(new THREE.BoxGeometry(W, layerH, wallT), wl.mat);
            bw.position.set(0, wl.yBase + layerH / 2, -D / 2 + wallT / 2);
            bw.castShadow = true;
            g.add(bw);
            // Left wall
            const lw = new THREE.Mesh(new THREE.BoxGeometry(wallT, layerH, D), wl.mat);
            lw.position.set(-W / 2 + wallT / 2, wl.yBase + layerH / 2, 0);
            lw.castShadow = true;
            g.add(lw);
            // Right wall
            const rw = new THREE.Mesh(new THREE.BoxGeometry(wallT, layerH, D), wl.mat);
            rw.position.set(W / 2 - wallT / 2, wl.yBase + layerH / 2, 0);
            rw.castShadow = true;
            g.add(rw);
        });

        // Front wall with large door opening (use mid color)
        const frontSideW = (W - doorW) / 2;
        const fL = new THREE.Mesh(new THREE.BoxGeometry(frontSideW, H, wallT), wallMatMid);
        fL.position.set(-W / 2 + frontSideW / 2, H / 2, D / 2 - wallT / 2);
        fL.castShadow = true;
        g.add(fL);
        const fR = new THREE.Mesh(new THREE.BoxGeometry(frontSideW, H, wallT), wallMatMid);
        fR.position.set(W / 2 - frontSideW / 2, H / 2, D / 2 - wallT / 2);
        fR.castShadow = true;
        g.add(fR);
        const fTop = new THREE.Mesh(new THREE.BoxGeometry(doorW, H - doorH, wallT), wallMatTop);
        fTop.position.set(0, doorH + (H - doorH) / 2, D / 2 - wallT / 2);
        fTop.castShadow = true;
        g.add(fTop);

        // Crenellations along all walls
        const crenMat = wallMatTop;
        // Back wall crenellations
        for (let i = 0; i < 12; i++) {
            if (i % 2 === 0) continue;
            const cren = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.6), crenMat);
            cren.position.set(-W / 2 + 1 + i * (W / 12), H + 0.6, -D / 2 + 0.3);
            cren.castShadow = true;
            g.add(cren);
        }
        // Left/right wall crenellations
        for (let i = 0; i < 10; i++) {
            if (i % 2 === 0) continue;
            [-W / 2 + 0.3, W / 2 - 0.3].forEach(xOff => {
                const cren = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.8), crenMat);
                cren.position.set(xOff, H + 0.6, -D / 2 + 1 + i * (D / 10));
                cren.castShadow = true;
                g.add(cren);
            });
        }

        // 4 corner towers — taller with spires
        const towerPositions = [
            [-W / 2, -D / 2], [W / 2, -D / 2],
            [-W / 2, D / 2], [W / 2, D / 2]
        ];
        towerPositions.forEach(([tx, tz]) => {
            const tower = new THREE.Mesh(new THREE.BoxGeometry(3, 16, 3), stoneGrey);
            tower.position.set(tx, 8, tz);
            tower.castShadow = true;
            g.add(tower);

            // Cone roof (5 diminishing layers)
            for (let i = 0; i < 5; i++) {
                const s = 3.5 - i * 0.55;
                const rh = 1.0;
                const roofLayer = new THREE.Mesh(new THREE.BoxGeometry(s, rh, s), roofMat);
                roofLayer.position.set(tx, 16 + i * rh + rh / 2, tz);
                roofLayer.castShadow = true;
                g.add(roofLayer);
            }

            // Spire: thin pillar + golden ball
            const spire = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2, 0.15), stoneGrey);
            spire.position.set(tx, 22, tz);
            g.add(spire);
            const ball = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), goldMat);
            ball.position.set(tx, 23.15, tz);
            g.add(ball);

            // Flag on top
            const pole = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.1), stoneGrey);
            pole.position.set(tx, 23.8, tz);
            g.add(pole);
            const flag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.8, 1.2), pinkMat);
            flag.position.set(tx, 24.2, tz + 0.6);
            g.add(flag);
        });

        // Roof of main hall
        const mainRoof = new THREE.Mesh(new THREE.BoxGeometry(W + 1, 0.6, D + 1), roofMat);
        mainRoof.position.y = H + 0.3;
        mainRoof.castShadow = true;
        g.add(mainRoof);

        // Entrance arch — 2 columns + 3 arch segments
        [-doorW / 2 - 0.3, doorW / 2 + 0.3].forEach(xOff => {
            const col = new THREE.Mesh(new THREE.BoxGeometry(0.6, doorH, 0.6), wallMatLow);
            col.position.set(xOff, doorH / 2, D / 2 + 0.3);
            col.castShadow = true;
            g.add(col);
        });
        // Arch pieces (3 boxes forming arc above door)
        [-1.2, 0, 1.2].forEach((xOff, i) => {
            const archH = 0.6;
            const archY = doorH + 0.3 + (i === 1 ? 0.4 : 0);
            const archP = new THREE.Mesh(new THREE.BoxGeometry(1.8, archH, 0.6), wallMatMid);
            archP.position.set(xOff, archY, D / 2 + 0.3);
            archP.castShadow = true;
            g.add(archP);
        });

        // Stained glass windows (colorful panes inside each window)
        const stainedColors = [0xff69b4, 0xffd700, 0x87ceeb];
        [-D / 4, D / 4].forEach(zOff => {
            // Base window
            const wL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 1), winMat);
            wL.position.set(-W / 2 + wallT / 2 - 0.05, H * 0.6, zOff);
            g.add(wL);
            const wR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 1), winMat);
            wR.position.set(W / 2 - wallT / 2 + 0.05, H * 0.6, zOff);
            g.add(wR);
            // Stained glass panes
            stainedColors.forEach((sc, si) => {
                const pMat = new THREE.MeshStandardMaterial({ color: sc, transparent: true, opacity: 0.5 });
                const pL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.25), pMat);
                pL.position.set(-W / 2 + wallT / 2 - 0.08, H * 0.6 - 0.4 + si * 0.4, zOff);
                g.add(pL);
                const pR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.25), pMat);
                pR.position.set(W / 2 - wallT / 2 + 0.08, H * 0.6 - 0.4 + si * 0.4, zOff);
                g.add(pR);
            });
        });

        // Banners at entrance
        [-3.5, 3.5].forEach(xOff => {
            const banner = new THREE.Mesh(new THREE.BoxGeometry(0.05, 4, 1.5), pinkMat);
            banner.position.set(xOff, 5, D / 2 + 0.5);
            g.add(banner);
            // Gold diamond on banner
            const diamond = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.8), goldMat);
            diamond.position.set(xOff, 5, D / 2 + 0.55);
            diamond.rotation.z = Math.PI / 4;
            g.add(diamond);
        });

        // Staircase to entrance (3 steps)
        [
            { w: 7, y: 0.15, z: D / 2 + 1.0 },
            { w: 6, y: 0.45, z: D / 2 + 2.0 },
            { w: 5, y: 0.75, z: D / 2 + 3.0 }
        ].forEach(s => {
            const step = new THREE.Mesh(new THREE.BoxGeometry(s.w, 0.3, 1.5), wallMatLow);
            step.position.set(0, s.y, s.z);
            step.receiveShadow = true;
            g.add(step);
        });

        // Fountain in front of castle (local coords, placed at front)
        const fntZ = D / 2 + 8;
        // Basin
        const basin = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 4), wallMatLow);
        basin.position.set(0, 0.2, fntZ);
        g.add(basin);
        // Water
        const fntWater = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.15, 3.6),
            new THREE.MeshStandardMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.6 }));
        fntWater.position.set(0, 0.38, fntZ);
        g.add(fntWater);
        // Central column
        const fntCol = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2, 0.4), wallMatMid);
        fntCol.position.set(0, 1.4, fntZ);
        g.add(fntCol);
        // 4 water streams (small blue rods)
        const streamMat = new THREE.MeshStandardMaterial({ color: 0x6ab4e8, transparent: true, opacity: 0.5 });
        [[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]].forEach(([dx, dz]) => {
            const stream = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), streamMat);
            stream.position.set(dx, 1.8, fntZ + dz);
            stream.rotation.z = dx !== 0 ? Math.sign(dx) * 0.6 : 0;
            stream.rotation.x = dz !== 0 ? -Math.sign(dz) * 0.6 : 0;
            g.add(stream);
        });

        // === INTERIOR ===
        // Red carpet
        const carpet = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 18), redMat);
        carpet.position.set(0, 0.1, -1);
        g.add(carpet);

        // 4 paired columns along carpet
        [-5, -1, 3, 7].forEach(zOff => {
            [-4, 4].forEach(xOff => {
                const col = new THREE.Mesh(new THREE.BoxGeometry(0.4, 10, 0.4), stoneGrey);
                col.position.set(xOff, 5, zOff);
                col.castShadow = true;
                g.add(col);
                // Gold capital
                const cap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.6), goldMat);
                cap.position.set(xOff, 10.15, zOff);
                g.add(cap);
            });
        });

        // Chandelier (center of hall)
        const chandelierY = 10;
        // Chain to ceiling
        const chain = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2, 0.08),
            new THREE.MeshStandardMaterial({ color: 0x444444 }));
        chain.position.set(0, chandelierY + 1, 0);
        g.add(chain);
        // Horizontal bar
        const bar = new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, 0.15),
            new THREE.MeshStandardMaterial({ color: 0x444444 }));
        bar.position.set(0, chandelierY, 0);
        g.add(bar);
        // 3 candles on bar
        const flameMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 0.5 });
        [-1, 0, 1].forEach(xOff => {
            const candle = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.15),
                new THREE.MeshStandardMaterial({ color: 0xfffff0 }));
            candle.position.set(xOff, chandelierY - 0.2, 0);
            g.add(candle);
            const flame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.1), flameMat);
            flame.position.set(xOff, chandelierY + 0.1, 0);
            g.add(flame);
        });

        // Throne step platform
        const throneZ = -D / 2 + 2;
        const throneStep = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 4), wallMatLow);
        throneStep.position.set(0, 0.15, throneZ);
        throneStep.receiveShadow = true;
        g.add(throneStep);

        // Throne (on step)
        const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 2), goldMat);
        seat.position.set(0, 0.65, throneZ);
        seat.castShadow = true;
        g.add(seat);
        const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 1.8), redMat);
        cushion.position.set(0, 1.0, throneZ);
        g.add(cushion);
        const throneBack = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 0.4), goldMat);
        throneBack.position.set(0, 2.3, throneZ - 1);
        throneBack.castShadow = true;
        g.add(throneBack);
        [-1.1, 1.1].forEach(xOff => {
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.5, 2), goldMat);
            arm.position.set(xOff, 1.3, throneZ);
            arm.castShadow = true;
            g.add(arm);
        });

        // Crown on throne back (3 gold prongs)
        [-0.3, 0, 0.3].forEach(xOff => {
            const prong = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.15), goldMat);
            prong.position.set(xOff, 4.0, throneZ - 1);
            g.add(prong);
        });

        // Wall tapestries with gold diamond ornament
        [-D / 4, 0, D / 4].forEach(zOff => {
            const tapL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3, 1.5), pinkMat);
            tapL.position.set(-W / 2 + wallT + 0.05, H * 0.45, zOff);
            g.add(tapL);
            // Gold diamond on tapestry
            const dL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.6), goldMat);
            dL.position.set(-W / 2 + wallT + 0.1, H * 0.45, zOff);
            dL.rotation.z = Math.PI / 4;
            g.add(dL);

            const tapR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3, 1.5),
                new THREE.MeshStandardMaterial({ color: 0xffd700 }));
            tapR.position.set(W / 2 - wallT - 0.05, H * 0.45, zOff);
            g.add(tapR);
            const dR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.6), pinkMat);
            dR.position.set(W / 2 - wallT - 0.1, H * 0.45, zOff);
            dR.rotation.z = Math.PI / 4;
            g.add(dR);
        });

        // Candelabras along carpet
        const candleMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
        [-4, -1, 2, 5].forEach(zOff => {
            [-2.5, 2.5].forEach(xOff => {
                const pole = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.5, 0.15), candleMat);
                pole.position.set(xOff, 1.25, zOff);
                g.add(pole);
                const flame2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), flameMat);
                flame2.position.set(xOff, 2.65, zOff);
                g.add(flame2);
            });
        });

        g.position.set(cx, 0, cz);
        GAME.scene.add(g);

        // Collisions — 4 walls
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(cx - W / 2, 0, cz - D / 2),
                new THREE.Vector3(cx + W / 2, H, cz - D / 2 + wallT)
            )
        });
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(cx - W / 2, 0, cz - D / 2),
                new THREE.Vector3(cx - W / 2 + wallT, H, cz + D / 2)
            )
        });
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(cx + W / 2 - wallT, 0, cz - D / 2),
                new THREE.Vector3(cx + W / 2, H, cz + D / 2)
            )
        });
        // Front left
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(cx - W / 2, 0, cz + D / 2 - wallT),
                new THREE.Vector3(cx - W / 2 + frontSideW, H, cz + D / 2)
            )
        });
        // Front right
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(cx + W / 2 - frontSideW, 0, cz + D / 2 - wallT),
                new THREE.Vector3(cx + W / 2, H, cz + D / 2)
            )
        });

        // Throne step + throne collision (raised by step)
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(cx - 1.2, 0, cz + throneZ - 1.5),
                new THREE.Vector3(cx + 1.2, 1.15, cz + throneZ + 1)
            )
        });

        // Castle roof collision
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(cx - (W + 1) / 2, H, cz - (D + 1) / 2),
                new THREE.Vector3(cx + (W + 1) / 2, H + 0.6, cz + (D + 1) / 2)
            )
        });

        // Store throne position for game logic (raised by step)
        this.thronePos = { x: cx, y: 1.15, z: cz + throneZ };
    },

    // === PHASE 3: Stable ===
    _createStable() {
        const sx = 30, sz = 35;
        const g = new THREE.Group();
        const W = 14, H = 5, D = 10;
        const wallT = 0.4;

        const woodMat = new THREE.MeshStandardMaterial({ color: 0xb08050 });
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xb44444, side: THREE.DoubleSide });

        // Floor
        const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.15, D),
            new THREE.MeshStandardMaterial({ color: 0x8a7d6b }));
        floor.position.y = 0.075;
        floor.receiveShadow = true;
        g.add(floor);

        // Back wall
        const bW = new THREE.Mesh(new THREE.BoxGeometry(W, H, wallT), woodMat);
        bW.position.set(0, H / 2, -D / 2 + wallT / 2);
        bW.castShadow = true;
        g.add(bW);

        // Left wall
        const lW = new THREE.Mesh(new THREE.BoxGeometry(wallT, H, D), woodMat);
        lW.position.set(-W / 2 + wallT / 2, H / 2, 0);
        lW.castShadow = true;
        g.add(lW);

        // Right wall
        const rW = new THREE.Mesh(new THREE.BoxGeometry(wallT, H, D), woodMat);
        rW.position.set(W / 2 - wallT / 2, H / 2, 0);
        rW.castShadow = true;
        g.add(rW);

        // Sloped roof (2 angled boxes)
        const roofL = new THREE.Mesh(new THREE.BoxGeometry(W + 1, 0.3, D / 2 + 1), roofMat);
        roofL.position.set(0, H + 0.8, -D / 4);
        roofL.rotation.x = 0.2;
        roofL.castShadow = true;
        g.add(roofL);
        const roofR = new THREE.Mesh(new THREE.BoxGeometry(W + 1, 0.3, D / 2 + 1), roofMat);
        roofR.position.set(0, H + 0.8, D / 4);
        roofR.rotation.x = -0.2;
        roofR.castShadow = true;
        g.add(roofR);

        // Water trough
        const troughMat = new THREE.MeshStandardMaterial({ color: 0x6699cc });
        const trough = new THREE.Mesh(new THREE.BoxGeometry(3, 0.6, 1), troughMat);
        trough.position.set(-4, 0.3, -3);
        g.add(trough);
        const water = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 0.8),
            new THREE.MeshStandardMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.7 }));
        water.position.set(-4, 0.55, -3);
        g.add(water);

        // Feed trough
        const feedTrough = new THREE.Mesh(new THREE.BoxGeometry(3, 0.6, 1),
            new THREE.MeshStandardMaterial({ color: 0xc48a5c }));
        feedTrough.position.set(4, 0.3, -3);
        g.add(feedTrough);
        const hay = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.3, 0.8),
            new THREE.MeshStandardMaterial({ color: 0xe8d44d }));
        hay.position.set(4, 0.65, -3);
        g.add(hay);

        // 3 beds along back wall
        [-4, 0, 4].forEach(xOff => {
            const bed = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.3, 1.5),
                new THREE.MeshStandardMaterial({ color: 0xffc0cb }));
            bed.position.set(xOff, 0.15, -D / 2 + 1.5);
            g.add(bed);
        });

        // Sign
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#b08050';
        ctx.fillRect(0, 0, 256, 64);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Конюшня', 128, 42);
        const signTex = new THREE.CanvasTexture(canvas);
        const signBoard = new THREE.Mesh(new THREE.BoxGeometry(3, 0.6, 0.3), woodMat);
        signBoard.position.set(0, H - 0.5, D / 2 + 0.2);
        g.add(signBoard);
        const signFace = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.6),
            new THREE.MeshBasicMaterial({ map: signTex }));
        signFace.position.set(0, H - 0.5, D / 2 + 0.36);
        g.add(signFace);

        g.position.set(sx, 0, sz);
        GAME.scene.add(g);

        // Collisions — 3 walls (open front)
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(sx - W / 2, 0, sz - D / 2),
                new THREE.Vector3(sx + W / 2, H, sz - D / 2 + wallT)
            )
        });
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(sx - W / 2, 0, sz - D / 2),
                new THREE.Vector3(sx - W / 2 + wallT, H, sz + D / 2)
            )
        });
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(sx + W / 2 - wallT, 0, sz - D / 2),
                new THREE.Vector3(sx + W / 2, H, sz + D / 2)
            )
        });
        // Stable roof collision
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(sx - (W + 1) / 2, H + 0.5, sz - (D / 2 + 1)),
                new THREE.Vector3(sx + (W + 1) / 2, H + 1.1, sz + (D / 2 + 1))
            )
        });
    },

    // === PHASE 3: Cat House ===
    _createCatHouse() {
        const chx = -20, chz = 25;
        const g = new THREE.Group();
        const W = 5, H = 3, D = 4;
        const wallT = 0.3;
        const doorW = 1.5, doorH = 2;

        const wallMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xff85a2, side: THREE.DoubleSide });

        // Back wall
        const bW = new THREE.Mesh(new THREE.BoxGeometry(W, H, wallT), wallMat);
        bW.position.set(0, H / 2, -D / 2 + wallT / 2);
        bW.castShadow = true;
        g.add(bW);

        // Left wall
        const lW = new THREE.Mesh(new THREE.BoxGeometry(wallT, H, D), wallMat);
        lW.position.set(-W / 2 + wallT / 2, H / 2, 0);
        lW.castShadow = true;
        g.add(lW);

        // Right wall
        const rW = new THREE.Mesh(new THREE.BoxGeometry(wallT, H, D), wallMat);
        rW.position.set(W / 2 - wallT / 2, H / 2, 0);
        rW.castShadow = true;
        g.add(rW);

        // Front wall with small door
        const fSideW = (W - doorW) / 2;
        const fL = new THREE.Mesh(new THREE.BoxGeometry(fSideW, H, wallT), wallMat);
        fL.position.set(-W / 2 + fSideW / 2, H / 2, D / 2 - wallT / 2);
        g.add(fL);
        const fR = new THREE.Mesh(new THREE.BoxGeometry(fSideW, H, wallT), wallMat);
        fR.position.set(W / 2 - fSideW / 2, H / 2, D / 2 - wallT / 2);
        g.add(fR);
        const fTop = new THREE.Mesh(new THREE.BoxGeometry(doorW, H - doorH, wallT), wallMat);
        fTop.position.set(0, doorH + (H - doorH) / 2, D / 2 - wallT / 2);
        g.add(fTop);

        // Roof
        const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.3, D + 0.5), roofMat);
        roof.position.y = H + 0.15;
        roof.castShadow = true;
        g.add(roof);

        // Milk bowl outside
        const bowl = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.8),
            new THREE.MeshStandardMaterial({ color: 0xdddddd }));
        bowl.position.set(1.5, 0.1, D / 2 + 0.8);
        g.add(bowl);
        const milk = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.7),
            new THREE.MeshStandardMaterial({ color: 0xfffff0 }));
        milk.position.set(1.5, 0.22, D / 2 + 0.8);
        g.add(milk);

        // Cushion inside
        const cushion = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 2),
            new THREE.MeshStandardMaterial({ color: 0xff85a2 }));
        cushion.position.set(0, 0.1, -0.5);
        g.add(cushion);

        g.position.set(chx, 0, chz);
        GAME.scene.add(g);

        // Collisions
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(chx - W / 2, 0, chz - D / 2),
                new THREE.Vector3(chx + W / 2, H, chz - D / 2 + wallT)
            )
        });
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(chx - W / 2, 0, chz - D / 2),
                new THREE.Vector3(chx - W / 2 + wallT, H, chz + D / 2)
            )
        });
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(chx + W / 2 - wallT, 0, chz - D / 2),
                new THREE.Vector3(chx + W / 2, H, chz + D / 2)
            )
        });
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(chx - W / 2, 0, chz + D / 2 - wallT),
                new THREE.Vector3(chx - W / 2 + fSideW, H, chz + D / 2)
            )
        });
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(chx + W / 2 - fSideW, 0, chz + D / 2 - wallT),
                new THREE.Vector3(chx + W / 2, H, chz + D / 2)
            )
        });
        // Cat house roof collision
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(chx - (W + 0.5) / 2, H, chz - (D + 0.5) / 2),
                new THREE.Vector3(chx + (W + 0.5) / 2, H + 0.3, chz + (D + 0.5) / 2)
            )
        });
    },

    // === PHASE 3: Hamster House ===
    _createHamsterHouse() {
        const hx = -70, hz = -65;
        const g = new THREE.Group();
        const W = 6, H = 3, D = 5;
        const wallT = 0.3;
        const doorW = 1.2, doorH = 1.5;

        const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8d44d });
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x6daa50, side: THREE.DoubleSide });

        // Back wall
        const bW = new THREE.Mesh(new THREE.BoxGeometry(W, H, wallT), wallMat);
        bW.position.set(0, H / 2, -D / 2 + wallT / 2);
        bW.castShadow = true;
        g.add(bW);

        // Left wall
        const lW = new THREE.Mesh(new THREE.BoxGeometry(wallT, H, D), wallMat);
        lW.position.set(-W / 2 + wallT / 2, H / 2, 0);
        lW.castShadow = true;
        g.add(lW);

        // Right wall
        const rW = new THREE.Mesh(new THREE.BoxGeometry(wallT, H, D), wallMat);
        rW.position.set(W / 2 - wallT / 2, H / 2, 0);
        rW.castShadow = true;
        g.add(rW);

        // Front wall with tiny door
        const fSideW = (W - doorW) / 2;
        const fL = new THREE.Mesh(new THREE.BoxGeometry(fSideW, H, wallT), wallMat);
        fL.position.set(-W / 2 + fSideW / 2, H / 2, D / 2 - wallT / 2);
        g.add(fL);
        const fR = new THREE.Mesh(new THREE.BoxGeometry(fSideW, H, wallT), wallMat);
        fR.position.set(W / 2 - fSideW / 2, H / 2, D / 2 - wallT / 2);
        g.add(fR);
        const fTop = new THREE.Mesh(new THREE.BoxGeometry(doorW, H - doorH, wallT), wallMat);
        fTop.position.set(0, doorH + (H - doorH) / 2, D / 2 - wallT / 2);
        g.add(fTop);

        // Roof
        const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.3, D + 0.5), roofMat);
        roof.position.y = H + 0.15;
        roof.castShadow = true;
        g.add(roof);

        // Decorative wheel inside
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0xc48a5c });
        // Stand
        const wheelStand = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.0, 0.15), wheelMat);
        wheelStand.position.set(-1.5, 0.5, -1);
        g.add(wheelStand);
        // Wheel ring (made of 4 small boxes in a square)
        [
            [0, 0.5, 0], [0.5, 0, 0], [0, -0.5, 0], [-0.5, 0, 0]
        ].forEach(([dx, dy]) => {
            const part = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.3), wheelMat);
            part.position.set(-1.5 + dx * 0.6, 1.2 + dy * 0.6, -1);
            part.rotation.z = Math.atan2(dy, dx);
            g.add(part);
        });

        // Small feeder
        const feeder = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 0.6),
            new THREE.MeshStandardMaterial({ color: 0xc48a5c }));
        feeder.position.set(1.5, 0.15, -1);
        g.add(feeder);

        // Outside: small pen fence
        const penMat = new THREE.MeshStandardMaterial({ color: 0xd4a574 });
        const penS = 4;
        [
            [0, penS / 2, penS, 0.1],
            [0, -penS / 2, penS, 0.1],
            [penS / 2, 0, 0.1, penS],
            [-penS / 2, 0, 0.1, penS]
        ].forEach(([dx, dz, w, d]) => {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, d), penMat);
            rail.position.set(dx, 0.3, D / 2 + 2 + dz);
            g.add(rail);
        });

        // Sign
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#e8d44d';
        ctx.fillRect(0, 0, 256, 64);
        ctx.fillStyle = '#6b3a2a';
        ctx.font = 'bold 26px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Хомячки', 128, 42);
        const signTex = new THREE.CanvasTexture(canvas);
        const signBoard = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.5, 0.2), wallMat);
        signBoard.position.set(0, H - 0.3, D / 2 + 0.15);
        g.add(signBoard);
        const signFace = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.5),
            new THREE.MeshBasicMaterial({ map: signTex }));
        signFace.position.set(0, H - 0.3, D / 2 + 0.26);
        g.add(signFace);

        g.position.set(hx, 0, hz);
        GAME.scene.add(g);

        // Collisions
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(hx - W / 2, 0, hz - D / 2),
                new THREE.Vector3(hx + W / 2, H, hz - D / 2 + wallT)
            )
        });
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(hx - W / 2, 0, hz - D / 2),
                new THREE.Vector3(hx - W / 2 + wallT, H, hz + D / 2)
            )
        });
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(hx + W / 2 - wallT, 0, hz - D / 2),
                new THREE.Vector3(hx + W / 2, H, hz + D / 2)
            )
        });
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(hx - W / 2, 0, hz + D / 2 - wallT),
                new THREE.Vector3(hx - W / 2 + fSideW, H, hz + D / 2)
            )
        });
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(hx + W / 2 - fSideW, 0, hz + D / 2 - wallT),
                new THREE.Vector3(hx + W / 2, H, hz + D / 2)
            )
        });
        // Hamster house roof collision
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(hx - (W + 0.5) / 2, H, hz - (D + 0.5) / 2),
                new THREE.Vector3(hx + (W + 0.5) / 2, H + 0.3, hz + (D + 0.5) / 2)
            )
        });
    },

    // === Terrain Variety ===
    _createTerrainVariety() {
        const grassMat = new THREE.MeshStandardMaterial({ color: 0x5a9a40 });
        const grassMat2 = new THREE.MeshStandardMaterial({ color: 0x6daa50 });
        const slopeMat = new THREE.MeshStandardMaterial({ color: 0x4a8a35 });
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a7a8a });
        const rockMat2 = new THREE.MeshStandardMaterial({ color: 0x8a8a9a });
        const flowerColors = [0xff69b4, 0xffd700, 0xff85a2];

        // 1. Earth platforms (plateaus)
        const platforms = [
            { x: 50, z: 45, w: 20, d: 18, h: 1.5 },
            { x: -55, z: 40, w: 15, d: 12, h: 1.0 },
            { x: 0, z: -50, w: 18, d: 14, h: 2.0 }
        ];
        platforms.forEach(p => {
            // Main top
            const top = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), grassMat);
            top.position.set(p.x, p.h / 2, p.z);
            top.receiveShadow = true;
            top.castShadow = true;
            GAME.scene.add(top);

            // Slopes on 4 sides
            [
                { dx: p.w / 2 + 1, dz: 0, sw: 2, sd: p.d },
                { dx: -p.w / 2 - 1, dz: 0, sw: 2, sd: p.d },
                { dx: 0, dz: p.d / 2 + 1, sw: p.w, sd: 2 },
                { dx: 0, dz: -p.d / 2 - 1, sw: p.w, sd: 2 }
            ].forEach(s => {
                const slope = new THREE.Mesh(new THREE.BoxGeometry(s.sw, p.h * 0.6, s.sd), slopeMat);
                slope.position.set(p.x + s.dx, p.h * 0.3, p.z + s.dz);
                slope.receiveShadow = true;
                GAME.scene.add(slope);
            });

            // Collision for main platform
            this.collidables.push({
                box: new THREE.Box3(
                    new THREE.Vector3(p.x - p.w / 2, 0, p.z - p.d / 2),
                    new THREE.Vector3(p.x + p.w / 2, p.h, p.z + p.d / 2)
                )
            });

            // Flowers on platform
            for (let i = 0; i < 3; i++) {
                const fg = new THREE.Group();
                const stem = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08),
                    new THREE.MeshStandardMaterial({ color: 0x7dba5c }));
                stem.position.y = 0.15;
                fg.add(stem);
                const petal = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25),
                    new THREE.MeshStandardMaterial({ color: flowerColors[i] }));
                petal.position.y = 0.35;
                fg.add(petal);
                fg.position.set(
                    p.x + (Math.random() - 0.5) * (p.w - 2),
                    p.h,
                    p.z + (Math.random() - 0.5) * (p.d - 2)
                );
                GAME.scene.add(fg);
            }
        });

        // 2. Stone ridge from (20,-20) to (50,-30)
        const ridgeSegments = 8;
        for (let i = 0; i < ridgeSegments; i++) {
            const frac = i / (ridgeSegments - 1);
            const rx = 20 + frac * 30;
            const rz = -20 + frac * (-10);
            const segCount = 3 + Math.floor(Math.random() * 2);
            for (let j = 0; j < segCount; j++) {
                const sw = 2 + Math.random();
                const sh = 0.5 + Math.random();
                const sd = 1.5 + Math.random();
                const rock = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sd),
                    j % 2 === 0 ? rockMat : rockMat2);
                rock.position.set(
                    rx + (Math.random() - 0.5) * 2,
                    sh / 2 + j * 0.2,
                    rz + (Math.random() - 0.5) * 2
                );
                rock.rotation.y = Math.random() * 0.5;
                rock.castShadow = true;
                GAME.scene.add(rock);
            }
        }
        // One long collision for ridge
        this.collidables.push({
            box: new THREE.Box3(
                new THREE.Vector3(18, 0, -33),
                new THREE.Vector3(52, 2, -17)
            )
        });

        // 3. Foothills near each mountain
        const mountains = [
            { x: 60, z: -60, base: 8 },
            { x: -45, z: -40, base: 9 },
            { x: -80, z: 60, base: 7 },
            { x: -80, z: -20, base: 8 }
        ];
        mountains.forEach(m => {
            // 2 foothills per mountain
            [1, -1].forEach(side => {
                const fhx = m.x + side * (m.base * 0.8);
                const fhz = m.z + side * (m.base * 0.5);
                const fhSize = m.base * 0.6;
                const fhH = 1;
                const foothill = new THREE.Mesh(new THREE.BoxGeometry(fhSize, fhH, fhSize), grassMat2);
                foothill.position.set(fhx, fhH / 2, fhz);
                foothill.receiveShadow = true;
                foothill.castShadow = true;
                GAME.scene.add(foothill);
                this.collidables.push({
                    box: new THREE.Box3(
                        new THREE.Vector3(fhx - fhSize / 2, 0, fhz - fhSize / 2),
                        new THREE.Vector3(fhx + fhSize / 2, fhH, fhz + fhSize / 2)
                    )
                });
            });
        });

        // 4. Visual ravine
        const ravine = new THREE.Mesh(new THREE.BoxGeometry(20, 0.05, 4),
            new THREE.MeshStandardMaterial({ color: 0x3a6a30 }));
        ravine.position.set(-20, 0.02, -10);
        ravine.receiveShadow = true;
        GAME.scene.add(ravine);
        // Rocks along ravine edges
        for (let i = 0; i < 6; i++) {
            const side = i % 2 === 0 ? 1 : -1;
            const rock = new THREE.Mesh(new THREE.BoxGeometry(0.8 + Math.random() * 0.5, 0.3 + Math.random() * 0.3, 0.6),
                rockMat);
            rock.position.set(-28 + i * 3.5, 0.2, -10 + side * 2.2);
            rock.castShadow = true;
            GAME.scene.add(rock);
        }
    },

    update(dt) {
        this.clouds.forEach(c => {
            c.position.x += c.userData.speed * dt;
            if (c.position.x > 130) c.position.x = -130;
        });
    }
};

World.init();
