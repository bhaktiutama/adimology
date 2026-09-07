-- Migration: 015_ara_detector_results
INSERT INTO _migrations (name)
VALUES ('015_ara_detector_results')
ON CONFLICT DO NOTHING;

-- Tabel hasil scan ARA Detector
CREATE TABLE IF NOT EXISTS ara_detector_results (
  id               SERIAL PRIMARY KEY,
  scan_date        DATE         NOT NULL DEFAULT CURRENT_DATE,
  scanned_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  emiten           TEXT         NOT NULL,
  sector           TEXT,

  -- Harga & Batas
  harga            NUMERIC(12,2) DEFAULT 0,
  ara_batas        NUMERIC(12,2) DEFAULT 0,   -- Batas ARA hari ini
  ara_pct          NUMERIC(5,2)  DEFAULT 0,   -- Persentase ARA yang berlaku (20/25/35)
  jarak_ke_ara_pct NUMERIC(8,2)  DEFAULT 0,   -- Sisa jarak ke ARA (%)

  -- Sinyal Bandar
  avg_bandar       NUMERIC(12,2) DEFAULT 0,
  top_bandar       TEXT,
  bandar_below_harga BOOLEAN     DEFAULT FALSE,
  bandar_accdist   TEXT,                      -- 'Accumulation'/'Distribution'
  top3_pct         NUMERIC(5,2)  DEFAULT 0,   -- Top3 broker dominasi (%)

  -- Sinyal Orderbook
  total_bid        NUMERIC(14,0) DEFAULT 0,
  total_offer      NUMERIC(14,0) DEFAULT 0,
  bid_offer_ratio  NUMERIC(8,2)  DEFAULT 0,   -- bid/offer ratio (>2 = bullish)
  offer_tipis      BOOLEAN       DEFAULT FALSE, -- Offer side sangat tipis

  -- Sinyal Volume
  volume_hari_ini  NUMERIC(14,0) DEFAULT 0,
  volume_avg5      NUMERIC(14,0) DEFAULT 0,   -- Avg volume 5 hari
  volume_spike_x   NUMERIC(6,2)  DEFAULT 0,   -- Volume hari ini / avg5 (>2 = spike)

  -- Sinyal Momentum (dari historical)
  consecutive_up   INTEGER       DEFAULT 0,   -- Hari naik berturut-turut
  foreign_net      NUMERIC(14,0) DEFAULT 0,   -- Net foreign hari ini
  foreign_net_positive BOOLEAN   DEFAULT FALSE,

  -- Skor ARA
  ara_score        INTEGER       DEFAULT 0,   -- 0-100
  ara_signals      JSONB         DEFAULT '[]'::jsonb, -- Array sinyal yang aktif
  alert_level      TEXT          DEFAULT 'LOW', -- LOW / MEDIUM / HIGH / CRITICAL

  UNIQUE(scan_date, emiten)
);

CREATE INDEX IF NOT EXISTS idx_ara_scan_date     ON ara_detector_results(scan_date DESC);
CREATE INDEX IF NOT EXISTS idx_ara_score         ON ara_detector_results(ara_score DESC);
CREATE INDEX IF NOT EXISTS idx_ara_alert_level   ON ara_detector_results(alert_level);
CREATE INDEX IF NOT EXISTS idx_ara_emiten        ON ara_detector_results(emiten);
