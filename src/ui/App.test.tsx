import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../storage/db';
import { App } from './App';

beforeAll(() => {
  // jsdom lacks these browser APIs.
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.scrollTo = () => {};
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-30T10:00:00+09:00'));
  db.close();
  await db.delete();
  await db.open();
  window.location.hash = '';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('App integration', () => {
  it('first launch → goal → quick expense updates the dashboard', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('heading', { name: '目標を決めましょう' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('買いたい物'), 'MacBook Pro');
    await user.type(screen.getByLabelText('目標金額'), '450000');
    await user.type(screen.getByLabelText('すでに貯まっている金額'), '200000');
    await user.click(screen.getByRole('button', { name: 'はじめる' }));

    expect(await screen.findByTestId('goal-name')).toHaveTextContent('MacBook Pro');
    expect(screen.getByTestId('current-savings')).toHaveTextContent('¥200,000');

    await user.click(screen.getByTestId('quick-expense'));
    const sheet = await screen.findByTestId('transaction-sheet');
    const amount = within(sheet).getByLabelText('金額');
    expect(amount).toHaveFocus();
    await user.type(amount, '1500');
    await user.click(within(sheet).getByRole('radio', { name: /食費/ }));
    expect(amount).toHaveFocus();
    await user.click(within(sheet).getByTestId('tx-submit'));

    await waitFor(() => expect(screen.getByTestId('current-savings')).toHaveTextContent('¥198,500'));
    expect(screen.getByTestId('toast')).toHaveTextContent('¥1,500 を記録しました');
  });
});
