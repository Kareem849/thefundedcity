// Shared storage for the published page: the `db` + `user` runtime capabilities (claude.ai artifacts).
// When the page runs anywhere else (locally, as a file) these resolve to null and features fall back
// to this browser only.
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Cloud {
  db: any;
  user: any;
  uid: string | null;
  /** null = the platform said nothing (keep inputs and let a refused write decide) */
  canWrite: boolean | null;
}

let cached: Promise<Cloud | null> | null = null;

export function getCloud(): Promise<Cloud | null> {
  if (cached) return cached;
  cached = (async () => {
    const c = (window as any).claude;
    if (!c || typeof c.use !== 'function') return null;
    try {
      const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
      if (!db) return null;
      const uid: string | null = user ? await user.id() : null;
      const canWrite: boolean | null = user ? await user.can('data.write') : null;
      return { db, user, uid, canWrite };
    } catch {
      return null;
    }
  })();
  return cached;
}
