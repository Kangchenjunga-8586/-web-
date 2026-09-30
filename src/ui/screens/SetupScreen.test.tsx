import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../storage/db';
import { initializeDatabase, loadSnapshot } from '../../storage/repository';
import { SetupScreen } from './SetupScreen';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
  await initializeDatabase();
});

describe('SetupScreen', () => {
  it('validates and saves the goal to IndexedDB', async () => {
    render(<SetupScreen today="2026-09-30" />);
    await userEvent.click(screen.getByRole('button', { name: 'はじめる' }));
    expect(await screen.findByText('買いたい物を入力してください')).toBeInTheDocument();
    expect(screen.getByText('目標金額を入力してください')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('買いたい物'), 'MacBook Pro');
    await userEvent.type(screen.getByLabelText('目標金額'), '450000');
    await userEvent.type(screen.getByLabelText('すでに貯まっている金額'), '200000');
    fireEvent.change(screen.getByLabelText('購入目標日'), { target: { value: '2027-04-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'はじめる' }));

    await waitFor(async () => {
      const snap = await loadSnapshot();
      expect(snap.goal).toMatchObject({
        name: 'MacBook Pro',
        targetAmount: 450_000,
        initialSavings: 200_000,
        startDate: '2026-09-30',
        targetDate: '2027-04-01',
      });
    });
  });

  it('offers target-date presets', async () => {
    render(<SetupScreen today="2026-09-30" />);
    await userEvent.click(screen.getByRole('button', { name: '1年後' }));
    expect(screen.getByRole('button', { name: '1年後' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('2027/09/30')).toBeInTheDocument();
  });
});
