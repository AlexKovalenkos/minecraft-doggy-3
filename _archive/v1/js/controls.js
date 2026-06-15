// ============================================================
// controls.js — Управление и камера (3rd person, стандартная 3D)
//
// Мышь поворачивает персонажа (yaw).
// W — вперёд куда смотрит Тёпа.
// S — назад. A/D — стрейф влево/вправо.
// Камера всегда за спиной.
// ============================================================

const Controls = {
    keys: {},
    cameraPitch: 0.3, // вертикальный угол камеры
    selectedSlot: 0,

    init() {
        document.addEventListener('keydown', e => this._onKeyDown(e));
        document.addEventListener('keyup', e => { this.keys[e.code] = false; });
        document.addEventListener('mousemove', e => this._onMouse(e));
        document.addEventListener('mousedown', e => this._onClick(e));
        document.addEventListener('contextmenu', e => e.preventDefault());

        document.getElementById('startBtn').addEventListener('click', () => {
            GAME.started = true;
            document.getElementById('startScreen').style.display = 'none';
            document.getElementById('hud').style.display = 'flex';
            document.getElementById('hotbar').style.display = 'flex';
            document.getElementById('crosshair').style.display = 'block';
            GAME.renderer.domElement.requestPointerLock();
        });
    },

    _onKeyDown(e) {
        this.keys[e.code] = true;
        if (!GAME.started) return;

        // Hotbar 1-5
        if (e.code >= 'Digit1' && e.code <= 'Digit5') {
            this.selectedSlot = parseInt(e.code.replace('Digit', '')) - 1;
            document.querySelectorAll('.hotbar-slot').forEach((s, i) => {
                s.classList.toggle('active', i === this.selectedSlot);
            });
        }

        // Bark
        if (e.code === 'KeyQ') Sounds.bark();

        // Remove block
        if (e.code === 'KeyX') Items.removeBlock();

        // Tame unicorn
        if (e.code === 'KeyE') NPCs.tryTame();
    },

    _onMouse(e) {
        if (!GAME.started || !document.pointerLockElement) return;

        // Мышь поворачивает персонажа по горизонтали
        Dog.yaw -= e.movementX * 0.003;

        // Вертикаль — только камера (наклон вверх/вниз)
        this.cameraPitch -= e.movementY * 0.003;
        this.cameraPitch = Math.max(-0.3, Math.min(1.2, this.cameraPitch));
    },

    _onClick(e) {
        if (!GAME.started) return;
        if (!document.pointerLockElement) {
            GAME.renderer.domElement.requestPointerLock();
            return;
        }
        if (e.button === 0) Items.placeBlock();
    },

    // Вызывается каждый кадр — двигает Тёпу
    update(dt) {
        const dog = Dog;
        const pos = dog.group.position;
        const yaw = dog.yaw;

        // Направления относительно Тёпы
        const forwardX = Math.sin(yaw);
        const forwardZ = Math.cos(yaw);
        const rightX = Math.cos(yaw);
        const rightZ = -Math.sin(yaw);

        // Сбор ввода
        let mx = 0, mz = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp'])    { mx += forwardX; mz += forwardZ; }
        if (this.keys['KeyS'] || this.keys['ArrowDown'])   { mx -= forwardX; mz -= forwardZ; }
        if (this.keys['KeyA'] || this.keys['ArrowLeft'])   { mx -= rightX;   mz -= rightZ; }
        if (this.keys['KeyD'] || this.keys['ArrowRight'])  { mx += rightX;   mz += rightZ; }

        const isMoving = (mx * mx + mz * mz) > 0.01;
        if (isMoving) {
            const len = Math.sqrt(mx * mx + mz * mz);
            mx /= len;
            mz /= len;
        }

        // Полёт
        const wantFly = this.keys['Space'];
        const wantDescend = this.keys['ShiftLeft'] || this.keys['ShiftRight'];

        if (wantFly) {
            dog.isFlying = true;
            dog.vy = dog.flySpeed;
        } else if (wantDescend && !dog.onGround) {
            dog.vy = -dog.flySpeed;
        } else if (!dog.onGround) {
            dog.vy += dog.gravity * dt;
        }

        if (dog.onGround && !wantFly) {
            dog.isFlying = false;
            dog.vy = 0;
        }

        // Применяем движение
        pos.x += mx * dog.speed * dt;
        pos.z += mz * dog.speed * dt;
        pos.y += dog.vy * dt;

        // Земля
        if (pos.y <= 1.6) {
            pos.y = 1.6;
            dog.vy = 0;
            dog.onGround = true;
        } else {
            dog.onGround = false;
        }

        // Потолок
        if (pos.y > GAME.MAX_HEIGHT) {
            pos.y = GAME.MAX_HEIGHT;
            dog.vy = 0;
        }

        // Границы мира
        const bound = GAME.WORLD_SIZE - 2;
        pos.x = Math.max(-bound, Math.min(bound, pos.x));
        pos.z = Math.max(-bound, Math.min(bound, pos.z));

        // Тёпа всегда смотрит куда указывает мышь
        dog.group.rotation.y = yaw;

        return isMoving;
    },

    // Камера следует за Тёпой
    updateCamera(dt) {
        const pos = Dog.group.position;
        const yaw = Dog.yaw;
        const camDist = 8;

        // Камера за спиной Тёпы
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
