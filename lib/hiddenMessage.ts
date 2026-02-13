import { mulberry32 } from "./random";

const PIXEL_FONT: Record<string, string[]> = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "11110", "10001", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  E: ["11111", "10000", "11110", "10000", "10000", "10000", "11111"],
  F: ["11111", "10000", "11110", "10000", "10000", "10000", "10000"],
  H: ["10001", "10001", "11111", "10001", "10001", "10001", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  R: ["11110", "10001", "11110", "10100", "10010", "10001", "10001"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  Y: ["10001", "01010", "00100", "00100", "00100", "00100", "00100"],
  "❤": ["01110", "11111", "11111", "11111", "01110", "00100", "00000"],
};

export type TextMask = boolean[][];

export interface TextMaskResult {
  mask: TextMask;
  letterMap: number[][];
  letters: string[];
  letterMeta: { lineIndex: number; letterIndex: number; char: string }[];
}

export interface MaskBounds {
  width: number;
  height: number;
  offsetX?: number;
  offsetY?: number;
  seed?: number;
  jitter?: number;
}

export interface SpawnPoint {
  x: number;
  y: number;
  row: number;
  col: number;
  pixelIndex: number;
  letterIndex: number;
  lineIndex: number;
  letterChar: string;
  species?: string;
}

export function buildTextMask(lines: string[]): TextMaskResult {
  const normalized = lines.map((line) => line.toUpperCase());
  const charWidth = 5;
  const charHeight = 7;
  const charSpacing = 1;
  const lineSpacing = 2;
  const maxLineLength = Math.max(...normalized.map((line) => Math.max(line.length, 1)));
  const cols = maxLineLength * (charWidth + charSpacing) - charSpacing;
  const rows = normalized.length * charHeight + Math.max(normalized.length - 1, 0) * lineSpacing;
  const mask: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const letterMap: number[][] = Array.from({ length: rows }, () => Array(cols).fill(-1));
  const letters: string[] = [];
  const letterMeta: { lineIndex: number; letterIndex: number; char: string }[] = [];
  let letterCounter = 0;

  normalized.forEach((line, lineIndex) => {
    const startRow = lineIndex * (charHeight + lineSpacing);
    const lineLength = Math.max(line.length, 1);
    const lineWidth = lineLength * (charWidth + charSpacing) - charSpacing;
    let colCursor = Math.floor((cols - lineWidth) / 2);
    let charPosition = 0;
    for (const ch of line) {
      const glyph = PIXEL_FONT[ch] ?? PIXEL_FONT[" "];
      const currentIndex = ch === " " ? -1 : letterCounter++;
      if (currentIndex !== -1) {
        letters.push(ch);
        letterMeta.push({ lineIndex, letterIndex: charPosition, char: ch });
      }
      for (let r = 0; r < charHeight; r++) {
        for (let c = 0; c < charWidth; c++) {
          if (glyph[r][c] === "1") {
            const row = startRow + r;
            const col = colCursor + c;
            if (row < rows && col < cols) {
              mask[row][col] = true;
              letterMap[row][col] = currentIndex;
            }
          }
        }
      }
      colCursor += charWidth + charSpacing;
      charPosition += 1;
    }
  });

  return { mask, letterMap, letters, letterMeta };
}

export function generateFlowerPositionsFromMask(
  maskResult: TextMaskResult,
  bounds: MaskBounds,
  density: number
): SpawnPoint[] {
  const { mask, letterMap, letterMeta } = maskResult;
  const rows = mask.length;
  const cols = mask[0]?.length ?? 0;
  if (!rows || !cols) return [];
  const width = bounds.width;
  const height = bounds.height;
  const offsetX = bounds.offsetX ?? (100 - width) / 2;
  const offsetY = bounds.offsetY ?? (100 - height) / 2;
  const cellW = width / cols;
  const cellH = height / rows;
  const jitter = bounds.jitter ?? 0.15;
  const rng = mulberry32(bounds.seed ?? 2025);
  const points: SpawnPoint[] = [];

  mask.forEach((rowVals, row) => {
    rowVals.forEach((isOn, col) => {
      if (!isOn) return;
      for (let d = 0; d < density; d++) {
        const jx = (rng() - 0.5) * jitter;
        const jy = (rng() - 0.5) * jitter;
        const letterIndex = letterMap[row]?.[col] ?? -1;
        if (letterIndex === -1) return;
        points.push({
          x: offsetX + (col + 0.5 + jx) * cellW,
          y: offsetY + (row + 0.5 + jy) * cellH,
          row,
          col,
          pixelIndex: points.length,
          letterIndex,
          lineIndex: letterMeta[letterIndex]?.lineIndex ?? 0,
          letterChar: letterMeta[letterIndex]?.char ?? "",
        });
      }
    });
  });

  return points;
}

const DEFAULT_SPECIES = ["forgetmenot", "lily", "peony", "rose", "tulip", "sunflower"];

export function assignSpeciesToPoints(
  points: SpawnPoint[],
  maskResult: TextMaskResult,
  enabledSpecies: string[],
  lineSpecies: string[][]
): SpawnPoint[] {
  const fallbackPool = enabledSpecies.length ? enabledSpecies : DEFAULT_SPECIES;
  if (!fallbackPool.length) return points;

  const letterSpecies: string[] = [];
  maskResult.letterMeta.forEach((meta, idx) => {
    const pair = lineSpecies[meta.lineIndex] ?? fallbackPool;
    const filtered = pair.filter((species) => fallbackPool.includes(species));
    const pool = filtered.length ? filtered : fallbackPool;
    letterSpecies[idx] = pool[meta.letterIndex % pool.length];
  });

  return points.map((point, idx) => {
    const species =
      letterSpecies[point.letterIndex] ?? fallbackPool[idx % fallbackPool.length];
    return { ...point, species };
  });
}
