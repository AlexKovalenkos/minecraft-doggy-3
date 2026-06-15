// ============================================================
// controls.js — Управление и камера (MC-style physics)
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

    // Sprint
    _sprinting: false,

    // Camera distance toggle (V key)
    _camClose: true, // default: close (5 units) to see Тёпу

    // Camera bob
    _bobPhase: 0,
    _bobAmount: 0,

    // Dog sit timer
    _idleTimer: 0,
    _dogSitting: false,

    // Surface type for footstep sounds
    _lastSurface: 'grass',
    _stepTimer: 0,

    init() {
        document.addEventListener('keydown', e => {
            this.keys[e.code] = true;

            if (['KeyQ','KeyE','KeyZ','KeyX','KeyR','Space','ControlLeft','ControlRight'].includes(e.code)) {
                e.preventDefault();
            }

            if (e.repeat) return;

            // V — toggle camera distance (close/far)
            if (e.code === 'KeyV') {
                this._camClose = !this._camClose;
                Effects.showMessage(this._camClose ? '📷 Камера: близко' : '📷 Камера: далеко');
            }

            if (e.code === 'KeyQ') Sounds.bark();
            if (e.code === 'KeyE') NPCs.tryTame();
            if (e.code === 'KeyZ') Items.placeBlock();
            if (e.code === 'KeyX') Items.removeBlock();

            // Sprint toggle with Ctrl
            if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
                this._sprinting = true;
            }

            // R — toggle dragon riding
            if (e.code === 'KeyR') {
                if (Dog.ridingDragon) {
                    Dog.ridingDragon = null;
                } else {
                    NPCs.dragons.forEach(dr => {
                        if (!dr.userData.tamed) return;
                        const dist = Dog.group.position.distanceTo(dr.position);
                        if (dist < 4 && !Dog.ridingDragon) Dog.ridingDragon = dr;
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
            if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
                this._sprinting = false;
            }
        });

        document.addEventListener('mousemove', e => {
            if (!GAME.started) return;
            let dx, dy;
            if (document.pointerLockElement) {
                dx = e.movementX || 0;
                dy = e.movementY || 0;
            } else {
                if (this._lastMouseX !== null) {
                    dx = e.clientX - this._lastMouseX;
                    dy = e.clientY - this._lastMouseY;
                } else { dx = 0; dy = 0; }
                this._lastMouseX = e.clientX;
                this._lastMouseY = e.clientY;
            }
            Dog.yaw -= dx * 0.003;
            this.cameraPitch += dy * 0.003;
            this.cameraPitch = Math.max(-0.3, Math.min(1.2, this.cameraPitch));
        });

        document.addEventListener('mouseleave', () => {
            this._lastMouseX = null;
            this._lastMouseY = null;
        });

        document.addEventListener('mousedown', () => {
            // Don't grab pointer lock while pause menu is open
            if (GAME.started && !GAME.paused && !document.pointerLockElement) {
                GAME.renderer.domElement.requestPointerLock();
            }
        });

        // Pause menu
        document.addEventListener('keydown', e => {
            if (e.code === 'Escape' && GAME.started) {
                this._togglePause();
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

        this._buildPauseMenu();
    },

    _buildPauseMenu() {
        const overlay = document.createElement('div');
        overlay.id = 'pauseMenu';
        overlay.style.cssText = `
            display:none; position:fixed; top:0; left:0; width:100%; height:100%;
            background:rgba(0,0,0,0.5); z-index:200; pointer-events:all;
            flex-direction:column; align-items:center; justify-content:center; gap:12px;
        `;
        overlay.innerHTML = `
            <div style="color:#ffff55;font-size:20px;font-family:'Press Start 2P',monospace;
                text-shadow:3px 3px 0 #555500;margin-bottom:20px;">ПАУЗА</div>
            <button class="mc-btn" id="pauseResume">Продолжить</button>
            <button class="mc-btn" id="pauseQuit">Выйти в меню</button>
        `;
        document.body.appendChild(overlay);

        const style = document.createElement('style');
        style.textContent = `.mc-btn {
            padding:10px 36px; font-size:10px; font-family:'Press Start 2P',monospace;
            background:#5a7a5a; color:#fff; border:none; cursor:pointer; pointer-events:all;
            border-top:2px solid #8aaa8a; border-left:2px solid #8aaa8a;
            border-right:2px solid #2a4a2a; border-bottom:2px solid #2a4a2a;
            text-shadow:1px 1px 0 #000; letter-spacing:1px;
        }
        .mc-btn:hover { filter:brightness(1.25); }`;
        document.head.appendChild(style);

        document.getElementById('pauseResume').addEventListener('click', () => this._togglePause());
        document.getElementById('pauseQuit').addEventListener('click', () => {
            this._togglePause();
            GAME.started = false;
            document.getElementById('startScreen').style.display = 'flex';
        });

        this._pauseOverlay = overlay;
    },

    _togglePause() {
        GAME.paused = !GAME.paused;
        this._pauseOverlay.style.display = GAME.paused ? 'flex' : 'none';
        if (GAME.paused) {
            document.exitPointerLock();
        } else {
            GAME.renderer.domElement.requestPointerLock();
        }
    },

    update(dt) {
        if (GAME.paused) return false;

        if (Dog.ridingDragon) return this._updateDragonRide(dt);

        const pos = Dog.group.position;
        const isSprinting = this._sprinting && Dog.onGround;
        const speedMult = Dog.inWater ? 0.6 : isSprinting ? 1.5 : 1.0;

        const forwardX = Math.sin(Dog.yaw);
        const forwardZ = Math.cos(Dog.yaw);
        const rightX   = Math.cos(Dog.yaw);
        const rightZ   = -Math.sin(Dog.yaw);

        let mx = 0, mz = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp'])   { mx += forwardX; mz += forwardZ; }
        if (this.keys['KeyS'] || this.keys['ArrowDown'])  { mx -= forwardX; mz -= forwardZ; }
        if (this.keys['KeyA'] || this.keys['ArrowLeft'])  { mx += rightX;   mz += rightZ; }
        if (this.keys['KeyD'] || this.keys['ArrowRight']) { mx -= rightX;   mz -= rightZ; }

        const isMoving = (mx * mx + mz * mz) > 0.01;
        if (isMoving) {
            const len = Math.sqrt(mx * mx + mz * mz);
            mx /= len; mz /= len;
        }

        // === Fly / gravity ===
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

        pos.x += mx * Dog.speed * speedMult * dt;
        pos.z += mz * Dog.speed * speedMult * dt;
        pos.y += Dog.vy * dt;

        // === Dog sit/stand logic ===
        if (isMoving || !Dog.onGround) {
            this._idleTimer = 0;
            if (this._dogSitting) {
                this._dogSitting = false;
                Dog.sitting = false;
            }
        } else if (Dog.onGround) {
            this._idleTimer += dt;
            if (this._idleTimer > 3.0 && !this._dogSitting) {
                this._dogSitting = true;
                Dog.sitting = true;
            }
        }

        // === Camera bob ===
        if (isMoving && Dog.onGround) {
            this._bobPhase += dt * (isSprinting ? 14 : 10);
            this._bobAmount = Math.sin(this._bobPhase) * (isSprinting ? 0.12 : 0.07);
        } else {
            this._bobAmount *= 0.85; // decay
        }

        // === Footstep sounds ===
        if (isMoving && Dog.onGround) {
            const stepInterval = isSprinting ? 0.28 : 0.42;
            this._stepTimer += dt;
            if (this._stepTimer >= stepInterval) {
                this._stepTimer = 0;
                const surface = Dog.inWater ? 'water'
                    : (World.getTerrainY && World.getTerrainY(pos.x, pos.z) > 0.5) ? 'grass' : 'grass';
                Sounds.step(surface);
            }
        } else {
            this._stepTimer = 0;
        }

        // === COLLISION DETECTION ===
        const dogRadius   = 0.8;
        const groundOffset = 1.6;
        let surfaceY = World.getTerrainY ? World.getTerrainY(pos.x, pos.z) : 0;

        World.collidables.forEach(c => {
            const box = c.box;
            const overlapX = pos.x + dogRadius > box.min.x && pos.x - dogRadius < box.max.x;
            const overlapZ = pos.z + dogRadius > box.min.z && pos.z - dogRadius < box.max.z;
            if (overlapX && overlapZ) {
                const dogFeetY = pos.y - groundOffset;
                const dogTopY  = pos.y + 0.7;
                if (Dog.vy <= 0 && dogFeetY <= box.max.y && dogFeetY >= box.max.y - 0.5) {
                    if (box.max.y > surfaceY) surfaceY = box.max.y;
                } else if (dogFeetY < box.max.y && dogTopY > box.min.y) {
                    const pushRight = pos.x + dogRadius - box.min.x;
                    const pushLeft  = box.max.x - (pos.x - dogRadius);
                    const pushBack  = pos.z + dogRadius - box.min.z;
                    const pushFront = box.max.z - (pos.z - dogRadius);
                    const minPush = Math.min(pushLeft, pushRight, pushFront, pushBack);
                    if (minPush === pushRight) pos.x = box.min.x - dogRadius;
                    else if (minPush === pushLeft)  pos.x = box.max.x + dogRadius;
                    else if (minPush === pushBack)  pos.z = box.min.z - dogRadius;
                    else pos.z = box.max.z + dogRadius;
                }
            }
        });

        Items.placedBlocks.forEach(b => {
            const bPos = b.mesh.position;
            const half = GAME.BLOCK_SIZE / 2;
            const bMin = { x: bPos.x-half, y: bPos.y-half, z: bPos.z-half };
            const bMax = { x: bPos.x+half, y: bPos.y+half, z: bPos.z+half };
            const overlapX = pos.x + dogRadius > bMin.x && pos.x - dogRadius < bMax.x;
            const overlapZ = pos.z + dogRadius > bMin.z && pos.z - dogRadius < bMax.z;
            if (overlapX && overlapZ) {
                const dogFeetY = pos.y - groundOffset;
                const dogTopY  = pos.y + 0.7;
                if (Dog.vy <= 0 && dogFeetY <= bMax.y && dogFeetY >= bMax.y - 0.5) {
                    if (bMax.y > surfaceY) surfaceY = bMax.y;
                } else if (dogFeetY < bMax.y && dogTopY > bMin.y) {
                    const pushRight = pos.x + dogRadius - bMin.x;
                    const pushLeft  = bMax.x - (pos.x - dogRadius);
                    const pushBack  = pos.z + dogRadius - bMin.z;
                    const pushFront = bMax.z - (pos.z - dogRadius);
                    const minPush = Math.min(pushLeft, pushRight, pushFront, pushBack);
                    if (minPush === pushRight) pos.x = bMin.x - dogRadius;
                    else if (minPush === pushLeft)  pos.x = bMax.x + dogRadius;
                    else if (minPush === pushBack)  pos.z = bMin.z - dogRadius;
                    else pos.z = bMax.z + dogRadius;
                }
            }
        });

        // Unicorn riding
        Dog.ridingUnicorn = null;
        NPCs.unicorns.forEach(u => {
            if (!u.userData.tamed) return;
            const dx = Math.abs(pos.x - u.position.x);
            const dz = Math.abs(pos.z - u.position.z);
            if (dx < 1.5 && dz < 1.5) {
                const uTopY = u.position.y + 0.65;
                const dogFeetY = pos.y - groundOffset;
                if (Dog.vy <= 0 && dogFeetY <= uTopY && dogFeetY >= uTopY - 0.8) {
                    if (uTopY > surfaceY) { surfaceY = uTopY; Dog.ridingUnicorn = u; }
                }
            }
        });

        // Rainbow bridge
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

        const effectiveGround = surfaceY + groundOffset;
        if (pos.y <= effectiveGround) {
            pos.y = effectiveGround;
            Dog.vy = 0;
            Dog.onGround = true;
        } else {
            Dog.onGround = false;
        }

        // Water check
        if (Dog.onGround && surfaceY < 0.5) {
            let inWater = false;
            World.waterZones.forEach(wz => {
                if (Math.abs(pos.x - wz.cx) < wz.halfW && Math.abs(pos.z - wz.cz) < wz.halfD) inWater = true;
            });
            if (inWater && !this._wasInWater) Sounds.splash();
            if (!inWater && this._wasInWater) Sounds.splash();
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

        if (World.thronePos) {
            const tp = World.thronePos;
            const dx = Math.abs(pos.x - tp.x);
            const dz = Math.abs(pos.z - tp.z);
            const dogFeetY = pos.y - groundOffset;
            Dog.onThrone = (dx < 1.5 && dz < 1.5 && Math.abs(dogFeetY - tp.y) < 0.5);
        }

        // Portal check (dance floor / portal defined in world)
        if (World.portalPos) {
            const pp = World.portalPos;
            const d = Math.sqrt((pos.x-pp.x)**2 + (pos.z-pp.z)**2);
            if (d < 2.5 && !this._portalCooldown) {
                this._portalCooldown = true;
                setTimeout(() => { this._portalCooldown = false; }, 3000);
                // Teleport to lake
                pos.x = 10; pos.z = 10;
                pos.y = 5;
                Effects.showMessage('✨ Телепортация к озеру!');
                Sounds.portal && Sounds.portal();
            }
        }

        return isMoving;
    },

    _updateDragonRide(dt) {
        if (GAME.paused) return false;
        const dragon = Dog.ridingDragon;
        const pos = dragon.position;

        const forwardX = Math.sin(Dog.yaw);
        const forwardZ = Math.cos(Dog.yaw);
        const rightX   = Math.cos(Dog.yaw);
        const rightZ   = -Math.sin(Dog.yaw);

        let mx = 0, mz = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp'])   { mx += forwardX; mz += forwardZ; }
        if (this.keys['KeyS'] || this.keys['ArrowDown'])  { mx -= forwardX; mz -= forwardZ; }
        if (this.keys['KeyA'] || this.keys['ArrowLeft'])  { mx += rightX;   mz += rightZ; }
        if (this.keys['KeyD'] || this.keys['ArrowRight']) { mx -= rightX;   mz -= rightZ; }

        const isMoving = (mx * mx + mz * mz) > 0.01;
        if (isMoving) { const l = Math.sqrt(mx*mx+mz*mz); mx/=l; mz/=l; }

        const dragonSpeed = this._sprinting ? 18 : 12;
        pos.x += mx * dragonSpeed * dt;
        pos.z += mz * dragonSpeed * dt;
        if (this.keys['Space']) pos.y += 8 * dt;
        else if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) pos.y -= 8 * dt;
        pos.y = Math.max(2.0, Math.min(GAME.MAX_HEIGHT, pos.y));

        const bound = GAME.WORLD_SIZE - 2;
        pos.x = Math.max(-bound, Math.min(bound, pos.x));
        pos.z = Math.max(-bound, Math.min(bound, pos.z));

        dragon.rotation.y = Dog.yaw;
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
        // V toggles between close (5) and far (10)
        const baseCamDist = Dog.ridingDragon ? 14 : (this._camClose ? 5 : 10);

        const cx = pos.x - Math.sin(Dog.yaw) * baseCamDist * Math.cos(this.cameraPitch);
        const cz = pos.z - Math.cos(Dog.yaw) * baseCamDist * Math.cos(this.cameraPitch);
        // Lower camera height: +1 instead of +2 so dog fills more of the frame
        const cy = pos.y + baseCamDist * Math.sin(this.cameraPitch) + 1.2 + this._bobAmount;

        this._camTarget.set(cx, cy, cz);
        const smoothFactor = 1 - Math.exp(-18 * dt);
        GAME.camera.position.lerp(this._camTarget, smoothFactor);

        // Look at dog's head/body level (not 1 unit above group)
        this._lookGoal.set(pos.x, pos.y + 0.5, pos.z);
        this._lookTarget.lerp(this._lookGoal, smoothFactor);
        GAME.camera.lookAt(this._lookTarget);
    }
};

Controls.init();
