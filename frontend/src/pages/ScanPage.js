import React from 'react';
import useScan from '../hooks/useScan';
import ScanningView from '../components/ScanningView';
import ResultsDashboard from '../components/ResultsDashboard';
import { ArrowLeft, Shield, RotateCcw } from 'lucide-react';
import './ScanPage.css';

export default function ScanPage({ scanId, onBack, onRescan, onScanComplete }) {
  const { scan, progress, currentStep, phase, status, error, loading, isScanning } = useScan(scanId);

  // Notify parent when scan reaches a terminal state so it can clear persistence
  React.useEffect(() => {
    if (status === 'completed' || status === 'failed') {
      onScanComplete?.();
    }
  }, [status, onScanComplete]);

  function handleRescan() {
    onRescan?.(scan?.url || '');
  }

  return (
    <div className="scan-page">
      {/* Nav */}
      <nav className="scan-nav">
        <button className="nav-back" onClick={onBack}>
          <ArrowLeft size={15} />
          <span>Back</span>
        </button>
        <div
          className="scan-nav-brand"
          onClick={onBack}
          style={{ cursor: 'pointer' }}
          title="Return to Dashboard"
        >
          <Shield size={14} color="var(--accent)" />
          <span>Scantinel</span>
        </div>
        <div className="scan-nav-url">
          {scan?.url || ''}
        </div>
      </nav>

      {/* Content */}
      {loading ? (
        <div className="scan-loading">
          <div className="scan-loading-spinner" />
          <p>Loading scan data...</p>
        </div>
      ) : status === 'failed' || error ? (
        /* ── Feature 2: Error Retry ─────────────────────────────────────────── */
        <div className="scan-error-view">
          <div className="scan-error-icon">⚠</div>
          <h2>Scan Failed</h2>
          <p>{error || scan?.error || 'An unexpected error occurred.'}</p>
          <div className="scan-error-actions">
            <button className="nav-back" onClick={onBack}>
              <ArrowLeft size={14} /> Back to Home
            </button>
            {scan?.url && (
              <button className="retry-btn" onClick={handleRescan}>
                <RotateCcw size={14} /> Retry Scan
              </button>
            )}
          </div>
        </div>
      ) : isScanning ? (
        <ScanningView
          url={scan?.url || ''}
          progress={progress}
          currentStep={currentStep}
          phase={phase}
        />
      ) : scan ? (
        <ResultsDashboard
          scan={scan}
          onBack={onBack}
          onRescan={handleRescan}
        />
      ) : null}
    </div>
  );
}
