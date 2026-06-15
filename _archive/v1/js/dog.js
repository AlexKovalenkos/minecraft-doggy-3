// ============================================================
// dog.js — Модель Тёпы и анимации
// ============================================================

const Dog = {
    group: new THREE.Group(),
    pivots: {},

    // Физика
    vy: 0,
    speed: 8,
    flySpeed: 6,
    gravity: -15,
    isFlying: false,
    onGround: true,

    // Направление (yaw управляется мышью)
    yaw: 0,

    init() {
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb5651d });
        const bodyLightMat = new THREE.MeshStandardMaterial({ color: 0xc47a2e });
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
        const noseMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
        const wingDotMat = new THREE.MeshStandardMaterial({ color: 0x2244aa });

        const g = this.group;

        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 1.4), bodyMat);
        body.castShadow = true;
        g.add(body);
        this.body = body;

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), bodyLightMat);
        head.position.set(1.5, 0.3, 0);
        head.castShadow = true;
        g.add(head);
        this.head = head;

        // Eyes
        const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.1), eyeMat);
        eyeL.position.set(1.95, 0.45, 0.3);
        g.add(eyeL);
        const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.1), eyeMat);
        eyeR.position.set(1.95, 0.45, -0.3);
        g.add(eyeR);

        // Nose
        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.2), noseMat);
        nose.position.set(2.05, 0.15, 0);
        g.add(nose);

        // Ear
        const ear = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.3), bodyMat);
        ear.position.set(1.3, 1.05, 0.25);
        ear.castShadow = true;
        g.add(ear);

        // Legs (with pivots for animation)
        const legGeom = new THREE.BoxGeometry(0.35, 0.9, 0.35);
        const legPositions = [
            { name: 'FL', x: 0.8, z: 0.4 },
            { name: 'FR', x: 0.8, z: -0.4 },
            { name: 'BL', x: -0.8, z: 0.4 },
            { name: 'BR', x: -0.8, z: -0.4 }
        ];

        legPositions.forEach(lp => {
            const pivot = new THREE.Group();
            pivot.position.set(lp.x, -0.7, lp.z);
            const leg = new THREE.Mesh(legGeom, bodyMat);
            leg.position.y = -0.45;
            leg.castShadow = true;
            pivot.add(leg);
            g.add(pivot);
            this.pivots['leg' + lp.name] = pivot;
        });

        // Tail
        const tailPivot = new THREE.Group();
        tailPivot.position.set(-1.2, 0.3, 0);
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), bodyMat);
        tail.position.set(-0.15, 0.3, 0);
        tail.castShadow = true;
        tailPivot.add(tail);
        g.add(tailPivot);
        this.pivots.tail = tailPivot;

        // Wings
        this._buildWing('L', wingMat, wingDotMat, 0.7, 1);
        this._buildWing('R', wingMat, wingDotMat, -0.7, -1);

        g.position.set(0, 1.6, 0);
        GAME.scene.add(g);
    },

    _buildWing(side, wingMat, dotMat, zOffset, zDir) {
        const pivot = new THREE.Group();
        pivot.position.set(0, 0.5, zOffset);
        const wing = new THREE.Group();

        const plane = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 1.0), wingMat);
        plane.position.set(0, 0, 0.5 * zDir);
        plane.castShadow = true;
        wing.add(plane);

        // Blue dots
        for (let dx = -0.5; dx <= 0.5; dx += 0.5) {
            for (let dz = 0.15; dz <= 0.75; dz += 0.3) {
                const dot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.18), dotMat);
                dot.position.set(dx, 0.06, dz * zDir);
                wing.add(dot);
            }
        }

        pivot.add(wing);
        this.group.add(pivot);
        this.pivots['wing' + side] = pivot;
    },

    // Анимация
    animate(dt, t, isMoving) {
        const walkSpeed = 10;
        const flyWingSpeed = 15;
        const flying = this.isFlying || !this.onGround;

        // Legs
        if (isMoving && this.onGround) {
            const a = Math.sin(t * walkSpeed) * 0.5;
            this.pivots.legFL.rotation.x = a;
            this.pivots.legBR.rotation.x = a;
            this.pivots.legFR.rotation.x = -a;
            this.pivots.legBL.rotation.x = -a;
        } else if (flying) {
            // Tuck legs when flying
            this.pivots.legFL.rotation.x = 0.3;
            this.pivots.legFR.rotation.x = 0.3;
            this.pivots.legBL.rotation.x = -0.3;
            this.pivots.legBR.rotation.x = -0.3;
        } else {
            ['legFL', 'legFR', 'legBL', 'legBR'].forEach(k => {
                this.pivots[k].rotation.x *= 0.9;
            });
        }

        // Wings
        if (flying) {
            const wa = Math.sin(t * flyWingSpeed) * 0.6;
            this.pivots.wingL.rotation.x = wa;
            this.pivots.wingR.rotation.x = -wa;
        } else {
            const ra = Math.sin(t * 2) * 0.05;
            this.pivots.wingL.rotation.x = ra;
            this.pivots.wingR.rotation.x = -ra;
        }

        // Tail
        this.pivots.tail.rotation.y = Math.sin(t * 6) * 0.4;

        // Body bob
        if (isMoving && this.onGround) {
            const bob = Math.sin(t * walkSpeed * 2) * 0.05;
            this.body.position.y = bob;
            this.head.position.y = 0.3 + bob;
        }
    }
};

Dog.init();
