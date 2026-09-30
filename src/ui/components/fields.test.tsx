import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { formatAmountInput } from '../lib/amountInput';
import { AmountField, CategoryGrid } from './fields';
import { DEFAULT_CATEGORIES } from '../../domain/categories';

function AmountHarness() {
  const [v, setV] = useState('');
  return <AmountField label="金額" value={v} onChange={setV} />;
}

describe('AmountField', () => {
  it('formats yen with separators and uses the numeric keypad', async () => {
    render(<AmountHarness />);
    const input = screen.getByLabelText('金額');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('pattern', '[0-9]*');
    await userEvent.type(input, '0012500');
    expect(input).toHaveValue('12,500');
  });

  it('normalises full-width digits and strips junk', () => {
    expect(formatAmountInput('１２３４')).toBe('1,234');
    expect(formatAmountInput('¥1,2a3')).toBe('123');
    expect(formatAmountInput('')).toBe('');
    expect(formatAmountInput('12345678901')).toBe('123,456,789');
  });
});

describe('CategoryGrid', () => {
  it('is a radio group that reports the chosen category', async () => {
    let chosen: string | null = null;
    const cats = DEFAULT_CATEGORIES.filter((c) => c.kind === 'expense');
    const { rerender } = render(<CategoryGrid categories={cats} value={null} onChange={(id) => (chosen = id)} />);
    await userEvent.click(screen.getByRole('radio', { name: /食費/ }));
    expect(chosen).toBe('exp-food');
    rerender(<CategoryGrid categories={cats} value="exp-food" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: /食費/ })).toHaveAttribute('aria-checked', 'true');
  });
});
