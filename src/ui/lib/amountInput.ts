import { formatNumber } from '../../domain/money';

/** Normalises typed text to a comma-formatted integer string ('' when empty). */
export function formatAmountInput(raw: string): string {
  const digits = raw.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\D/g, '');
  if (digits === '') return '';
  const trimmed = digits.replace(/^0+(?=\d)/, '').slice(0, 9);
  return formatNumber(Number(trimmed));
}

/** Integer → input text ('' for null). */
export function amountToInput(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : formatNumber(value);
}
