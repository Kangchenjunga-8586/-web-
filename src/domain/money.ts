import type { Yen } from './types';

export const MAX_AMOUNT: Yen = 999_999_999;

const yenFormatter = new Intl.NumberFormat('ja-JP');

/** ¥450,000 (negative: −¥1,200) */
export function formatYen(amount: Yen): string {
  const sign = amount < 0 ? '−' : '';
  return `${sign}¥${yenFormatter.format(Math.abs(Math.round(amount)))}`;
}

/** +¥1,200 / −¥1,200 / ¥0 */
export function formatSignedYen(amount: Yen): string {
  if (amount === 0) return '¥0';
  return `${amount > 0 ? '+' : '−'}¥${yenFormatter.format(Math.abs(Math.round(amount)))}`;
}

/** 450,000 (no symbol) */
export function formatNumber(amount: number): string {
  return yenFormatter.format(Math.round(amount));
}

/** Compact axis labels: ¥45万, ¥1.2万, ¥8,000 */
export function formatYenCompact(amount: Yen): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '−' : '';
  if (abs >= 100_000_000) return `${sign}¥${trimZero(abs / 100_000_000)}億`;
  if (abs >= 10_000) return `${sign}¥${trimZero(abs / 10_000)}万`;
  return `${sign}¥${yenFormatter.format(abs)}`;
}

function trimZero(n: number): string {
  const rounded = n >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
  return String(rounded);
}

/**
 * Parses user input into integer yen. Accepts full-width digits, commas, ¥ and spaces.
 * Returns null for empty/invalid/non-integer/out-of-range input.
 */
export function parseYenInput(raw: string): Yen | null {
  const normalized = raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，\s¥￥円]/g, '');
  if (!/^\d+$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isSafeInteger(value) || value > MAX_AMOUNT) return null;
  return value;
}

export function isValidAmount(value: unknown, { allowZero = false } = {}): value is Yen {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value <= MAX_AMOUNT &&
    (allowZero ? value >= 0 : value > 0)
  );
}

/** Integer ceil that is robust against float noise (e.g. 31666.000000001). */
export function ceilYen(value: number): Yen {
  return Math.ceil(value - 1e-7) + 0; // + 0 normalises -0
}
