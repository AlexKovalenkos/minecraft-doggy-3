// ============================================================
// main.js — Игровой цикл
// ============================================================

Save.init();

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

    const isMoving = Controls.update(dt);
    Dog.animate(dt, t, isMoving);
    Controls.updateCamera(dt);

    document.getElementById('heightVal').textContent = Math.max(0, Math.round(Dog.group.position.y - 1.6));

    if (isMoving && Dog.onGround && t - lastStepSound > 0.3) {
        Sounds.step();
        lastStepSound = t;
    }
    if (!Dog.onGround && t - lastWingSound > 0.2) {
        Sounds.wing();
        lastWingSound = t;
    }

    Items.update(dt, t);
    NPCs.update(dt, t);
    World.update(dt);
    Effects.update(dt);
    Save.update(dt);

    GAME.renderer.render(GAME.scene, GAME.camera);
}

gameLoop();
