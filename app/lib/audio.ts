export class AudioEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  private play(freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.15) {
    if (!this.enabled) return;
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }

  /** Short tick that rises in pitch as progress increases (0..1) */
  sndTick(progress: number) {
    const freq = 300 + progress * 600; // 300Hz -> 900Hz
    this.play(freq, 0.04, 'sine', 0.06);
  }

  sndBet() { this.play(250, 0.12, 'sine', 0.08); }

  sndWin() {
    this.play(660, 0.15, 'sine', 0.12);
    setTimeout(() => this.play(880, 0.15, 'sine', 0.12), 80);
    setTimeout(() => this.play(1100, 0.25, 'sine', 0.14), 160);
    setTimeout(() => this.play(1320, 0.35, 'sine', 0.10), 260);
  }

  sndBigWin() {
    this.play(660, 0.15, 'sine', 0.15);
    setTimeout(() => this.play(880, 0.15, 'sine', 0.15), 80);
    setTimeout(() => this.play(1100, 0.2, 'sine', 0.15), 160);
    setTimeout(() => this.play(1320, 0.2, 'sine', 0.15), 240);
    setTimeout(() => this.play(1540, 0.4, 'sine', 0.18), 320);
    setTimeout(() => this.play(1760, 0.5, 'sine', 0.12), 420);
  }

  sndLose() {
    this.play(200, 0.25, 'sine', 0.08);
    setTimeout(() => this.play(160, 0.3, 'sine', 0.06), 100);
  }

  sndClick() { this.play(500, 0.06, 'square', 0.04); }
}
