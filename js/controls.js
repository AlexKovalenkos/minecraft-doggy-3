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
    _camTarget: new THREE.Vector3(),
    _lookTarget: new THREE.Vector3(0, 2.6, 0),
    _lookGoal: new THREE.Vector3(),
    _wasInWater: false,

    _lastMouseX: null,
    _lastMouseY: null,

    init() {
        document.addEventListener('keydown', e => {
            this.keys[e.code] = true;

            if (['KeyQ','KeyE','KeyZ','KeyX','KeyR','Space'].includes(e.code)) {
                e.preventDefault();
            }

            if (e.repeat) return;

            if (e.code === 'KeyQ') Sounds.bark();
            if (e.code === 'KeyE') NPCs.tryTame();
            if (e.code === 'KeyZ') Items.placeBlock();
            if (e.code === 'KeyX') Items.removeBlock();

            // R — toggle dragon riding
            if (e.code === 'KeyR') {
                if (Dog.ridingDragon) {
                    // Dismount
                    Dog.ridingDragon = null;
                } else {
                    // Try to mount tamed dragon nearby
                    NPCs.dragons.forEach(dr => {
                        if (!dr.userData.tamed) return;
                        const dist = Dog.group.position.distanceTo(dr.position);
                        if (dist < 4 && !Dog.ridingDragon) {
                            Dog.ridingDragon = dr;
                        }
                    });
                }
            }

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

        // Mouse/trackpad — works with AND without pointer lock
        document.addEventListener('mousemove', e => {
            if (!GAME.started) return;
            let dx, dy;
            if (document.pointerLockElement) {
                // Pointer lock active — use movementX/Y
                dx = e.movementX || 0;
                dy = e.movementY || 0;
            } else {
                // No pointer lock — compute delta from last position (trackpad touch)
                if (this._lastMouseX !== null) {
                    dx = e.clientX - this._lastMouseX;
                    dy = e.clientY - this._lastMouseY;
                } else {
                    dx = 0;
                    dy = 0;
                }
                this._lastMouseX = e.clientX;
                this._lastMouseY = e.clientY;
            }
            Dog.yaw -= dx * 0.003;
            this.cameraPitch += dy * 0.003;
            this.cameraPitch = Math.max(-0.3, Math.min(1.2, this.cameraPitch));
        });

        // Reset last mouse pos when pointer leaves/enters to avoid jumps
        document.addEventListener('mouseleave', () => {
            this._lastMouseX = null;
            this._lastMouseY = null;
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
            this._lookTarget.set(Dog.group.position.x, Dog.group.position.y + 1, Dog.group.position.z);
        });
    },

    update(dt) {
        // === Dragon riding mode ===
        if (Dog.ridingDragon) {
            return this._updateDragonRide(dt);
        }

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

        // Water slowdown
        let speedMult = 1;
        if (Dog.inWater && Dog.onGround) {
            speedMult = 0.6;
        }

        pos.x += mx * Dog.speed * speedMult * dt;
        pos.z += mz * Dog.speed * speedMult * dt;
        pos.y += Dog.vy * dt;

        // --- COLLISION DETECTION ---
        const dogRadius = 0.8;
        const groundOffset = 1.6;
        // Start surfaceY from terrain height at current position (Minecraft-style terrain follow)
        let surfaceY = World.getTerrainY ? World.getTerrainY(pos.x, pos.z) : 0;

        // Tree/foliage/building collisions
        World.collidables.forEach(c => {
            const box = c.box;
            const overlapX = pos.x + dogRadius > box.min.x && pos.x - dogRadius < box.max.x;
            const overlapZ = pos.z + dogRadius > box.min.z && pos.z - dogRadius < box.max.z;

            if (overlapX && overlapZ) {
                const dogFeetY = pos.y - groundOffset;
                const dogTopY = pos.y + 0.7;

                if (Dog.vy <= 0 && dogFeetY <= box.max.y && dogFeetY >= box.max.y - 0.5) {
                    if (box.max.y > surfaceY) surfaceY = box.max.y;
                }
                else if (dogFeetY < box.max.y && dogTopY > box.min.y) {
                    const pushRight = pos.x + dogRadius - box.min.x;
                    const pushLeft = box.max.x - (pos.x - dogRadius);
                    const pushBack = pos.z + dogRadius - box.min.z;
                    const pushFront = box.max.z - (pos.z - dogRadius);
                    const minPush = Math.min(pushLeft, pushRight, pushFront, pushBack);
                    if (minPush === pushRight) pos.x = box.min.x - dogRadius;
                    else if (minPush === pushLeft) pos.x = box.max.x + dogRadius;
                    else if (minPush === pushBack) pos.z = box.min.z - dogRadius;
                    else pos.z = box.max.z + dogRadius;
                }
            }
        });

        // Placed blocks collision
        Items.placedBlocks.forEach(b => {
            const bPos = b.mesh.position;
            const half = GAME.BLOCK_SIZE / 2;
            const bMin = { x: bPos.x - half, y: bPos.y - half, z: bPos.z - half };
            const bMax = { x: bPos.x + half, y: bPos.y + half, z: bPos.z + half };
            const overlapX = pos.x + dogRadius > bMin.x && pos.x - dogRadius < bMax.x;
            const overlapZ = pos.z + dogRadius > bMin.z && pos.z - dogRadius < bMax.z;

            if (overlapX && overlapZ) {
                const dogFeetY = pos.y - groundOffset;
                const dogTopY = pos.y + 0.7;
                if (Dog.vy <= 0 && dogFeetY <= bMax.y && dogFeetY >= bMax.y - 0.5) {
                    if (bMax.y > surfaceY) surfaceY = bMax.y;
                } else if (dogFeetY < bMax.y && dogTopY > bMin.y) {
                    const pushRight = pos.x + dogRadius - bMin.x;
                    const pushLeft = bMax.x - (pos.x - dogRadius);
                    const pushBack = pos.z + dogRadius - bMin.z;
                    const pushFront = bMax.z - (pos.z - dogRadius);
                    const minPush = Math.min(pushLeft, pushRight, pushFront, pushBack);
                    if (minPush === pushRight) pos.x = bMin.x - dogRadius;
                    else if (minPush === pushLeft) pos.x = bMax.x + dogRadius;
                    else if (minPush === pushBack) pos.z = bMin.z - dogRadius;
                    else pos.z = bMax.z + dogRadius;
                }
            }
        });

        // Unicorn riding (tamed only)
        Dog.ridingUnicorn = null;
        NPCs.unicorns.forEach(u => {
            if (!u.userData.tamed) return;
            const dx = Math.abs(pos.x - u.position.x);
            const dz = Math.abs(pos.z - u.position.z);
            if (dx < 1.5 && dz < 1.5) {
                const uTopY = u.position.y + 0.65;
                const dogFeetY = pos.y - groundOffset;
                if (Dog.vy <= 0 && dogFeetY <= uTopY && dogFeetY >= uTopY - 0.8) {
                    if (uTopY > surfaceY) {
                        surfaceY = uTopY;
                        Dog.ridingUnicorn = u;
                    }
                }
            }
        });

        // Rainbow bridge (formula-based smooth surface)
        if (World.bridge) {
            const b = World.bridge;
            const dz = Math.abs(pos.z - b.cz);
            const dx = pos.x - b.cx;
            if (dz < b.halfW && Math.abs(dx) < b.R) {
                const bridgeY = Math.sqrt(b.R * b.R - dx * dx);
                const dogFeetY = pos.y - groundOffset;
                if (Dog.vy <= 0 && dogFeetY <= bridgeY + 0.3 && dogFeetY >= bridgeY - 1.5) {
                    if (bridgeY > surfaceY) surfaceY = bridgeY;
                }
            }
        }

        // Ground/surface landing
        const effectiveGround = surfaceY + groundOffset;
        if (pos.y <= effectiveGround) {
            pos.y = effectiveGround;
            Dog.vy = 0;
            Dog.onGround = true;
        } else {
            Dog.onGround = false;
        }

        // Water in-water check
        if (Dog.onGround && surfaceY < 0.01) {
            let inWater = false;
            World.waterZones.forEach(wz => {
                if (Math.abs(pos.x - wz.cx) < wz.halfW && Math.abs(pos.z - wz.cz) < wz.halfD) {
                    inWater = true;
                }
            });
            if (inWater && !this._wasInWater) {
                Sounds.splash();
            }
            if (!inWater && this._wasInWater) {
                Sounds.splash();
            }
            this._wasInWater = inWater;
            Dog.inWater = inWater;
        } else {
            Dog.inWater = false;
            this._wasInWater = false;
        }

        if (pos.y > GAME.MAX_HEIGHT) { pos.y = GAME.MAX_HEIGHT; Dog.vy = 0; }

        const bound = GAME.WORLD_SIZE - 2;
        pos.x = Math.max(-bound, Math.min(bound, pos.x));
        pos.z = Math.max(-bound, Math.min(bound, pos.z));

        Dog.group.rotation.y = Dog.yaw - Math.PI / 2;

        // Throne check
        if (World.thronePos) {
            const tp = World.thronePos;
            const dx = Math.abs(pos.x - tp.x);
            const dz = Math.abs(pos.z - tp.z);
            const dogFeetY = pos.y - groundOffset;
            Dog.onThrone = (dx < 1.5 && dz < 1.5 && Math.abs(dogFeetY - tp.y) < 0.5);
        }

        return isMoving;
    },

    _updateDragonRide(dt) {
        const dragon = Dog.ridingDragon;
        const pos = dragon.position;

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

        const dragonSpeed = 12;
        pos.x += mx * dragonSpeed * dt;
        pos.z += mz * dragonSpeed * dt;

        // Vertical
        if (this.keys['Space']) {
            pos.y += 8 * dt;
        } else if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
            pos.y -= 8 * dt;
        }
        pos.y = Math.max(2.0, Math.min(GAME.MAX_HEIGHT, pos.y));

        const bound = GAME.WORLD_SIZE - 2;
        pos.x = Math.max(-bound, Math.min(bound, pos.x));
        pos.z = Math.max(-bound, Math.min(bound, pos.z));

        // Dragon faces movement direction
        dragon.rotation.y = Dog.yaw;

        // Dog sits on dragon
        Dog.group.position.set(pos.x, pos.y + 2.5, pos.z);
        Dog.group.rotation.y = Dog.yaw - Math.PI / 2;
        Dog.onGround = false;
        Dog.isFlying = true;
        Dog.onThrone = false;
        Dog.inWater = false;

        return isMoving;
    },

    updateCamera(dt) {
        const pos = Dog.group.position;
        const baseCamDist = Dog.ridingDragon ? 14 : 8;

        const cx = pos.x - Math.sin(Dog.yaw) * baseCamDist * Math.cos(this.cameraPitch);
        const cz = pos.z - Math.cos(Dog.yaw) * baseCamDist * Math.cos(this.cameraPitch);
        const cy = pos.y + baseCamDist * Math.sin(this.cameraPitch) + 2;

        this._camTarget.set(cx, cy, cz);
        const smoothFactor = 1 - Math.exp(-8 * dt);
        GAME.camera.position.lerp(this._camTarget, smoothFactor);

        this._lookGoal.set(pos.x, pos.y + 1, pos.z);
        this._lookTarget.lerp(this._lookGoal, smoothFactor);
        GAME.camera.lookAt(this._lookTarget);
    }
};

Controls.init();
