import { useId } from 'react';
import { generateRecurringTransactions, saveGoal } from '../../storage/repository';
import { errorMessage, useApp } from '../AppContext';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { GoalForm } from './GoalForm';

export function GoalSheet() {
  const { goal, today, closeSheet, toast } = useApp();
  const formId = useId();
  return (
    <Sheet
      title="目標を編集"
      onClose={closeSheet}
      testId="goal-sheet"
      footer={
        <Button type="submit" form={formId} size="lg" block>
          保存する
        </Button>
      }
    >
      <div className="pt-2 pb-2">
        <GoalForm
          formId={formId}
          today={today}
          initial={goal}
          onSubmit={async (input) => {
            try {
              await saveGoal(input);
              await generateRecurringTransactions(today);
              closeSheet();
              toast({ message: '目標を更新しました' });
            } catch (error) {
              toast({ message: errorMessage(error), tone: 'error' });
            }
          }}
        />
      </div>
    </Sheet>
  );
}
