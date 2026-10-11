import React, { useState, useEffect } from 'react';
import { getScans } from '../utils/api';
import { GRADE_META } from '../utils/helpers';
import { Trophy, Shield, Globe, TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';
import './Leaderboard.css';

function RankBadge({ rank }) {
  if (rank === 1) return <span className="lb-rank gold">🥇</span>;
  if (rank === 2) return <span className="lb-rank silver">🥈</span>;
  if (rank === 3) return <span className="lb-rank bronze">🥉</span>;
  return <span className="lb-rank lb-rank-num">#{rank}</span>;
}

export default function Leaderboard({ onScanOpen }) {
  const [scans, setScans]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getScans(20)
      .then(data => {
        // Filter only completed scans, sort by risk score descending (higher = safer)
        const completed = data
          .filter(s => s.status === 'completed' && s.summary?.riskScore !== undefined)
          .sort((a, b) => (b.summary.riskScore ?? 0) - (a.summary.riskScore ?? 0));
        setScans(completed);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="leaderboard">
        <div className="lb-header">
          <Trophy size={16} color="var(--med)" />
          <h3>Security Leaderboard</h3>
        </div>
        <div className="lb-list">
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10 }} />)}
        </div>
      </div>
    );
  }

  if (scans.length === 0) {
    return (
      <div className="leaderboard">
        <div className="lb-header">
          <Trophy size={16} color="var(--med)" />
          <h3>Security Leaderboard</h3>
        </div>
        <div className="lb-empty">
          <Shield size={24} />
          <p>Run your first scan to appear on the leaderboard!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="leaderboard">
      <div className="lb-header">
        <Trophy size={16} color="var(--med)" />
        <h3>Security Leaderboard</h3>
        <span className="lb-subtitle">Ranked by security score</span>
      </div>
      <div className="lb-list">
        {scans.slice(0, 10).map((scan, i) => {
          const gm = GRADE_META[scan.summary?.grade] || {};
          const score = scan.summary?.riskScore ?? 0;
          return (
            <div
              key={scan.scanId}
              className={`lb-row ${i < 3 ? 'lb-row--top' : ''}`}
              onClick={() => onScanOpen?.(scan.scanId)}
            >
              <RankBadge rank={i + 1} />
              <div className="lb-url">
                <Globe size={11} />
                <span>{scan.url?.replace(/^https?:\/\//, '')}</span>
              </div>
              <div className="lb-grade" style={{ color: gm.color }}>
                {scan.summary?.grade}
              </div>
              <div className="lb-score" style={{ color: gm.color }}>
                {score}
                <span className="lb-score-max">/100</span>
              </div>
              <ChevronRight size={13} color="var(--text-4)" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
