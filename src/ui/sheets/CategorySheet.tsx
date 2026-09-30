import { useId, useState, type FormEvent } from 'react';
import { CATEGORY_EMOJI_CHOICES } from '../../domain/categories';
import type { Category, TxType } from '../../domain/types';
import { saveCategory, setCategoryArchived } from '../../storage/repository';
import { errorMessage, useApp } from '../AppContext';
import { Button } from '../components/Button';
import { TextField } from '../components/fields';
import { Sheet } from '../components/Sheet';

interface Props {
  kind: TxType;
  category: Category | null;
}

export function CategorySheet({ kind, category }: Props) {
  const { snapshot, closeSheet, toast, confirm } = useApp();
  const formId = useId();
  const [name, setName] = useState(category?.name ?? '');
  const [emoji, setEmoji] = useState(category?.emoji ?? '📦');
  const [error, setError] = useState<string>();

  const activeOfKind = snapshot.categories.filter((c) => c.kind === kind && !c.archived).length;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await saveCategory({ kind, name, emoji }, category?.id);
      closeSheet();
      toast({ message: `カテゴリ「${name.trim()}」を保存しました` });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const archive = async () => {
    if (!category) return;
    const ok = await confirm({
      title: `「${category.name}」を非表示にしますか？`,
      message: '入力画面に表示されなくなります。過去の記録はそのまま残り、あとで再表示できます。',
      confirmLabel: '非表示にする',
      destructive: true,
    });
    if (!ok) return;
    await setCategoryArchived(category.id, true);
    closeSheet();
    toast({ message: `「${category.name}」を非表示にしました` });
  };

  return (
    <Sheet
      title={category ? 'カテゴリを編集' : `${kind === 'income' ? '収入' : '支出'}カテゴリを追加`}
      onClose={closeSheet}
      testId="category-sheet"
      footer={
        <Button type="submit" form={formId} size="lg" block>
          保存する
        </Button>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-5 pt-2 pb-2">
        <TextField label="名前" value={name} onChange={setName} placeholder="例：カフェ" maxLength={30} error={error} />
        <div>
          <div className="mb-1.5 text-[14px] font-semibold text-ink-2">アイコン</div>
          <div role="radiogroup" aria-label="アイコン" className="grid grid-cols-8 gap-1">
            {CATEGORY_EMOJI_CHOICES.map((e) => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={emoji === e}
                aria-label={e}
                onClick={() => setEmoji(e)}
                className={`grid aspect-square min-h-[44px] place-items-center rounded-xl border-2 text-[22px] ${
                  emoji === e ? 'border-progress bg-accent-soft' : 'border-transparent bg-surface-2'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        {category && !category.archived && (
          <Button variant="destructive" block onClick={archive} disabled={activeOfKind <= 1}>
            このカテゴリを非表示にする
          </Button>
        )}
      </form>
    </Sheet>
  );
}
