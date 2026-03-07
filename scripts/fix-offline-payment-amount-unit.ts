import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

import { yuanToFen } from '../src/lib/moneyUtils';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.development' });
dotenv.config({ path: '.env.production' });

type CoachSubscriptionRowLite = {
  id: string;
  monthly_price: number | null;
  subscribed_weeks: number | null;
  payment_data: any;
  updated_at: string | null;
};

type FixReportRow = {
  id: string;
  monthly_price_fen: number | null;
  raw_amount: number | null;
  converted_amount_fen: number | null;
  action: 'skipped_no_amount' | 'skipped_no_monthly_price' | 'no_change' | 'updated' | 'error';
  reason: string;
  error?: string;
};

function nowStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function decideAmountFen(raw: number, monthlyPriceFen: number | null, subscribedWeeks: number | null): { shouldConvert: boolean; amountFen: number; reason: string } {
  const asFen = Math.round(raw);
  const asYuanToFen = yuanToFen(raw);

  if (!monthlyPriceFen || !Number.isFinite(monthlyPriceFen) || monthlyPriceFen <= 0) {
    return {
      shouldConvert: false,
      amountFen: asFen,
      reason: 'missing_monthly_price_reference',
    };
  }

  const expectedTotals = new Set<number>([monthlyPriceFen]);
  const monthsFromWeeks = subscribedWeeks && subscribedWeeks > 0 ? Math.max(1, Math.round(subscribedWeeks / 4)) : 0;
  if (monthsFromWeeks > 0) expectedTotals.add(monthlyPriceFen * monthsFromWeeks);
  [2, 3, 6, 12].forEach((m) => expectedTotals.add(monthlyPriceFen * m));
  const expectedList = Array.from(expectedTotals);

  const distFen = Math.min(...expectedList.map((x) => Math.abs(asFen - x)));
  const distYuan = Math.min(...expectedList.map((x) => Math.abs(asYuanToFen - x)));
  const nearestExpected = expectedList.reduce((best, cur) => {
    return Math.abs(asFen - cur) < Math.abs(asFen - best) ? cur : best;
  }, expectedList[0]);
  const toleranceFen = Math.max(100, Math.round(nearestExpected * 0.15));

  if (distYuan < distFen && distYuan <= toleranceFen) {
    return {
      shouldConvert: true,
      amountFen: asYuanToFen,
      reason: `yuan_guess_better_match(distYuan=${distYuan}, distFen=${distFen}, tol=${toleranceFen}, expected=${expectedList.join('|')})`,
    };
  }

  return {
    shouldConvert: false,
    amountFen: asFen,
    reason: `already_fen_or_uncertain(distFen=${distFen}, distYuan=${distYuan}, tol=${toleranceFen}, expected=${expectedList.join('|')})`,
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const serviceKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error('Missing service role key. Please set NEXT_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY.');
  }

  const { serviceRoleSupabase } = await import('../src/lib/supabaseClient');

  const { data, error } = await (serviceRoleSupabase as any)
    .from('coach_subscriptions')
    .select('id, monthly_price, subscribed_weeks, payment_data, updated_at')
    .eq('payment_method', 'offline');

  if (error) throw error;

  const rows = (data || []) as CoachSubscriptionRowLite[];
  const reportRows: FixReportRow[] = [];
  let updatedCount = 0;

  for (const row of rows) {
    const paymentData = row.payment_data;
    const offlinePayment = paymentData?.offline_payment;
    const raw = Number(offlinePayment?.amount ?? 0);

    if (!offlinePayment || !Number.isFinite(raw) || raw <= 0) {
      reportRows.push({
        id: row.id,
        monthly_price_fen: row.monthly_price,
        raw_amount: Number.isFinite(raw) ? raw : null,
        converted_amount_fen: null,
        action: 'skipped_no_amount',
        reason: 'offline_payment.amount missing/invalid',
      });
      continue;
    }

    if (!row.monthly_price || !Number.isFinite(row.monthly_price) || row.monthly_price <= 0) {
      reportRows.push({
        id: row.id,
        monthly_price_fen: row.monthly_price,
        raw_amount: raw,
        converted_amount_fen: null,
        action: 'skipped_no_monthly_price',
        reason: 'monthly_price unavailable, skip for safety',
      });
      continue;
    }

    const decided = decideAmountFen(raw, row.monthly_price, row.subscribed_weeks ?? null);
    if (!decided.shouldConvert) {
      reportRows.push({
        id: row.id,
        monthly_price_fen: row.monthly_price,
        raw_amount: raw,
        converted_amount_fen: decided.amountFen,
        action: 'no_change',
        reason: decided.reason,
      });
      continue;
    }

    const nextPaymentData = {
      ...paymentData,
      offline_payment: {
        ...offlinePayment,
        amount: decided.amountFen,
        amount_unit: 'fen',
      },
    };

    if (!apply) {
      reportRows.push({
        id: row.id,
        monthly_price_fen: row.monthly_price,
        raw_amount: raw,
        converted_amount_fen: decided.amountFen,
        action: 'updated',
        reason: `${decided.reason} [dry-run]`,
      });
      updatedCount += 1;
      continue;
    }

    try {
      const { error: updErr } = await (serviceRoleSupabase as any)
        .from('coach_subscriptions')
        .update({
          payment_data: nextPaymentData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      if (updErr) throw updErr;
      reportRows.push({
        id: row.id,
        monthly_price_fen: row.monthly_price,
        raw_amount: raw,
        converted_amount_fen: decided.amountFen,
        action: 'updated',
        reason: decided.reason,
      });
      updatedCount += 1;
    } catch (e: any) {
      reportRows.push({
        id: row.id,
        monthly_price_fen: row.monthly_price,
        raw_amount: raw,
        converted_amount_fen: decided.amountFen,
        action: 'error',
        reason: decided.reason,
        error: e?.message || String(e),
      });
    }
  }

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    generated_at: new Date().toISOString(),
    total_scanned: rows.length,
    updated_count: updatedCount,
    skipped_no_amount: reportRows.filter((r) => r.action === 'skipped_no_amount').length,
    skipped_no_monthly_price: reportRows.filter((r) => r.action === 'skipped_no_monthly_price').length,
    no_change_count: reportRows.filter((r) => r.action === 'no_change').length,
    error_count: reportRows.filter((r) => r.action === 'error').length,
    manual_review_candidates: reportRows.filter((r) => r.action === 'skipped_no_monthly_price'),
    rows: reportRows,
  };

  const outDir = path.join(process.cwd(), 'temp_dir');
  ensureDir(outDir);
  const outPath = path.join(outDir, `offline_payment_amount_unit_fix_${summary.mode}_${nowStamp()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8');

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, outPath, ...summary }, null, 2));
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[fix-offline-payment-amount-unit] Failed:', e);
  process.exitCode = 1;
});

