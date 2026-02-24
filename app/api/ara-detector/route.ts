/**
 * API Route: /api/ara-detector
 *
 * GET  ?watchlist=true     → Scan semua item watchlist, simpan ke DB, return hasil
 * GET  ?date=YYYY-MM-DD    → Ambil hasil dari DB untuk tanggal tertentu
 * POST { emiten: 'BBRI' }  → Analisis satu emiten on-demand
 */
import { NextRequest, NextResponse } from 'next/server';
import { analyzeARA, saveARAResult, getARAResults } from '@/lib/araDetector';
import { fetchWatchlist } from '@/lib/stockbit';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const watchlistScan = searchParams.get('watchlist') === 'true';
  const date          = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const minScore      = parseInt(searchParams.get('minScore') || '0');
  const alertLevel    = searchParams.get('alertLevel') || '';

  try {
    // Mode 1: Scan watchlist dan simpan ke DB
    if (watchlistScan) {
      const watchlistResponse = await fetchWatchlist();
      const items = watchlistResponse.data?.result || [];

      if (items.length === 0) {
        return NextResponse.json({ success: true, data: [], message: 'Watchlist kosong' });
      }

      const today   = new Date().toISOString().split('T')[0];
      const results = [];
      const errors: { emiten: string; error: string }[] = [];

      for (const item of items) {
        const emiten = item.symbol || item.company_code;
        try {
          const result = await analyzeARA(emiten, today);
          await saveARAResult(result, today);
          results.push(result);
        } catch (e) {
          errors.push({ emiten, error: e instanceof Error ? e.message : String(e) });
        }
      }

      // Sort by score descending
      results.sort((a, b) => b.araScore - a.araScore);

      return NextResponse.json({
        success: true,
        data:    results,
        total:   results.length,
        errors:  errors.length,
        date:    today,
      });
    }

    // Mode 2: Ambil dari DB (default)
    const dbResults = await getARAResults({
      scanDate:   date,
      minScore:   minScore || undefined,
      alertLevel: alertLevel || undefined,
      limit:      200,
    });

    return NextResponse.json({
      success: true,
      data:    dbResults,
      total:   dbResults.length,
      date,
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { emiten } = await req.json();
    if (!emiten) {
      return NextResponse.json(
        { success: false, error: 'Parameter emiten wajib diisi' },
        { status: 400 }
      );
    }

    const today  = new Date().toISOString().split('T')[0];
    const result = await analyzeARA(emiten.toUpperCase(), today);

    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
