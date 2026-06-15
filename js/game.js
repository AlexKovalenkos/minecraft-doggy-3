// ============================================================
// game.js — Сцена, рендерер, освещение, радуга, терраин
// ============================================================

const GAME = {
    started: false,
    clock: new THREE.Clock(),
    animTime: 0,
    WORLD_SIZE: 100,
    MAX_HEIGHT: 35,
    BLOCK_SIZE: 1.5
};

// === SCENE ===
GAME.scene = new THREE.Scene();
GAME.scene.background = new THREE.Color(0x8BC8FF); // bright shader-like MC sky
GAME.scene.fog = new THREE.Fog(0xd6ecff, 95, 320); // soft panoramic distance haze

// === CAMERA ===
GAME.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);
GAME.camera.position.set(0, 6, -8);
GAME.camera.lookAt(0, 1.6, 0);

// === RENDERER ===
GAME.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
GAME.renderer.setSize(window.innerWidth, window.innerHeight);
GAME.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
GAME.renderer.outputColorSpace = THREE.SRGBColorSpace;
GAME.renderer.toneMapping = THREE.ACESFilmicToneMapping;
GAME.renderer.toneMappingExposure = 1.15;
GAME.renderer.shadowMap.enabled = true;
GAME.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(GAME.renderer.domElement);

// === LIGHTING ===
GAME.scene.add(new THREE.HemisphereLight(0xbfe6ff, 0x5f7f3a, 0.78));
GAME.scene.add(new THREE.AmbientLight(0xfff1dd, 0.28));

GAME.sun = new THREE.DirectionalLight(0xfff0c8, 1.65);
GAME.sun.position.set(55, 95, 35);
GAME.sun.castShadow = true;
GAME.sun.shadow.mapSize.width = 2048;
GAME.sun.shadow.mapSize.height = 2048;
GAME.sun.shadow.camera.near = 1;
GAME.sun.shadow.camera.far = 300;
GAME.sun.shadow.camera.left = -100;
GAME.sun.shadow.camera.right = 100;
GAME.sun.shadow.camera.top = 100;
GAME.sun.shadow.camera.bottom = -100;
GAME.sun.shadow.bias = -0.002;
GAME.sun.shadow.normalBias = 0.02;
GAME.scene.add(GAME.sun);
GAME.scene.add(GAME.sun.target);

const fillLight = new THREE.DirectionalLight(0xb8d8ff, 0.35);
fillLight.position.set(-45, 35, -30);
GAME.scene.add(fillLight);

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

// === BASE FLOOR (detail terrain built by world.js _buildTerrain) ===
// Just a deep bedrock layer + infinite grass base; world.js places the block terrain on top
(function() {
    const bedrock = new THREE.Mesh(
        new THREE.BoxGeometry(GAME.WORLD_SIZE * 8, 4, GAME.WORLD_SIZE * 8),
        new THREE.MeshStandardMaterial({ color: 0x2a2a2a })
    );
    bedrock.position.y = -2.05;
    GAME.scene.add(bedrock);
})();

// === RESIZE ===
window.addEventListener('resize', () => {
    GAME.camera.aspect = window.innerWidth / window.innerHeight;
    GAME.camera.updateProjectionMatrix();
    GAME.renderer.setSize(window.innerWidth, window.innerHeight);
});
