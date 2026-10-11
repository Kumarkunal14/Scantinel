import React, { useState } from 'react';
import { GRADE_META, SEVERITY_META, formatDate, formatDuration } from '../utils/helpers';
import { ArrowLeft, ArrowRight, CheckCircle, AlertTriangle, TrendingUp, TrendingDown, Minus, Globe, Shield } from 'lucide-react';
import './ScanCompare.css';

function diffFindings(scanA, scanB) {
  const aIds  = new Set((scanA.findings || []).map(f => f.title));
  const bIds  = new Set((scanB.findings || []).map(f => f.title));
  const fixed = (scanA.findings || []).filter(f => !bIds.has(f.title));   // in A, not in B = fixed
  const newFs = (scanB.findings || []).filter(f => !aIds.has(f.title));   // in B, not in A = new
  const same  = (scanB.findings || []).filter(f => aIds.has(f.title));    // in both
  return { fixed, new: newFs, same };
}

function GradeChip({ grade, score }) {
  const gm = GRADE_META[grade] || { color: 'var(--text-3)' };
  return (
    <div className="compare-grade-chip" style={{ color: gm.color, borderColor: gm.color }}>
      <span className="cgc-grade">{grade || '?'}</span>
      <span className="cgc-score">{score ?? '—'}/100</span>
    </div>
  );
}

function SevRow({ label, aCount, bCount }) {
  const sm = SEVERITY_META[label.toLowerCase()] || {};
  const delta = bCount - aCount;
  return (
    <div className="compare-sev-row">
      <span className="csr-label" style={{ color: sm.color }}>{label}</span>
      <span className="csr-count">{aCount}</span>
      <span className="csr-arrow">→</span>
      <span className="csr-count">{bCount}</span>
      <span className={`csr-delta ${delta > 0 ? 'worse' : delta < 0 ? 'better' : 'same'}`}>
        {delta > 0 ? <TrendingUp size={12} /> : delta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
        {delta > 0 ? `+${delta}` : delta < 0 ? delta : '—'}
      </span>
    </div>
  );
}

export default function ScanCompare({ scanA, scanB, onClose }) {
  const { fixed, new: newFindings, same } = diffFindings(scanA, scanB);
  const [tab, setTab] = useState('overview');

  const scoreA = scanA.summary?.riskScore ?? 0;
  const scoreB = scanB.summary?.riskScore ?? 0;
  const scoreDelta = scoreB - scoreA;

  return (
    <div className="scan-compare-overlay">
      <div className="scan-compare-modal">
        {/* Header */}
        <div className="compare-header">
          <div className="compare-header-title">
            <Shield size={16} color="var(--accent)" />
            <span>Scan Comparison</span>
          </div>
          <button className="compare-close" onClick={onClose}>✕</button>
        </div>

        {/* Two scan cards */}
        <div className="compare-scans-row">
          {[{ label: 'Earlier', scan: scanA }, { label: 'Later', scan: scanB }].map(({ label, scan }, i) => (
            <div key={i} className="compare-scan-card">
              <div className="csc-label">{label}</div>
              <div className="csc-url"><Globe size={11} />{scan.url}</div>
              <div className="csc-date">{formatDate(scan.completedAt)}</div>
              <GradeChip grade={scan.summary?.grade} score={scan.summary?.riskScore} />
            </div>
          ))}
          {/* Score delta */}
          <div className="compare-delta-badge">
            {scoreDelta > 0
              ? <><TrendingUp size={18} color="var(--safe)" /><span style={{ color: 'var(--safe)' }}>+{scoreDelta} pts</span></>
              : scoreDelta < 0
                ? <><TrendingDown size={18} color="var(--crit)" /><span style={{ color: 'var(--crit)' }}>{scoreDelta} pts</span></>
                : <><Minus size={18} color="var(--text-3)" /><span style={{ color: 'var(--text-3)' }}>No change</span></>}
          </div>
        </div>

        {/* Tabs */}
        <div className="compare-tabs">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'fixed',    label: `Fixed (${fixed.length})` },
            { key: 'new',      label: `New Issues (${newFindings.length})` },
            { key: 'same',     label: `Unchanged (${same.length})` },
          ].map(t => (
            <button key={t.key} className={`compare-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="compare-body">
          {tab === 'overview' && (
            <div className="compare-overview">
              <div className="compare-overview-summary">
                <div className={`cos-card ${fixed.length > 0 ? 'green' : ''}`}>
                  <CheckCircle size={20} color="var(--safe)" />
                  <div className="cos-num">{fixed.length}</div>
                  <div className="cos-label">Issues Fixed</div>
                </div>
                <div className={`cos-card ${newFindings.length > 0 ? 'red' : ''}`}>
                  <AlertTriangle size={20} color="var(--crit)" />
                  <div className="cos-num">{newFindings.length}</div>
                  <div className="cos-label">New Issues</div>
                </div>
                <div className="cos-card">
                  <Minus size={20} color="var(--text-3)" />
                  <div className="cos-num">{same.length}</div>
                  <div className="cos-label">Unchanged</div>
                </div>
              </div>
              <div className="compare-sev-table">
                <div className="cst-header">
                  <span>Severity</span>
                  <span>{new Date(scanA.completedAt).toLocaleDateString()}</span>
                  <span />
                  <span>{new Date(scanB.completedAt).toLocaleDateString()}</span>
                  <span>Change</span>
                </div>
                {['Critical', 'High', 'Medium', 'Low', 'Info'].map(s => (
                  <SevRow
                    key={s}
                    label={s}
                    aCount={scanA.summary?.[s.toLowerCase()] || 0}
                    bCount={scanB.summary?.[s.toLowerCase()] || 0}
                  />
                ))}
              </div>
            </div>
          )}

          {tab === 'fixed' && (
            <div className="compare-finding-list">
              {fixed.length === 0
                ? <div className="compare-empty">No findings were fixed between these two scans.</div>
                : fixed.map((f, i) => (
                  <div key={i} className="compare-finding-row fixed">
                    <CheckCircle size={13} color="var(--safe)" />
                    <span className="cfr-sev" style={{ color: SEVERITY_META[f.severity]?.color }}>{f.severity}</span>
                    <span className="cfr-title">{f.title}</span>
                  </div>
                ))}
            </div>
          )}

          {tab === 'new' && (
            <div className="compare-finding-list">
              {newFindings.length === 0
                ? <div className="compare-empty">No new findings in the later scan. Great!</div>
                : newFindings.map((f, i) => (
                  <div key={i} className="compare-finding-row new">
                    <AlertTriangle size={13} color="var(--crit)" />
                    <span className="cfr-sev" style={{ color: SEVERITY_META[f.severity]?.color }}>{f.severity}</span>
                    <span className="cfr-title">{f.title}</span>
                  </div>
                ))}
            </div>
          )}

          {tab === 'same' && (
            <div className="compare-finding-list">
              {same.length === 0
                ? <div className="compare-empty">No unchanged findings.</div>
                : same.map((f, i) => (
                  <div key={i} className="compare-finding-row">
                    <Minus size={13} color="var(--text-4)" />
                    <span className="cfr-sev" style={{ color: SEVERITY_META[f.severity]?.color }}>{f.severity}</span>
                    <span className="cfr-title">{f.title}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
