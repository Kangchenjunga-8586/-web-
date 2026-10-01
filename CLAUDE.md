# CLAUDE.md — GoalBudget

Guidance for Claude Code continuing development of this repository.

## Product purpose

A **single-user** household-budget + savings-goal PWA whose job is to make one purchase
goal (e.g. a MacBook) succeed: current savings, remaining amount, required monthly/weekly
savings, on-track status with reasons, forecast completion date, and very fast expense
entry. UI language Japanese, currency JPY, locale ja-JP, timezone Asia/Tokyo.

## Invariants (do not break)

- **Single user.** No accounts, login, sharing, roles, backend, sync. Delete complexity that only exists for multiple users.
- **iPhone-only.** Target device is iPhone 17 Pro Max. Primary viewport **440 × 956 CSS px** portrait (@3x, 1320 × 2868 px). Primary runtime: home-screen PWA (standalone); Safari with browser chrome must also work. Landscape must stay usable, not optimized.
- **The owner uses only an iPhone.** Never ask them to use a PC, terminal, local git/npm, DevTools, or local servers. Do all dev/test/build work in the Claude Code cloud environment; any unavoidable human step must be doable on iPhone (Safari / GitHub mobile).
- **Local-first privacy.** Financial data stays in IndexedDB on the device. No analytics, ads, tracking, telemetry, external APIs, or secrets.
- **Active goal: one.** The data model can grow later; the UI stays single-goal.

## Architecture

```
src/domain/   Pure, UI-free, fully unit-tested logic
  types.ts        Goal, Transaction, RecurringRule, Category, AppSettings, BackupData
  dates.ts        'YYYY-MM-DD' calendar dates via UTC day numbers; todayInTokyo()
  money.ts        integer-yen parse/format, ceilYen
  recurring.ts    occurrence expansion, planRecurringGeneration (idempotent), applyRuleEdit
  calculations.ts goal metrics, aggregation, forecast, pace assessment, chart series
  backup.ts       buildBackup / parseBackup (strict validation + migration hook)
  csv.ts          UTF-8 BOM CSV export
src/storage/  The ONLY code that touches IndexedDB
  db.ts           Dexie schema (versioned)
  repository.ts   CRUD, generateRecurringTransactions, importBackup (atomic), wipeAllData
src/ui/       React UI
  App.tsx         bootstrap (init DB, live snapshot, recurring generation on launch/date change), shell, sheet host
  AppContext.ts   snapshot, today, dashboard, openAdd/openSheet/toast/confirm
  screens/        Setup, Home, History, Plan (tab label 「グラフ」), Settings, Recurring, Categories
  sheets/         TransactionSheet, GoalForm/GoalSheet, RuleSheet, CategorySheet
  components/     Sheet, ConfirmDialog, Toast, BottomNav, fields, Money, …
  charts/         SavingsChart, CashFlowChart (lazy-loaded Recharts), CategoryBreakdown, chartData
                  (chartData.buildSavingsChartModel decides ranges, ticks and label placement — keep that logic pure and tested)
e2e/          Playwright: scenarios, iPhone layout suite, PWA offline test
```

Data flow: UI reads everything through `useLiveQuery(loadSnapshot)` (small single-user
dataset) and derives numbers with `computeDashboard` (memoized). Writes go through
`storage/repository.ts`. Keep calculation logic out of components.

Routing is a tiny hash router (`#/`, `#/history`, `#/plan`, `#/settings`, `#/settings/income|expenses|categories`) — works on GitHub Pages without rewrites.
`navigate(route, anchor)` scrolls to a `Section id` (`savings`, `monthly`, `categories`, `outlook`, `rates`, `goal` on the グラフ tab) via `scrollToAnchor`, which keeps re-aligning while lazy charts load and stops on user touch.

Screen order is part of the product: on Home the savings chart sits right under the 支出/収入 buttons and must stay fully visible in the first screen; the グラフ tab opens with 貯金の推移 first. `e2e/iphone-ui.spec.ts` asserts both.

## Commands (run them yourself in the cloud environment)

```bash
npm ci
npm run lint        # ESLint, zero warnings allowed
npm run typecheck   # tsc -b
npm test            # Vitest (jsdom + fake-indexeddb)
npm run build       # production build (+ service worker)
npm run e2e         # Playwright (builds must exist; uses `vite preview` on :4173)
npm run icons       # regenerate PNG icons from the SVG in scripts/generate-icons.mjs
```

Playwright is pinned to **1.56.1** to match the pre-installed Chromium (`/opt/pw-browsers`,
chromium-1194). Do not run `playwright install` locally. CI installs Chromium + WebKit and
runs E2E on both (`E2E_WEBKIT=1`).

## Testing rules

- Every financial calculation change needs unit tests in `src/domain/*.test.ts`.
- Recurring generation must stay idempotent: deterministic IDs `rec:<ruleId>:<YYYY-MM-DD>` + `generatedThrough` watermark; tests cover repeated runs, lost watermark, concurrent runs, deleted occurrences.
- Backup: export → import must round-trip; invalid files must be rejected without touching data (`importBackup` is one Dexie rw transaction).
- UI changes: run `e2e/iphone-ui.spec.ts`, then **look at the screenshots** in `e2e/screenshots/` (440 × 956, light + dark). CDP `Emulation.setSafeAreaInsetsOverride` emulates Dynamic Island (top 62) and home indicator (bottom 34) in Chromium.
- Tests pin the date with `page.clock.setFixedTime(2026-09-30 10:00 JST)`.

## Financial rules

- Money is **integer yen** everywhere. Round only at the end, with `ceilYen` for "required" amounts.
- `currentSavings = initialSavings + Σ(income − expense)` for transactions with `goal.startDate ≤ date ≤ today`.
- Required per month/week: remaining ÷ max(1, periods left) where months = days / 30.436875.
- Progress % never shows 100 before the goal is reached, never below 0.
- Forecast uses recurring rules (next 12 months) + average **manual** income/expense over the last ≤ 90 days. Needs ≥ 30 days of recorded history; otherwise show 「支出データがまだ十分ありません」 and no forecast numbers. Never show a completion date when average net savings ≤ 0.
- Pace: achieved / on-track / slightly-behind (shortfall ≤ 10% of target) / behind / overdue — always with reasons.
- Rate table (1日 / 1週 / 1か月, `buildRateTable`): 1 month = 30.436875 days. Recurring rules are converted from their nominal frequency (weekly ¥1,000 → exactly ¥1,000/週, monthly ¥62,000 → exactly ¥62,000/月); each cell is rounded once and group totals / net are column sums of the displayed cells, so the table always adds up. Required amounts come from `GoalMetrics` (ceil).
- Recurring rules never back-fill before the goal's 貯金開始日; re-enabling a paused rule resumes from today.

## Date rules

- Calendar dates are `'YYYY-MM-DD'` strings in Asia/Tokyo. **Never** `new Date('2026-09-30')` or `toISOString()` for calendar dates — use `src/domain/dates.ts`.
- `todayInTokyo()` is the only source of "today"; `useToday()` refreshes it on resume/midnight.

## Storage rules

- Never delete or reset the database on upgrade. Schema changes: add `db.version(N+1).stores(...).upgrade(...)` migrating rows in place; keep old versions.
- Backup format has `schemaVersion`; bump it only with a migration in `parseBackup` (`migrate()`), keeping old files importable.
- Service worker updates are prompted (`registerType: 'prompt'`), never forced; IndexedDB is untouched by updates.
- Categories are archived, never deleted.

## iPhone layout rules

- `viewport-fit=cover`; use `env(safe-area-inset-*)` (never hard-coded inset values). Headers pad with `max(env(safe-area-inset-top), 12px)`; the tab bar pads with `env(safe-area-inset-bottom)`; `.page-x` handles left/right insets.
- Use `dvh` / `--vvh`; never rely on plain `100vh` for full-height layout.
- Bottom sheets are positioned with `--kb` / `--vvh` from `useKeyboardInset` (visualViewport) so the footer action stays above the iOS keyboard.
- Touch targets ≥ 44 pt (the layout test enforces this). Inputs ≥ 16 px to avoid iOS zoom. No hover-only UI.
- Amount inputs: `inputMode="numeric"` + `pattern="[0-9]*"`. Opening the add sheet focuses the amount field synchronously (`flushSync`) so the keypad appears in the same tap; category/date chips `preventDefault` on mousedown to keep the keypad up.
- Chart colors: validated palette (series-1 blue / series-2 orange) against both surfaces; text never uses series colors.

## Prohibited shortcuts

- Adding a backend, auth, analytics, or any network call with user data.
- Floating-point money storage, UTC-shifted dates, `height: 100vh` layouts.
- Skipping/deleting failing tests, `--no-verify`, force pushes, rewriting history.
- Clearing IndexedDB on version change, or auto-reloading the page for SW updates.
- Inventing forecast numbers when data is insufficient.
- Asking the owner to do anything on a computer.

## Status

See `docs/STATUS.md` for the current state, remaining work, and manual (iPhone) actions.
