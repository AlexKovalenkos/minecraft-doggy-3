// ============================================================
// main.js — Игровой цикл
// ============================================================

Save.init();

let lastStepSound = 0;
let lastWingSound = 0;
let lastDustTime = 0;

function gameLoop() {
    requestAnimationFrame(gameLoop);
    const dt = Math.min(GAME.clock.getDelta(), 0.05);
    GAME.animTime += dt;
    const t = GAME.animTime;

    if (!GAME.started) {
        GAME.renderer.render(GAME.scene, GAME.camera);
        return;
    }

    const isMoving = Controls.update(dt);
    Dog.animate(dt, t, isMoving);
    Controls.updateCamera(dt);

    // Height display
    const heightRef = Dog.ridingDragon
        ? Math.max(0, Math.round(Dog.ridingDragon.position.y))
        : Math.max(0, Math.round(Dog.group.position.y - 1.6));
    document.getElementById('heightVal').textContent = heightRef;

    if (isMoving && Dog.onGround && !Dog.ridingDragon && t - lastStepSound > 0.3) {
        Sounds.step();
        lastStepSound = t;
    }
    if (!Dog.onGround && !Dog.ridingDragon && t - lastWingSound > 0.2) {
        Sounds.wing();
        lastWingSound = t;
    }

    // Dust particles when running on ground
    if (isMoving && Dog.onGround && !Dog.inWater && !Dog.ridingDragon && t - lastDustTime > 0.3) {
        const pos = Dog.group.position;
        Effects.spawnParticles(pos.x, 0.2, pos.z, 0xd4a574, 2);
        lastDustTime = t;
    }

    Items.update(dt, t);
    NPCs.update(dt, t);

    // Riding sync: dog follows unicorn position
    if (Dog.ridingUnicorn && !Dog.ridingDragon) {
        Dog.group.position.x = Dog.ridingUnicorn.position.x;
        Dog.group.position.z = Dog.ridingUnicorn.position.z;
        Dog.group.position.y = Dog.ridingUnicorn.position.y + 0.65 + 1.6;
    }

    // Shadow follow — sun target follows dog on large map
    GAME.sun.target.position.copy(Dog.group.position);
    GAME.sun.target.updateMatrixWorld();
    GAME.sun.position.set(
        Dog.group.position.x + 40,
        80,
        Dog.group.position.z + 30
    );

    World.update(dt);
    Effects.update(dt);
    Save.update(dt);

    GAME.renderer.render(GAME.scene, GAME.camera);
}

gameLoop();
