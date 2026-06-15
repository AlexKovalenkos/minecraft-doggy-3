// ============================================================
// main.js — Игровой цикл
// ============================================================

let lastStepSound = 0;
let lastWingSound = 0;

function gameLoop() {
    requestAnimationFrame(gameLoop);
    const dt = Math.min(GAME.clock.getDelta(), 0.05);
    GAME.animTime += dt;
    const t = GAME.animTime;

    if (!GAME.started) {
        GAME.renderer.render(GAME.scene, GAME.camera);
        return;
    }

    // Movement
    const isMoving = Controls.update(dt);

    // Dog animation
    Dog.animate(dt, t, isMoving);

    // Camera
    Controls.updateCamera(dt);

    // HUD height
    document.getElementById('heightVal').textContent = Math.max(0, Math.round(Dog.group.position.y - 1.6));

    // Sounds
    if (isMoving && Dog.onGround && t - lastStepSound > 0.3) {
        Sounds.step();
        lastStepSound = t;
    }
    if (!Dog.onGround && t - lastWingSound > 0.2) {
        Sounds.wing();
        lastWingSound = t;
    }

    // Updates
    Items.update(dt, t);
    NPCs.update(dt, t);
    World.update(dt);
    Effects.update(dt);

    GAME.renderer.render(GAME.scene, GAME.camera);
}

gameLoop();
