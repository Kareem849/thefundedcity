// Advertising spaces around FUNDEDCITY: city billboards, the Yacht Club breakwater board, golf course
// boards, hull ads on the container ships and superyachts, and (in the airport panel) aircraft liveries.
// Prices are sample figures for the demo.
import * as THREE from 'three';
import { MAT, mesh, rbox, signPlane } from './buildings';

export type AdKind = 'billboard' | 'marina' | 'golf' | 'ship' | 'yacht';
export interface AdSlot {
  id: string;
  name: string;
  where: string;
  kind: AdKind;
  size: string;
  audience: string;
  /** sample monthly price, USD */
  price: number;
  /** placement for boards built by the city (ships and yachts are placed by the harbour) */
  x?: number;
  z?: number;
  y?: number;
  rot?: number;
}

export const AD_KIND_LABEL: Record<AdKind, string> = {
  billboard: 'City billboard', marina: 'Yacht Club', golf: 'Golf course', ship: 'Ship hull', yacht: 'Superyacht hull',
};

export const AD_SLOTS: AdSlot[] = [
  // city billboards (coast and main avenues; any spot that turns out to be occupied is skipped)
  { id: 'ad-north-w', name: 'North Shore billboard (west)', where: 'Main island · north shore', kind: 'billboard', size: '9 × 4 m · double-sided', audience: 'Airport traffic, causeway', price: 450, x: -56, z: -80, rot: 0 },
  { id: 'ad-north-e', name: 'North Shore billboard (east)', where: 'Main island · north shore', kind: 'billboard', size: '9 × 4 m · double-sided', audience: 'Airport traffic, Media District', price: 450, x: 60, z: -80, rot: 0 },
  { id: 'ad-bridge', name: 'Bridge approach billboard', where: 'Rat Race Exit Bridge · city end', kind: 'billboard', size: '9 × 4 m · double-sided', audience: 'Everyone crossing to Brooklyn', price: 520, x: 96, z: -52, rot: Math.PI / 2 },
  { id: 'ad-arena', name: 'Arena plaza billboard', where: 'Liquidation Arena · south plaza', kind: 'billboard', size: '9 × 4 m · double-sided', audience: 'Tournament crowds', price: 600, x: 60, z: 82, rot: 0 },
  { id: 'ad-south', name: 'South Shore billboard', where: 'Main island · south shore', kind: 'billboard', size: '9 × 4 m · double-sided', audience: 'Bay traffic, Statue visitors', price: 400, x: -30, z: 82, rot: 0 },
  { id: 'ad-west', name: 'West Coast billboard', where: 'Main island · by the golf club', kind: 'billboard', size: '9 × 4 m · double-sided', audience: 'Golf club members, park visitors', price: 480, x: -100, z: 18, rot: Math.PI / 2 },
  { id: 'ad-brooklyn-n', name: 'Brooklyn north billboard', where: 'Brooklyn · north shore', kind: 'billboard', size: '9 × 4 m · double-sided', audience: 'Brooklyn residents', price: 300, x: 210, z: -80, rot: 0 },
  { id: 'ad-brooklyn-e', name: 'Brooklyn east billboard', where: 'Brooklyn · east shore', kind: 'billboard', size: '9 × 4 m · double-sided', audience: 'Port traffic', price: 280, x: 306, z: -30, rot: Math.PI / 2 },
  { id: 'ad-airport', name: 'Airport landside billboard', where: 'Airport · terminal road', kind: 'billboard', size: '9 × 4 m · double-sided', audience: 'Passengers and visitors', price: 550, x: -70, z: -136, rot: 0 },
  // Yacht Club
  { id: 'ad-marina', name: 'Yacht Club breakwater board', where: 'Yacht Marina · breakwater', kind: 'marina', size: '12 × 5 m · double-sided', audience: 'Yacht owners, marina club', price: 700, x: 213, z: 116, y: -1.0, rot: 0 },
  // golf course
  { id: 'ad-golf-1', name: 'Golf board · hole 7', where: '100K+ Payouts Golf Club', kind: 'golf', size: '9 × 4 m · double-sided', audience: 'Members: 100K+ traders, firm CEOs & marketing', price: 900, x: -130, z: 25, rot: 0 },
  { id: 'ad-golf-2', name: 'Golf board · hole 8', where: '100K+ Payouts Golf Club', kind: 'golf', size: '9 × 4 m · double-sided', audience: 'Members: 100K+ traders, firm CEOs & marketing', price: 900, x: -165, z: 25, rot: 0 },
  { id: 'ad-golf-3', name: 'Golf board · hole 2', where: '100K+ Payouts Golf Club', kind: 'golf', size: '9 × 4 m · double-sided', audience: 'Members: 100K+ traders, firm CEOs & marketing', price: 900, x: -160, z: -82, rot: 0 },
  { id: 'ad-golf-4', name: 'Golf board · members’ lawn', where: '100K+ Payouts Golf Club', kind: 'golf', size: '9 × 4 m · double-sided', audience: 'Members: 100K+ traders, firm CEOs & marketing', price: 1200, x: -209, z: -41, rot: Math.PI / 2 },
  // hulls
  { id: 'ad-ship-cargo', name: 'Cargo ship “Compound Interest” hull', where: 'Sails the loop round the islands', kind: 'ship', size: '2 × 23 m hull panels', audience: 'Seen from every shore', price: 1500 },
  { id: 'ad-ship-docked', name: 'Container ship at the quay hull', where: 'Container Port', kind: 'ship', size: '2 × 26 m hull panels', audience: 'Port and Brooklyn waterfront', price: 1100 },
  { id: 'ad-yacht-payout', name: 'Superyacht “Payout” hull', where: 'Yacht Marina · outer berth', kind: 'yacht', size: '2 × 7 m hull panels', audience: 'Marina club', price: 650 },
  { id: 'ad-yacht-funded', name: 'Superyacht “Funded” hull', where: 'Yacht Marina · outer berth', kind: 'yacht', size: '2 × 6 m hull panels', audience: 'Marina club', price: 550 },
];

export const adSlot = (id: string) => AD_SLOTS.find((s) => s.id === id);

/** A double-sided ad billboard on two legs; faces ±z before rotation. */
export function buildAdBoard(slot: AdSlot) {
  const big = slot.kind === 'marina';
  const w = big ? 10 : 7.4;
  const h = big ? 4.2 : 3.3;
  const legH = big ? 3.2 : 3.0;
  const g = new THREE.Group();
  const accent = slot.kind === 'golf' ? '#1f3b33' : slot.kind === 'marina' ? '#13213f' : '#2f6bff';
  for (const x of [-w * 0.3, w * 0.3]) {
    const leg = mesh(rbox(0.34, legH + h / 2, 0.34, 0.06), MAT.white);
    leg.position.set(x, (legH + h / 2) / 2, 0);
    g.add(leg);
  }
  const frame = mesh(rbox(w + 0.4, h + 0.4, 0.35, 0.12), MAT.white);
  frame.position.set(0, legH + h / 2, 0);
  const label = slot.kind === 'golf' ? 'GOLF CLUB · AD SPACE' : slot.kind === 'marina' ? 'YACHT CLUB · AD SPACE' : 'BILLBOARD · AD SPACE';
  const face = signPlane('YOUR AD HERE', w, h, { bg: '#ffffff', fg: accent, sub: label, subColor: '#13213f', accent: '#d4a94a' });
  face.position.set(0, legH + h / 2, 0.19);
  const back = face.clone();
  back.position.z = -0.19;
  back.rotation.y = Math.PI;
  g.add(frame, face, back);
  return { group: g, height: legH + h + 0.4, radius: w / 2 + 0.6 };
}
