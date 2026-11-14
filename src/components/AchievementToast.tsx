import { useEffect, useState } from 'react';
import { ui } from '../i18n/ui';
import { browserStore } from '../lib/storage';
import { sfx } from '../sfx';
import { useAppStore } from '../state/appStore';
import { ACHIEVEMENTS, useAchievements } from '../state/useGame';
import { Emoji } from './Emoji';

/** Badges already announced on this device. Kept outside the log: it is about this screen, not progress. */
const SEEN_KEY = 'deja:achievements-seen';
const SHOW_MS = 3500;

function loadSeen(): Set<string> | undefined {
  try {
    const raw = browserStore()?.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : undefined;
  } catch {
    return undefined;
  }
}

function saveSeen(seen: ReadonlySet<string>) {
  try {
    browserStore()?.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    // Storage full or blocked: at worst a badge is announced again.
  }
}

/** Announces each newly unlocked badge once per device, one after another. */
export function AchievementToast() {
  const ready = useAppStore((s) => s.status === 'ready');
  const sound = useAppStore((s) => s.settings.sound);
  const { unlocked } = useAchievements();
  const [seen, setSeen] = useState<ReadonlySet<string> | undefined>(loadSeen);

  // First run on this device: whatever is unlocked was earned before toasts existed, so take it as seen.
  useEffect(() => {
    if (!ready || seen) return;
    const timer = window.setTimeout(() => {
      const all = new Set(unlocked);
      saveSeen(all);
      setSeen(all);
    });
    return () => window.clearTimeout(timer);
  }, [ready, seen, unlocked]);

  const current = seen && ACHIEVEMENTS.find((a) => unlocked.has(a.id) && !seen.has(a.id));

  useEffect(() => {
    if (!current || !seen) return;
    if (sound) sfx.levelUp();
    const timer = window.setTimeout(() => {
      const next = new Set(seen).add(current.id);
      saveSeen(next);
      setSeen(next);
    }, SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [current, seen, sound]);

  if (!current) return null;
  return (
    <div className="achievement-toast" role="status" key={current.id}>
      <span className="achievement-toast-icon" aria-hidden>
        <Emoji char={current.icon} />
      </span>
      <span>
        <span className="muted small">{ui.newAchievement}</span>
        <strong>{current.title}</strong>
      </span>
    </div>
  );
}
