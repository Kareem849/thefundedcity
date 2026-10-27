// Registered trader profiles.
// Public part (everything on the tower card) lives in the page's shared database as `traders/<your id>`,
// so every viewer of the city sees every registered trader's tower or house. Email and phone go to your
// private space (`data/users/<your id>/contact`), which nobody else can read. Off the published page,
// both stay in this browser.
import { getCloud, type Cloud } from './cloud';
import type { TraderProfilePublic, PayoutRecord, SectorId, LinkKey } from './data';
import { LINK_LABEL } from './data';

export interface PrivateContact { email: string; phone: string }

export interface ProfileStore {
  ready: Promise<void>;
  /** shared on the published page (false = this browser only) */
  readonly shared: boolean;
  readonly readOnly: boolean;
  readonly uid: string;
  mine: () => TraderProfilePublic | null;
  all: () => TraderProfilePublic[];
  onChange: (fn: (all: TraderProfilePublic[]) => void) => void;
  save: (p: TraderProfilePublic) => Promise<void>;
  getContact: () => Promise<PrivateContact | null>;
  saveContact: (c: PrivateContact) => Promise<void>;
}

const LOCAL_PUB = 'fundedcity-trader-profile';
const LOCAL_PRIV = 'fundedcity-trader-contact';
const SECTORS: SectorId[] = ['cfd', 'futures', 'perps', 'multi'];
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0);

function cleanRecord(v: unknown): PayoutRecord | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const status = r.status === 'verified' || r.status === 'rejected' || r.status === 'pending' ? r.status : null;
  if (!status) return null;
  return {
    id: str(r.id, 24) || Math.random().toString(36).slice(2, 10),
    kind: r.kind === 'lifetime' ? 'lifetime' : 'single',
    amount: Math.round(num(r.amount, 0, 1e9)),
    firm: str(r.firm, 48),
    date: str(r.date, 10),
    method: r.method === 'code' ? 'code' : 'bank',
    status,
    checks: Array.isArray(r.checks) ? r.checks.filter((c) => typeof c === 'string').slice(0, 8).map((c) => (c as string).slice(0, 220)) : [],
    at: num(r.at, 0, 4e12),
    hash: str(r.hash, 64) || undefined,
  };
}

/** Never trust shared rows: clamp every field to the shapes the city draws. */
export function cleanProfile(uid: string, v: unknown): TraderProfilePublic | null {
  if (!v || typeof v !== 'object') return null;
  const d = v as Record<string, unknown>;
  const fullName = str(d.fullName, 60).trim();
  if (!fullName) return null;
  const links: Partial<Record<LinkKey, string>> = {};
  const lv = (d.links && typeof d.links === 'object' ? d.links : {}) as Record<string, unknown>;
  for (const k of Object.keys(LINK_LABEL) as LinkKey[]) {
    const s = str(lv[k], 160).trim();
    if (s) links[k] = s;
  }
  return {
    uid,
    fullName,
    towerName: str(d.towerName, 28).trim() || fullName.slice(0, 28),
    sector: SECTORS.includes(d.sector as SectorId) ? (d.sector as SectorId) : 'multi',
    allocation: Math.round(num(d.allocation, 0, 1e9)),
    claimedPayouts: Math.round(num(d.claimedPayouts, 0, 1e9)),
    country: str(d.country, 48),
    firms: Array.isArray(d.firms) ? d.firms.filter((f) => typeof f === 'string').slice(0, 30).map((f) => (f as string).slice(0, 48)) : [],
    links,
    services: str(d.services, 400),
    allowVisitors: d.allowVisitors === true,
    payouts: (Array.isArray(d.payouts) ? d.payouts : []).map(cleanRecord).filter(Boolean).slice(0, 60) as PayoutRecord[],
    joined: num(d.joined, 0, 4e12),
    updatedAt: num(d.updatedAt, 0, 4e12),
  };
}

export function createProfileStore(): ProfileStore {
  let cloud: Cloud | null = null;
  let readOnly = false;
  let uid = 'me';
  let list: TraderProfilePublic[] = [];
  const fns: Array<(all: TraderProfilePublic[]) => void> = [];
  const emit = () => { for (const f of fns) f(list); };

  const ready = (async () => {
    cloud = await getCloud();
    if (cloud?.uid) uid = cloud.uid;
    readOnly = !!cloud && (cloud.canWrite === false || !cloud.uid);
    if (cloud) {
      await new Promise<void>((resolve) => {
        let first = true;
        cloud!.db.collection('traders').limit(500).onSnapshot(
          (snap: { docs: Array<{ id: string; data(): Record<string, unknown> | undefined }> }) => {
            list = snap.docs.map((d) => cleanProfile(d.id, d.data())).filter(Boolean) as TraderProfilePublic[];
            emit();
            if (first) { first = false; resolve(); }
          },
          () => { if (first) { first = false; resolve(); } },
        );
        setTimeout(() => { if (first) { first = false; resolve(); } }, 8000);
      });
    } else {
      try {
        const p = cleanProfile('me', JSON.parse(localStorage.getItem(LOCAL_PUB) ?? 'null'));
        list = p ? [p] : [];
      } catch { list = []; }
      emit();
    }
  })();

  return {
    ready,
    get shared() { return !!cloud; },
    get readOnly() { return readOnly; },
    get uid() { return uid; },
    mine: () => list.find((p) => p.uid === uid) ?? null,
    all: () => list,
    onChange: (fn) => { fns.push(fn); },
    async save(p) {
      const clean = cleanProfile(uid, { ...p, updatedAt: Date.now() })!;
      if (cloud && cloud.uid) {
        const { uid: _u, ...doc } = clean;
        void _u;
        await cloud.db.doc('traders/' + cloud.uid).set(doc);
      } else {
        try { localStorage.setItem(LOCAL_PUB, JSON.stringify(clean)); } catch { /* storage unavailable */ }
        list = [clean];
        emit();
      }
    },
    async getContact() {
      await ready;
      if (cloud && cloud.uid) {
        try {
          const snap = await cloud.db.doc(`data/users/${cloud.uid}/contact`).get();
          const v = snap?.data?.() ?? null;
          return v ? { email: str(v.email, 120), phone: str(v.phone, 40) } : null;
        } catch { return null; }
      }
      try {
        const v = JSON.parse(localStorage.getItem(LOCAL_PRIV) ?? 'null');
        return v ? { email: str(v.email, 120), phone: str(v.phone, 40) } : null;
      } catch { return null; }
    },
    async saveContact(c) {
      const doc = { email: c.email.slice(0, 120), phone: c.phone.slice(0, 40), updatedAt: Date.now() };
      if (cloud && cloud.uid) await cloud.db.doc(`data/users/${cloud.uid}/contact`).set(doc);
      else try { localStorage.setItem(LOCAL_PRIV, JSON.stringify(doc)); } catch { /* ignore */ }
    },
  };
}
