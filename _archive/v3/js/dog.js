// ============================================================
// dog.js — Модель Тёпы и анимации (v2)
//
// По оригинальному рисунку:
// - Два уха сверху головы
// - Тёмная "шапочка" на голове
// - Хвост свисает вниз, виляет вбок
// - Крылья широкие, плоские, в стороны (как у пчёлки)
//   с сеткой синих точек 3 столбца × 2 ряда
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

    // Направление
    yaw: 0,

    init() {
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb5651d });
        const bodyLightMat = new THREE.MeshStandardMaterial({ color: 0xc47a2e });
        const headTopMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // тёмная шапочка
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
        const noseMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
        const wingDotMat = new THREE.MeshStandardMaterial({ color: 0x2244aa });

        const g = this.group;

        // Body — основное тело
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 1.6), bodyMat);
        body.castShadow = true;
        g.add(body);
        this.body = body;

        // Head — голова чуть светлее
        const head = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.2, 1.3), bodyLightMat);
        head.position.set(1.55, 0.3, 0);
        head.castShadow = true;
        g.add(head);
        this.head = head;

        // Head top — тёмная шапочка (как на пиксельарте)
        const headTop = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 1.3), headTopMat);
        headTop.position.set(1.55, 0.9, 0);
        headTop.castShadow = true;
        g.add(headTop);

        // Eyes — большие тёмные глаза
        const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.1), eyeMat);
        eyeL.position.set(2.1, 0.4, 0.32);
        g.add(eyeL);
        const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.1), eyeMat);
        eyeR.position.set(2.1, 0.4, -0.32);
        g.add(eyeR);

        // Eye whites (маленький блик)
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

        // Mouth hint
        const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.4), noseMat);
        mouth.position.set(2.12, -0.02, 0);
        g.add(mouth);

        // === ДВА УХА (по оригиналу) ===
        const earGeom = new THREE.BoxGeometry(0.35, 0.55, 0.3);
        const earL = new THREE.Mesh(earGeom, headTopMat);
        earL.position.set(1.35, 1.15, 0.35);
        earL.rotation.z = 0.15; // чуть наклон наружу
        earL.castShadow = true;
        g.add(earL);

        const earR = new THREE.Mesh(earGeom, headTopMat);
        earR.position.set(1.35, 1.15, -0.35);
        earR.rotation.z = -0.15;
        earR.castShadow = true;
        g.add(earR);

        // === НОГИ (с пивотами для анимации) ===
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

        // === ХВОСТ — свисает вниз (по оригиналу) ===
        const tailPivot = new THREE.Group();
        tailPivot.position.set(-1.2, 0, 0);
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), bodyMat);
        tail.position.set(0, -0.35, 0); // свисает вниз
        tail.castShadow = true;
        tailPivot.add(tail);
        g.add(tailPivot);
        this.pivots.tail = tailPivot;

        // === КРЫЛЬЯ — широкие, плоские, в стороны (по оригиналу) ===
        // Крылья состоят из 3×2 ячеек с синими точками
        this._buildWing('L', wingMat, wingDotMat, 0.8, 1);
        this._buildWing('R', wingMat, wingDotMat, -0.8, -1);

        g.position.set(0, 1.6, 0);
        GAME.scene.add(g);
    },

    _buildWing(side, wingMat, dotMat, zOffset, zDir) {
        const pivot = new THREE.Group();
        pivot.position.set(-0.2, 0.5, zOffset);

        const wing = new THREE.Group();

        // Основа крыла — широкая плоская пластина
        // По оригиналу: крыло ~4 блока в ширину, ~3 в длину
        const plane = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 1.5), wingMat);
        plane.position.set(0, 0, 0.75 * zDir);
        plane.castShadow = true;
        wing.add(plane);

        // Закруглённый край (дополнительная секция)
        const tip = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.5), wingMat);
        tip.position.set(0, 0, 1.6 * zDir);
        wing.add(tip);

        // Синие точки 3 столбца × 2 ряда (как на рисунке)
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

    // Анимация
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

        // Wings — машут вверх-вниз (вращение по Z для бокового взмаха)
        if (flying) {
            const wa = Math.sin(t * flyWingSpeed) * 0.5;
            this.pivots.wingL.rotation.x = wa;
            this.pivots.wingR.rotation.x = -wa;
        } else {
            // Лёгкое покачивание в покое
            const ra = Math.sin(t * 2) * 0.03;
            this.pivots.wingL.rotation.x = ra;
            this.pivots.wingR.rotation.x = -ra;
        }

        // Tail — виляет вбок (по Z)
        this.pivots.tail.rotation.z = Math.sin(t * 6) * 0.35;
        // Лёгкое покачивание вперёд-назад
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
