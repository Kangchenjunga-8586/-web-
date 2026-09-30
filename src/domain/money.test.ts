import { describe, expect, it } from 'vitest';
import { ceilYen, formatSignedYen, formatYen, formatYenCompact, parseYenInput } from './money';

describe('money', () => {
  it('formats JPY', () => {
    expect(formatYen(450000)).toBe('¥450,000');
    expect(formatYen(0)).toBe('¥0');
    expect(formatYen(-1200)).toBe('−¥1,200');
    expect(formatSignedYen(1200)).toBe('+¥1,200');
    expect(formatSignedYen(-1200)).toBe('−¥1,200');
    expect(formatYenCompact(450000)).toBe('¥45万');
    expect(formatYenCompact(12500)).toBe('¥1.3万');
    expect(formatYenCompact(8000)).toBe('¥8,000');
  });

  it('parses integer yen input including full-width digits', () => {
    expect(parseYenInput('1,200')).toBe(1200);
    expect(parseYenInput('１２００')).toBe(1200);
    expect(parseYenInput('¥ 450,000')).toBe(450000);
    expect(parseYenInput('')).toBeNull();
    expect(parseYenInput('12.5')).toBeNull();
    expect(parseYenInput('-5')).toBeNull();
    expect(parseYenInput('abc')).toBeNull();
    expect(parseYenInput('9999999999')).toBeNull();
  });

  it('ceils yen robustly against float noise', () => {
    expect(ceilYen(31666.0000000001)).toBe(31666);
    expect(ceilYen(31666.2)).toBe(31667);
    expect(ceilYen(0)).toBe(0);
  });
});
