// One clock for simulation and coffee challenges. Pauses never accumulate catch-up time.
export class GameClock {
  constructor(dayMs = 3500) {
    this.dayMs = dayMs;
    this.reasons = new Set();
    this.last = null;
    this.dayElapsed = 0;
    this.elapsed = 0;
  }
  get paused() { return this.reasons.size > 0; }
  pause(reason) { this.reasons.add(reason); this.last = null; }
  resume(reason) { this.reasons.delete(reason); this.last = null; }
  reset() { this.last = null; this.dayElapsed = 0; this.elapsed = 0; }
  advance(now) {
    const previous = this.last;
    this.last = now;
    if (previous === null || this.paused) return { delta: 0, ticks: 0 };
    const delta = Math.max(0, Math.min(100, now - previous));
    this.elapsed += delta;
    this.dayElapsed += delta;
    const ticks = Math.floor(this.dayElapsed / this.dayMs);
    this.dayElapsed %= this.dayMs;
    return { delta, ticks };
  }
}
