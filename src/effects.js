// Shared, short-lived Canvas particles. Velocities use pixels/second, independent of frame rate.
export class ParticleSystem {
  constructor() { this.particles = []; this.pool = []; this.lastTime = 0; this.reduced = false; this.limit = 160; }
  add(values) {
    if (this.reduced || this.particles.length >= this.limit) return;
    const particle = this.pool.pop() || {};
    Object.assign(particle, values);
    this.particles.push(particle);
  }
  burst(kind, x, y) {
    const palettes = { buy: ["#fff3b6", "#e8c46c", "#c7e7a0"], sell: ["#f3d488", "#fff4c6"],
      build: ["#eee0bd", "#be7955"], perfect: ["#fff2bc", "#b7d7a1"], twist: ["#f2d075", "#dc865c", "#fff2c2"] };
    const colors = palettes[kind] || palettes.buy;
    for (let i = 0; i < 22; i++) {
      const angle = i / 22 * Math.PI * 2;
      const speed = 38 + Math.random() * 75;
      this.add({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 30,
        life: .8 + Math.random() * .35, total: 1.15, size: 2 + Math.random() * 3,
        gravity: 90, color: colors[i % colors.length] });
    }
  }
  celebrate(width) {
    const colors = ["#edca77", "#e66b51", "#f7e8b6", "#7cb5ad"];
    for (let i = 0; i < 65; i++) this.add({ x: Math.random() * width, y: -Math.random() * 90,
      vx: (Math.random() - .5) * 80, vy: 35 + Math.random() * 60, life: 2.4, total: 2.4,
      size: 3 + Math.random() * 4, gravity: 35, color: colors[i % colors.length] });
  }
  draw(ctx, now) {
    if (this.reduced) { this.clear(); this.lastTime = now; return; }
    const dt = Math.min(.05, this.lastTime ? (now - this.lastTime) / 1000 : .016);
    this.lastTime = now;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      if (this.particles[i].life <= 0) { this.pool.push(this.particles[i]); this.particles.splice(i, 1); }
    }
    ctx.save();
    for (const particle of this.particles) {
      particle.x += particle.vx * dt; particle.y += particle.vy * dt;
      particle.vy += particle.gravity * dt; particle.life -= dt;
      ctx.globalAlpha = Math.min(1, Math.max(0, particle.life / particle.total * 1.8));
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
    ctx.restore();
  }
  clear() { this.pool.push(...this.particles); this.particles.length = 0; }
}
