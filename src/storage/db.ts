import Dexie, { type EntityTable } from 'dexie';
import type { AppSettings, Category, Goal, RecurringRule, Transaction } from '../domain/types';

export const DB_NAME = 'goalbudget';

/**
 * IndexedDB schema.
 *
 * DATA SAFETY: never change or remove an existing version() block and never delete the
 * database on upgrade. To change the schema, add `this.version(N + 1).stores({...})`
 * with an `.upgrade(tx => ...)` that migrates existing rows in place.
 */
export class GoalBudgetDB extends Dexie {
  goals!: EntityTable<Goal, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  recurringRules!: EntityTable<RecurringRule, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores({
      goals: 'id',
      transactions: 'id, date, type, categoryId, recurringRuleId',
      recurringRules: 'id',
      categories: 'id, kind',
      settings: 'id',
    });
  }
}

export const db = new GoalBudgetDB();
