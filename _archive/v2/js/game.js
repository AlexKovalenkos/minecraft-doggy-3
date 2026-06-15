// ============================================================
// game.js — Сцена, рендерер, освещение, радуга, терраин
// ============================================================

const GAME = {
    started: false,
    clock: new THREE.Clock(),
    animTime: 0,
    WORLD_SIZE: 50,
    MAX_HEIGHT: 35,
    BLOCK_SIZE: 1
};

// === SCENE ===
GAME.scene = new THREE.Scene();
GAME.scene.background = new THREE.Color(0xf0c4de);
GAME.scene.fog = new THREE.FogExp2(0xf0c4de, 0.012);

// === CAMERA ===
GAME.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);

// === RENDERER ===
GAME.renderer = new THREE.WebGLRenderer({ antialias: true });
GAME.renderer.setSize(window.innerWidth, window.innerHeight);
GAME.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
GAME.renderer.shadowMap.enabled = true;
GAME.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(GAME.renderer.domElement);

// === LIGHTING ===
GAME.scene.add(new THREE.AmbientLight(0xffd4e8, 0.7));

GAME.sun = new THREE.DirectionalLight(0xfff5e0, 1.2);
GAME.sun.position.set(40, 80, 30);
GAME.sun.castShadow = true;
GAME.sun.shadow.mapSize.width = 2048;
GAME.sun.shadow.mapSize.height = 2048;
GAME.sun.shadow.camera.near = 1;
GAME.sun.shadow.camera.far = 200;
GAME.sun.shadow.camera.left = -60;
GAME.sun.shadow.camera.right = 60;
GAME.sun.shadow.camera.top = 60;
GAME.sun.shadow.camera.bottom = -60;
GAME.scene.add(GAME.sun);

GAME.scene.add(new THREE.DirectionalLight(0xffe0f0, 0.3)).position.set(-30, 20, -20);

// === RAINBOW ===
(function() {
    const colors = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3];
    const group = new THREE.Group();
    colors.forEach((color, i) => {
        const geom = new THREE.TorusGeometry(80 - i * 2.5, 1.2, 8, 64, Math.PI);
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
        const torus = new THREE.Mesh(geom, mat);
        torus.rotation.x = Math.PI / 2;
        torus.rotation.z = Math.PI;
        group.add(torus);
    });
    group.position.set(0, 5, -70);
    GAME.scene.add(group);
})();

// === TERRAIN ===
(function() {
    // Grass texture
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#f4a7c8';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 300; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#f0b6d0' : '#e89ab8';
        ctx.fillRect(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }
    for (let i = 0; i < 40; i++) {
        ctx.fillStyle = '#ffe066';
        ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(12, 12);

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(GAME.WORLD_SIZE * 2, GAME.WORLD_SIZE * 2),
        new THREE.MeshStandardMaterial({ map: tex })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    GAME.scene.add(ground);
    GAME.ground = ground;

    // Dirt edge
    const edge = new THREE.Mesh(
        new THREE.BoxGeometry(GAME.WORLD_SIZE * 2, 2, GAME.WORLD_SIZE * 2),
        new THREE.MeshStandardMaterial({ color: 0xe8c9a0 })
    );
    edge.position.y = -1;
    edge.receiveShadow = true;
    GAME.scene.add(edge);
})();

// === RESIZE ===
window.addEventListener('resize', () => {
    GAME.camera.aspect = window.innerWidth / window.innerHeight;
    GAME.camera.updateProjectionMatrix();
    GAME.renderer.setSize(window.innerWidth, window.innerHeight);
});
