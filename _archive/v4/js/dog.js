// ============================================================
// dog.js — Модель Тёпы и анимации
// Все части на this.group напрямую, без inner model
// Модель смотрит в +X, компенсация rotation.y = yaw - PI/2
// ============================================================

const Dog = {
    group: new THREE.Group(),
    pivots: {},

    // Physics
    vy: 0,
    speed: 8,
    flySpeed: 6,
    gravity: -15,
    isFlying: false,
    onGround: true,

    // Direction
    yaw: 0,

    init() {
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb5651d });
        const bodyLightMat = new THREE.MeshStandardMaterial({ color: 0xc47a2e });
        const headTopMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
        const noseMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
        const wingDotMat = new THREE.MeshStandardMaterial({ color: 0x2244aa });

        const g = this.group;

        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 1.6), bodyMat);
        body.castShadow = true;
        g.add(body);
        this.body = body;

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.2, 1.3), bodyLightMat);
        head.position.set(1.55, 0.3, 0);
        head.castShadow = true;
        g.add(head);
        this.head = head;

        // Head top (dark cap)
        const headTop = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 1.3), headTopMat);
        headTop.position.set(1.55, 0.9, 0);
        headTop.castShadow = true;
        g.add(headTop);

        // Eyes
        const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.1), eyeMat);
        eyeL.position.set(2.1, 0.4, 0.32);
        g.add(eyeL);
        const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.1), eyeMat);
        eyeR.position.set(2.1, 0.4, -0.32);
        g.add(eyeR);

        // Eye whites
        const eyeWMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const ewL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.05), eyeWMat);
        ewL.position.set(2.13, 0.5, 0.38);
        g.add(ewL);
        const ewR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.05), eyeWMat);
        ewR.position.set(2.13, 0.5, -0.25);
        g.add(ewR);

        // Nose
        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.25), noseMat);
        nose.position.set(2.15, 0.1, 0);
        g.add(nose);

        // Mouth
        const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.4), noseMat);
        mouth.position.set(2.12, -0.02, 0);
        g.add(mouth);

        // Ears
        const earGeom = new THREE.BoxGeometry(0.35, 0.55, 0.3);
        const earL = new THREE.Mesh(earGeom, headTopMat);
        earL.position.set(1.35, 1.15, 0.35);
        earL.rotation.z = 0.15;
        earL.castShadow = true;
        g.add(earL);

        const earR = new THREE.Mesh(earGeom, headTopMat);
        earR.position.set(1.35, 1.15, -0.35);
        earR.rotation.z = -0.15;
        earR.castShadow = true;
        g.add(earR);

        // Legs with pivots for animation
        const legGeom = new THREE.BoxGeometry(0.4, 0.9, 0.4);
        const legPositions = [
            { name: 'FL', x: 0.8, z: 0.5 },
            { name: 'FR', x: 0.8, z: -0.5 },
            { name: 'BL', x: -0.8, z: 0.5 },
            { name: 'BR', x: -0.8, z: -0.5 }
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
        tailPivot.position.set(-1.2, 0, 0);
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), bodyMat);
        tail.position.set(0, -0.35, 0);
        tail.castShadow = true;
        tailPivot.add(tail);
        g.add(tailPivot);
        this.pivots.tail = tailPivot;

        // Wings with blue dots
        this._buildWing('L', wingMat, wingDotMat, 0.8, 1);
        this._buildWing('R', wingMat, wingDotMat, -0.8, -1);

        g.position.set(0, 1.6, 0);
        GAME.scene.add(g);
    },

    _buildWing(side, wingMat, dotMat, zOffset, zDir) {
        const pivot = new THREE.Group();
        pivot.position.set(-0.2, 0.5, zOffset);

        const wing = new THREE.Group();

        const plane = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 1.5), wingMat);
        plane.position.set(0, 0, 0.75 * zDir);
        plane.castShadow = true;
        wing.add(plane);

        const tip = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.5), wingMat);
        tip.position.set(0, 0, 1.6 * zDir);
        wing.add(tip);

        for (let col = -0.6; col <= 0.6; col += 0.6) {
            for (let row = 0; row < 2; row++) {
                const dot = new THREE.Mesh(
                    new THREE.BoxGeometry(0.25, 0.14, 0.25),
                    dotMat
                );
                dot.position.set(col, 0.07, (0.4 + row * 0.55) * zDir);
                wing.add(dot);
            }
        }

        pivot.add(wing);
        this.group.add(pivot);
        this.pivots['wing' + side] = pivot;
    },

    animate(dt, t, isMoving) {
        const walkSpeed = 10;
        const flyWingSpeed = 12;
        const flying = this.isFlying || !this.onGround;

        // Legs
        if (isMoving && this.onGround) {
            const a = Math.sin(t * walkSpeed) * 0.5;
            this.pivots.legFL.rotation.x = a;
            this.pivots.legBR.rotation.x = a;
            this.pivots.legFR.rotation.x = -a;
            this.pivots.legBL.rotation.x = -a;
        } else if (flying) {
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
            const wa = Math.sin(t * flyWingSpeed) * 0.5;
            this.pivots.wingL.rotation.x = wa;
            this.pivots.wingR.rotation.x = -wa;
        } else {
            const ra = Math.sin(t * 2) * 0.03;
            this.pivots.wingL.rotation.x = ra;
            this.pivots.wingR.rotation.x = -ra;
        }

        // Tail wag
        this.pivots.tail.rotation.z = Math.sin(t * 6) * 0.35;
        this.pivots.tail.rotation.x = -0.2 + Math.sin(t * 3) * 0.1;

        // Body bob
        if (isMoving && this.onGround) {
            const bob = Math.sin(t * walkSpeed * 2) * 0.05;
            this.body.position.y = bob;
            this.head.position.y = 0.3 + bob;
        }
    }
};

Dog.init();
