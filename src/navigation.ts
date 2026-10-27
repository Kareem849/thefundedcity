// Walkable grid over the island + A* path-finding with line-of-sight smoothing.

export type Obstacle =
  | { kind: 'rect'; x: number; z: number; hw: number; hd: number }
  | { kind: 'circle'; x: number; z: number; r: number }
  | { kind: 'ellipse'; x: number; z: number; rx: number; rz: number };

export interface P2 { x: number; z: number }

export interface NavGrid {
  walkable: (x: number, z: number) => boolean;
  nearestWalkable: (x: number, z: number, maxRadius?: number) => P2 | null;
  findPath: (from: P2, to: P2) => P2[] | null;
  /** Point just outside an obstacle footprint, on the side facing `from`. */
  approachPoint: (center: P2, from: P2) => P2 | null;
}

export interface WalkRegion { minX: number; maxX: number; minZ: number; maxZ: number; inside: (x: number, z: number) => boolean }

export function createNavGrid(
  region: WalkRegion,
  obstacles: Obstacle[],
  cell = 0.5,
  pad = 0.45,
): NavGrid {
  const x0 = region.minX;
  const z0 = region.minZ;
  const cols = Math.ceil((region.maxX - region.minX) / cell);
  const rows = Math.ceil((region.maxZ - region.minZ) / cell);
  const grid = new Uint8Array(cols * rows); // 1 = walkable
  const toCell = (x: number, z: number) => [Math.floor((x - x0) / cell), Math.floor((z - z0) / cell)] as const;
  const toWorld = (c: number, r: number): P2 => ({ x: x0 + (c + 0.5) * cell, z: z0 + (r + 0.5) * cell });

  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const p = toWorld(c, r);
      grid[r * cols + c] = region.inside(p.x, p.z) ? 1 : 0;
    }
  // rasterise obstacles (only the cells inside each footprint's bounding box)
  for (const o of obstacles) {
    const ex = o.kind === 'rect' ? o.hw : o.kind === 'circle' ? o.r : o.rx;
    const ez = o.kind === 'rect' ? o.hd : o.kind === 'circle' ? o.r : o.rz;
    const [c0, r0] = toCell(o.x - ex - pad, o.z - ez - pad);
    const [c1, r1] = toCell(o.x + ex + pad, o.z + ez + pad);
    for (let r = Math.max(0, r0); r <= Math.min(rows - 1, r1); r++)
      for (let c = Math.max(0, c0); c <= Math.min(cols - 1, c1); c++) {
        const p = toWorld(c, r);
        let hit = false;
        if (o.kind === 'rect') hit = Math.abs(p.x - o.x) < o.hw + pad && Math.abs(p.z - o.z) < o.hd + pad;
        else if (o.kind === 'circle') hit = Math.hypot(p.x - o.x, p.z - o.z) < o.r + pad;
        else hit = ((p.x - o.x) / (o.rx + pad)) ** 2 + ((p.z - o.z) / (o.rz + pad)) ** 2 < 1;
        if (hit) grid[r * cols + c] = 0;
      }
  }

  const ok = (c: number, r: number) => c >= 0 && r >= 0 && c < cols && r < rows && grid[r * cols + c] === 1;
  const walkable = (x: number, z: number) => {
    const [c, r] = toCell(x, z);
    return ok(c, r);
  };

  const nearestCell = (x: number, z: number, maxRadius = 40): [number, number] | null => {
    const [c0, r0] = toCell(x, z);
    if (ok(c0, r0)) return [c0, r0];
    for (let rad = 1; rad <= maxRadius; rad++) {
      let best: [number, number] | null = null;
      let bestD = Infinity;
      for (let dr = -rad; dr <= rad; dr++)
        for (let dc = -rad; dc <= rad; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
          if (!ok(c0 + dc, r0 + dr)) continue;
          const d = dc * dc + dr * dr;
          if (d < bestD) { bestD = d; best = [c0 + dc, r0 + dr]; }
        }
      if (best) return best;
    }
    return null;
  };

  // line of sight on the grid (sampled every quarter cell)
  const los = (a: P2, b: P2) => {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.ceil(d / (cell * 0.25));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (!walkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  };

  // connected regions (4-neighbour flood fill, which matches A*'s no-corner-cutting moves), built on first
  // use: a goal in another region fails at once instead of searching the whole map
  let comp: Int32Array | null = null;
  const compOf = (i: number) => {
    if (!comp) {
      comp = new Int32Array(cols * rows).fill(-1);
      const q = new Int32Array(cols * rows);
      let id = 0;
      for (let i0 = 0; i0 < cols * rows; i0++) {
        if (grid[i0] !== 1 || comp[i0] !== -1) continue;
        let head = 0;
        let tail = 0;
        q[tail++] = i0;
        comp[i0] = id;
        while (head < tail) {
          const cur = q[head++];
          const cc = cur % cols;
          const cr = (cur - cc) / cols;
          for (const [nc, nr] of [[cc + 1, cr], [cc - 1, cr], [cc, cr + 1], [cc, cr - 1]]) {
            if (!ok(nc, nr)) continue;
            const ni = nr * cols + nc;
            if (comp[ni] !== -1) continue;
            comp[ni] = id;
            q[tail++] = ni;
          }
        }
        id++;
      }
    }
    return comp[i];
  };

  // binary-heap A*
  const findPath = (from: P2, to: P2): P2[] | null => {
    const s = nearestCell(from.x, from.z);
    const g = nearestCell(to.x, to.z);
    if (!s || !g) return null;
    const start = s[1] * cols + s[0];
    const goal = g[1] * cols + g[0];
    if (compOf(start) !== compOf(goal)) return null;
    const N = cols * rows;
    const gScore = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap: number[] = [];
    const f = new Float32Array(N);
    const h = (i: number) => {
      const dx = Math.abs((i % cols) - g[0]);
      const dz = Math.abs(Math.floor(i / cols) - g[1]);
      return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz);
    };
    const push = (i: number) => {
      heap.push(i);
      let k = heap.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (f[heap[p]] <= f[heap[k]]) break;
        [heap[p], heap[k]] = [heap[k], heap[p]];
        k = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let k = 0;
        for (;;) {
          const l = 2 * k + 1;
          const r = l + 1;
          let m = k;
          if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l;
          if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]];
          k = m;
        }
      }
      return top;
    };
    gScore[start] = 0;
    f[start] = h(start);
    push(start);
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    let found = false;
    while (heap.length) {
      const cur = pop();
      if (cur === goal) { found = true; break; }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cc = cur % cols;
      const cr = Math.floor(cur / cols);
      for (const [dc, dr, cost] of dirs) {
        const nc = cc + dc;
        const nr = cr + dr;
        if (!ok(nc, nr)) continue;
        if (dc && dr && (!ok(cc + dc, cr) || !ok(cc, cr + dr))) continue; // no corner cutting
        const ni = nr * cols + nc;
        if (closed[ni]) continue;
        const ng = gScore[cur] + cost;
        if (ng < gScore[ni]) {
          gScore[ni] = ng;
          came[ni] = cur;
          f[ni] = ng + h(ni);
          push(ni);
        }
      }
    }
    if (!found) return null;
    const cells: P2[] = [];
    for (let i = goal; i !== -1; i = came[i]) cells.push(toWorld(i % cols, Math.floor(i / cols)));
    cells.reverse();
    // the exact start / end points when they are walkable
    if (walkable(from.x, from.z)) cells[0] = { x: from.x, z: from.z };
    if (walkable(to.x, to.z)) cells[cells.length - 1] = { x: to.x, z: to.z };
    // string-pulling: keep only the turns we need
    const out: P2[] = [cells[0]];
    let anchor = cells[0];
    for (let i = 2; i < cells.length; i++) {
      if (!los(anchor, cells[i])) {
        anchor = cells[i - 1];
        out.push(anchor);
      }
    }
    if (cells.length > 1) out.push(cells[cells.length - 1]);
    return out;
  };

  return {
    walkable,
    nearestWalkable(x, z, maxRadius) {
      const c = nearestCell(x, z, maxRadius);
      return c ? toWorld(c[0], c[1]) : null;
    },
    findPath,
    approachPoint(center, from) {
      let dx = from.x - center.x;
      let dz = from.z - center.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      for (let d = 0.5; d < 20; d += cell * 0.5) {
        const p = { x: center.x + dx * d, z: center.z + dz * d };
        if (walkable(p.x, p.z)) {
          const q = { x: center.x + dx * (d + 0.4), z: center.z + dz * (d + 0.4) };
          return walkable(q.x, q.z) ? q : p;
        }
      }
      const n = nearestCell(center.x, center.z);
      return n ? toWorld(n[0], n[1]) : null;
    },
  };
}
