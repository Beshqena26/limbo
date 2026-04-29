"use client";

import { HOUSE_EDGE, MIN_BET, MAX_BET, MAX_MULTIPLIER } from "../lib/constants";

interface GameInfoModalProps {
  open: boolean;
  onClose: () => void;
}

export default function GameInfoModal({ open, onClose }: GameInfoModalProps) {
  const rtp = ((1 - HOUSE_EDGE) * 100).toFixed(1);

  return (
    <div
      className={`modal-overlay${open ? " show" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <button className="modal-close" onClick={onClose}>
          &times;
        </button>
        <h2>Game Info</h2>
        <div className="modal-payout-box">
          <span className="label">Max Multiplier</span>
          <span className="value">{MAX_MULTIPLIER.toLocaleString()}x</span>
        </div>
        <div className="modal-payout-box">
          <span className="label">Max Win</span>
          <span className="value">${(MAX_BET * MAX_MULTIPLIER).toLocaleString()}</span>
        </div>
        <div className="modal-payout-box">
          <span className="label">Bet Range</span>
          <span className="value">${MIN_BET.toFixed(2)} — ${MAX_BET.toFixed(2)}</span>
        </div>
        <div className="info-box">
          <span className="info-icon">{"\u221E"}</span>
          <p>
            Limbo is a multiplier game. Set your target multiplier, place a bet, and a random
            multiplier is generated. If the result meets or exceeds your target, you win!
          </p>
        </div>
        <h3>How to Play</h3>
        <ol>
          <li>
            <strong>Set your bet</strong> — enter the amount you want to wager.
          </li>
          <li>
            <strong>Choose a target</strong> — pick a multiplier (e.g. 2.00x). Higher targets
            = bigger payouts but lower win chance.
          </li>
          <li>
            <strong>Press BET</strong> — a random multiplier is generated.
          </li>
          <li>
            <strong style={{ color: "#0ECC68" }}>Win</strong> — if the result is
            {" \u2265 "} your target, you win bet &times; target.
          </li>
          <li>
            <strong style={{ color: "#EF4060" }}>Lose</strong> — if the result is below
            your target, you lose your bet.
          </li>
        </ol>
        <h3>Win Chance</h3>
        <div className="mult-table-wrap">
          <table className="mult-table">
            <tbody>
              <tr>
                <th>Target</th>
                <th>Win Chance</th>
                <th>Payout ($10 bet)</th>
              </tr>
              {[1.5, 2, 3, 5, 10, 50, 100].map((t) => (
                <tr key={t}>
                  <td>{t.toFixed(2)}x</td>
                  <td>{((1 - HOUSE_EDGE) / t * 100).toFixed(2)}%</td>
                  <td>${(10 * t).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>House Edge &amp; RTP</h3>
        <div className="info-box">
          <span className="info-icon">{"\uD83D\uDCCA"}</span>
          <p>
            <strong>RTP: {rtp}%</strong> — House edge is {(HOUSE_EDGE * 100).toFixed(1)}%.
            Each round is independent. Max bet ${MAX_BET}. Your payout = bet &times; target multiplier.
          </p>
        </div>
        <h3>Tips</h3>
        <ul>
          <li>Lower targets (1.5x–2x) give you the best win chance.</li>
          <li>Higher targets pay more but hit less often.</li>
          <li>Every outcome is provably fair — tap Fair Play to verify.</li>
          <li>Use Auto mode to run multiple rounds automatically.</li>
          <li>Each round is fully independent — streaks don{"'"}t affect odds.</li>
        </ul>
      </div>
    </div>
  );
}
