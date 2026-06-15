// ============================================================
// main.js — Игровой цикл + день/ночь + achievements + ambient
// ============================================================

Save.init();

// Debug hooks for visual QA in browser devtools/Codex checks.
window.GAME = GAME;
window.World = World;
window.Dog = Dog;

// ── Day/Night cycle ─────────────────────────────────────────
const DAY = {
    time: 0.25,          // 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk, 1=midnight
    speed: 1 / 600,      // full cycle = 600 seconds = 10 min
    _sunMesh: null,
    _moonMesh: null,
    _stars: null,

    init() {
        // Sun cube
        const sunGeo = new THREE.BoxGeometry(6, 6, 6);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xffff44 });
        this._sunMesh = new THREE.Mesh(sunGeo, sunMat);
        GAME.scene.add(this._sunMesh);

        // Moon cube
        const moonMat = new THREE.MeshBasicMaterial({ color: 0xeeeeff });
        this._moonMesh = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), moonMat);
        GAME.scene.add(this._moonMesh);

        // Stars (small white boxes)
        const starGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this._stars = new THREE.InstancedMesh(starGeo, starMat, 200);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < 200; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi   = Math.random() * Math.PI;
            const r = 180;
            dummy.position.set(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.abs(Math.cos(phi)) + 30,
                r * Math.sin(phi) * Math.sin(theta)
            );
            dummy.updateMatrix();
            this._stars.setMatrixAt(i, dummy.matrix);
        }
        this._stars.instanceMatrix.needsUpdate = true;
        this._stars.visible = false;
        GAME.scene.add(this._stars);
    },

    update(dt) {
        this.time = (this.time + this.speed * dt) % 1;
        const t = this.time;

        // Sun arc (rises in east, sets in west)
        const sunAngle = (t - 0.25) * Math.PI * 2;
        const R = 160;
        this._sunMesh.position.set(
            Math.cos(sunAngle) * R,
            Math.sin(sunAngle) * R,
            0
        );

        // Moon opposite to sun
        this._moonMesh.position.set(
            -Math.cos(sunAngle) * R,
            -Math.sin(sunAngle) * R,
            0
        );

        // Sky colour + ambient based on time
        const isDay     = t > 0.2 && t < 0.8;
        const isDawn    = t > 0.18 && t < 0.3;
        const isDusk    = t > 0.7 && t < 0.82;
        const isNight   = t < 0.18 || t > 0.82;

        let skyR, skyG, skyB;
        if (isNight) {
            skyR=0.04; skyG=0.04; skyB=0.12;
        } else if (isDawn) {
            const p = (t - 0.18) / 0.12;
            skyR=0.04+p*0.45; skyG=0.04+p*0.70; skyB=0.12+p*0.87;
        } else if (isDusk) {
            const p = 1 - (t - 0.70) / 0.12;
            skyR=0.04+p*0.45; skyG=0.04+p*0.70; skyB=0.12+p*0.87;
        } else {
            skyR=0.49; skyG=0.77; skyB=0.98; // MC blue
        }

        GAME.scene.background = new THREE.Color(skyR, skyG, skyB);
        GAME.scene.fog.color.setRGB(
            skyR + 0.1, skyG + 0.1, skyB + 0.05
        );

        // Ambient light intensity
        const ambInt = isNight ? 0.15 : isDawn || isDusk ? 0.45 : 0.75;
        GAME.scene.children.forEach(c => {
            if (c.isAmbientLight) c.intensity = ambInt;
        });

        // Sun directional light follows sun position
        GAME.sun.position.copy(this._sunMesh.position).normalize().multiplyScalar(80);
        GAME.sun.intensity = Math.max(0, Math.sin(sunAngle));

        // Stars visible at night
        this._stars.visible = isNight || (t < 0.22) || (t > 0.78);
        const starOpacity = isNight ? 1 : 0;
        // Can't animate InstancedMesh opacity easily — just show/hide

        // Sun visible only above horizon
        this._sunMesh.visible = this._sunMesh.position.y > 0;
        this._moonMesh.visible = this._moonMesh.position.y > 0;
    }
};

// ── Achievement system ───────────────────────────────────────
const Achievements = {
    _shown: new Set(),
    _list: {
        first_tame:    { icon:'🐾', text:'Первый друг!',      cond: () => NPCs.tamedCount > 0 },
        tame_3:        { icon:'🐕', text:'Стая!',             cond: () => NPCs.tamedCount + NPCs.tamedNpcDogs >= 3 },
        ride_unicorn:  { icon:'🦄', text:'Верхом на единороге!', cond: () => !!Dog.ridingUnicorn },
        ride_dragon:   { icon:'🐉', text:'Покоритель дракона!', cond: () => !!Dog.ridingDragon },
        reach_castle:  { icon:'🏰', text:'Замок найден!',     cond: () => {
            const p = Dog.group.position;
            return Math.sqrt((p.x-0)**2+(p.z-32)**2) < 24;
        }},
        fly_high:      { icon:'✈️', text:'Высоко лечу!',      cond: () => Dog.group.position.y > 18 },
        throne:        { icon:'👑', text:'Восседаю на троне!', cond: () => Dog.onThrone },
    },

    check() {
        for (const [id, ach] of Object.entries(this._list)) {
            if (!this._shown.has(id) && ach.cond()) {
                this._shown.add(id);
                this._show(ach.icon, ach.text);
            }
        }
    },

    _show(icon, text) {
        const el = document.createElement('div');
        el.className = 'achievement-toast';
        el.innerHTML = `<span class="ach-icon">${icon}</span><div><div class="ach-title">ДОСТИЖЕНИЕ</div><div class="ach-text">${text}</div></div>`;
        document.getElementById('ui').appendChild(el);
        setTimeout(() => el.classList.add('show'), 50);
        setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 500); }, 3500);
    }
};

// ── Ambient sound timer ──────────────────────────────────────
let ambientBirdTimer = 8;
let ambientPigTimer  = 15;
let lastWingSound    = 0;
let lastDustTime     = 0;

// ── Init ────────────────────────────────────────────────────
DAY.init();

// Add achievement + hearts CSS
(function() {
    const s = document.createElement('style');
    s.textContent = `
    .achievement-toast {
        position:absolute; bottom:80px; right:16px;
        background:rgba(0,0,0,0.75); border:2px solid #555;
        padding:8px 14px; display:flex; align-items:center; gap:10px;
        font-family:'Press Start 2P',monospace; color:#fff;
        opacity:0; transform:translateX(120%); transition:all 0.4s;
        pointer-events:none; z-index:50;
    }
    .achievement-toast.show { opacity:1; transform:translateX(0); }
    .ach-icon  { font-size:20px; }
    .ach-title { font-size:6px; color:#ffff55; margin-bottom:4px; }
    .ach-text  { font-size:8px; color:#ffffff; }

    #hearts { position:absolute; bottom:58px; left:50%; transform:translateX(-50%);
        display:none; gap:2px; }
    .heart { width:14px; height:14px; background:#ff3333;
        clip-path:polygon(50% 0%,61% 11%,98% 11%,98% 60%,50% 100%,2% 60%,2% 11%,39% 11%);
        display:inline-block; }
    #xpbar { position:absolute; bottom:52px; left:50%; transform:translateX(-50%);
        width:200px; height:4px; background:#333; display:none; }
    #xpfill { height:100%; background:#7aff00; width:0%; transition:width 0.3s; }
    `;
    document.head.appendChild(s);

    // Hearts row
    const hearts = document.createElement('div');
    hearts.id = 'hearts';
    hearts.style.display = 'none';
    for (let i = 0; i < 10; i++) {
        const h = document.createElement('div');
        h.className = 'heart';
        hearts.appendChild(h);
    }
    document.getElementById('ui').appendChild(hearts);

    // XP bar
    const xp = document.createElement('div');
    xp.id = 'xpbar';
    xp.innerHTML = '<div id="xpfill"></div>';
    document.getElementById('ui').appendChild(xp);
})();

// Show hearts + xp bar when game starts
document.getElementById('startBtn').addEventListener('click', () => {
    document.getElementById('hearts').style.display = 'flex';
    document.getElementById('xpbar').style.display  = 'block';
    Sounds.startWind && Sounds.startWind();
}, { once: true });

// ── Game loop ────────────────────────────────────────────────
function gameLoop() {
    requestAnimationFrame(gameLoop);
    const dt = Math.min(GAME.clock.getDelta(), 0.05);
    GAME.animTime += dt;
    const t = GAME.animTime;

    if (!GAME.started) {
        GAME.renderer.render(GAME.scene, GAME.camera);
        return;
    }

    if (GAME.paused) {
        GAME.renderer.render(GAME.scene, GAME.camera);
        return;
    }

    // Day/night
    DAY.update(dt);

    const isMoving = Controls.update(dt);
    Dog.animate(dt, t, isMoving);
    Controls.updateCamera(dt);

    // Height display
    const heightRef = Dog.ridingDragon
        ? Math.max(0, Math.round(Dog.ridingDragon.position.y))
        : Math.max(0, Math.round(Dog.group.position.y - 1.6));
    document.getElementById('heightVal').textContent = heightRef;

    // Wing sound when flying
    if (!Dog.onGround && !Dog.ridingDragon && t - lastWingSound > 0.2) {
        Sounds.wing();
        lastWingSound = t;
    }

    // Sprint dust (more particles when sprinting)
    if (isMoving && Dog.onGround && !Dog.inWater && !Dog.ridingDragon && t - lastDustTime > 0.25) {
        const pos = Dog.group.position;
        const count = Controls._sprinting ? 4 : 2;
        Effects.spawnParticles(pos.x, (World.getTerrainY ? World.getTerrainY(pos.x,pos.z) : 0) + 0.1, pos.z, 0xc8a878, count);
        lastDustTime = t;
    }

    // Ambient sounds
    ambientBirdTimer -= dt;
    if (ambientBirdTimer <= 0) {
        ambientBirdTimer = 10 + Math.random() * 20;
        if (DAY.time > 0.2 && DAY.time < 0.8) Sounds.bird && Sounds.bird();
    }
    ambientPigTimer -= dt;
    if (ambientPigTimer <= 0) {
        ambientPigTimer = 8 + Math.random() * 15;
        // Find nearest pig and oink
        NPCs.pigs.forEach(p => {
            const d = Dog.group.position.distanceTo(p.position);
            if (d < 12) Sounds.oink && Sounds.oink();
        });
    }

    Items.update(dt, t);
    NPCs.update(dt, t);

    // Unicorn riding sync
    if (Dog.ridingUnicorn && !Dog.ridingDragon) {
        Dog.group.position.x = Dog.ridingUnicorn.position.x;
        Dog.group.position.z = Dog.ridingUnicorn.position.z;
        Dog.group.position.y = Dog.ridingUnicorn.position.y + 0.65 + 1.6;
    }

    // Sun shadow target follows dog
    GAME.sun.target.position.copy(Dog.group.position);
    GAME.sun.target.updateMatrixWorld();

    // XP bar = tamed animals / max
    const totalTamed = NPCs.tamedCount + NPCs.tamedNpcDogs + NPCs.tamedPigs + NPCs.tamedCats;
    const xpPct = Math.min(100, totalTamed * 12);
    const xpEl = document.getElementById('xpfill');
    if (xpEl) xpEl.style.width = xpPct + '%';

    // Achievements
    Achievements.check();

    // Dance floor lights (portal/castle interaction in world.js update)
    World.update(dt);
    Effects.update(dt);
    Save.update(dt);

    GAME.renderer.render(GAME.scene, GAME.camera);
}

gameLoop();
