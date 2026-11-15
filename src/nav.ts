// ============ Breach Point — A* over grid; revalidates on destruction ============
import type { GridWorld } from './physics';

const NEIGH: Array<[number, number, number]> = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
];

function h(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

export class NavGrid {
  world: GridWorld;
  cols: number; rows: number;
  gScore: Float32Array;
  fScore: Float32Array;
  parent: Int32Array;
  closedStamp: Int32Array;
  visitStamp: Int32Array;
  stamp: number;
  openIds: number[] = [];
  openKeys: number[] = [];
  destroyed: Set<string>;

  constructor(world: GridWorld) {
    this.world = world;
    this.cols = world.cols;
    this.rows = world.rows;
    const n = this.cols * this.rows;
    this.gScore = new Float32Array(n);
    this.fScore = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.closedStamp = new Int32Array(n);
    this.visitStamp = new Int32Array(n);
    this.stamp = 0;
    this.destroyed = new Set<string>();
  }

  /** Returns list of cells from start to goal, or null if unreachable. */
  findPath(sx: number, sy: number, gx: number, gy: number): Array<{ x: number; y: number }> | null {
    const W = this.world;
    const walkable = (x: number, y: number): boolean => {
      if (!W.inBounds(x, y)) return false;
      const id = W.idx(x, y);
      if (W.wall[id] === 1 && !this.destroyed.has(`${x},${y}`)) return false;
      return true;
    };

    if (!walkable(sx, sy) || !walkable(gx, gy)) return null;

    this.stamp++;
    this.openIds.length = 0;
    this.openKeys.length = 0;
    const start = W.idx(sx, sy);
    const goal = W.idx(gx, gy);
    this.gScore[start] = 0;
    this.fScore[start] = h(sx, sy, gx, gy);
    this.parent[start] = -1;
    this.visitStamp[start] = this.stamp;
    this.heapPush(start, this.fScore[start]);

    let iter = 0;
    while (this.openIds.length > 0 && iter++ < 6000) {
      const cur = this.heapPop();
      if (cur === goal) return this.reconstruct(cur);
      if (this.closedStamp[cur] === this.stamp) continue;
      this.closedStamp[cur] = this.stamp;

      const cx = cur % this.cols;
      const cy = (cur - cx) / this.cols;
      for (const [dx, dy, cost] of NEIGH) {
        const nx = cx + dx, ny = cy + dy;
        if (!walkable(nx, ny)) continue;
        const nid = W.idx(nx, ny);
        if (this.closedStamp[nid] === this.stamp) continue;
        const tg = this.gScore[cur] + cost;
        if (this.visitStamp[nid] !== this.stamp || tg < this.gScore[nid]) {
          this.gScore[nid] = tg;
          this.fScore[nid] = tg + h(nx, ny, gx, gy);
          this.parent[nid] = cur;
          this.visitStamp[nid] = this.stamp;
          this.heapPush(nid, this.fScore[nid]);
        }
      }
    }
    return null;
  }

  heapPush(id: number, key: number): void {
    this.openIds.push(id); this.openKeys.push(key);
    let i = this.openIds.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.openKeys[p] <= this.openKeys[i]) break;
      const ti = this.openIds[i]; this.openIds[i] = this.openIds[p]; this.openIds[p] = ti;
      const tk = this.openKeys[i]; this.openKeys[i] = this.openKeys[p]; this.openKeys[p] = tk;
      i = p;
    }
  }

  heapPop(): number {
    const top = this.openIds[0];
    const lastId = this.openIds.pop() as number;
    const lastKey = this.openKeys.pop() as number;
    if (this.openIds.length > 0) {
      this.openIds[0] = lastId; this.openKeys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = i * 2 + 2;
        let m = i;
        if (l < this.openIds.length && this.openKeys[l] < this.openKeys[m]) m = l;
        if (r < this.openIds.length && this.openKeys[r] < this.openKeys[m]) m = r;
        if (m === i) break;
        const ti = this.openIds[i]; this.openIds[i] = this.openIds[m]; this.openIds[m] = ti;
        const tk = this.openKeys[i]; this.openKeys[i] = this.openKeys[m]; this.openKeys[m] = tk;
        i = m;
      }
    }
    return top;
  }

  reconstruct(id: number): Array<{ x: number; y: number }> {
    const out: Array<{ x: number; y: number }> = [];
    while (id !== -1) {
      const x = id % this.cols;
      const y = (id - x) / this.cols;
      out.push({ x, y });
      id = this.parent[id];
    }
    out.reverse();
    return out;
  }

  notifyDestroyed(x: number, y: number): void {
    this.destroyed.add(`${x},${y}`);
  }
}
