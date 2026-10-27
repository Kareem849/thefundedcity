// Shared access to Claude through the published page's `sample` capability.
// Resolves once; null anywhere the page can't reach Claude (then features use their offline fallback).
export type SampleFn = ((input: string | Array<{ role: 'user' | 'assistant'; content: string }>, opts?: Record<string, unknown>) => Promise<{ text: string }>) & {
  json?: <T>(i: string, o?: Record<string, unknown>) => Promise<T>;
  limits?: () => Promise<{ images?: unknown }>;
};
let p: Promise<SampleFn | null> | null = null;
export function getSample(): Promise<SampleFn | null> {
  if (!p) {
    p = (async () => {
      const c = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
      if (!c?.use) return null;
      try { return ((await c.use('sample')) as SampleFn) ?? null; } catch { return null; }
    })();
  }
  return p;
}
/** Error codes that mean "no AI in this view": switch to the offline helper for good. */
export const AI_OFF_CODES = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'];
export function aiErrorNote(code: string) {
  if (code === 'rate_limited') return 'Too many questions right now. Try again in a little while.';
  if (code === 'session_expired') return 'Please sign in to Claude again, then ask once more.';
  if (code === 'refused') return 'I can’t help with that one. Try asking another way.';
  return 'The answer was interrupted. Ask again to retry.';
}
