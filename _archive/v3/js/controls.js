// ============================================================
// controls.js — Управление и камера (v3)
//
// Основа: проверенные формулы из v1 + поворот модели
// ============================================================

const Controls = {
    keys: {},
    cameraPitch: 0.3,
    selectedSlot: 0,

    init() {
        document.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            if (!GAME.started) return;

            if (e.code >= 'Digit1' && e.code <= 'Digit5') {
                this.selectedSlot = parseInt(e.code.replace('Digit', '')) - 1;
                document.querySelectorAll('.hotbar-slot').forEach((s, i) => {
                    s.classList.toggle('active', i === this.selectedSlot);
                });
            }
            if (e.code === 'KeyQ') Sounds.bark();
            if (e.code === 'KeyZ') Items.placeBlock();
            if (e.code === 'KeyX') Items.removeBlock();
            if (e.code === 'KeyE') NPCs.tryTame();
        });

        document.addEventListener('keyup', e => { this.keys[e.code] = false; });

        // Мышь / тачпад — работает БЕЗ pointer lock тоже
        document.addEventListener('mousemove', e => {
            if (!GAME.started) return;
            const dx = e.movementX || 0;
            const dy = e.movementY || 0;
            if (dx === 0 && dy === 0) return;
            Dog.yaw -= dx * 0.003;
            this.cameraPitch += dy * 0.003;
            this.cameraPitch = Math.max(-0.3, Math.min(1.2, this.cameraPitch));
        });

        document.addEventListener('mousedown', () => {
            if (GAME.started && !document.pointerLockElement) {
                GAME.renderer.domElement.requestPointerLock();
            }
        });

        document.addEventListener('contextmenu', e => e.preventDefault());

        document.getElementById('startBtn').addEventListener('click', () => {
            GAME.started = true;
            document.getElementById('startScreen').style.display = 'none';
            document.getElementById('hud').style.display = 'flex';
            document.getElementById('hotbar').style.display = 'flex';
            document.getElementById('crosshair').style.display = 'block';
            GAME.renderer.domElement.requestPointerLock();

            // Ставим собаку на землю и камеру за спиной
            Dog.group.position.y = 1.6;
            Dog.vy = 0;
            Dog.onGround = true;
            this._snapCamera();
        });
    },

    update(dt) {
        const pos = Dog.group.position;
        const yaw = Dog.yaw;

        // === ФОРМУЛЫ ИЗ V1 (проверенные, работают) ===
        const forwardX = Math.sin(yaw);
        const forwardZ = Math.cos(yaw);
        const rightX = Math.cos(yaw);
        const rightZ = -Math.sin(yaw);

        let mx = 0, mz = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp'])    { mx += forwardX; mz += forwardZ; }
        if (this.keys['KeyS'] || this.keys['ArrowDown'])   { mx -= forwardX; mz -= forwardZ; }
        if (this.keys['KeyA'] || this.keys['ArrowLeft'])   { mx += rightX;   mz += rightZ; }
        if (this.keys['KeyD'] || this.keys['ArrowRight'])  { mx -= rightX;   mz -= rightZ; }

        const isMoving = (mx * mx + mz * mz) > 0.01;
        if (isMoving) {
            const len = Math.sqrt(mx * mx + mz * mz);
            mx /= len;
            mz /= len;
        }

        // Полёт
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

        // Движение
        pos.x += mx * Dog.speed * dt;
        pos.z += mz * Dog.speed * dt;
        pos.y += Dog.vy * dt;

        // Земля
        if (pos.y <= 1.6) {
            pos.y = 1.6;
            Dog.vy = 0;
            Dog.onGround = true;
        } else {
            Dog.onGround = false;
        }

        // Потолок
        if (pos.y > GAME.MAX_HEIGHT) {
            pos.y = GAME.MAX_HEIGHT;
            Dog.vy = 0;
        }

        // Границы
        const bound = GAME.WORLD_SIZE - 2;
        pos.x = Math.max(-bound, Math.min(bound, pos.x));
        pos.z = Math.max(-bound, Math.min(bound, pos.z));

        // Поворот модели — модель смотрит в +X, разворачиваем по yaw
        Dog.group.rotation.y = yaw - Math.PI / 2;

        return isMoving;
    },

    // Камера — ФОРМУЛА ИЗ V1
    _snapCamera() {
        const pos = Dog.group.position;
        const yaw = Dog.yaw;
        const camDist = 8;
        const cx = pos.x - Math.sin(yaw) * camDist * Math.cos(this.cameraPitch);
        const cz = pos.z - Math.cos(yaw) * camDist * Math.cos(this.cameraPitch);
        const cy = pos.y + camDist * Math.sin(this.cameraPitch) + 2;
        GAME.camera.position.set(cx, cy, cz);
        GAME.camera.lookAt(pos.x, pos.y + 1, pos.z);
    },

    updateCamera(dt) {
        const pos = Dog.group.position;
        const yaw = Dog.yaw;
        const camDist = 8;

        const cx = pos.x - Math.sin(yaw) * camDist * Math.cos(this.cameraPitch);
        const cz = pos.z - Math.cos(yaw) * camDist * Math.cos(this.cameraPitch);
        const cy = pos.y + camDist * Math.sin(this.cameraPitch) + 2;

        const target = new THREE.Vector3(cx, cy, cz);
        GAME.camera.position.lerp(target, 6 * dt);
        GAME.camera.lookAt(pos.x, pos.y + 1, pos.z);

        // Солнце
        GAME.sun.position.set(pos.x + 40, 80, pos.z + 30);
        GAME.sun.target.position.copy(pos);
        GAME.sun.target.updateMatrixWorld();
    }
};

Controls.init();
