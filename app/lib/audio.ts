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

  sndBet() { this.play(220, 0.15, 'sine', 0.1); }
  sndWin() { this.play(880, 0.3, 'sine', 0.15); this.play(1100, 0.3, 'sine', 0.1); }
  sndLose() { this.play(150, 0.4, 'triangle', 0.12); }
  sndClick() { this.play(600, 0.08, 'square', 0.05); }
  sndBigWin() { this.play(880, 0.5, 'sine', 0.2); setTimeout(() => this.play(1320, 0.5, 'sine', 0.15), 150); }
}
