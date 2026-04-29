"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { MAX_BET, MIN_BET, MIN_MULTIPLIER, MAX_MULTIPLIER, HOUSE_EDGE } from "../lib/constants";
import { generateMultiplier, fmt, winChance } from "../lib/game-logic";
import { AudioEngine } from "../lib/audio";
import GameInfoModal from "./GameInfoModal";
import ProvablyFairModal from "./ProvablyFairModal";

type GameResult = {
  id: number;
  target: number;
  result: number;
  bet: number;
  payout: number;
  won: boolean;
};

export default function LimboApp() {
  const [balance, setBalance] = useState(1000);
  const [bet, setBet] = useState("10.00");
  const [targetMultiplier, setTargetMultiplier] = useState("2.00");
  const [isPlaying, setIsPlaying] = useState(false);
  const [resultMultiplier, setResultMultiplier] = useState<number | null>(null);
  const [lastWon, setLastWon] = useState<boolean | null>(null);
  const [animatingValue, setAnimatingValue] = useState<number | null>(null);
  const [history, setHistory] = useState<GameResult[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [gameInfoOpen, setGameInfoOpen] = useState(false);
  const [pfModalOpen, setPfModalOpen] = useState(false);
  const [gamePhase, setGamePhase] = useState<"idle" | "counting" | "result">("idle");
  const [showPayout, setShowPayout] = useState<string | null>(null);
  const [particles, setParticles] = useState<{id: number; x: number; y: number; tx: number; ty: number}[]>([]);
  const [alert, setAlert] = useState<string | null>(null);

  // Auto play
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoRounds, setAutoRounds] = useState("10");
  const [autoPlayed, setAutoPlayed] = useState(0);
  const autoRunningRef = useRef(false);
  const autoStopRef = useRef(false);

  const audioRef = useRef<AudioEngine | null>(null);
  const balanceRef = useRef(balance);
  const gameIdRef = useRef(0);

  useEffect(() => { balanceRef.current = balance; }, [balance]);
  useEffect(() => {
    audioRef.current = new AudioEngine();
  }, []);

  const playRound = useCallback(async () => {
    const betAmt = parseFloat(bet);
    const target = parseFloat(targetMultiplier);

    if (!isFinite(betAmt) || betAmt < MIN_BET || betAmt > MAX_BET) return;
    if (!isFinite(target) || target < MIN_MULTIPLIER || target > MAX_MULTIPLIER) return;
    if (betAmt > balanceRef.current) {
      setAlert("Insufficient balance");
      setTimeout(() => setAlert(null), 2500);
      return;
    }
    if (balanceRef.current <= 0) {
      setAlert("You're out of balance");
      setTimeout(() => setAlert(null), 2500);
      return;
    }

    // Reset everything immediately
    setResultMultiplier(null);
    setLastWon(null);
    setAnimatingValue(0);
    setIsPlaying(true);

    await new Promise(r => setTimeout(r, 30));

    setGamePhase("counting");
    const newBal = balanceRef.current - betAmt;
    setBalance(newBal);
    balanceRef.current = newBal;
    audioRef.current?.sndBet();

    const result = await generateMultiplier();

    // Fast count — 300ms total, 10 steps
    const steps = 10;
    const stepTime = 30;

    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const eased = 1 - Math.pow(1 - progress, 2);
      const current = 1 + (result - 1) * eased;
      setAnimatingValue(+current.toFixed(2));
      if (i % 2 === 0) audioRef.current?.sndTick(progress);
      if (i < steps) await new Promise(r => setTimeout(r, stepTime));
    }
    setAnimatingValue(null);

    const won = result >= target;
    const payout = won ? betAmt * target : 0;

    if (won) {
      const winBal = balanceRef.current + payout;
      setBalance(winBal);
      balanceRef.current = winBal;
      setWins(w => w + 1);
      if (target >= 10) {
        audioRef.current?.sndBigWin();
      } else {
        audioRef.current?.sndWin();
      }
    } else {
      setLosses(l => l + 1);
      audioRef.current?.sndLose();
    }

    setResultMultiplier(result);
    setLastWon(won);
    setGamePhase("result");
    setIsPlaying(false);

    if (won) {
      // Floating payout
      setShowPayout(`+${fmt(payout)}`);
      setTimeout(() => setShowPayout(null), 1200);

      // Particles burst
      const newParticles = Array.from({ length: 14 }, (_, i) => {
        const angle = ((360 / 14) * i + Math.random() * 25) * (Math.PI / 180);
        const dist = 60 + Math.random() * 50;
        return {
          id: Date.now() + i,
          x: 50,
          y: 50,
          tx: Math.cos(angle) * dist,
          ty: Math.sin(angle) * dist,
        };
      });
      setParticles(newParticles);
      setTimeout(() => setParticles([]), 800);
    }

    // Reset phase after animation plays
    setTimeout(() => setGamePhase("idle"), 800);

    gameIdRef.current++;
    const entry: GameResult = {
      id: gameIdRef.current,
      target,
      result,
      bet: betAmt,
      payout,
      won,
    };
    setHistory(prev => [entry, ...prev].slice(0, 50));
  }, [bet, targetMultiplier]);

  // Auto play loop
  const startAuto = useCallback(async () => {
    const rounds = parseInt(autoRounds) || 10;
    autoRunningRef.current = true;
    autoStopRef.current = false;
    setAutoRunning(true);
    setAutoPlayed(0);

    for (let i = 0; i < rounds; i++) {
      if (autoStopRef.current || !autoRunningRef.current) break;

      const betAmt = parseFloat(bet);
      if (betAmt > balanceRef.current || balanceRef.current <= 0) break;

      await playRound();
      setAutoPlayed(i + 1);

      if (i < rounds - 1 && !autoStopRef.current) {
        await new Promise(r => setTimeout(r, 800));
      }
    }

    autoRunningRef.current = false;
    setAutoRunning(false);
  }, [autoRounds, bet, playRound]);

  const stopAuto = () => {
    autoStopRef.current = true;
    autoRunningRef.current = false;
    setAutoRunning(false);
  };

  const chance = winChance(parseFloat(targetMultiplier) || 2);
  const displayValue = animatingValue !== null && animatingValue > 0
    ? animatingValue.toFixed(2)
    : resultMultiplier !== null
      ? resultMultiplier.toFixed(2)
      : "1.00";

  const resultClass = lastWon === true ? "result-win" : lastWon === false ? "result-lose" : "";

  const handleSoundToggle = () => {
    const e = audioRef.current?.toggle() ?? true;
    setSoundEnabled(e);
  };

  return (
  <>
    <div className="app">
      {/* Header */}
      <div className="header">
        <div className="header-left">
          <div className="game-name">
            <span className="ico">{"\u221E"}</span>
            <span>Limbo</span>
          </div>
        </div>
        <div className="header-balance">
          <span className="header-bal-icon">{"\uD83D\uDCB0"}</span>
          <span className="header-bal-value">{fmt(balance)}</span>
        </div>
        <div className="header-right">
          <div className="fairplay" onClick={() => setPfModalOpen(true)}>
            Fair Play
          </div>
          <div className="info" onClick={() => setGameInfoOpen(true)}>
            i
          </div>
        </div>
      </div>

      <div className="row">
        {/* Side Panel */}
        <aside className="side">
          {/* Mode Toggle */}
          <div className="mode-toggle">
            <button
              className={mode === "manual" ? "active" : ""}
              onClick={() => setMode("manual")}
              disabled={autoRunning}
            >
              Manual
            </button>
            <button
              className={mode === "auto" ? "active" : ""}
              onClick={() => setMode("auto")}
              disabled={autoRunning}
            >
              Auto
            </button>
          </div>

          {/* === MANUAL TAB === */}
          {mode === "manual" && (
            <div className="tab-panel">
              <div className="field">
                <label className="label">Bet Amount</label>
                <div className="input-row">
                  <span className="currency">$</span>
                  <input
                    type="number"
                    value={bet}
                    onChange={e => setBet(e.target.value)}
                    disabled={isPlaying}
                    min={MIN_BET}
                    max={MAX_BET}
                    step="0.01"
                  />
                  <div className="chips">
                    <button className="chip" onClick={() => setBet(prev => Math.max(MIN_BET, parseFloat(prev) / 2).toFixed(2))} disabled={isPlaying}>&#xBD;</button>
                    <button className="chip" onClick={() => setBet(prev => Math.min(balanceRef.current, MAX_BET, parseFloat(prev) * 2).toFixed(2))} disabled={isPlaying}>2x</button>
                    <button className="chip" onClick={() => setBet(Math.min(balanceRef.current, MAX_BET).toFixed(2))} disabled={isPlaying}>Max</button>
                  </div>
                </div>
              </div>

              <div className="field">
                <label className="label">Target Multiplier</label>
                <div className="input-row target-input">
                  <input
                    type="number"
                    value={targetMultiplier}
                    onChange={e => setTargetMultiplier(e.target.value)}
                    disabled={isPlaying}
                    min={MIN_MULTIPLIER}
                    max={MAX_MULTIPLIER}
                    step="0.01"
                  />
                  <span className="currency">x</span>
                </div>
              </div>

              <div className="side-stats">
                <div className="stat-box">
                  <span className="stat-label">Win Chance</span>
                  <span className="stat-val accent">{chance.toFixed(2)}%</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Payout</span>
                  <span className="stat-val green">{fmt(parseFloat(bet || "0") * parseFloat(targetMultiplier || "0"))}</span>
                </div>
              </div>

              <button
                className="place-btn"
                onClick={playRound}
                disabled={isPlaying}
              >
                {isPlaying ? "Rolling..." : "BET"}
              </button>
            </div>
          )}

          {/* === AUTO TAB === */}
          {mode === "auto" && (
            <div className="tab-panel">
              <div className="field">
                <label className="label">Bet Amount</label>
                <div className="input-row">
                  <span className="currency">$</span>
                  <input
                    type="number"
                    value={bet}
                    onChange={e => setBet(e.target.value)}
                    disabled={autoRunning}
                    min={MIN_BET}
                    max={MAX_BET}
                    step="0.01"
                  />
                  <div className="chips">
                    <button className="chip" onClick={() => setBet(prev => Math.max(MIN_BET, parseFloat(prev) / 2).toFixed(2))} disabled={autoRunning}>&#xBD;</button>
                    <button className="chip" onClick={() => setBet(prev => Math.min(balanceRef.current, MAX_BET, parseFloat(prev) * 2).toFixed(2))} disabled={autoRunning}>2x</button>
                    <button className="chip" onClick={() => setBet(Math.min(balanceRef.current, MAX_BET).toFixed(2))} disabled={autoRunning}>Max</button>
                  </div>
                </div>
              </div>

              <div className="field">
                <label className="label">Target Multiplier</label>
                <div className="input-row target-input">
                  <input
                    type="number"
                    value={targetMultiplier}
                    onChange={e => setTargetMultiplier(e.target.value)}
                    disabled={autoRunning}
                    min={MIN_MULTIPLIER}
                    max={MAX_MULTIPLIER}
                    step="0.01"
                  />
                  <span className="currency">x</span>
                </div>
              </div>

              <div className="side-stats">
                <div className="stat-box">
                  <span className="stat-label">Win Chance</span>
                  <span className="stat-val accent">{chance.toFixed(2)}%</span>
                </div>
              </div>

              <div className="auto-section">
                <span className="auto-section-label">Auto Settings</span>
                <div className="auto-row">
                  <label className="label small">Rounds</label>
                  <input
                    type="number"
                    className="auto-input"
                    value={autoRounds}
                    onChange={e => setAutoRounds(e.target.value)}
                    disabled={autoRunning}
                    min={1}
                    max={1000}
                  />
                </div>
              </div>

              {autoRunning && (
                <div className="auto-progress-bar-wrap">
                  <div className="auto-progress-text">
                    Round {autoPlayed} / {autoRounds}
                  </div>
                  <div className="auto-progress-bar">
                    <div
                      className="auto-progress-fill"
                      style={{ width: `${(autoPlayed / (parseInt(autoRounds) || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {autoRunning ? (
                <button className="stop-btn" onClick={stopAuto}>Stop Auto</button>
              ) : (
                <button className="auto-start-btn" onClick={startAuto} disabled={isPlaying}>
                  Start Auto
                </button>
              )}
            </div>
          )}
        </aside>

        <main className="main">
          {/* Recent Games — horizontal strip under header */}
          <div className="history-bar">
            {history.length === 0 ? (
              <span className="history-empty">No games yet</span>
            ) : (
              history.map(h => (
                <span key={h.id} className={`history-chip ${h.won ? 'hc-win' : 'hc-lose'}`}>
                  {h.result.toFixed(2)}x
                </span>
              ))
            )}
          </div>

          <div className={`game-area phase-${gamePhase} ${resultClass}`}>
            {/* Ambient background */}
            <div className="bg-ambient">
              <div className="stars" />
              <div className="nebula n1" />
              <div className="nebula n2" />
              <div className="infinity-ring ring-1" />
              <div className="infinity-ring ring-2" />
              <div className="infinity-ring ring-3" />
              <div className={`energy-wave ${gamePhase === 'counting' ? 'active' : ''}`} />
              <div className={`energy-wave wave-2 ${gamePhase === 'counting' ? 'active' : ''}`} />
            </div>

            {/* Background flash on result */}
            {gamePhase === "result" && lastWon && <div className="bg-flash win" />}

            {/* Ripple rings on result */}
            {gamePhase === "result" && (
              <>
                <div className={`ripple ${resultClass}`} />
                <div className={`ripple ripple-2 ${resultClass}`} />
              </>
            )}

            <div className="cube-wrap">
              <div className={`cube-track ${resultClass} phase-${gamePhase}`}>
                {(() => {
                  const tgt = parseFloat(targetMultiplier) || 2;
                  const val = animatingValue !== null && animatingValue > 0
                    ? animatingValue
                    : resultMultiplier !== null
                      ? resultMultiplier
                      : 1;
                  const fillPct = tgt <= 1 ? 0 : Math.max(0, Math.min(100, ((val - 1) / (tgt - 1)) * 100));
                  return (
                    <>
                      <div
                        className={`cube-fill ${resultClass} ${animatingValue !== null ? 'animating' : ''}`}
                        style={{ height: `${fillPct}%` }}
                      />
                      {fillPct > 0 && (
                        <div
                          className={`cube-indicator ${resultClass} ${animatingValue !== null ? 'animating' : ''}`}
                          style={{ bottom: `${fillPct}%` }}
                        />
                      )}
                    </>
                  );
                })()}
                <div className={`cube-value ${resultClass} ${animatingValue !== null ? 'animating' : ''} phase-${gamePhase}`}>
                  {displayValue}x
                </div>

                {/* Particles on win */}
                {particles.map(p => (
                  <div
                    key={p.id}
                    className="particle"
                    style={{
                      left: `${p.x}%`,
                      top: `${p.y}%`,
                      '--tx': `${p.tx}px`,
                      '--ty': `${p.ty}px`,
                    } as React.CSSProperties}
                  />
                ))}
              </div>

              {/* Floating payout text */}
              {showPayout && (
                <div className="payout-float">{showPayout}</div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Bottom Bar — same as tower-game */}
      <div className="bottom">
        <div className="bottom-icons">
          <div
            className={`ic sound-toggle${!soundEnabled ? " muted" : ""}`}
            title="Toggle Sound"
            onClick={handleSoundToggle}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path
                className="sound-waves"
                d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"
                style={{ display: soundEnabled ? undefined : "none" }}
              />
            </svg>
          </div>
          <div className="ic" title="Settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
          <div className="ic" title="Fullscreen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
            </svg>
          </div>
          <div className="ic" title="Favorite">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
        </div>
        <div className="bottom-logo">MYBC</div>
      </div>

    </div>

    {alert && !gameInfoOpen && !pfModalOpen && (
      <div className="alert-toast">
        <span className="alert-icon">&#x26A0;</span>
        {alert}
      </div>
    )}

    <GameInfoModal open={gameInfoOpen} onClose={() => setGameInfoOpen(false)} />
    <ProvablyFairModal open={pfModalOpen} onClose={() => setPfModalOpen(false)} />
  </>
  );
}
