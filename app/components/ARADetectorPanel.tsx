'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ARADetectorResult, ARASignal } from '@/lib/araDetector';

// ── Helpers ──────────────────────────────────────────────
const fmt = (n: number) => n?.toLocaleString('id-ID') ?? '-';

function alertBadge(level: string) {
  switch (level) {
    case 'CRITICAL': return 'bg-red-600    text-white        font-black  animate-pulse';
    case 'HIGH':     return 'bg-orange-500 text-white        font-bold';
    case 'MEDIUM':   return 'bg-yellow-400 text-yellow-900   font-semibold';
    default:         return 'bg-gray-200   dark:bg-gray-700  text-gray-500 dark:text-gray-400';
  }
}

function alertEmoji(level: string) {
  switch (level) {
    case 'CRITICAL': return '🚨';
    case 'HIGH':     return '🔥';
    case 'MEDIUM':   return '⚡';
    default:         return '💤';
  }
}

function scoreBar(score: number) {
  const w = `${score}%`;
  let color = 'bg-gray-400';
  if (score >= 75) color = 'bg-red-500 animate-pulse';
  else if (score >= 55) color = 'bg-orange-500';
  else if (score >= 35) color = 'bg-yellow-400';
  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-0.5">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: w }} />
    </div>
  );
}

function SignalDots({ signals }: { signals: ARASignal[] }) {
  return (
    <div className="flex gap-0.5 flex-wrap">
      {signals.map(s => (
        <span
          key={s.code}
          title={`${s.label}: ${s.value || ''}`}
          className={`w-2.5 h-2.5 rounded-full transition-colors ${
            s.active
              ? s.weight >= 15 ? 'bg-red-500' : s.weight >= 10 ? 'bg-orange-400' : 'bg-yellow-400'
              : 'bg-gray-300 dark:bg-gray-600'
          }`}
        />
      ))}
    </div>
  );
}

function DetailModal({ result, onClose }: { result: ARADetectorResult; onClose: () => void }) {
  const activeSignals = result.araSignals?.filter(s => s.active) || [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black text-gray-900 dark:text-white">{result.emiten}</span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${alertBadge(result.alertLevel)}`}>
              {alertEmoji(result.alertLevel)} {result.alertLevel}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 grid grid-cols-2 gap-4">
          {/* Skor */}
          <div className="col-span-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">ARA Score</span>
              <span className="text-3xl font-black text-gray-900 dark:text-white">{result.araScore}<span className="text-base font-normal text-gray-400">/100</span></span>
            </div>
            {scoreBar(result.araScore)}
          </div>

          {/* Harga & Batas ARA */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Harga & Batas ARA</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{fmt(result.harga)}</p>
            <p className="text-sm text-gray-500">Batas ARA: <span className="text-green-600 dark:text-green-400 font-bold">{fmt(result.araBatas)}</span> (+{result.araPct}%)</p>
            <p className="text-sm text-gray-500">Jarak: <span className="font-bold text-orange-500">{result.jarakKeAraPct?.toFixed(1)}%</span> lagi</p>
          </div>

          {/* Bandar */}
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
            <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">Bandar</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{result.topBandar}</p>
            <p className="text-sm text-gray-500">Avg: {fmt(result.avgBandar)} · Top3: {result.top3Pct?.toFixed(1)}%</p>
            <p className="text-sm">
              <span className={result.bandarAccdist?.toLowerCase().includes('accum') ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>
                {result.bandarAccdist || '-'}
              </span>
            </p>
          </div>

          {/* Orderbook */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
            <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">Orderbook</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{result.bidOfferRatio?.toFixed(2)}x</p>
            <p className="text-sm text-gray-500">Bid: {fmt(result.totalBid)} lot</p>
            <p className="text-sm text-gray-500">Offer: {fmt(result.totalOffer)} lot</p>
            {result.offerTipis && <p className="text-xs text-red-500 font-bold mt-1">⚠ OFFER TIPIS</p>}
          </div>

          {/* Volume */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4">
            <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium mb-1">Volume</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{result.volumeSpikeX?.toFixed(1)}x avg</p>
            <p className="text-sm text-gray-500">Hari ini: {fmt(result.volumeHariIni)}</p>
            <p className="text-sm text-gray-500">Avg-5: {fmt(result.volumeAvg5)}</p>
          </div>

          {/* Momentum */}
          <div className="col-span-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Momentum</p>
            <div className="flex gap-4 flex-wrap">
              <div>
                <p className="text-xs text-gray-400">Naik Beruntun</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{result.consecutiveUp} <span className="text-sm font-normal">hari</span></p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Net Foreign</p>
                <p className={`text-xl font-bold ${result.foreignNetPositive ? 'text-green-600' : 'text-red-500'}`}>
                  {result.foreignNetPositive ? '+' : ''}{(result.foreignNet / 1e9).toFixed(2)}M
                </p>
              </div>
            </div>
          </div>

          {/* Sinyal Aktif */}
          <div className="col-span-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Sinyal Aktif ({activeSignals.length}/{result.araSignals?.length})</p>
            <div className="space-y-2">
              {result.araSignals?.map(s => (
                <div key={s.code}
                  className={`flex items-center gap-3 p-2.5 rounded-lg ${
                    s.active ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-800/30 opacity-50'
                  }`}>
                  <span className="text-base">{s.active ? '✅' : '⬜'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{s.label}</p>
                    {s.value && <p className="text-xs text-gray-500 truncate">{s.value}</p>}
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    s.active ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                  }`}>
                    +{s.weight}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────
export default function ARADetectorPanel() {
  const [results, setResults]         = useState<ARADetectorResult[]>([]);
  const [filtered, setFiltered]       = useState<ARADetectorResult[]>([]);
  const [loading, setLoading]         = useState(false);
  const [scanning, setScanning]       = useState(false);
  const [selected, setSelected]       = useState<ARADetectorResult | null>(null);
  const [error, setError]             = useState('');
  const [lastScan, setLastScan]       = useState('');
  const [minScore, setMinScore]       = useState(0);
  const [filterLevel, setFilterLevel] = useState('');
  const [manualEmiten, setManualEmiten] = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // Muat hasil dari DB saat mount
  const loadFromDB = useCallback(async (date = today) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ date, minScore: String(minScore) });
      if (filterLevel) q.set('alertLevel', filterLevel);
      const res  = await fetch(`/api/ara-detector?${q}`);
      const data = await res.json();
      if (data.success) {
        setResults(data.data);
        setLastScan(new Date().toLocaleTimeString('id-ID'));
      } else {
        setError(data.error || 'Gagal memuat data');
      }
    } catch { setError('Gagal terhubung ke server'); }
    finally   { setLoading(false); }
  }, [today, minScore, filterLevel]);

  useEffect(() => { loadFromDB(); }, []);

  // Filter lokal
  useEffect(() => {
    let r = [...results];
    if (minScore > 0)   r = r.filter(x => x.araScore  >= minScore);
    if (filterLevel)    r = r.filter(x => x.alertLevel === filterLevel);
    setFiltered(r);
  }, [results, minScore, filterLevel]);

  // Scan ulang watchlist
  const runScan = async () => {
    setScanning(true); setError('');
    try {
      const res  = await fetch('/api/ara-detector?watchlist=true');
      const data = await res.json();
      if (data.success) {
        setResults(data.data);
        setLastScan(new Date().toLocaleTimeString('id-ID'));
      } else {
        setError(data.error || 'Scan gagal');
      }
    } catch { setError('Gagal terhubung ke server'); }
    finally   { setScanning(false); }
  };

  // Analisis manual satu emiten
  const analyzeManual = async () => {
    if (!manualEmiten.trim()) return;
    setManualLoading(true); setError('');
    try {
      const res  = await fetch('/api/ara-detector', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ emiten: manualEmiten.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (data.success) {
        // Tambahkan / update di list
        setResults(prev => {
          const idx = prev.findIndex(r => r.emiten === data.data.emiten);
          if (idx >= 0) {
            const copy = [...prev]; copy[idx] = data.data; return copy;
          }
          return [data.data, ...prev];
        });
        setSelected(data.data);
        setManualEmiten('');
      } else {
        setError(data.error || 'Analisis gagal');
      }
    } catch { setError('Gagal terhubung ke server'); }
    finally   { setManualLoading(false); }
  };

  // Count by level
  const counts = {
    CRITICAL: filtered.filter(r => r.alertLevel === 'CRITICAL').length,
    HIGH:     filtered.filter(r => r.alertLevel === 'HIGH').length,
    MEDIUM:   filtered.filter(r => r.alertLevel === 'MEDIUM').length,
    LOW:      filtered.filter(r => r.alertLevel === 'LOW').length,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">

      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-5 gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            🚨 ARA Detector
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Deteksi multi-sinyal: Bandar · Orderbook · Volume · Momentum
            {lastScan && ` · Update: ${lastScan}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={runScan} disabled={scanning || loading}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-bold rounded-lg transition flex items-center gap-2">
            {scanning
              ? <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg> Scanning...</>
              : '🔍 Scan Watchlist'}
          </button>
          <button
            onClick={() => loadFromDB()}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            🔄 Refresh DB
          </button>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {(['CRITICAL','HIGH','MEDIUM','LOW'] as const).map(level => (
          <button
            key={level}
            onClick={() => setFilterLevel(f => f === level ? '' : level)}
            className={`rounded-xl p-3 border-2 text-left transition ${
              filterLevel === level
                ? level === 'CRITICAL' ? 'border-red-500   bg-red-50   dark:bg-red-900/20'
                  : level === 'HIGH'   ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                  : level === 'MEDIUM' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                  : 'border-gray-400   bg-gray-100  dark:bg-gray-800'
                : 'border-transparent bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700'
            }`}>
            <p className="text-xs text-gray-500 dark:text-gray-400">{alertEmoji(level)} {level}</p>
            <p className={`text-3xl font-black mt-0.5 ${
              level==='CRITICAL'?'text-red-600':
              level==='HIGH'?'text-orange-500':
              level==='MEDIUM'?'text-yellow-500':'text-gray-400'}` }>
              {counts[level]}
            </p>
          </button>
        ))}
      </div>

      {/* ── MANUAL SCAN ── */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Analisis manual: BBRI, TLKM..."
          value={manualEmiten}
          onChange={e => setManualEmiten(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && analyzeManual()}
          maxLength={10}
          className="flex-1 max-w-xs text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 outline-none focus:ring-2 focus:ring-red-500"
        />
        <button
          onClick={analyzeManual} disabled={manualLoading || !manualEmiten.trim()}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white text-sm font-bold rounded-lg transition">
          {manualLoading ? '...' : 'Analisis'}
        </button>
      </div>

      {/* ── FILTER SCORE ── */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">Min Score:</span>
        <input type="range" min={0} max={100} step={5} value={minScore}
          onChange={e => setMinScore(+e.target.value)}
          className="w-40 accent-red-500" />
        <span className="text-xs font-bold text-red-600 dark:text-red-400 w-8">{minScore}+</span>
        {filterLevel && (
          <button onClick={() => setFilterLevel('')}
            className="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 transition">
            ✕ {filterLevel}
          </button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} emiten</span>
      </div>

      {/* ── ERROR ── */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 mb-4 text-sm text-red-700 dark:text-red-300">
          ⚠️ {error}
        </div>
      )}

      {/* ── TABLE ── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <svg className="animate-spin h-8 w-8 mx-auto text-red-500 mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p className="text-gray-400 text-sm">Memuat data...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-5xl mb-3">📡</div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Belum ada data scan.</p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Klik <strong>Scan Watchlist</strong> untuk mulai deteksi.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <th className="px-3 py-2.5 text-left">Emiten</th>
                  <th className="px-3 py-2.5 text-center">Level</th>
                  <th className="px-3 py-2.5 text-center w-24">Score</th>
                  <th className="px-3 py-2.5 text-center">Sinyal</th>
                  <th className="px-3 py-2.5 text-right">Harga</th>
                  <th className="px-3 py-2.5 text-right">Batas ARA</th>
                  <th className="px-3 py-2.5 text-right">Jarak</th>
                  <th className="px-3 py-2.5 text-right">Bid/Offer</th>
                  <th className="px-3 py-2.5 text-right">Vol Spike</th>
                  <th className="px-3 py-2.5 text-right">↑Beruntun</th>
                  <th className="px-3 py-2.5 text-center">Bandar</th>
                  <th className="px-3 py-2.5 text-left">Sektor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((r, i) => (
                  <tr
                    key={r.emiten}
                    onClick={() => setSelected(r)}
                    className={`cursor-pointer hover:bg-red-50/30 dark:hover:bg-red-900/10 transition-colors ${
                      i % 2 !== 0 ? 'bg-gray-50/40 dark:bg-gray-800/20' : ''
                    } ${ r.alertLevel === 'CRITICAL' ? 'border-l-4 border-red-500' : r.alertLevel === 'HIGH' ? 'border-l-4 border-orange-400' : '' }`}>

                    <td className="px-3 py-2.5 font-black text-gray-900 dark:text-white">{r.emiten}</td>

                    <td className="px-3 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${alertBadge(r.alertLevel)}`}>
                        {alertEmoji(r.alertLevel)} {r.alertLevel}
                      </span>
                    </td>

                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-gray-900 dark:text-white w-6 text-right">{r.araScore}</span>
                        {scoreBar(r.araScore)}
                      </div>
                    </td>

                    <td className="px-3 py-2.5">
                      <SignalDots signals={r.araSignals || []} />
                    </td>

                    <td className="px-3 py-2.5 text-right font-mono text-xs text-gray-700 dark:text-gray-300">{fmt(r.harga)}</td>

                    <td className="px-3 py-2.5 text-right font-mono text-xs text-green-600 dark:text-green-400 font-bold">{fmt(r.araBatas)}</td>

                    <td className={`px-3 py-2.5 text-right text-xs font-bold ${
                      r.jarakKeAraPct <= 5 ? 'text-red-600 dark:text-red-400'
                      : r.jarakKeAraPct <= 10 ? 'text-orange-500'
                      : 'text-gray-500 dark:text-gray-400'}` }>
                      {r.jarakKeAraPct?.toFixed(1)}%
                    </td>

                    <td className={`px-3 py-2.5 text-right text-xs font-bold ${
                      r.bidOfferRatio >= 3 ? 'text-red-600 dark:text-red-400'
                      : r.bidOfferRatio >= 2 ? 'text-orange-500'
                      : 'text-gray-500 dark:text-gray-400'}` }>
                      {r.bidOfferRatio?.toFixed(2)}x
                      {r.offerTipis && <span className="ml-1 text-red-500 text-xs">🔥</span>}
                    </td>

                    <td className={`px-3 py-2.5 text-right text-xs font-bold ${
                      r.volumeSpikeX >= 3 ? 'text-red-600 dark:text-red-400'
                      : r.volumeSpikeX >= 2 ? 'text-orange-500'
                      : 'text-gray-500 dark:text-gray-400'}` }>
                      {r.volumeSpikeX?.toFixed(1)}x
                    </td>

                    <td className="px-3 py-2.5 text-right">
                      <span className={`text-xs font-bold ${
                        r.consecutiveUp >= 3 ? 'text-green-600 dark:text-green-400'
                        : r.consecutiveUp >= 2 ? 'text-yellow-500'
                        : 'text-gray-400'}` }>
                        {r.consecutiveUp}↑
                      </span>
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        r.bandarAccdist?.toLowerCase().includes('accum')
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}` }>
                        {r.topBandar || '-'}
                      </span>
                    </td>

                    <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 max-w-[120px] truncate" title={r.sector}>
                      {r.sector || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── LEGEND ── */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
        <span>● Merah = sinyal besar (≥15 poin)</span>
        <span>● Oranye = sinyal sedang (10-14 poin)</span>
        <span>● Kuning = sinyal kecil (&lt;10 poin)</span>
        <span>● Abu = sinyal tidak aktif</span>
        <span className="ml-auto">Klik baris untuk detail lengkap</span>
      </div>

      {/* ── DETAIL MODAL ── */}
      {selected && <DetailModal result={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
