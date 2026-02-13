import { mulberry32 } from "./random";
import { FLOWER_SVGS } from "./flowers";

export interface FlowerData {
  id: number;
  x: number;
  y: number;
  svg: string;
  scale: number;
  rotation: number;
  zIndex: number;
  dayNumber: number;
  date: string; // ISO date string
}

const COLS = 48;
const ROWS = 41;
const SEED = 20201027;

export function generateGarden(count: number): FlowerData[] {
  const rng = mulberry32(SEED);
  const totalCells = COLS * ROWS;

  // Create and shuffle cell indices (Fisher-Yates)
  const indices = Array.from({ length: totalCells }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const flowers: FlowerData[] = [];
  const cellW = 100 / COLS;
  const cellH = 100 / ROWS;

  for (let i = 0; i < Math.min(count, totalCells); i++) {
    const cellIndex = indices[i];
    const col = cellIndex % COLS;
    const row = Math.floor(cellIndex / COLS);

    const x = col * cellW + rng() * cellW;
    const y = row * cellH + rng() * cellH;
    const svg = FLOWER_SVGS[Math.floor(rng() * FLOWER_SVGS.length)];
    const scale = 0.8 + rng() * 0.4;
    const rotation = -15 + rng() * 30;
    const zIndex = Math.floor(y);

    const date = new Date("2020-10-27");
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];

    flowers.push({ id: i, x, y, svg, scale, rotation, zIndex, dayNumber: i + 1, date: dateStr });
  }

  return flowers;
}
