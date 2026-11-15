// ============ Breach Point — grid world: walls, doors, windows, panels ============
import { CELL, MAP_COLS, MAP_ROWS } from './data';

export type PanelState = 0 | 1 | 2 | 3; // 0 intact, 1 cracked, 2 big hole, 3 gone

export interface DoorCell {
  x: number; y: number;
  barricade: 0 | 1 | 2 | 3;
  open01: number;
  target: number;
}

export interface WindowCell {
  x: number; y: number;
  barricade: 0 | 1 | 2 | 3;
  locked: boolean;
}

export type Material = 'soft' | 'reinforced';

export interface Panel {
  x: number; y: number;
  dir: 'h' | 'v';
  material: Material;
  state: PanelState;
  hp: number;
  reinforced: boolean;
}

export interface AABB { minX: number; maxX: number; minZ: number; maxZ: number }

export const KEY = (x: number, y: number): string => `${x},${y}`;

export class GridWorld {
  cols: number; rows: number; cellSize: number;
  minX: number; minZ: number;
  wall: Uint8Array;
  open: Uint8Array;
  doors: Map<string, DoorCell>;
  windows: Map<string, WindowCell>;
  panels: Map<string, Panel>;

  constructor(cols: number, rows: number, cell = CELL) {
    this.cols = cols; this.rows = rows; this.cellSize = cell;
    this.minX = (-cols * cell) / 2;
    this.minZ = (-rows * cell) / 2;
    this.wall = new Uint8Array(cols * rows).fill(1);
    this.open = new Uint8Array(cols * rows);
    this.doors = new Map();
    this.windows = new Map();
    this.panels = new Map();
  }

  idx(x: number, y: number): number { return y * this.cols + x; }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
  }

  isOpen(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    return this.open[this.idx(x, y)] === 1;
  }

  isWall(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return true;
    return this.wall[this.idx(x, y)] === 1;
  }

  carveRoom(x: number, y: number, w: number, h: number): void {
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        if (i > 0 && j > 0 && i < this.cols - 1 && j < this.rows - 1) {
          this.wall[this.idx(i, j)] = 0;
        }
      }
    }
  }

  carveDoor(x: number, y: number): void {
    this.open[this.idx(x, y)] = 1;
    this.doors.set(KEY(x, y), { x, y, barricade: 0, open01: 1, target: 1 });
  }

  addWindow(x: number, y: number): void {
    this.open[this.idx(x, y)] = 1;
    this.windows.set(KEY(x, y), { x, y, barricade: 0, locked: false });
  }

  addPanel(x: number, y: number, dir: 'h' | 'v', material: Material): Panel {
    const k = `${x},${y},${dir}`;
    let p = this.panels.get(k);
    if (!p) {
      p = { x, y, dir, material, state: 0, hp: 100, reinforced: false };
      this.panels.set(k, p);
    }
    return p;
  }
}

export { MAP_COLS, MAP_ROWS };
