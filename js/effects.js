// ============================================================
// effects.js — Партиклы и сообщения
// ============================================================

const Effects = {
    particles: [],
    messageTimer: 0,

    spawnParticles(x, y, z, color, count) {
        count = count || 8;
        for (let i = 0; i < count; i++) {
            const s = 0.1 + Math.random() * 0.15;
            const p = new THREE.Mesh(
                new THREE.BoxGeometry(s, s, s),
                new THREE.MeshBasicMaterial({ color, transparent: true })
            );
            p.position.set(x, y, z);
            p.userData = {
                vx: (Math.random() - 0.5) * 4,
                vy: 2 + Math.random() * 3,
                vz: (Math.random() - 0.5) * 4,
                life: 1.0
            };
            GAME.scene.add(p);
            this.particles.push(p);
        }
    },

    spawnHearts(x, y, z) {
        for (let i = 0; i < 5; i++) {
            const s = 0.2 + Math.random() * 0.15;
            const p = new THREE.Mesh(
                new THREE.BoxGeometry(s, s * 0.8, s * 0.3),
                new THREE.MeshBasicMaterial({ color: 0xff69b4, transparent: true })
            );
            p.position.set(x + (Math.random() - 0.5) * 2, y, z + (Math.random() - 0.5) * 2);
            p.userData = {
                vx: (Math.random() - 0.5),
                vy: 1.5 + Math.random() * 2,
                vz: (Math.random() - 0.5),
                life: 1.5
            };
            GAME.scene.add(p);
            this.particles.push(p);
        }
    },

    showMessage(text) {
        const el = document.getElementById('message');
        el.textContent = text;
        el.style.opacity = 1;
        this.messageTimer = 2;
    },

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            const d = p.userData;
            d.life -= dt;
            if (d.life <= 0) {
                GAME.scene.remove(p);
                this.particles.splice(i, 1);
                continue;
            }
            p.position.x += d.vx * dt;
            p.position.y += d.vy * dt;
            p.position.z += d.vz * dt;
            d.vy -= 5 * dt;
            p.material.opacity = d.life;
            p.scale.setScalar(d.life);
        }

        if (this.messageTimer > 0) {
            this.messageTimer -= dt;
            if (this.messageTimer <= 0) {
                document.getElementById('message').style.opacity = 0;
            }
        }
    }
};
