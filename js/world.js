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
        flat(0, 72, 34);      // dogi4 castle mountain — panoramic landmark
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

        // ── Pixel textures (neutral white — colour via instanceColor) ─
        // We use white textures and tint each block via setColorAt()
        // so every block gets unique biome colour without grid uniformity

        const tGT = this._pixTex(16, (x, y) => {
            // Grass top: pixel noise pattern, neutral so tint works cleanly
            const v = Math.sin(x*3.7+y*2.3)*0.06 + Math.cos(x*1.9-y*4.1)*0.04 + 0.92;
            const c = Math.round(255*v);
            return `rgb(${c},${c},${c})`;
        });
        const tGS = this._pixTex(16, (x, y) => {
            // Grass side: top 3px lighter (grass), rest neutral dirt-ish
            if (y < 3) { const v=Math.sin(x*4.1)*0.05+0.95; const c=Math.round(255*v); return `rgb(${c},${c},${c})`; }
            const v = Math.sin(x*2.9+y*1.3)*0.06 + 0.82;
            return `rgb(${Math.round(255*v)},${Math.round(215*v)},${Math.round(175*v)})`;
        });
        const tDirt = this._pixTex(16, (x, y) => {
            const v = Math.sin(x*3.1+y*2.7)*0.06 + 0.85;
            return `rgb(${Math.round(255*v)},${Math.round(210*v)},${Math.round(165*v)})`;
        });
        const tStone = this._pixTex(16, (x, y) => {
            const v = Math.sin(x*4.3+y*3.7)*0.07 + Math.cos(x*2.1-y*5.3)*0.05 + 0.88;
            const c = Math.round(255*v); return `rgb(${c},${c},${c})`;
        });
        [tGT, tGS, tDirt, tStone].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });

        this._texGrassTop  = tGT;
        this._texGrassSide = tGS;
        this._texDirt      = tDirt;
        this._texStone     = tStone;

        // ── Base floor — biome-varied texture ───────────────────────
        const tFloor = this._pixTex(128, (x, y) => {
            const nx=x/128, ny=y/128;
            const b = Math.sin(nx*9.1+ny*6.3+1.2)*0.35 + Math.cos(nx*5.7-ny*8.9)*0.30
                    + Math.sin((nx+ny)*12)*0.12 + 0.52;
            // dirt patches
            if (Math.sin(nx*23+ny*17)*Math.cos(nx*11-ny*19) > 0.6) {
                const v=0.78+Math.random()*0.08;
                return `rgb(${Math.round(155*v)},${Math.round(110*v)},${Math.round(70*v)})`;
            }
            if (b < 0.22) { // dry savanna
                const v=0.85+Math.random()*0.1;
                return `rgb(${Math.round(175*v)},${Math.round(195*v)},${Math.round(75*v)})`;
            } else if (b < 0.48) { // standard plains
                const v=0.82+Math.random()*0.12;
                return `rgb(${Math.round(88*v)},${Math.round(148*v)},${Math.round(48*v)})`;
            } else if (b < 0.72) { // lush green
                const v=0.80+Math.random()*0.12;
                return `rgb(${Math.round(68*v)},${Math.round(138*v)},${Math.round(42*v)})`;
            } else { // dark forest
                const v=0.78+Math.random()*0.1;
                return `rgb(${Math.round(52*v)},${Math.round(110*v)},${Math.round(32*v)})`;
            }
        });
        tFloor.wrapS = tFloor.wrapT = THREE.RepeatWrapping;
        tFloor.repeat.set(14, 14);
        tFloor.magFilter = tFloor.minFilter = THREE.NearestFilter;

        const floorM = new THREE.MeshStandardMaterial({ map: tFloor });
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(GRID*CELL + 80, GRID*CELL + 80), floorM
        );
        floor.rotation.x = -Math.PI/2;
        floor.position.y = -0.02;
        floor.receiveShadow = true;
        GAME.scene.add(floor);
        GAME.ground = floor;

        // ── Biome colour — VIVID Minecraft palette ───────────────────
        // Compensate for neutral grey tex (×0.9) → multiply up accordingly
        // MC Plains grass: #5C9A2C, Lush: #4E8B22, Savanna: #8DB360
        const biomeCol = (gx, gz, h) => {
            const nx = gx / GRID, nz = gz / GRID;
            const bn = Math.sin(nx*4.7+nz*3.2+1.1)*0.38
                     + Math.cos(nx*2.3-nz*5.1)*0.32
                     + Math.sin((nx+nz)*7.8)*0.15;
            const t = (bn + 0.85) / 1.70; // 0..1

            // Height overrides (bright grey stone, not dark)
            if (h >= 7) return new THREE.Color(0xB0B0B8);   // light MC stone
            if (h >= 5) return new THREE.Color(0x7A9060);   // mountain green-grey

            // Cherry blossom zone — grid cells near (-30, -30)
            const wx2 = (-HALF + gx*CELL), wz2 = (-HALF + gz*CELL);
            if (Math.sqrt((wx2+30)**2+(wz2+30)**2) < 28) {
                return new THREE.Color(0xF4A8C8); // pink cherry blossom
            }

            // Per-block micro-variation (±6%) for natural look
            const jitter = 1 + Math.sin(gx*31.7+gz*17.3)*0.06;

            // VIVID MC-style colours (pre-compensated for grey tex multiply)
            let r, g, b;
            if (t < 0.18) {
                r=0.56; g=0.71; b=0.22; // savanna #8EB538 (MC savanna)
            } else if (t < 0.40) {
                r=0.42; g=0.72; b=0.22; // plains #6BB838 (MC plains bright)
            } else if (t < 0.64) {
                r=0.32; g=0.64; b=0.18; // lush forest #52A42E (MC forest)
            } else {
                r=0.22; g=0.50; b=0.14; // dark forest #388023
            }

            return new THREE.Color(r*jitter, g*jitter, b*jitter);
        };

        // ── Terrain block columns via InstancedMesh ─────────────────
        const cnt = new Array(MAX_H + 1).fill(0);
        for (let gx = 0; gx < GRID; gx++) for (let gz = 0; gz < GRID; gz++) cnt[hmap[gx][gz]]++;

        const dummy = new THREE.Object3D();
        const tmpCol = new THREE.Color();

        for (let h = 1; h <= MAX_H; h++) {
            if (!cnt[h]) continue;
            const hW = h * BSIZE;

            const useStone = h >= 6;
            const topTex   = useStone ? tStone : tGT;
            const sideTex  = (useStone ? tStone : tGS).clone();
            sideTex.wrapT  = THREE.RepeatWrapping;
            sideTex.repeat.set(1, h);
            sideTex.needsUpdate = true;

            const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, vertexColors: false });
            const topMat  = new THREE.MeshStandardMaterial({ map: topTex,  vertexColors: false });
            const botMat  = new THREE.MeshStandardMaterial({ map: tDirt,   vertexColors: false });
            const mats = [sideMat, sideMat, topMat, botMat, sideMat, sideMat];

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
                im.setMatrixAt(idx, dummy.matrix);
                // Per-block biome colour
                im.setColorAt(idx, biomeCol(gx, gz, h));
                idx++;
            }
            im.instanceMatrix.needsUpdate = true;
            if (im.instanceColor) im.instanceColor.needsUpdate = true;
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
            const cut = (x*7 + y*11 + Math.floor(Math.sin(x*1.7+y*2.1)*9)) % 17;
            if (cut < 3) return 'rgba(0,0,0,0)';
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
        // П4 — окружение
        this._addSandAndReeds();
        this._addSnowAndStone();
        this._addWaterfall();
        this._addGlowingMushrooms();
        this._addMCGrass();
    },

    _createTrees() {
        // ── 4 Minecraft tree types ──────────────────────────────────
        // OAK: medium, round green crown
        // BIRCH: tall thin, white trunk, small yellow-green leaves
        // SPRUCE: tall conical, dark green layers (like MC spruce/pine)
        // JUNGLE: very tall, thick trunk, dense bright leaves

        const B = 1.0; // 1 block

        // Shared textures
        const oakLogTex   = this._mkOakLog();
        const oakLeafTex  = this._mkOakLeaves();
        oakLogTex.wrapS   = oakLogTex.wrapT = THREE.RepeatWrapping;
        oakLeafTex.wrapS  = oakLeafTex.wrapT = THREE.RepeatWrapping;

        const mOakLog   = new THREE.MeshStandardMaterial({ map: oakLogTex });
        const mOakLeaf  = new THREE.MeshStandardMaterial({
            map: oakLeafTex,
            transparent: true,
            alphaTest: 0.35,
            side: THREE.DoubleSide,
            roughness: 0.85
        });

        // Birch trunk — white/light grey bark
        const mBirchLog = new THREE.MeshStandardMaterial({ color: 0xD8D0B8 });
        // Birch leaves — lighter yellow-green
        const mBirchLeaf = new THREE.MeshStandardMaterial({ color: 0x7DB84A });

        // Spruce — dark trunk, very dark needle-green
        const mSpruceLog  = new THREE.MeshStandardMaterial({ color: 0x5a3a1a });
        const mSpruceLeaf = new THREE.MeshStandardMaterial({ color: 0x2B5A1A });

        // Jungle — thick trunk, bright tropical green
        const mJungleLog  = new THREE.MeshStandardMaterial({ color: 0x6B4A20 });
        const mJungleLeaf = new THREE.MeshStandardMaterial({ color: 0x2E8B2E });

        // Cherry blossom — MC 1.20 style pink
        const mCherryLog  = new THREE.MeshStandardMaterial({ color: 0x8B4565 });
        const mCherryLeaf = new THREE.MeshStandardMaterial({
            color: 0xF4A8C8, emissive: 0x3A0A18, emissiveIntensity: 0.08
        });

        // Tree position list: [x, z, type, trunkH]
        // type: 0=oak, 1=birch, 2=spruce, 3=jungle, 4=cherry
        const trees = [
            [-15,-12, 0,4], [18,8,   1,6], [-8,20,  2,8], [12,-18, 0,4],
            [-20,5,   2,9], [5,-22,  1,5], [22,22,  0,5], [-18,-22,3,7],
            [55,40,   0,6], [-60,45, 2,8], [70,-30, 1,6], [-50,-55,0,5],
            [45,-65,  2,9], [-70,35, 0,6], [55,20,  1,5], [-55,-30,3,8],
            [-30,-15, 1,6], [25,-30, 2,8], [-10,-35,0,5], [35,15,  3,7],
            [-40,10,  0,6], [50,-20, 1,5], [-65,-15,2,9], [40,50,  3,8],
            [65,-50,  0,6], [-55,50, 1,6], [15,45,  2,7], [-35,-60,0,5],
            [60,40,   2,8], [-45,25, 0,5], [30,-45, 3,7], [-20,-45,1,5],
            [-50,-25, 3,9], [55,25,  2,8], [-30,45, 0,6], [50,-45, 2,9],
            [-75,-35, 1,6], [60,-15, 0,5], [-60,55, 3,8], [50,60,  2,7],
            [-40,-55, 0,6], [45,55,  1,5], [-70,0,  3,9], [55,-40, 2,8],
            // Cherry blossom grove near (-30,-30)
            [-28,-28, 4,4], [-32,-24, 4,5], [-26,-34, 4,4], [-36,-30, 4,5],
            [-22,-28, 4,4], [-30,-36, 4,6], [-34,-22, 4,4], [-24,-32, 4,5],
            [-38,-26, 4,4], [-26,-22, 4,5]
        ];

        const makeOak = (g, trunkH, logM, leafM) => {
            const trunk = new THREE.Mesh(new THREE.BoxGeometry(B, trunkH, B), logM);
            trunk.position.y = trunkH/2; trunk.castShadow = true; g.add(trunk);
            // 2 wide layers (5×5) + 1 narrow top (3×3)
            [0, B].forEach(ly => {
                const l = new THREE.Mesh(new THREE.BoxGeometry(5*B, B, 5*B), leafM);
                l.position.y = trunkH + ly + B/2; l.castShadow = true; g.add(l);
            });
            const top = new THREE.Mesh(new THREE.BoxGeometry(3*B, 1.5*B, 3*B), leafM);
            top.position.y = trunkH + 2*B + 0.75*B; top.castShadow = true; g.add(top);
            return 5*B;
        };

        const makeBirch = (g, trunkH, logM, leafM) => {
            const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.6*B, trunkH, 0.6*B), logM);
            trunk.position.y = trunkH/2; trunk.castShadow = true; g.add(trunk);
            // Small crown: 3×3 bottom, 3×3 mid, 1×1.5 top
            const l1 = new THREE.Mesh(new THREE.BoxGeometry(3*B, B, 3*B), leafM);
            l1.position.y = trunkH + B/2; l1.castShadow = true; g.add(l1);
            const l2 = new THREE.Mesh(new THREE.BoxGeometry(2*B, B, 2*B), leafM);
            l2.position.y = trunkH + 1.5*B; l2.castShadow = true; g.add(l2);
            const top = new THREE.Mesh(new THREE.BoxGeometry(B, B, B), leafM);
            top.position.y = trunkH + 2.5*B; top.castShadow = true; g.add(top);
            return 3*B;
        };

        const makeSpruce = (g, trunkH, logM, leafM) => {
            const trunk = new THREE.Mesh(new THREE.BoxGeometry(B, trunkH, B), logM);
            trunk.position.y = trunkH/2; trunk.castShadow = true; g.add(trunk);
            // Conical layers: wide at bottom, narrow at top (MC spruce)
            const layers = [5, 5, 4, 3, 3, 2, 2, 1];
            layers.forEach((w, i) => {
                if (i * B >= trunkH - B) return; // only above trunk
                const ly = i > 0 ? i : 0;
                const l = new THREE.Mesh(new THREE.BoxGeometry(w*B, B, w*B), leafM);
                l.position.y = trunkH - 1 + ly*B + B/2;
                l.castShadow = true; g.add(l);
            });
            return 5*B;
        };

        const makeJungle = (g, trunkH, logM, leafM) => {
            // Thick trunk (2×2 blocks)
            const trunk = new THREE.Mesh(new THREE.BoxGeometry(2*B, trunkH, 2*B), logM);
            trunk.position.y = trunkH/2; trunk.castShadow = true; g.add(trunk);
            // Large dense crown
            const l1 = new THREE.Mesh(new THREE.BoxGeometry(6*B, 1.5*B, 6*B), leafM);
            l1.position.y = trunkH + 0.75*B; l1.castShadow = true; g.add(l1);
            const l2 = new THREE.Mesh(new THREE.BoxGeometry(5*B, B, 5*B), leafM);
            l2.position.y = trunkH + 2*B; l2.castShadow = true; g.add(l2);
            const top = new THREE.Mesh(new THREE.BoxGeometry(3*B, 1.5*B, 3*B), leafM);
            top.position.y = trunkH + 3.5*B; top.castShadow = true; g.add(top);
            return 6*B;
        };

        trees.forEach(([x, z, type, trunkH]) => {
            const groundY = this.getTerrainY(x, z);
            const g = new THREE.Group();
            let crownW;

            if      (type === 0) crownW = makeOak   (g, trunkH, mOakLog,   mOakLeaf);
            else if (type === 1) crownW = makeBirch (g, trunkH, mBirchLog, mBirchLeaf);
            else if (type === 2) crownW = makeSpruce(g, trunkH, mSpruceLog,mSpruceLeaf);
            else if (type === 3) crownW = makeJungle(g, trunkH, mJungleLog,mJungleLeaf);
            else {
                // Cherry blossom: round crown like oak but PINK
                crownW = makeOak(g, trunkH, mCherryLog, mCherryLeaf);
            }

            g.position.set(x, groundY, z);
            GAME.scene.add(g);

            const trunkW = type === 3 ? B : B/2;
            this.collidables.push({ box: new THREE.Box3(
                new THREE.Vector3(x-trunkW, groundY, z-trunkW),
                new THREE.Vector3(x+trunkW, groundY+trunkH, z+trunkW)
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
        // Main lake — shader-like MC water with shallow stepped edges.
        const waterMat = new THREE.MeshPhysicalMaterial({
            color: 0x46BCE8,
            transparent: true, opacity: 0.68,
            roughness: 0.04, metalness: 0.05,
            transmission: 0.15, thickness: 0.25,
            emissive: 0x135C8A, emissiveIntensity: 0.10,
            depthWrite: false
        });
        const shallowMat = waterMat.clone();
        shallowMat.color = new THREE.Color(0x77D7FF);
        shallowMat.opacity = 0.45;
        const sandMat = new THREE.MeshStandardMaterial({ color: 0xD8C588, roughness: 0.85 });
        const reedMat = new THREE.MeshStandardMaterial({ color: 0x5F9B35 });

        const lake = new THREE.Mesh(new THREE.BoxGeometry(16, 0.3, 16), waterMat);
        lake.position.set(10, 0.05, 10);
        lake.receiveShadow = true;
        GAME.scene.add(lake);

        this.waterZones.push({ cx: 10, cz: 10, halfW: 8, halfD: 8 });

        // Blocky shallow shelf and sandy banks like shader screenshots.
        [
            [10, 0, 18, 3], [10, 20, 16, 3], [0, 10, 3, 16], [20, 10, 3, 16],
            [2, 2, 5, 5], [18, 18, 5, 5], [2, 18, 4, 4], [18, 2, 4, 4],
        ].forEach(([x,z,w,d], i) => {
            const shelf = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), i % 2 ? shallowMat : sandMat);
            shelf.position.set(x, i % 2 ? 0.18 : 0.02, z);
            shelf.receiveShadow = true;
            GAME.scene.add(shelf);
        });

        // Small river from the castle waterfall splash pool into the lake.
        for (let i = 0; i < 9; i++) {
            const t = i / 8;
            const x = 10 * (1 - t) + 0 * t + Math.sin(i * 1.1) * 0.45;
            const z = 18 * (1 - t) + 56.5 * t;
            const w = 4.5 + Math.sin(i * 0.8) * 0.8;
            const seg = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, 2.2), waterMat);
            seg.position.set(x, 0.12, z);
            seg.receiveShadow = true;
            GAME.scene.add(seg);
            this.waterZones.push({ cx: x, cz: z, halfW: w/2, halfD: 1.1 });

            [-1, 1].forEach(side => {
                const bank = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 2.4), sandMat);
                bank.position.set(x + side * (w/2 + 0.55), 0.03, z);
                bank.receiveShadow = true;
                GAME.scene.add(bank);
            });
        }

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

        // Reeds on the near bank.
        for (let i = 0; i < 24; i++) {
            const x = 1 + Math.random() * 18;
            const z = 1 + Math.random() * 22;
            if (Math.abs(x-10) < 6 && Math.abs(z-10) < 6) continue;
            const h = 0.9 + Math.random() * 0.9;
            const reed = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, 0.16), reedMat);
            reed.position.set(x, h/2 + 0.08, z);
            GAME.scene.add(reed);
        }

        // Second pond near hill
        const pond = new THREE.Mesh(
            new THREE.BoxGeometry(10, 0.3, 10),
            waterMat
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
            const main = new THREE.Mesh(new THREE.BoxGeometry(W, 1.5, D), mat);
            main.position.set(0, 0, 0);
            g.add(main);
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
                46 + Math.random() * 14,
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
        // Minecraft-style blocky mountains: bright grey stone + white snow cap
        // Stone tiers: base=dark grey, mid=medium grey, top=light grey, snow=white
        const mountains = [
            // Big dramatic peaks with snow
            { x: -36, z:  42, height: 28, base: 17 }, // visible left skyline from spawn
            { x:  38, z:  46, height: 26, base: 16 }, // visible right skyline from spawn
            { x: -55, z: -50, height: 22, base: 13 }, // back range
            { x:  65, z: -55, height: 20, base: 12 },
            { x: -70, z:  55, height: 22, base: 13 },
            { x:  55, z:  65, height: 20, base: 12 },
            { x: -80, z: -15, height: 19, base: 12 },
            { x:  70, z: -20, height: 15, base:  9 },
            // Medium peaks
            { x: -40, z:  60, height: 13, base:  8 },
            { x:  60, z:  40, height: 12, base:  8 },
            { x: -55, z:  20, height: 14, base:  9 },
            { x:  50, z: -70, height: 16, base: 10 },
        ];

        mountains.forEach(m => {
            const g = new THREE.Group();
            const LEVELS = 8;
            const layerH = m.height / LEVELS;

            for (let i = 0; i < LEVELS; i++) {
                const frac = i / LEVELS;
                const size = m.base * (1 - frac * 0.72);

                // Colour: base=dark grey, upper=lighter, top=bright light grey, snow zone=white
                let col;
                if (frac > 0.72) col = 0xEEEEF4;          // bright snow grey
                else if (frac > 0.55) col = 0xB8B8C8;     // light stone
                else if (frac > 0.30) col = 0x909098;     // medium stone (MC stone)
                else col = 0x727278;                       // dark base stone

                const mat = new THREE.MeshStandardMaterial({ color: col });

                // Each layer: slightly offset for jagged look
                const jx = (Math.sin(i*2.3+m.x)*0.25);
                const jz = (Math.cos(i*1.7+m.z)*0.25);

                const block = new THREE.Mesh(new THREE.BoxGeometry(size, layerH+0.1, size), mat);
                block.position.set(jx, i*layerH + layerH/2, jz);
                block.castShadow = true; block.receiveShadow = true;
                g.add(block);
            }

            // Snow cap (extra white block on peak)
            const capMat = new THREE.MeshStandardMaterial({ color: 0xF5F5FF });
            const cap = new THREE.Mesh(new THREE.BoxGeometry(m.base*0.22, layerH, m.base*0.22), capMat);
            cap.position.y = LEVELS*layerH + layerH/2;
            cap.castShadow = true; g.add(cap);

            // Side snow shelves, like the reference panoramas where snow spills down ridges.
            [
                [ 0.35, 0.68, 0.55, 0.26],
                [-0.42, 0.61, 0.45, 0.22],
                [ 0.12, 0.78,-0.48, 0.20],
            ].forEach(([ox, yf, oz, scale]) => {
                const snow = new THREE.Mesh(
                    new THREE.BoxGeometry(m.base*scale, layerH*0.45, m.base*scale),
                    capMat
                );
                snow.position.set(ox*m.base, yf*m.height, oz*m.base);
                snow.castShadow = true; snow.receiveShadow = true;
                g.add(snow);
            });

            // Exposed stone cliff faces on sides (darker blocks jutting out)
            for (let ci = 0; ci < 4; ci++) {
                const a = (ci/4)*Math.PI*2;
                const cr = m.base*0.3 + Math.random()*m.base*0.15;
                const ch = m.height*0.2 + Math.random()*m.height*0.3;
                const cliffMat = new THREE.MeshStandardMaterial({ color: 0x606068 });
                const cliff = new THREE.Mesh(
                    new THREE.BoxGeometry(cr*0.6, ch, cr*0.6), cliffMat
                );
                cliff.position.set(Math.cos(a)*m.base*0.45, ch/2, Math.sin(a)*m.base*0.45);
                cliff.castShadow = true; g.add(cliff);
            }

            g.position.set(m.x, 0, m.z);
            GAME.scene.add(g);

            // Collisions
            for (let i = 0; i < LEVELS; i++) {
                const size = m.base * (1 - (i/LEVELS) * 0.72);
                const hs = size/2;
                this.collidables.push({ box: new THREE.Box3(
                    new THREE.Vector3(m.x-hs, i*layerH, m.z-hs),
                    new THREE.Vector3(m.x+hs, (i+1)*layerH, m.z+hs)
                )});
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
            // From house/lake meadow toward dogi4 castle mountain
            { points: [[-20, 24], [-12, 32], [-5, 42], [0, 52], [0, 62]] },
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

    // === PHASE 3: Castle on dramatic cliff ===
    _createCastle() {
        // Castle sits on a tall stone cliff directly ahead of spawn.
        // It is close enough to read from spawn, but far enough to feel like a panorama.
        const cx = 0, cz = 72;
        const CLIFF_H = 26; // tall enough to read above trees and fog

        // ── Stone cliff / spire ─────────────────────────────────────
        const s1 = new THREE.MeshStandardMaterial({ color: 0x6F6F77 }); // dark stone base
        const s2 = new THREE.MeshStandardMaterial({ color: 0x92929C }); // medium stone
        const s3 = new THREE.MeshStandardMaterial({ color: 0xB8B8C2 }); // light stone top
        const moss = new THREE.MeshStandardMaterial({ color: 0x4F7F2A }); // grassy cap edges
        const faceDark = new THREE.MeshStandardMaterial({ color: 0x55565C });
        const faceLight = new THREE.MeshStandardMaterial({ color: 0xAAAAB2 });
        const snowM = new THREE.MeshStandardMaterial({ color: 0xF1F4FF });

        const addSolid = (x, y, z, w, h, d) => {
            this.collidables.push({ box: new THREE.Box3(
                new THREE.Vector3(x-w/2, y, z-d/2),
                new THREE.Vector3(x+w/2, y+h, z+d/2)
            )});
        };

        // Multi-layer cliff — heavy mountain mass, not a floating pedestal.
        // The final cap reaches exactly CLIFF_H, so the castle floor sits on stone.
        const cliffLayers = [
            { w: 34, d: 30, h: 4, y: 0,  m: s1 },
            { w: 30, d: 28, h: 4, y: 4,  m: s1, jx: 0.4 },
            { w: 26, d: 24, h: 4, y: 8,  m: s2, jx:-0.4 },
            { w: 22, d: 22, h: 4, y: 12, m: s2, jx: 0.3 },
            { w: 20, d: 20, h: 3, y: 16, m: s3 },
            { w: 25, d: 22, h: 3, y: 19, m: s3 }, // shoulder under walls
            { w: 29, d: 25, h: 2, y: 22, m: s3 }, // full castle support
            { w: 31, d: 27, h: 2, y: 24, m: moss }, // grassy/stone cap flush with floor
        ];
        cliffLayers.forEach(l => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(l.w, l.h, l.d || l.w), l.m);
            mesh.position.set(cx + (l.jx||0), l.y + l.h/2, cz);
            mesh.castShadow = true; mesh.receiveShadow = true;
            GAME.scene.add(mesh);
            addSolid(cx + (l.jx || 0), l.y, cz, l.w, l.h, l.d || l.w);
        });

        // Dirt/grass ledges make the cliff feel grown out of the terrain.
        [
            [-15, 5, -8, 6, 1, 5],
            [ 14, 9,  6, 5, 1, 6],
            [-11,14,  9, 7, 1, 4],
            [ 10,18, -7, 6, 1, 5],
            [ -7,21,-12, 8, 1, 3],
            [  8,24,-11, 7, 1, 3],
        ].forEach(([ox, oy, oz, w, h, d]) => {
            const ledge = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), moss);
            ledge.position.set(cx+ox, oy+h/2, cz+oz);
            ledge.castShadow = true; ledge.receiveShadow = true;
            GAME.scene.add(ledge);
            addSolid(cx+ox, oy, cz+oz, w, h, d);
        });

        // Visible front details: stone patches and ledges break the big flat face.
        [
            [-12, 2.2, -15.4, 5.5, 3.0, 1.0, faceDark],
            [ 10, 3.0, -14.8, 6.0, 3.5, 1.0, s2],
            [ -3, 6.0, -13.2, 7.0, 2.8, 0.9, faceLight],
            [ 13, 8.6, -12.2, 4.0, 3.2, 0.9, faceDark],
            [ -9,10.8, -11.3, 5.0, 3.0, 0.9, s2],
            [  5,13.7, -10.5, 7.0, 2.5, 0.8, faceLight],
            [-12,16.5,  -9.5, 4.5, 2.8, 0.8, faceDark],
            [ 11,19.0,  -9.0, 5.0, 2.5, 0.8, s3],
        ].forEach(([ox, oy, oz, w, h, d, mat]) => {
            const rock = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            rock.position.set(cx+ox, oy+h/2, cz+oz);
            rock.castShadow = true; rock.receiveShadow = true;
            GAME.scene.add(rock);
        });

        [
            [-5, 4.2, -15.95, 0.22, 5.8],
            [ 7, 7.5, -14.1,  0.18, 4.5],
            [-13,12.4,-12.0,  0.18, 4.0],
            [ 2,16.0, -10.7,  0.16, 5.0],
        ].forEach(([ox, oy, oz, w, h]) => {
            const crack = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), faceDark);
            crack.position.set(cx+ox, oy+h/2, cz+oz);
            GAME.scene.add(crack);
        });

        // ── Waterfall down the front face (visible from spawn) ────────
        const wfMat = new THREE.MeshStandardMaterial({
            color: 0x3FC8E8, transparent: true, opacity: 0.75,
            emissive: 0x1A6888, emissiveIntensity: 0.2
        });
        for (let i = 0; i < 12; i++) {
            const wy = CLIFF_H - i * 2.15;
            const wf = new THREE.Mesh(new THREE.BoxGeometry(2.6 + Math.sin(i)*0.5, 2.5, 1.2), wfMat);
            wf.position.set(cx + Math.sin(i * 0.8) * 0.55, wy, cz - 13.0 - i * 0.12);
            GAME.scene.add(wf);
            if (!this._waterfallSegs) this._waterfallSegs = [];
            this._waterfallSegs.push(wf);
        }
        // Splash pool at base
        const splashMat = new THREE.MeshStandardMaterial({
            color: 0x3FC8E8, transparent: true, opacity: 0.6
        });
        const splash = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 7), splashMat);
        splash.position.set(cx, 0.2, cz - 15.5);
        GAME.scene.add(splash);
        this.waterZones.push({ cx, cz: cz-15.5, halfW: 4.5, halfD: 3.5 });

        // ── Stone staircase up the south face ─────────────────────────
        const stepMat = new THREE.MeshStandardMaterial({ color: 0x8A8A95 });
        for (let i = 0; i < 11; i++) {
            const step = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2, 2.5), stepMat);
            step.position.set(cx - 7, i * 2 + 1, cz + 10 - i * 1.4);
            step.receiveShadow = true; GAME.scene.add(step);
            addSolid(cx - 7, i*2, cz+10-i*1.4, 3.5, 2, 2.5);
        }

        // ── Snow patches on cliff top ─────────────────────────────────
        [[-3,0,2],[4,0,3],[-2,0,-3],[5,0,-2],[-8,0,-8],[8,0,-7]].forEach(([sx,sy,sz]) => {
            const sn = new THREE.Mesh(new THREE.BoxGeometry(3,0.4,3), snowM);
            sn.position.set(cx+sx, CLIFF_H+sy+0.2, cz+sz); GAME.scene.add(sn);
        });

        // ── CASTLE GROUP at cliff top ──────────────────────────────────
        const g = new THREE.Group();
        const W = 22, H = 12, D = 18, wallT = 0.6;
        const doorW = 4.5, doorH = 7;
        const goldMat   = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x443300, emissiveIntensity: 0.2 });
        const pinkRoof  = new THREE.MeshStandardMaterial({ color: 0xff69b4 });
        const blueRoof  = new THREE.MeshStandardMaterial({ color: 0x4488ff });
        const purpRoof  = new THREE.MeshStandardMaterial({ color: 0x8844cc });
        const redMat    = new THREE.MeshStandardMaterial({ color: 0xcc2222 });
        const winMat    = new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.6 });
        const floorMat  = new THREE.MeshStandardMaterial({ color: 0xd4c8a0 });
        const torchMat  = new THREE.MeshStandardMaterial({ color: 0xffcc44, emissive: 0xff8800, emissiveIntensity: 0.9 });
        const wallMat   = new THREE.MeshStandardMaterial({ color: 0xF5EED8 }); // cream

        const addTorch = (x, y, z) => {
            const torch = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.5,0.2),
                new THREE.MeshStandardMaterial({color:0x8B6040}));
            torch.position.set(x,y,z); g.add(torch);
            const flame = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.22,0.18), torchMat);
            flame.position.set(x,y+0.35,z); g.add(flame);
            const light = new THREE.PointLight(0xff9940, 1.2, 6);
            light.position.set(x,y+0.5,z); g.add(light);
        };

        // Floor
        const floor = new THREE.Mesh(new THREE.BoxGeometry(W,0.2,D), floorMat);
        floor.position.y = 0.1; floor.receiveShadow = true; g.add(floor);

        // Walls
        const bw = new THREE.Mesh(new THREE.BoxGeometry(W,H,wallT), wallMat);
        bw.position.set(0,H/2,-D/2+wallT/2); bw.castShadow=true; g.add(bw);
        [[-W/2+wallT/2,0],[W/2-wallT/2,0]].forEach(([x]) => {
            const w = new THREE.Mesh(new THREE.BoxGeometry(wallT,H,D), wallMat);
            w.position.set(x,H/2,0); w.castShadow=true; g.add(w);
        });
        const frontSideW = (W-doorW)/2;
        const fL = new THREE.Mesh(new THREE.BoxGeometry(frontSideW,H,wallT), wallMat);
        fL.position.set(-W/2+frontSideW/2,H/2,D/2-wallT/2); fL.castShadow=true; g.add(fL);
        const fR = new THREE.Mesh(new THREE.BoxGeometry(frontSideW,H,wallT), wallMat);
        fR.position.set(W/2-frontSideW/2,H/2,D/2-wallT/2); fR.castShadow=true; g.add(fR);
        const fTop = new THREE.Mesh(new THREE.BoxGeometry(doorW,H-doorH,wallT), wallMat);
        fTop.position.set(0,doorH+(H-doorH)/2,D/2-wallT/2); fTop.castShadow=true; g.add(fTop);

        // Stained glass windows
        const wColors=[0xff69b4,0xffd700,0x88ccff,0xff69b4];
        [-D/3,D/3].forEach(zo => {
            wColors.forEach((c,i) => {
                const pm=new THREE.MeshStandardMaterial({color:c,transparent:true,opacity:0.55,emissive:c,emissiveIntensity:0.15});
                [[-W/2+wallT/2],[W/2-wallT/2]].forEach(([xp]) => {
                    const wp=new THREE.Mesh(new THREE.BoxGeometry(0.08,1.8,0.45),pm);
                    wp.position.set(xp,H*0.55-0.6,zo+i*0.5-0.75); g.add(wp);
                });
            });
        });

        // 4 corner towers
        const towerDefs=[
            {x:-W/2,z:-D/2,roof:pinkRoof},{x:W/2,z:-D/2,roof:blueRoof},
            {x:-W/2,z:D/2,roof:purpRoof},{x:W/2,z:D/2,roof:pinkRoof}
        ];
        towerDefs.forEach(td => {
            const tower=new THREE.Mesh(new THREE.BoxGeometry(3.5,20,3.5),wallMat);
            tower.position.set(td.x,10,td.z); tower.castShadow=true; g.add(tower);
            for(let ci=0;ci<4;ci++){
                const cr=new THREE.Mesh(new THREE.BoxGeometry(1,1.5,1),wallMat);
                const a=ci*Math.PI/2;
                cr.position.set(td.x+Math.cos(a)*1.2,21,td.z+Math.sin(a)*1.2); g.add(cr);
            }
            [3.2,2.5,1.8,1.2,0.6].forEach((s,i)=>{
                const rl=new THREE.Mesh(new THREE.BoxGeometry(s,1.2,s),td.roof);
                rl.position.set(td.x,21.5+i*1.2,td.z); rl.castShadow=true; g.add(rl);
            });
            const spire=new THREE.Mesh(new THREE.BoxGeometry(0.2,3,0.2),goldMat);
            spire.position.set(td.x,28,td.z); g.add(spire);
            const flag=new THREE.Mesh(new THREE.BoxGeometry(0.05,1.2,1.8),td.roof);
            flag.position.set(td.x+0.9,30,td.z); g.add(flag);
            addTorch(td.x,20.5,td.z);
        });

        // Main roof
        [W+1,W-2,W-5].forEach((s,i)=>{
            const rl=new THREE.Mesh(new THREE.BoxGeometry(s,1.2,D+1-i*1.5),blueRoof);
            rl.position.set(0,H+0.6+i*1.2,0); rl.castShadow=true; g.add(rl);
        });

        // Banners
        [-W/2+2,W/2-2].forEach(xo=>{
            const ban=new THREE.Mesh(new THREE.BoxGeometry(0.1,5,2),pinkRoof);
            ban.position.set(xo,H*0.6,D/2+0.5); g.add(ban);
        });

        // Entry steps
        [[8,0.2,D/2+1.2],[7,0.5,D/2+2.4],[6,0.8,D/2+3.6]].forEach(([w,y,z])=>{
            const step=new THREE.Mesh(new THREE.BoxGeometry(w,0.4,1.5),wallMat);
            step.position.set(0,y,z); step.receiveShadow=true; g.add(step);
        });

        // Wall torches
        [-D/3,0,D/3].forEach(zo=>{
            addTorch(-W/2+0.5,H*0.45,zo);
            addTorch(W/2-0.5,H*0.45,zo);
        });
        addTorch(0,H*0.45,-D/2+0.5);

        // Interior
        const carpet=new THREE.Mesh(new THREE.BoxGeometry(3,0.15,D-2),redMat);
        carpet.position.set(0,0.15,0); g.add(carpet);

        // Bookshelf
        for(let i=-3;i<=3;i++){
            const shelf=new THREE.Mesh(new THREE.BoxGeometry(1.5,2.5,0.6),
                new THREE.MeshStandardMaterial({color:0x5a3a0a}));
            shelf.position.set(i*2.2,1.25,-D/2+0.5); g.add(shelf);
            [0xff69b4,0x4488ff,0xffdd00,0x44cc44].forEach((bc,bi)=>{
                const book=new THREE.Mesh(new THREE.BoxGeometry(0.3,1.8,0.15),
                    new THREE.MeshStandardMaterial({color:bc}));
                book.position.set(i*2.2-0.45+bi*0.3,1.2,-D/2+0.55); g.add(book);
            });
        }

        // Chandelier
        const chanY=H-0.5;
        const chanChain=new THREE.Mesh(new THREE.BoxGeometry(0.1,2,0.1),
            new THREE.MeshStandardMaterial({color:0x666666}));
        chanChain.position.set(0,chanY+1,0); g.add(chanChain);
        const chanBar=new THREE.Mesh(new THREE.BoxGeometry(4,0.2,0.2),
            new THREE.MeshStandardMaterial({color:0x666666}));
        chanBar.position.set(0,chanY,0); g.add(chanBar);
        [-1.5,0,1.5].forEach(xo=>{
            const fl=new THREE.Mesh(new THREE.BoxGeometry(0.15,0.3,0.15),torchMat);
            fl.position.set(xo,chanY-0.2,0); g.add(fl);
            const cl=new THREE.PointLight(0xffcc44,0.8,8);
            cl.position.set(xo,chanY-0.1,0); g.add(cl);
        });

        // Dance floor
        const danceColors=[0xff69b4,0xffd700,0x4488ff,0x44cc44,0xff8800,0xcc44ff];
        this._danceTiles=[];
        for(let di=-2;di<=2;di++) for(let dj=-2;dj<=2;dj++){
            const col=danceColors[((di+2)+(dj+2)*5)%danceColors.length];
            const tileMat=new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:0.05});
            const tile=new THREE.Mesh(new THREE.BoxGeometry(1.8,0.15,1.8),tileMat);
            tile.position.set(di*2,0.15,D/4+dj*2);
            g.add(tile);
            this._danceTiles.push({mesh:tile,mat:tileMat,bx:cx+di*2,bz:cz+D/4+dj*2});
        }

        // Portal
        const portalMat=new THREE.MeshStandardMaterial({
            color:0x8844cc,emissive:0x6622aa,emissiveIntensity:0.8,transparent:true,opacity:0.85
        });
        [[0,3,0],[0,-3,0],[2.5,0,0],[-2.5,0,0]].forEach(([px,py,pz])=>{
            const fr=new THREE.Mesh(new THREE.BoxGeometry(
                Math.abs(px)>0?0.4:5,Math.abs(py)>0?0.4:6.2,0.4
            ),new THREE.MeshStandardMaterial({color:0x4a2080,emissive:0x220840,emissiveIntensity:0.5}));
            fr.position.set(px,py+3,-D/2+3); g.add(fr);
        });
        const portalFill=new THREE.Mesh(new THREE.BoxGeometry(4.5,5.5,0.15),portalMat);
        portalFill.position.set(0,3,-D/2+3); g.add(portalFill);
        const portalLight=new THREE.PointLight(0x8844cc,1.5,10);
        portalLight.position.set(0,3,-D/2+3); g.add(portalLight);
        this.portalPos={x:cx,y:CLIFF_H+3,z:cz-D/2+3};

        // Throne
        const throneZ=D/4;
        const throneStep=new THREE.Mesh(new THREE.BoxGeometry(6,0.4,4),wallMat);
        throneStep.position.set(0,0.2,throneZ); g.add(throneStep);
        const seat=new THREE.Mesh(new THREE.BoxGeometry(2.5,0.5,2.5),goldMat);
        seat.position.set(0,0.7,throneZ); g.add(seat);
        const cushion=new THREE.Mesh(new THREE.BoxGeometry(2.2,0.35,2.2),redMat);
        cushion.position.set(0,1.1,throneZ); g.add(cushion);
        const throneBack2=new THREE.Mesh(new THREE.BoxGeometry(2.5,4,0.4),goldMat);
        throneBack2.position.set(0,3,throneZ-1.2); throneBack2.castShadow=true; g.add(throneBack2);
        [-1.2,0,1.2].forEach(xo=>{
            const prong=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.6,0.2),goldMat);
            prong.position.set(xo,5.3,throneZ-1.2); g.add(prong);
        });
        const crownLight=new THREE.PointLight(0xffd700,0.6,5);
        crownLight.position.set(0,5,throneZ-1); g.add(crownLight);

        // Place group on top of cliff
        g.position.set(cx, CLIFF_H, cz);
        GAME.scene.add(g);

        // Collisions — walls (offset by cliff height)
        const ch=CLIFF_H;
        addSolid(cx, ch - 0.05, cz, W, 0.35, D); // walkable floor, prevents falling through
        addSolid(cx, ch, cz-D/2+wallT/2, W, H, wallT);
        addSolid(cx-W/2+wallT/2, ch, cz, wallT, H, D);
        addSolid(cx+W/2-wallT/2, ch, cz, wallT, H, D);
        addSolid(cx-W/2+frontSideW/2, ch, cz+D/2-wallT/2, frontSideW, H, wallT);
        addSolid(cx+W/2-frontSideW/2, ch, cz+D/2-wallT/2, frontSideW, H, wallT);
        addSolid(cx, ch, cz+throneZ, 3, 1.5, 4);
        addSolid(cx, ch+H, cz, W+1, 1.5, D+1);

        this.thronePos={x:cx,y:ch+1.1,z:cz+throneZ};
        this._castleGroup=g;

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

    // ── New environment features ────────────────────────────────
    _addSandAndReeds() {
        const sandTex = this._pixTex(16, (x, y) => {
            const v = Math.sin(x*4.1+y*3.3)*0.08 + Math.cos(x*2.3-y*4.7)*0.06 + 0.88;
            return `rgb(${Math.round(215*v)},${Math.round(195*v)},${Math.round(140*v)})`;
        });
        sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;
        const sandMat = new THREE.MeshStandardMaterial({ map: sandTex });
        const reedMat = new THREE.MeshStandardMaterial({ color: 0x5a8a30 });

        // Sand strip around main lake (10,10) and second pond (-60,-50)
        [{ cx:10, cz:10, r:9 }, { cx:-60, cz:-50, r:6 }].forEach(lake => {
            for (let a = 0; a < Math.PI*2; a += 0.3) {
                const r = lake.r + 0.5 + Math.random()*1.5;
                const sx = lake.cx + Math.cos(a)*r;
                const sz = lake.cz + Math.sin(a)*r;
                const sand = new THREE.Mesh(new THREE.BoxGeometry(2, 0.18, 2), sandMat);
                sand.position.set(sx, this.getTerrainY(sx,sz)-0.05, sz);
                sand.receiveShadow = true;
                GAME.scene.add(sand);
            }
            // Reeds (тростник)
            for (let i = 0; i < 8; i++) {
                const a = Math.random()*Math.PI*2;
                const r2 = lake.r - 0.5 + Math.random()*1.5;
                const rx = lake.cx + Math.cos(a)*r2;
                const rz = lake.cz + Math.sin(a)*r2;
                const h = 1.2 + Math.random()*0.8;
                const reed = new THREE.Mesh(new THREE.BoxGeometry(0.2, h, 0.2), reedMat);
                reed.position.set(rx, h/2+0.1, rz);
                GAME.scene.add(reed);
                // Reed top (cattail knob)
                const knob = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.5, 0.25),
                    new THREE.MeshStandardMaterial({ color: 0x4a2800 }));
                knob.position.set(rx, h+0.35, rz);
                GAME.scene.add(knob);
            }
        });
    },

    _addSnowAndStone() {
        const snowMat = new THREE.MeshStandardMaterial({ color: 0xf0f5ff });
        const stoneTex = this._texStone || null;
        const stoneMat = stoneTex
            ? new THREE.MeshStandardMaterial({ map: stoneTex })
            : new THREE.MeshStandardMaterial({ color: 0x888899 });

        if (!this._hmap) return;
        const GRID = this._tGRID, CELL = this._tCELL, HALF = this._tHALF;
        const dummy = new THREE.Object3D();

        // Snow caps on cells with height >= 6
        const snowCnt = [];
        for (let gx=0;gx<GRID;gx++) for (let gz=0;gz<GRID;gz++) {
            if (this._hmap[gx][gz] >= 6) snowCnt.push({gx,gz});
        }
        if (snowCnt.length > 0) {
            const snowGeo = new THREE.BoxGeometry(CELL, 0.4, CELL);
            const snowIM = new THREE.InstancedMesh(snowGeo, snowMat, snowCnt.length);
            snowCnt.forEach(({gx,gz}, i) => {
                const wx = -HALF+gx*CELL+CELL/2;
                const wz = -HALF+gz*CELL+CELL/2;
                const hW = this._hmap[gx][gz]*this._tBSIZE;
                dummy.position.set(wx, hW+0.2, wz); dummy.updateMatrix();
                snowIM.setMatrixAt(i, dummy.matrix);
            });
            snowIM.instanceMatrix.needsUpdate = true;
            GAME.scene.add(snowIM);
        }

        // Stone exposed on steep slopes (cells where neighbour height differs >= 3)
        const stoneCells = [];
        for (let gx=1;gx<GRID-1;gx++) for (let gz=1;gz<GRID-1;gz++) {
            const h = this._hmap[gx][gz];
            if (h < 3) continue;
            const maxNeighbour = Math.max(
                this._hmap[gx-1][gz], this._hmap[gx+1][gz],
                this._hmap[gx][gz-1], this._hmap[gx][gz+1]
            );
            if (h - maxNeighbour >= 2) stoneCells.push({gx,gz,h});
        }
        if (stoneCells.length > 0) {
            const stGeo = new THREE.BoxGeometry(CELL*0.9, CELL*0.9, CELL*0.9);
            const stIM = new THREE.InstancedMesh(stGeo, stoneMat, stoneCells.length);
            stoneCells.forEach(({gx,gz,h}, i) => {
                const wx = -HALF+gx*CELL+CELL/2;
                const wz = -HALF+gz*CELL+CELL/2;
                dummy.position.set(wx, h*this._tBSIZE-CELL*0.45, wz); dummy.updateMatrix();
                stIM.setMatrixAt(i, dummy.matrix);
            });
            stIM.instanceMatrix.needsUpdate = true;
            GAME.scene.add(stIM);
        }
    },

    _addWaterfall() {
        // Waterfall from mountain peak at (-45, -40) down to pond
        const wfMat = new THREE.MeshStandardMaterial({
            color: 0x88bbff, transparent: true, opacity: 0.7
        });
        const x = -45, z = -40;
        for (let i = 0; i < 5; i++) {
            const seg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 1.2), wfMat);
            seg.position.set(x + i*0.15, 8 - i*1.5, z + i*0.5);
            GAME.scene.add(seg);
            seg.userData.wfIdx = i;
            if (!this._waterfallSegs) this._waterfallSegs = [];
            this._waterfallSegs.push(seg);
        }
        // Splash at bottom
        const splashMat = new THREE.MeshStandardMaterial({ color: 0xaaddff, transparent:true, opacity:0.5 });
        const splash = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 3), splashMat);
        splash.position.set(x + 0.75, 0.2, z + 2.5);
        GAME.scene.add(splash);
        this.waterZones.push({ cx: x+0.75, cz: z+2.5, halfW: 1.5, halfD: 1.5 });
    },

    _addGlowingMushrooms() {
        const mushroomPositions = [
            [-22, -18], [-35, -22], [-18, -30], [-40, 15],
            [-45, -10], [-30, -35], [-50, -20], [-15, -40]
        ];
        mushroomPositions.forEach(([x, z]) => {
            const groundY = this.getTerrainY(x, z);
            const col = Math.random() > 0.5 ? 0xff44cc : 0xcc44ff;
            const emMat = new THREE.MeshStandardMaterial({
                color: col, emissive: col, emissiveIntensity: 0.7
            });
            const stemMat = new THREE.MeshStandardMaterial({ color: 0xf5e8d0 });
            // Stem
            const stem = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.8, 0.25), stemMat);
            stem.position.set(x, groundY + 0.4, z);
            GAME.scene.add(stem);
            // Cap
            const cap = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.8), emMat);
            cap.position.set(x, groundY + 0.95, z);
            GAME.scene.add(cap);
            // Glow light
            const glow = new THREE.PointLight(col, 0.8, 4);
            glow.position.set(x, groundY + 1.2, z);
            GAME.scene.add(glow);
        });
    },

    _addMCGrass() {
        // MC-accurate tall grass: VIVID green, SHORT (0.25-0.45), VERY DENSE
        // From screenshots: individual bright blades covering terrain surface

        // Vivid MC grass colours (same bright greens as biome)
        const gCols = [0x5DB136, 0x4CA825, 0x6DC840, 0x3E9A20, 0x78D448, 0x47B030];
        const fernCol = 0x2E8B22;
        const flowerCols = [0xFF6B9D, 0xFFE066, 0xFF8C42, 0xCC44FF, 0xFF4444, 0x44CCFF];

        const skip = (x, z) =>
            (Math.abs(x)<3.5&&Math.abs(z)<3.5) || // only keep the exact spawn clear
            (x > 0 && x < 20 && z > 0 && z < 21) || // lake surface
            (Math.abs(x+25)<14&&Math.abs(z-20)<12) ||
            (Math.abs(x-10)<14&&Math.abs(z-10)<14) ||
            (Math.abs(x)<22&&Math.abs(z-72)<26); // castle cliff area

        const makeGrassTuft = (x, z, scale=1) => {
            if (skip(x, z)) return;
            const gy = this.getTerrainY(x, z);
            const col = gCols[Math.floor(Math.random()*gCols.length)];
            const h = (0.55 + Math.random()*0.40) * scale;
            const w = (0.65 + Math.random()*0.35) * scale;
            const mat = new THREE.MeshStandardMaterial({
                color: col,
                emissive: col,
                emissiveIntensity: 0.08,
                side: THREE.DoubleSide
            });
            const grp = new THREE.Group();
            const p1 = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.025), mat);
            const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.025, h, w), mat);
            p1.position.y = h/2; p2.position.y = h/2;
            grp.add(p1); grp.add(p2);
            grp.position.set(x, gy, z);
            GAME.scene.add(grp);
        };

        const makeFlower = (x, z, scale=1) => {
            if (skip(x, z)) return;
            const gy = this.getTerrainY(x, z);
            const col = flowerCols[Math.floor(Math.random()*flowerCols.length)];
            const stemM = new THREE.MeshStandardMaterial({color:0x44AA22, emissive:0x226611, emissiveIntensity:0.06});
            const petM  = new THREE.MeshStandardMaterial({color:col, emissive:col, emissiveIntensity:0.12});
            const grp = new THREE.Group();
            const h = (0.35 + Math.random()*0.25) * scale;
            const stem = new THREE.Mesh(new THREE.BoxGeometry(0.06,h,0.06), stemM);
            stem.position.y = h/2;
            const pet = new THREE.Mesh(new THREE.BoxGeometry(0.26,0.26,0.26), petM);
            pet.position.y = h + 0.13;
            grp.add(stem); grp.add(pet);
            grp.position.set(x, gy, z);
            GAME.scene.add(grp);
        };

        // === START MEADOW — visible immediately after pressing Play ===
        for (let i = 0; i < 380; i++) {
            const x = (Math.random()-0.5) * 44;
            const z = 4 + Math.random() * 23;
            makeGrassTuft(x, z, 1.2);
        }
        for (let i = 0; i < 90; i++) {
            const x = (Math.random()-0.5) * 42;
            const z = 5 + Math.random() * 22;
            makeFlower(x, z, 1.15);
        }

        // === DENSE TALL GRASS — 500 tufts ===
        for (let i = 0; i < 500; i++) {
            const x = (Math.random()-0.5)*170;
            const z = (Math.random()-0.5)*170;
            makeGrassTuft(x, z, 1);
        }

        // === FLOWERS scattered — small bright dots ===
        for (let i = 0; i < 180; i++) {
            const x = (Math.random()-0.5)*160;
            const z = (Math.random()-0.5)*160;
            makeFlower(x, z, 1);
        }

        // === FERNS (darker, bigger) ===
        for (let i = 0; i < 120; i++) {
            const x = (Math.random()-0.5)*150;
            const z = (Math.random()-0.5)*150;
            if (skip(x, z)) continue;

            const gy = this.getTerrainY(x, z);
            const h = 0.45 + Math.random()*0.35;
            const fMat = new THREE.MeshStandardMaterial({color:fernCol, side:THREE.DoubleSide});
            const grp = new THREE.Group();
            const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.65,h,0.025), fMat);
            const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.025,h,0.65), fMat);
            p1.rotation.z = 0.12; p2.rotation.x = 0.12;
            p1.position.y = h/2; p2.position.y = h/2;
            grp.add(p1); grp.add(p2);
            grp.position.set(x, gy, z);
            GAME.scene.add(grp);
        }

        // === LOW BUSHES — small green blobs ===
        for (let i = 0; i < 80; i++) {
            const x = (Math.random()-0.5)*140;
            const z = (Math.random()-0.5)*140;
            if (skip(x, z)) continue;

            const gy = this.getTerrainY(x, z);
            const col = gCols[Math.floor(Math.random()*gCols.length)];
            const bMat = new THREE.MeshStandardMaterial({color:col});
            const bh = 0.4 + Math.random()*0.4;
            const bw = 0.5 + Math.random()*0.5;
            const bush = new THREE.Mesh(new THREE.BoxGeometry(bw,bh,bw), bMat);
            bush.position.set(x, gy+bh/2, z);
            GAME.scene.add(bush);
        }
    },

    update(dt) {
        this.clouds.forEach(c => {
            c.position.x += c.userData.speed * dt;
            if (c.position.x > 150) c.position.x = -150;
        });

        // Dance floor — tiles light up near player
        if (this._danceTiles) {
            const px = Dog.group.position.x;
            const pz = Dog.group.position.z;
            const t = GAME.animTime;
            this._danceTiles.forEach(tile => {
                const d = Math.sqrt((px-tile.bx)**2 + (pz-tile.bz)**2);
                if (d < 2.5) {
                    tile.mat.emissiveIntensity = 0.6 + Math.sin(t*8 + tile.bx)*0.4;
                } else {
                    tile.mat.emissiveIntensity *= 0.92;
                }
            });
        }

        // Waterfall UV animation (position jitter)
        if (this._waterfallSegs) {
            const t = GAME.animTime;
            this._waterfallSegs.forEach((seg, i) => {
                seg.position.x += Math.sin(t*3 + i) * 0.002;
                seg.material.opacity = 0.5 + Math.sin(t*4 + i*0.7) * 0.2;
            });
        }
    }
};

try {
    World.init();
} catch (err) {
    console.error('World.init failed:', err);
    const el = document.createElement('pre');
    el.id = 'worldInitError';
    el.textContent = `World init failed:\n${err && err.stack ? err.stack : err}`;
    el.style.cssText = [
        'position:fixed',
        'left:8px',
        'top:8px',
        'z-index:9999',
        'max-width:70vw',
        'max-height:45vh',
        'overflow:auto',
        'background:rgba(0,0,0,0.85)',
        'color:#ff7777',
        'font:12px monospace',
        'padding:10px',
        'white-space:pre-wrap',
        'pointer-events:none'
    ].join(';');
    document.body.appendChild(el);
}
