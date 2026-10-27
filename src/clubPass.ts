// Club pass for the 100K+ Payouts Golf Club (also lets firm teams publish arena tournaments).
// Traders qualify with $100,000+ in verified payouts; prop-firm CEOs and marketing teams request a firm
// pass. In this demo the firm role is self-declared and marked unverified; the pass lives in this browser.

export type PassKind = 'trader' | 'ceo' | 'marketing';
export interface ClubPass {
  kind: PassKind;
  firmId?: string;
  firmName?: string;
  /** verified payouts at the time the pass was issued (traders) */
  payouts?: number;
  since: number;
}

const KEY = 'fundedcity-club-pass';
let current: ClubPass | null = null;
const listeners: Array<(p: ClubPass | null) => void> = [];

try {
  const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  if (v && (v.kind === 'trader' || v.kind === 'ceo' || v.kind === 'marketing') && typeof v.since === 'number') current = v;
} catch { /* storage unavailable */ }

export const getPass = () => current;

export function setPass(p: ClubPass | null) {
  current = p;
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
  for (const f of listeners) f(p);
}

export const onPass = (f: (p: ClubPass | null) => void) => { listeners.push(f); };

export const PASS_LABEL: Record<PassKind, string> = { trader: '100K+ trader', ceo: 'CEO', marketing: 'Marketing' };

export function passRole(p: ClubPass | null) {
  if (!p) return '';
  return p.kind === 'trader' ? '100K+ trader' : `${PASS_LABEL[p.kind]} · ${p.firmName ?? 'Prop firm'}`;
}
