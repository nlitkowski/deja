import { useEffect } from 'react';
import { AppLayout, MenuButton } from '../components/AppLayout';
import { Emoji } from '../components/Emoji';
import { Icon } from '../components/Icon';
import { AudioDownload } from '../components/AudioDownload';
import { UnitMap } from '../components/UnitMap';
import { content } from '../content/registry';
import { ui } from '../i18n/ui';
import { useMapState } from '../state/useGame';

interface Props {
  packId: string;
  onBack: () => void;
  onPractice: (unitKey: string) => void;
  onBoss: (unitKey: string, listening?: boolean) => void;
  onRefresh: (unitKey: string, entryIds: string[]) => void;
  onOpenSheet: (key: string) => void;
}

/** One pack's path of units and bosses, opened from its tile on the home screen. */
export function PackScreen({ packId, onBack, onPractice, onBoss, onRefresh, onOpenSheet }: Props) {
  const map = useMapState();
  const pack = content.packs.find((p) => p.id === packId);
  const state = map.get(packId);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [packId]);

  return (
    <AppLayout onOpenSheet={onOpenSheet} onPractice={onPractice}>
      <main className="screen pack-screen">
        <header className="top-bar">
          <MenuButton />
          <button className="back-button" onClick={onBack}>
            <Icon name="back" /> {ui.back}
          </button>
        </header>
        {pack && state && (
          <section className="pack">
            <h1>
              <Emoji char={pack.icon} /> {pack.title} <span className="level">{pack.level}</span>
            </h1>
            <AudioDownload key={pack.id} units={pack.unitList.map((u) => u.key)} sheets={pack.sheetList.map((s) => s.key)} />
            <UnitMap pack={pack} state={state} onPractice={onPractice} onBoss={onBoss} onRefresh={onRefresh} />
          </section>
        )}
      </main>
    </AppLayout>
  );
}
