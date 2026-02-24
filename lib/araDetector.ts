/**
 * ARA Detector — Multi-Signal Engine
 * Mendeteksi saham berpotensi ARA menggunakan 5 lapisan sinyal:
 *  1. Sinyal Bandar (Broker Accumulation)
 *  2. Sinyal Orderbook (Bid/Offer Ratio & Offer Tipis)
 *  3. Sinyal Volume Spike
 *  4. Sinyal Momentum & Consecutive Up
 *  5. Sinyal Posisi Harga vs Avg Bandar
 *
 * Sumber riset:
 * - BEI ARA rules: <200=35%, 200-5000=25%, >5000=20%
 * - Bandar Detector Stockbit: top3/top5 broker dominance
 * - Bid/Offer ratio & offer drain pattern
 * - Historical volume spike vs MA5
 * - Consecutive daily close higher
 * - Net Foreign positive flow
 */

import {
  fetchMarketDetector,
  fetchOrderbook,
  fetchEmitenInfo,
  fetchHistoricalSummary,
  getTopBroker,
  getBrokerSummary,
} from './stockbit';
import { supabase } from './supabase';

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

export interface ARASignal {
  code:    string;
  label:   string;
  weight:  number;   // Kontribusi ke skor (0-100 total)
  active:  boolean;
  value?:  string;   // Nilai aktual untuk display
}

export interface ARADetectorResult {
  emiten:            string;
  sector:            string;
  harga:             number;
  araBatas:          number;
  araPct:            number;
  jarakKeAraPct:     number;

  // Bandar
  avgBandar:         number;
  topBandar:         string;
  bandarBelowHarga:  boolean;
  bandarAccdist:     string;
  top3Pct:           number;

  // Orderbook
  totalBid:          number;
  totalOffer:        number;
  bidOfferRatio:     number;
  offerTipis:        boolean;

  // Volume
  volumeHariIni:     number;
  volumeAvg5:        number;
  volumeSpikeX:      number;

  // Momentum
  consecutiveUp:     number;
  foreignNet:        number;
  foreignNetPositive:boolean;

  // Scoring
  araScore:          number;
  araSignals:        ARASignal[];
  alertLevel:        'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  lastUpdated:       string;
}

// ═══════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════

// Bobot tiap sinyal (total max = 100)
const SIGNAL_WEIGHTS = {
  BANDAR_AKUMULASI:       20,  // Top3 broker ≥ 20% dominasi + status Accumulation
  BANDAR_BELOW_HARGA:     10,  // Avg bandar masih di bawah harga market
  BID_OFFER_DOMINAN:      20,  // Bid/Offer ratio ≥ 2.0
  OFFER_DRAIN:            15,  // Offer tipis (offer < 0.4x bid)
  VOLUME_SPIKE:           15,  // Volume ≥ 2x avg 5 hari
  CONSECUTIVE_UP:         10,  // Naik berturut-turut ≥ 2 hari
  FOREIGN_NET_POSITIF:     5,  // Net foreign positif
  JARAK_ARA_DEKAT:         5,  // Jarak ke ARA ≤ 15% (hampir sampai)
};

/**
 * Hitung persentase ARA berdasarkan harga saham (aturan BEI 2025)
 * < 200    → 35%
 * 200-4999 → 25%
 * ≥ 5000   → 20%
 */
export function getAraPct(harga: number): number {
  if (harga < 200)   return 35;
  if (harga < 5000)  return 25;
  return 20;
}

/**
 * Hitung batas ARA hari ini dari harga kemarin (close)
 */
export function calculateAraBatas(hargaKemarin: number): number {
  const pct = getAraPct(hargaKemarin);
  // Snap ke fraksi terdekat (simplified untuk detection)
  return Math.round(hargaKemarin * (1 + pct / 100));
}

/**
 * Hitung alert level dari skor
 */
function getAlertLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (score >= 75) return 'CRITICAL';
  if (score >= 55) return 'HIGH';
  if (score >= 35) return 'MEDIUM';
  return 'LOW';
}

// ═══════════════════════════════════════
// CORE ENGINE
// ═══════════════════════════════════════

/**
 * Analisis satu emiten dan hitung skor ARA
 */
export async function analyzeARA(emiten: string, today: string): Promise<ARADetectorResult> {
  // Ambil semua data paralel
  const [marketDetectorData, orderbookRaw, emitenInfoData, historicalData] = await Promise.all([
    fetchMarketDetector(emiten, today, today),
    fetchOrderbook(emiten),
    fetchEmitenInfo(emiten).catch(() => null),
    fetchHistoricalSummary(emiten,
      // lookback 10 hari trading
      (() => { const d = new Date(today); d.setDate(d.getDate() - 15); return d.toISOString().split('T')[0]; })(),
      today,
      10
    ).catch(() => [] as any[]),
  ]);

  // ─── Parse Orderbook ───
  const ob = orderbookRaw.data || (orderbookRaw as any);
  const harga       = Number(ob.close) || 0;
  const totalBidLot = Number(String(ob.total_bid_offer?.bid?.lot  || '0').replace(/,/g, ''));
  const totalOfrLot = Number(String(ob.total_bid_offer?.offer?.lot || '0').replace(/,/g, ''));
  const bidOfferRatio = totalOfrLot > 0 ? totalBidLot / totalOfrLot : 0;
  // Offer tipis: offer < 40% dari bid (demand jauh lebih besar dari supply)
  const offerTipis    = totalOfrLot > 0 && totalOfrLot < totalBidLot * 0.4;

  // ─── Parse Bandar ───
  const brokerData    = getTopBroker(marketDetectorData);
  const brokerSummary = getBrokerSummary(marketDetectorData);
  const avgBandar     = brokerData?.rataRataBandar || 0;
  const topBandar     = brokerData?.bandar || '-';
  const bandarBelowHarga = avgBandar > 0 && harga > 0 && avgBandar < harga;
  const bandarAccdist    = brokerSummary.detector.broker_accdist || '-';
  const top3Pct          = brokerSummary.detector.top3?.percent || 0;
  const isAccumulation   = bandarAccdist.toLowerCase().includes('accum');

  // ─── Parse Historical ───
  const hist: any[] = Array.isArray(historicalData) ? historicalData : [];
  // hist[0] = hari ini / terbaru
  const volumeHariIni = hist[0]?.volume || 0;
  // Avg volume 5 hari sebelumnya (hist[1..5])
  const vol5 = hist.slice(1, 6).map((h: any) => h.volume || 0).filter((v: number) => v > 0);
  const volumeAvg5    = vol5.length > 0 ? Math.round(vol5.reduce((s: number, v: number) => s + v, 0) / vol5.length) : 0;
  const volumeSpikeX  = volumeAvg5 > 0 ? parseFloat((volumeHariIni / volumeAvg5).toFixed(2)) : 0;

  // Consecutive up: hitung berapa hari berturut-turut close lebih tinggi
  let consecutiveUp = 0;
  for (let i = 0; i < hist.length - 1; i++) {
    if (hist[i]?.close > hist[i + 1]?.close) consecutiveUp++;
    else break;
  }

  // Net foreign
  const foreignNet         = hist[0]?.net_foreign || 0;
  const foreignNetPositive = foreignNet > 0;

  // ─── ARA Batas ───
  const prevClose  = hist[1]?.close || harga;  // Harga kemarin
  const araPct     = getAraPct(prevClose);
  const araBatas   = calculateAraBatas(prevClose);
  const jarakKeAraPct = harga > 0 && araBatas > 0
    ? parseFloat(((araBatas - harga) / harga * 100).toFixed(2)) : 0;

  // ─── Sektor ───
  const sector = emitenInfoData?.data?.sector || '';

  // ═══════════════════════════════════════
  // SCORING ENGINE
  // ═══════════════════════════════════════
  const signals: ARASignal[] = [
    {
      code:   'BANDAR_AKUMULASI',
      label:  'Bandar Akumulasi (Top3 ≥ 20%)',
      weight: SIGNAL_WEIGHTS.BANDAR_AKUMULASI,
      active: isAccumulation && top3Pct >= 20,
      value:  `${top3Pct.toFixed(1)}% | ${bandarAccdist}`,
    },
    {
      code:   'BANDAR_BELOW_HARGA',
      label:  'Avg Bandar < Harga Market',
      weight: SIGNAL_WEIGHTS.BANDAR_BELOW_HARGA,
      active: bandarBelowHarga,
      value:  `Bandar: ${avgBandar} | Harga: ${harga}`,
    },
    {
      code:   'BID_OFFER_DOMINAN',
      label:  'Bid/Offer Ratio ≥ 2.0x',
      weight: SIGNAL_WEIGHTS.BID_OFFER_DOMINAN,
      active: bidOfferRatio >= 2.0,
      value:  `Ratio: ${bidOfferRatio.toFixed(2)}x`,
    },
    {
      code:   'OFFER_DRAIN',
      label:  'Offer Tipis (Supply Terserap)',
      weight: SIGNAL_WEIGHTS.OFFER_DRAIN,
      active: offerTipis,
      value:  `Bid: ${totalBidLot.toLocaleString()} | Offer: ${totalOfrLot.toLocaleString()}`,
    },
    {
      code:   'VOLUME_SPIKE',
      label:  'Volume Spike ≥ 2x Avg-5',
      weight: SIGNAL_WEIGHTS.VOLUME_SPIKE,
      active: volumeSpikeX >= 2.0,
      value:  `${volumeSpikeX.toFixed(1)}x avg (${(volumeAvg5 / 1000).toFixed(0)}K lot avg)`,
    },
    {
      code:   'CONSECUTIVE_UP',
      label:  `Naik Berturut-turut ≥ 2 Hari`,
      weight: SIGNAL_WEIGHTS.CONSECUTIVE_UP,
      active: consecutiveUp >= 2,
      value:  `${consecutiveUp} hari naik berturut`,
    },
    {
      code:   'FOREIGN_NET_POSITIF',
      label:  'Net Foreign Positif',
      weight: SIGNAL_WEIGHTS.FOREIGN_NET_POSITIF,
      active: foreignNetPositive,
      value:  `Net Asing: +${(foreignNet / 1e9).toFixed(2)}M`,
    },
    {
      code:   'JARAK_ARA_DEKAT',
      label:  'Jarak ke ARA ≤ 15%',
      weight: SIGNAL_WEIGHTS.JARAK_ARA_DEKAT,
      active: jarakKeAraPct >= 0 && jarakKeAraPct <= 15,
      value:  `Sisa ${jarakKeAraPct.toFixed(1)}% ke ARA (${araBatas})`,
    },
  ];

  const araScore    = signals.reduce((s, sig) => s + (sig.active ? sig.weight : 0), 0);
  const alertLevel  = getAlertLevel(araScore);

  return {
    emiten,
    sector,
    harga,
    araBatas,
    araPct,
    jarakKeAraPct,
    avgBandar,
    topBandar,
    bandarBelowHarga,
    bandarAccdist,
    top3Pct,
    totalBid:     totalBidLot,
    totalOffer:   totalOfrLot,
    bidOfferRatio,
    offerTipis,
    volumeHariIni,
    volumeAvg5,
    volumeSpikeX,
    consecutiveUp,
    foreignNet,
    foreignNetPositive,
    araScore,
    araSignals: signals,
    alertLevel,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Simpan hasil analisis ARA ke Supabase
 */
export async function saveARAResult(result: ARADetectorResult, scanDate: string) {
  const { error } = await supabase
    .from('ara_detector_results')
    .upsert({
      scan_date:          scanDate,
      scanned_at:         new Date().toISOString(),
      emiten:             result.emiten,
      sector:             result.sector,
      harga:              result.harga,
      ara_batas:          result.araBatas,
      ara_pct:            result.araPct,
      jarak_ke_ara_pct:   result.jarakKeAraPct,
      avg_bandar:         result.avgBandar,
      top_bandar:         result.topBandar,
      bandar_below_harga: result.bandarBelowHarga,
      bandar_accdist:     result.bandarAccdist,
      top3_pct:           result.top3Pct,
      total_bid:          result.totalBid,
      total_offer:        result.totalOffer,
      bid_offer_ratio:    result.bidOfferRatio,
      offer_tipis:        result.offerTipis,
      volume_hari_ini:    result.volumeHariIni,
      volume_avg5:        result.volumeAvg5,
      volume_spike_x:     result.volumeSpikeX,
      consecutive_up:     result.consecutiveUp,
      foreign_net:        result.foreignNet,
      foreign_net_positive: result.foreignNetPositive,
      ara_score:          result.araScore,
      ara_signals:        result.araSignals,
      alert_level:        result.alertLevel,
    }, { onConflict: 'scan_date,emiten' })
    .select();

  if (error) throw new Error(error.message);
}

/**
 * Ambil hasil ARA dari Supabase (untuk display di UI)
 */
export async function getARAResults(options?: {
  scanDate?:    string;
  minScore?:    number;
  alertLevel?:  string;
  limit?:       number;
}) {
  let query = supabase
    .from('ara_detector_results')
    .select('*')
    .order('ara_score', { ascending: false });

  if (options?.scanDate)   query = query.eq('scan_date', options.scanDate);
  if (options?.minScore)   query = query.gte('ara_score', options.minScore);
  if (options?.alertLevel) query = query.eq('alert_level', options.alertLevel);
  if (options?.limit)      query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}
