"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { MAX_BET, MIN_BET, MIN_MULTIPLIER, MAX_MULTIPLIER } from "../lib/constants";
import { generateMultiplier, fmt, winChance } from "../lib/game-logic";
import { AudioEngine } from "../lib/audio";

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
    if (betAmt > balanceRef.current) return;

    setIsPlaying(true);
    setResultMultiplier(null);
    setLastWon(null);

    const newBal = balanceRef.current - betAmt;
    setBalance(newBal);
    balanceRef.current = newBal;
    audioRef.current?.sndBet();

    // Animate the multiplier spinning
    const animDuration = 600;
    const animStart = Date.now();
    const animInterval = setInterval(() => {
      const elapsed = Date.now() - animStart;
      if (elapsed >= animDuration) {
        clearInterval(animInterval);
        return;
      }
      setAnimatingValue(+(Math.random() * 10 + 1).toFixed(2));
    }, 50);

    const result = await generateMultiplier();

    // Wait for animation to finish
    await new Promise(r => setTimeout(r, Math.max(0, animDuration - (Date.now() - animStart))));
    clearInterval(animInterval);
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
    setIsPlaying(false);

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
  const displayValue = animatingValue !== null
    ? animatingValue.toFixed(2)
    : resultMultiplier !== null
      ? resultMultiplier.toFixed(2)
      : "0.00";

  const resultClass = lastWon === true ? "result-win" : lastWon === false ? "result-lose" : "";

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <span className="game-name">
            <span className="ico">&#x221E;</span>
            <span>Limbo</span>
          </span>
        </div>
        <div className="header-balance">
          <span className="header-bal-icon">&#x1F4B0;</span>
          <span className="header-bal-value">{fmt(balance)}</span>
        </div>
        <div className="header-right">
          <div className="stats">
            <span className="stat-win">W: {wins}</span>
            <span className="stat-lose">L: {losses}</span>
          </div>
          <button className="sound-btn" onClick={() => {
            const e = audioRef.current?.toggle() ?? true;
            setSoundEnabled(e);
          }}>
            {soundEnabled ? "\u{1F50A}" : "\u{1F507}"}
          </button>
        </div>
      </header>

      <div className="row">
        {/* Side Panel */}
        <aside className="side">
          {/* Bet Amount */}
          <div className="field">
            <label className="label">Bet Amount</label>
            <div className="input-row">
              <span className="currency">$</span>
              <input
                type="number"
                value={bet}
                onChange={e => setBet(e.target.value)}
                disabled={isPlaying || autoRunning}
                min={MIN_BET}
                max={MAX_BET}
                step="0.01"
              />
              <div className="chips">
                <button className="chip" onClick={() => setBet(prev => Math.max(MIN_BET, parseFloat(prev) / 2).toFixed(2))} disabled={isPlaying || autoRunning}>&#xBD;</button>
                <button className="chip" onClick={() => setBet(prev => Math.min(balanceRef.current, MAX_BET, parseFloat(prev) * 2).toFixed(2))} disabled={isPlaying || autoRunning}>2x</button>
                <button className="chip" onClick={() => setBet(Math.min(balanceRef.current, MAX_BET).toFixed(2))} disabled={isPlaying || autoRunning}>Max</button>
              </div>
            </div>
          </div>

          {/* Target Multiplier */}
          <div className="field">
            <label className="label">Target Multiplier</label>
            <div className="input-row target-input">
              <input
                type="number"
                value={targetMultiplier}
                onChange={e => setTargetMultiplier(e.target.value)}
                disabled={isPlaying || autoRunning}
                min={MIN_MULTIPLIER}
                max={MAX_MULTIPLIER}
                step="0.01"
              />
              <span className="currency">x</span>
            </div>
          </div>

          {/* Quick targets */}
          <div className="quick-targets">
            {[1.5, 2, 3, 5, 10, 50].map(t => (
              <button
                key={t}
                className={`target-chip ${parseFloat(targetMultiplier) === t ? 'selected' : ''}`}
                onClick={() => setTargetMultiplier(t.toFixed(2))}
                disabled={isPlaying || autoRunning}
              >
                {t}x
              </button>
            ))}
          </div>

          {/* Win Chance */}
          <div className="chance-display">
            <span className="label">Win Chance</span>
            <span className="chance-value">{chance.toFixed(2)}%</span>
          </div>

          {/* Potential Payout */}
          <div className="chance-display">
            <span className="label">Payout on Win</span>
            <span className="payout-value">{fmt(parseFloat(bet || "0") * parseFloat(targetMultiplier || "0"))}</span>
          </div>

          {/* Play Button */}
          {!autoRunning && (
            <button
              className="place-btn"
              onClick={playRound}
              disabled={isPlaying}
            >
              {isPlaying ? "Rolling..." : "BET"}
            </button>
          )}

          {/* Auto Play Section */}
          <div className="auto-section">
            <span className="auto-section-label">Auto Play</span>
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
            {autoRunning ? (
              <>
                <div className="auto-progress-text">
                  Round {autoPlayed}/{autoRounds}
                </div>
                <button className="stop-btn" onClick={stopAuto}>Stop</button>
              </>
            ) : (
              <button className="auto-start-btn" onClick={startAuto} disabled={isPlaying}>
                Start Auto
              </button>
            )}
          </div>
        </aside>

        {/* Main Area */}
        <main className="main">
          <div className="game-area">
            {/* Result Display */}
            <div className={`result-display ${resultClass} ${animatingValue !== null ? 'animating' : ''}`}>
              <span className="result-value">{displayValue}x</span>
            </div>

            {/* Multiplier arc/meter visual */}
            <div className="meter-container">
              <div className="meter-track">
                <div
                  className="meter-fill"
                  style={{
                    width: resultMultiplier !== null
                      ? `${Math.min(100, (resultMultiplier / (parseFloat(targetMultiplier) || 2)) * 50)}%`
                      : '0%'
                  }}
                />
                <div
                  className="meter-target"
                  style={{ left: '50%' }}
                >
                  <span className="meter-target-label">{parseFloat(targetMultiplier || "2").toFixed(2)}x</span>
                </div>
              </div>
            </div>

            {/* History */}
            <div className="history">
              <div className="history-title">Recent Games</div>
              <div className="history-list">
                {history.length === 0 && <div className="history-empty">No games yet</div>}
                {history.map(h => (
                  <div key={h.id} className={`history-item ${h.won ? 'h-win' : 'h-lose'}`}>
                    <span className="h-result">{h.result.toFixed(2)}x</span>
                    <span className="h-target">/{h.target.toFixed(2)}x</span>
                    <span className={`h-payout ${h.won ? 'h-payout-win' : ''}`}>
                      {h.won ? `+${fmt(h.payout)}` : `-${fmt(h.bet)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
