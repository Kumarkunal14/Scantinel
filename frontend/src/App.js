import React, { useState, useEffect } from 'react';
import './styles/globals.css';
import HomePage from './pages/HomePage';
import ScanPage from './pages/ScanPage';

const LAST_SCAN_KEY = 'scantinel_last_scan_id';

export default function App() {
  const [view, setView]     = useState('home');
  const [scanId, setScanId] = useState(null);

  // ── Feature 9: Progress Persistence ────────────────────────────────────────
  // On mount, check if there was a scan in progress before the page was refreshed
  useEffect(() => {
    window.scrollTo(0, 0);
    const saved = localStorage.getItem(LAST_SCAN_KEY);
    if (saved) {
      setScanId(saved);
      setView('scan');
    }
  }, []);

  function handleScanStart(id) {
    setScanId(id);
    setView('scan');
    localStorage.setItem(LAST_SCAN_KEY, id); // persist for refresh recovery
  }

  function handleBack() {
    setScanId(null);
    setView('home');
    localStorage.removeItem(LAST_SCAN_KEY);
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
  }

  function handleRescan(url) {
    // Called from ResultsDashboard — go back to home, pre-fill the URL
    setScanId(null);
    setView('home');
    localStorage.removeItem(LAST_SCAN_KEY);
    // Pass the URL to HomePage via a custom event so it pre-fills the input
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('scantinel:rescan', { detail: { url } }));
    }, 50);
  }

  function handleScanComplete() {
    // Once a scan finishes (completed/failed), clear the persistence
    localStorage.removeItem(LAST_SCAN_KEY);
  }

  return (
    <>
      {view === 'home'
        ? <HomePage onScanStart={handleScanStart} />
        : <ScanPage
            scanId={scanId}
            onBack={handleBack}
            onRescan={handleRescan}
            onScanComplete={handleScanComplete}
          />}
    </>
  );
}
