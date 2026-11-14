import { describe, expect, it } from 'vitest';
import { mergeStamped, NEVER, parseStamped, stampSettings } from './settingsSync';
import { defaultSettings } from './storage';

const t1 = '2026-11-14T10:00:00.000Z';
const t2 = '2026-11-14T11:00:00.000Z';

describe('settings sync', () => {
  it('keeps the newer change per field, and the stored value on a tie', () => {
    const stored = { palette: { value: 'pixel' as const, at: t2 }, helpLang: { value: 'pl' as const, at: t1 } };
    const incoming = { palette: { value: 'provence' as const, at: t1 }, helpLang: { value: 'fr' as const, at: t2 }, sound: { value: false, at: t1 } };
    expect(mergeStamped(stored, incoming)).toEqual({ palette: { value: 'pixel', at: t2 }, helpLang: { value: 'fr', at: t2 }, sound: { value: false, at: t1 } });
    expect(mergeStamped(stored, { palette: { value: 'classic', at: t2 } }).palette?.value).toBe('pixel');
  });

  it('drops invalid fields and fields that do not sync', () => {
    expect(parseStamped({ palette: { value: 'neon', at: t1 }, sound: { value: true, at: 'yesterday' }, navCollapsed: { value: true, at: t1 }, helpLang: { value: 'fr', at: t1 } })).toEqual({ helpLang: { value: 'fr', at: t1 } });
    expect(parseStamped('nope')).toEqual({});
  });

  it('stamps settings never changed here as older than any real change', () => {
    const stamped = stampSettings(defaultSettings(), { palette: t1 });
    expect(stamped.palette).toEqual({ value: 'classic', at: t1 });
    expect(stamped.helpLang?.at).toBe(NEVER);
    expect('navCollapsed' in stamped).toBe(false);
  });
});
