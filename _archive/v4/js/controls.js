// ============================================================
// controls.js — Управление и камера
//
// ВАЖНО — рабочие формулы:
//   yaw -= movementX * 0.003
//   cameraPitch += movementY * 0.003
//   forward = (sin(yaw), cos(yaw))
//   A += rightX, D -= rightX  (SWAPPED)
//   model rotation = yaw - PI/2
//   camera behind = pos - sin(yaw)*dist, pos - cos(yaw)*dist
// ============================================================

const Controls = {
    keys: {},
    cameraPitch: 0.3,
    selectedSlot: 0,

    init() {
        document.addEventListener('keydown', e => {
            this.keys[e.code] = true;

            if (e.code === 'KeyQ') Sounds.bark();
            if (e.code === 'KeyE') NPCs.tryTame();
            if (e.code === 'KeyZ') Items.placeBlock();
            if (e.code === 'KeyX') Items.removeBlock();

            if (e.code >= 'Digit1' && e.code <= 'Digit5') {
                const slot = parseInt(e.code.replace('Digit', '')) - 1;
                this.selectedSlot = slot;
                document.querySelectorAll('.hotbar-slot').forEach((el, i) => {
                    el.classList.toggle('active', i === slot);
                });
            }
        });

        document.addEventListener('keyup', e => {
            this.keys[e.code] = false;
        });

        // Mouse/trackpad — works WITHOUT pointer lock requirement
        document.addEventListener('mousemove', e => {
            if (!GAME.started) return;
            Dog.yaw -= (e.movementX || 0) * 0.003;
            this.cameraPitch += (e.movementY || 0) * 0.003;
            this.cameraPitch = Math.max(-0.3, Math.min(1.2, this.cameraPitch));
        });

        document.addEventListener('mousedown', () => {
            if (GAME.started && !document.pointerLockElement) {
                GAME.renderer.domElement.requestPointerLock();
            }
        });

        document.getElementById('startBtn').addEventListener('click', () => {
            GAME.started = true;
            document.getElementById('startScreen').style.display = 'none';
            document.getElementById('hud').style.display = 'flex';
            document.getElementById('hotbar').style.display = 'flex';
            document.getElementById('crosshair').style.display = 'block';

            GAME.renderer.domElement.requestPointerLock();

            const camDist = 8;
            GAME.camera.position.set(
                Dog.group.position.x - Math.sin(Dog.yaw) * camDist * Math.cos(this.cameraPitch),
                Dog.group.position.y + camDist * Math.sin(this.cameraPitch) + 2,
                Dog.group.position.z - Math.cos(Dog.yaw) * camDist * Math.cos(this.cameraPitch)
            );
            GAME.camera.lookAt(Dog.group.position.x, Dog.group.position.y + 1, Dog.group.position.z);
        });
    },

    update(dt) {
        const pos = Dog.group.position;

        const forwardX = Math.sin(Dog.yaw);
        const forwardZ = Math.cos(Dog.yaw);
        const rightX = Math.cos(Dog.yaw);
        const rightZ = -Math.sin(Dog.yaw);

        let mx = 0, mz = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp'])    { mx += forwardX; mz += forwardZ; }
        if (this.keys['KeyS'] || this.keys['ArrowDown'])   { mx -= forwardX; mz -= forwardZ; }
        if (this.keys['KeyA'] || this.keys['ArrowLeft'])   { mx += rightX;   mz += rightZ; }
        if (this.keys['KeyD'] || this.keys['ArrowRight'])  { mx -= rightX;   mz -= rightZ; }

        const isMoving = (mx * mx + mz * mz) > 0.01;
        if (isMoving) {
            const len = Math.sqrt(mx * mx + mz * mz);
            mx /= len; mz /= len;
        }

        if (this.keys['Space']) {
            Dog.isFlying = true;
            Dog.vy = Dog.flySpeed;
        } else if ((this.keys['ShiftLeft'] || this.keys['ShiftRight']) && !Dog.onGround) {
            Dog.vy = -Dog.flySpeed;
        } else if (!Dog.onGround) {
            Dog.vy += Dog.gravity * dt;
        }
        if (Dog.onGround && !this.keys['Space']) {
            Dog.isFlying = false;
            Dog.vy = 0;
        }

        pos.x += mx * Dog.speed * dt;
        pos.z += mz * Dog.speed * dt;
        pos.y += Dog.vy * dt;

        if (pos.y <= 1.6) {
            pos.y = 1.6;
            Dog.vy = 0;
            Dog.onGround = true;
        } else {
            Dog.onGround = false;
        }

        if (pos.y > GAME.MAX_HEIGHT) { pos.y = GAME.MAX_HEIGHT; Dog.vy = 0; }

        const bound = GAME.WORLD_SIZE - 2;
        pos.x = Math.max(-bound, Math.min(bound, pos.x));
        pos.z = Math.max(-bound, Math.min(bound, pos.z));

        Dog.group.rotation.y = Dog.yaw - Math.PI / 2;

        return isMoving;
    },

    updateCamera(dt) {
        const pos = Dog.group.position;
        const camDist = 8;

        const cx = pos.x - Math.sin(Dog.yaw) * camDist * Math.cos(this.cameraPitch);
        const cz = pos.z - Math.cos(Dog.yaw) * camDist * Math.cos(this.cameraPitch);
        const cy = pos.y + camDist * Math.sin(this.cameraPitch) + 2;

        GAME.camera.position.lerp(new THREE.Vector3(cx, cy, cz), 6 * dt);
        GAME.camera.lookAt(pos.x, pos.y + 1, pos.z);

        GAME.sun.position.set(pos.x + 40, 80, pos.z + 30);
        GAME.sun.target.position.copy(pos);
        GAME.sun.target.updateMatrixWorld();
    }
};

Controls.init();
