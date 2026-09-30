import { useState } from 'react';
import { categoriesFor } from '../../domain/categories';
import type { TxType } from '../../domain/types';
import { setCategoryArchived } from '../../storage/repository';
import { useApp } from '../AppContext';
import { Button } from '../components/Button';
import { PlusIcon } from '../components/Icons';
import { Row, ScreenHeader, Section } from '../components/layout';
import { Segmented } from '../components/Segmented';

const KIND_OPTIONS = [
  { value: 'expense', label: '支出' },
  { value: 'income', label: '収入' },
] as const;

export function CategoriesScreen() {
  const { snapshot, back, openSheet, toast } = useApp();
  const [kind, setKind] = useState<TxType>('expense');
  const all = categoriesFor(snapshot.categories, kind, true);
  const active = all.filter((c) => !c.archived);
  const archived = all.filter((c) => c.archived);

  return (
    <main className="mx-auto max-w-[560px]">
      <ScreenHeader
        title="カテゴリ"
        onBack={back}
        backLabel="設定"
        trailing={
          <Button
            variant="tinted"
            icon={<PlusIcon size={18} strokeWidth={2.6} />}
            onClick={() => openSheet({ kind: 'category', categoryKind: kind, category: null })}
            data-testid="add-category"
          >
            追加
          </Button>
        }
      />
      <div className="page-x">
        <Segmented label="種類" options={KIND_OPTIONS} value={kind} onChange={setKind} />
        <Section title="使用中" footer="タップすると名前やアイコンを変更できます。">
          {active.map((c) => (
            <Row key={c.id} icon={c.emoji} title={c.name} onClick={() => openSheet({ kind: 'category', categoryKind: kind, category: c })} />
          ))}
        </Section>
        {archived.length > 0 && (
          <Section title="非表示" footer="非表示のカテゴリは入力画面に出ませんが、過去の記録には残ります。">
            {archived.map((c) => (
              <Row
                key={c.id}
                icon={<span className="opacity-60">{c.emoji}</span>}
                title={<span className="text-ink-2">{c.name}</span>}
                chevron={false}
                trailing={
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      await setCategoryArchived(c.id, false);
                      toast({ message: `「${c.name}」を再表示しました` });
                    }}
                  >
                    再表示
                  </Button>
                }
              />
            ))}
          </Section>
        )}
      </div>
    </main>
  );
}
