// Payout verification, run in the trader's browser:
//  1. Read any QR code or barcode on the payout document (the browser's barcode reader where it has one,
//     otherwise jsQR, loaded from a CDN only when a document is checked).
//  2. A code must link to the prop firm's official website, or the payout is rejected.
//  3. No code: a bank-transfer proof is required.
//  4. On the published page, Claude reads the documents (amount, firm, date, recipient, signs of
//     editing) and they must match what the trader entered.
// Documents are never uploaded or stored: only the result and the checks are saved.
import { FIRMS } from './firms';
import type { PayoutRecord, PayoutStatus } from './data';

export type StepState = 'run' | 'ok' | 'fail' | 'warn' | 'skip';
export interface Step { key: string; label: string; state: StepState; detail?: string }

export interface VerifyInput {
  kind: 'single' | 'lifetime';
  amount: number;
  firmId: string; // a FIRMS id, or 'other'
  firmName: string;
  date: string;
  fullName: string;
  doc: File;
  bank: File | null;
  /** fingerprints of proofs already used on this profile */
  usedHashes: string[];
}

export interface CodeScan { found: boolean; value: string; host: string; kind: 'link-ok' | 'link-bad' | 'no-link' | 'none' | 'unreadable'; firmHost: string }

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const isImage = (f: File) => IMAGE_TYPES.includes(f.type);

export function firmHost(firmId: string) {
  const f = FIRMS.find((x) => x.id === firmId);
  if (!f) return '';
  try { return new URL(f.website).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}
const hostMatches = (host: string, firm: string) => !!firm && (host === firm || host.endsWith('.' + firm));

export async function fileHash(f: File) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', await f.arrayBuffer());
    return [...new Uint8Array(buf)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch { return ''; }
}

/* ---------------- code reading ---------------- */
type JsQR = (data: Uint8ClampedArray, w: number, h: number, o?: { inversionAttempts?: string }) => { data: string } | null;
let jsqrPromise: Promise<JsQR | null> | null = null;
function loadJsQR(): Promise<JsQR | null> {
  const w = window as unknown as { jsQR?: JsQR };
  if (w.jsQR) return Promise.resolve(w.jsQR);
  if (!jsqrPromise) {
    jsqrPromise = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
      s.async = true;
      s.onload = () => resolve(w.jsQR ?? null);
      s.onerror = () => { jsqrPromise = null; resolve(null); };
      document.head.appendChild(s);
      setTimeout(() => resolve(w.jsQR ?? null), 12000);
    });
  }
  return jsqrPromise;
}

async function readCodeValue(file: File): Promise<string | null | 'unreadable'> {
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file); } catch { return 'unreadable'; }
  // 1. the browser's own barcode reader (QR + common 1D/2D barcodes) where available
  const BD = (window as unknown as { BarcodeDetector?: new (o?: unknown) => { detect: (s: ImageBitmap) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
  if (BD) {
    try {
      const found = await new BD().detect(bmp);
      if (found[0]?.rawValue) return found[0].rawValue;
    } catch { /* fall through to jsQR */ }
  }
  // 2. jsQR at two scales
  const jsQR = await loadJsQR();
  if (!jsQR) return BD ? null : 'unreadable';
  for (const max of [1600, 900]) {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * k));
    const h = Math.max(1, Math.round(bmp.height * k));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(bmp, 0, 0, w, h);
    const r = jsQR(g.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'attemptBoth' });
    if (r?.data) return r.data;
  }
  return null;
}

/** Look for a code on the document and check where it points. */
export async function scanCode(file: File, firmId: string): Promise<CodeScan> {
  const fh = firmHost(firmId);
  if (!isImage(file)) return { found: false, value: '', host: '', kind: 'unreadable', firmHost: fh };
  const v = await readCodeValue(file);
  if (v === 'unreadable') return { found: false, value: '', host: '', kind: 'unreadable', firmHost: fh };
  if (!v) return { found: false, value: '', host: '', kind: 'none', firmHost: fh };
  let host = '';
  try {
    const u = new URL(v.trim());
    if (u.protocol === 'https:' || u.protocol === 'http:') host = u.hostname.replace(/^www\./, '').toLowerCase();
  } catch { /* not a link */ }
  if (!host) return { found: true, value: v.slice(0, 200), host: '', kind: 'no-link', firmHost: fh };
  return { found: true, value: v.slice(0, 200), host, kind: hostMatches(host, fh) ? 'link-ok' : 'link-bad', firmHost: fh };
}

/* ---------------- AI document read ---------------- */
interface Read {
  document_type: 'payout_certificate' | 'payout_screenshot' | 'bank_transfer' | 'payment_receipt' | 'other';
  firm: string | null;
  amount: number | null;
  currency: string | null;
  date: string | null;
  recipient: string | null;
  sender: string | null;
  signs_of_editing: boolean;
  notes: string;
}
type SampleNS = ((i: string, o?: Record<string, unknown>) => Promise<{ text: string }>) & {
  json?: <T>(i: string, o?: Record<string, unknown>) => Promise<T>;
  limits?: () => Promise<{ images?: { maxCount: number; maxInputBytes: number; mediaTypes: string[] } }>;
};
let samplePromise: Promise<SampleNS | null> | null = null;
function getSample() {
  if (!samplePromise) {
    samplePromise = (async () => {
      const c = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
      if (!c?.use) return null;
      try { return ((await c.use('sample')) as SampleNS) ?? null; } catch { return null; }
    })();
  }
  return samplePromise;
}
/** Can this view send images to Claude? */
export async function aiAvailable() {
  const s = await getSample();
  if (!s?.json || !s.limits) return false;
  try { return !!(await s.limits()).images; } catch { return false; }
}

async function aiRead(file: File, role: 'payout document' | 'bank transfer proof'): Promise<Read | { error: string }> {
  const s = await getSample();
  if (!s?.json) return { error: 'unavailable' };
  const prompt = `You are checking a prop-trading ${role} uploaded to FUNDEDCITY. Read the attached image carefully and reply with ONLY a JSON object with these keys:
{"document_type": one of "payout_certificate" | "payout_screenshot" | "bank_transfer" | "payment_receipt" | "other",
 "firm": the prop firm named on it, or null,
 "amount": the payout amount as a number (no symbols), or null,
 "currency": ISO code like "USD", or null,
 "date": "YYYY-MM-DD" or null,
 "recipient": the person or account receiving the money, or null,
 "sender": who sent the money (firm, payment provider or bank), or null,
 "signs_of_editing": true if text looks pasted, misaligned, inconsistent fonts or numbers that don't add up, else false,
 "notes": one short sentence}
Use null for anything you cannot read. Do not guess.`;
  try {
    const v = await s.json<Read>(prompt, { images: [file], modelTier: 'default', cache: false });
    if (!v || typeof v !== 'object') return { error: 'unreadable' };
    return v;
  } catch (e) {
    return { error: (e as { code?: string })?.code ?? 'error' };
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
function nameMatches(a: string, b: string) {
  const ta = norm(a).split(' ').filter((x) => x.length >= 3);
  const tb = new Set(norm(b).split(' ').filter((x) => x.length >= 3));
  return ta.some((x) => tb.has(x));
}
function firmMatches(read: string, firmName: string) {
  const a = norm(read);
  const b = norm(firmName);
  if (!a || !b) return false;
  const key = b.split(' ').filter((w) => !['the', 'funded', 'trading', 'capital', 'group', 'markets', 'prop', 'firm', 'trader'].includes(w))[0] ?? b.split(' ')[0];
  return a.includes(key) || b.includes(a);
}
const usd = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

/**
 * Run every check and decide: verified, rejected, or pending (when a check that matters can't run here).
 * `onStep` streams progress for the checklist UI.
 */
export async function verifyPayout(inp: VerifyInput, onStep: (steps: Step[]) => void): Promise<Pick<PayoutRecord, 'status' | 'checks' | 'method' | 'hash'>> {
  const steps: Step[] = [];
  const push = (s: Step) => { const i = steps.findIndex((x) => x.key === s.key); if (i >= 0) steps[i] = s; else steps.push(s); onStep([...steps]); };
  const checks: string[] = [];
  const done = (status: PayoutStatus, method: 'code' | 'bank') => ({ status, checks, method, hash });

  // 0. the same proof can only count once
  push({ key: 'dup', label: 'Checking this proof hasn’t been used before', state: 'run' });
  const hash = await fileHash(inp.doc);
  if (hash && inp.usedHashes.includes(hash)) {
    push({ key: 'dup', label: 'This document was already submitted', state: 'fail' });
    checks.push('Rejected: this document was already used for another payout.');
    return done('rejected', 'code');
  }
  push({ key: 'dup', label: 'New proof', state: 'ok' });

  // 1. code on the document
  push({ key: 'code', label: 'Looking for a QR code or barcode', state: 'run' });
  const scan = await scanCode(inp.doc, inp.firmId);
  let method: 'code' | 'bank' = 'bank';
  if (scan.kind === 'link-ok') {
    method = 'code';
    push({ key: 'code', label: `Code links to ${scan.host}, ${inp.firmName}’s official site`, state: 'ok' });
    checks.push(`Code on the document links to ${scan.host} (${inp.firmName}’s official site).`);
  } else if (scan.kind === 'link-bad') {
    if (!scan.firmHost) {
      push({ key: 'code', label: `Code links to ${scan.host}; the firm isn’t in FUNDEDCITY’s list, so it can’t be matched`, state: 'warn' });
      checks.push(`Code links to ${scan.host}; firm not in FUNDEDCITY’s list, so the bank transfer decides.`);
    } else {
      push({ key: 'code', label: `Code links to ${scan.host}, not ${scan.firmHost}`, state: 'fail' });
      checks.push(`Rejected: the code links to ${scan.host}, not ${inp.firmName}’s official site (${scan.firmHost}).`);
      return done('rejected', 'code');
    }
  } else if (scan.kind === 'no-link') {
    push({ key: 'code', label: 'A code was found but it doesn’t link to a website', state: 'warn' });
    checks.push('A code was found but it holds no web link, so the bank transfer proof decides.');
  } else if (scan.kind === 'none') {
    push({ key: 'code', label: 'No code on this document', state: 'warn' });
    checks.push('No QR code or barcode found on the payout document.');
  } else {
    push({ key: 'code', label: isImage(inp.doc) ? 'Couldn’t read codes in this browser' : 'PDF: codes are read from images (JPG, PNG, WebP)', state: 'warn' });
    checks.push(isImage(inp.doc) ? 'The code reader isn’t available in this browser.' : 'Uploaded as PDF, so no code could be read.');
  }

  // 2. no valid code: a bank transfer proof is required
  if (method === 'bank' && !inp.bank) {
    push({ key: 'bank', label: 'Bank transfer proof needed', state: 'fail' });
    checks.push('Pending: attach the bank transfer (or payment provider) proof for this payout.');
    return done('pending', 'bank');
  }

  // 3. read the documents
  const canAI = await aiAvailable();
  const docs: Array<[File, 'payout document' | 'bank transfer proof']> = [[inp.doc, 'payout document']];
  if (inp.bank && method === 'bank') docs.push([inp.bank, 'bank transfer proof']);
  let aiProblem = '';
  let aiMatched = false;
  for (const [file, role] of docs) {
    const key = role === 'payout document' ? 'read' : 'bankread';
    if (!canAI || !isImage(file)) {
      push({ key, label: `Reading the ${role}: ${!canAI ? 'runs on the published city page' : 'needs an image (JPG, PNG, WebP)'}`, state: 'skip' });
      continue;
    }
    push({ key, label: `Reading the ${role} with Claude`, state: 'run' });
    const r = await aiRead(file, role);
    if ('error' in r) {
      push({ key, label: `Couldn’t read the ${role} (${r.error})`, state: 'warn' });
      continue;
    }
    const problems: string[] = [];
    if (role === 'payout document' && r.document_type === 'other') problems.push('it doesn’t look like a payout document');
    if (role === 'bank transfer proof' && !['bank_transfer', 'payment_receipt'].includes(r.document_type)) problems.push('it doesn’t look like a bank transfer or payment receipt');
    if (r.signs_of_editing) problems.push('it shows signs of editing');
    if (r.currency && r.currency.toUpperCase() !== 'USD' && r.amount) problems.push(`the amount is in ${r.currency.toUpperCase()}, enter it in USD`);
    if (r.amount != null) {
      const lo = role === 'bank transfer proof' ? inp.amount * 0.9 : inp.amount * 0.985;
      const hi = inp.amount * 1.015;
      if (r.amount < lo || r.amount > hi) problems.push(`it shows ${usd(r.amount)}, you entered ${usd(inp.amount)}`);
    } else problems.push('no amount could be read');
    if (role === 'payout document' && r.firm && inp.firmId !== 'other' && !firmMatches(r.firm, inp.firmName)) problems.push(`it names ${r.firm}, not ${inp.firmName}`);
    const who = r.recipient ?? '';
    if (who && !nameMatches(who, inp.fullName)) problems.push(`it’s made out to “${who.slice(0, 40)}”, not your profile name`);
    if (problems.length) {
      push({ key, label: `The ${role} doesn’t match: ${problems.join('; ')}`, state: 'fail' });
      aiProblem = `The ${role} doesn’t match: ${problems.join('; ')}.`;
      break;
    }
    aiMatched = true;
    push({ key, label: `The ${role} matches: ${r.amount != null ? usd(r.amount) : ''}${r.firm ? ' · ' + r.firm : ''}${r.date ? ' · ' + r.date : ''}`, state: 'ok' });
    checks.push(`Claude read the ${role}: ${r.amount != null ? usd(r.amount) : 'amount unread'}${r.firm ? `, ${r.firm}` : ''}${r.date ? `, ${r.date}` : ''}${who ? `, to ${who.slice(0, 40)}` : ''}.`);
  }
  if (aiProblem) {
    checks.push('Rejected: ' + aiProblem);
    return done('rejected', method);
  }

  // 4. decision
  if (method === 'code') {
    checks.push(aiMatched ? 'Verified: code links to the firm and the document matches.' : 'Verified: the code links to the firm’s official site.');
    return done('verified', 'code');
  }
  if (aiMatched && docs.length === 2 && steps.find((s) => s.key === 'bankread')?.state === 'ok') {
    checks.push('Verified: the bank transfer matches the payout.');
    return done('verified', 'bank');
  }
  checks.push('Pending: the bank transfer needs to be read and matched. That runs on the published city page.');
  return done('pending', 'bank');
}
