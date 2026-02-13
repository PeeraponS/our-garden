import { mulberry32 } from "./random";

const PIXEL_FONT: Record<string, string[]> = {
  " ": ["000000", "000000", "000000", "000000", "000000", "000000", "000000"],
  A: ["001100", "010010", "100001", "111111", "100001", "100001", "100001"],
  B: ["111110", "100001", "111110", "100001", "100001", "100001", "111110"],
  C: ["001111", "010000", "100000", "100000", "100000", "010000", "001111"],
  E: ["111111", "100000", "111110", "100000", "100000", "100000", "111111"],
  F: ["111111", "100000", "111110", "100000", "100000", "100000", "100000"],
  H: ["100001", "100001", "111111", "100001", "100001", "100001", "100001"],
  L: ["100000", "100000", "100000", "100000", "100000", "100000", "111111"],
  O: ["011110", "100001", "100001", "100001", "100001", "100001", "011110"],
  R: ["111110", "100001", "111110", "101000", "100100", "100010", "100001"],
  U: ["100001", "100001", "100001", "100001", "100001", "100001", "011110"],
  V: ["100001", "100001", "100001", "100001", "010010", "010010", "001100"],
  Y: ["100001", "010010", "001100", "001100", "001100", "001100", "001100"],
};

export interface TextMaskResult {
  mask: boolean[][];
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

export interface TextMaskOptions {
  charSpacing?: number;
  lineSpacing?: number;
  pixelScaleX?: number;
  pixelScaleY?: number;
}

export function buildTextMask(
  lines: string[],
  optionsOrSpacing: number | TextMaskOptions = 2,
): TextMaskResult {
  const options: TextMaskOptions =
    typeof optionsOrSpacing === "number" ? { charSpacing: optionsOrSpacing } : optionsOrSpacing ?? {};
  const charSpacing = options.charSpacing ?? 2;
  const lineSpacing = options.lineSpacing ?? 2;
  const pixelScaleX = Math.max(1, Math.floor(options.pixelScaleX ?? 1));
  const pixelScaleY = Math.max(1, Math.floor(options.pixelScaleY ?? 1));
  const sampleGlyph =
    PIXEL_FONT[Object.keys(PIXEL_FONT).find((key) => key.trim().length) ?? " "] ?? PIXEL_FONT[" "];
  const baseCharWidth = sampleGlyph[0]?.length ?? 0;
  const baseCharHeight = sampleGlyph.length;
  const scaledCharWidth = baseCharWidth * pixelScaleX;
  const scaledCharHeight = baseCharHeight * pixelScaleY;
  const normalized = lines.map((line) => line.toUpperCase());
  const maxLineLength = Math.max(...normalized.map((line) => Math.max(line.length, 1)));
  const cols = maxLineLength * (scaledCharWidth + charSpacing) - charSpacing;
  const rows = normalized.length * scaledCharHeight + Math.max(normalized.length - 1, 0) * lineSpacing;
  const mask: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const letterMap: number[][] = Array.from({ length: rows }, () => Array(cols).fill(-1));
  const letters: string[] = [];
  const letterMeta: { lineIndex: number; letterIndex: number; char: string }[] = [];
  let letterCounter = 0;

  normalized.forEach((line, lineIndex) => {
    const startRow = lineIndex * (scaledCharHeight + lineSpacing);
    const lineLength = Math.max(line.length, 1);
    const lineWidth = lineLength * (scaledCharWidth + charSpacing) - charSpacing;
    let colCursor = Math.floor((cols - lineWidth) / 2);
    let charPosition = 0;
    for (const ch of line) {
      const glyph = PIXEL_FONT[ch] ?? PIXEL_FONT[" "];
      const currentIndex = ch === " " ? -1 : letterCounter++;
      if (currentIndex !== -1) {
        letters.push(ch);
        letterMeta.push({ lineIndex, letterIndex: charPosition, char: ch });
      }
      for (let r = 0; r < baseCharHeight; r++) {
        const glyphRow = glyph[r];
        if (!glyphRow) continue;
        for (let c = 0; c < baseCharWidth; c++) {
          if (glyphRow[c] !== "1") continue;
          for (let yScale = 0; yScale < pixelScaleY; yScale++) {
            for (let xScale = 0; xScale < pixelScaleX; xScale++) {
              const row = startRow + r * pixelScaleY + yScale;
              const col = colCursor + c * pixelScaleX + xScale;
              if (row < rows && col < cols) {
                mask[row][col] = true;
                letterMap[row][col] = currentIndex;
              }
            }
          }
        }
      }
      colCursor += scaledCharWidth + charSpacing;
      charPosition += 1;
    }
  });

  return { mask, letterMap, letters, letterMeta };
}

export function generateFlowerPositionsFromMask(
  maskResult: TextMaskResult,
  bounds: MaskBounds,
  density: number,
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
      const baseCopies = Math.floor(density);
      const fractional = Math.max(0, Math.min(1, density - baseCopies));
      const extra = fractional > 0 && rng() < fractional ? 1 : 0;
      const totalCopies = baseCopies + extra;
      if (totalCopies <= 0) return;
      for (let d = 0; d < totalCopies; d++) {
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
  lineSpecies: string[][],
): SpawnPoint[] {
  const basePool = enabledSpecies.length ? enabledSpecies : DEFAULT_SPECIES;
  const sanitizedFallback = basePool.filter((species) => species !== "sunflower");
  const fallbackPool = sanitizedFallback.length ? sanitizedFallback : basePool;
  if (!fallbackPool.length) return points;

  const letterCounters = new Map<number, number>();
  const letterStartIndex = new Map<number, number>();
  const SPECIES_PER_LETTER = 3;

  return points.map((point, idx) => {
    const counter = letterCounters.get(point.letterIndex) ?? 0;
    letterCounters.set(point.letterIndex, counter + 1);

    const meta = maskResult.letterMeta[point.letterIndex];
    const lineList = meta ? lineSpecies[meta.lineIndex] ?? fallbackPool : fallbackPool;
    const filteredList = lineList
      .filter((species) => species !== "sunflower")
      .filter((species) => fallbackPool.includes(species));
    const activePool = filteredList.length ? filteredList : fallbackPool;

    let startIndex = letterStartIndex.get(point.letterIndex);
    if (startIndex === undefined) {
      startIndex = meta
        ? meta.letterIndex % activePool.length
        : idx % activePool.length;
      letterStartIndex.set(point.letterIndex, startIndex);
    }

    const perLetterPool =
      activePool.length >= SPECIES_PER_LETTER
        ? Array.from({ length: SPECIES_PER_LETTER }, (_, i) => activePool[(startIndex! + i) % activePool.length])
        : activePool;

    const species =
      perLetterPool[counter % perLetterPool.length] ??
      activePool[counter % activePool.length] ??
      fallbackPool[idx % fallbackPool.length];

    return { ...point, species };
  });
}
