import { mulberry32 } from "./random";
import { FLOWER_SVGS } from "./flowers";
import { TextSetConfig } from "./gardenConfig";
import {
  buildTextMask,
  generateFlowerPositionsFromMask,
  assignSpeciesToPoints,
  SpawnPoint,
} from "./hiddenMessage";

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
  textSetId?: string;
}

export interface EmojiData {
  id: number;
  emoji: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  zIndex: number;
  alwaysShow: boolean;
}

const EMOJI_SEED = 8888;

export function generateEmojis(
  alwaysEmojis: string[],
  rotatingEmojis: string[],
): EmojiData[] {
  const all = [...alwaysEmojis, ...rotatingEmojis];
  if (!all.length) return [];
  const rng = mulberry32(EMOJI_SEED);
  const items: EmojiData[] = [];
  for (let i = 0; i < all.length; i++) {
    items.push({
      id: i,
      emoji: all[i],
      alwaysShow: i < alwaysEmojis.length,
      x: 2 + rng() * 96,
      y: 2 + rng() * 96,
      rotation: -45 + rng() * 90,
      scale: 0.8 + rng() * 0.5,
      zIndex: 150 + Math.floor(rng() * 50),
    });
  }
  return items;
}

const COLS = 64;
const ROWS = 56;
const SEED = 20201027;

interface TextFlowerSlot {
  dayIndex: number; // which day this flower is planted
  point: SpawnPoint;
  textSetId: string;
  svg: string;
}

function precomputeTextFlowers(
  textSets: TextSetConfig[],
  speciesVariants: Record<string, string[]>,
): TextFlowerSlot[] {
  const slots: TextFlowerSlot[] = [];

  for (const ts of textSets) {
    const maskResult = buildTextMask(ts.lines, ts.maskOptions);

    const spawnPoints = generateFlowerPositionsFromMask(
      maskResult,
      {
        width: ts.bounds.width,
        height: ts.bounds.height,
        offsetX: ts.bounds.offsetX,
        offsetY: ts.bounds.offsetY,
        seed: ts.seed,
        jitter: ts.jitter,
      },
      ts.density,
    );

    const allSpecies = [
      ...new Set(ts.lineSpecies.flat()),
    ];
    const assignedPoints = assignSpeciesToPoints(
      spawnPoints,
      maskResult,
      allSpecies,
      ts.lineSpecies,
    );

    assignedPoints.forEach((point, index) => {
      const species = point.species ?? "rose";
      const variants = speciesVariants[species] ?? FLOWER_SVGS.filter((s) => s.startsWith("rose-"));
      const svg = variants[index % variants.length] ?? variants[0];
      slots.push({
        dayIndex: ts.startDay + index,
        point,
        textSetId: ts.id,
        svg,
      });
    });
  }

  // Sort by dayIndex so they interleave correctly
  slots.sort((a, b) => a.dayIndex - b.dayIndex);
  return slots;
}

function buildSpeciesVariants(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  FLOWER_SVGS.forEach((svg) => {
    const [species] = svg.split("-");
    if (!map[species]) map[species] = [];
    map[species].push(svg);
  });
  return map;
}

export function generateGarden(
  count: number,
  textSets: TextSetConfig[],
): FlowerData[] {
  const rng = mulberry32(SEED);
  const totalCells = COLS * ROWS;

  // Create and shuffle cell indices (Fisher-Yates)
  const indices = Array.from({ length: totalCells }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const speciesVariants = buildSpeciesVariants();
  const textSlots = precomputeTextFlowers(textSets, speciesVariants);

  // Build a map: dayIndex → TextFlowerSlot for quick lookup
  const textSlotMap = new Map<number, TextFlowerSlot>();
  for (const slot of textSlots) {
    textSlotMap.set(slot.dayIndex, slot);
  }

  const flowers: FlowerData[] = [];
  const cellW = 100 / COLS;
  const cellH = 100 / ROWS;
  let gridCellUsed = 0; // tracks how many grid cells we've consumed

  for (let i = 0; i < count; i++) {
    const date = new Date("2017-10-27");
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];

    const textSlot = textSlotMap.get(i);
    if (textSlot) {
      // Place a text flower at the pre-computed position
      flowers.push({
        id: i,
        x: textSlot.point.x,
        y: textSlot.point.y,
        svg: textSlot.svg,
        scale: 1.05,
        rotation: 0,
        zIndex: 200 + textSlot.point.row,
        dayNumber: i + 1,
        date: dateStr,
        textSetId: textSlot.textSetId,
      });
    } else if (gridCellUsed < totalCells) {
      // Place in shuffled grid cell
      const cellIndex = indices[gridCellUsed];
      gridCellUsed++;
      const col = cellIndex % COLS;
      const row = Math.floor(cellIndex / COLS);

      const x = col * cellW + rng() * cellW;
      const y = row * cellH + rng() * cellH;
      const svg = FLOWER_SVGS[Math.floor(rng() * FLOWER_SVGS.length)];
      const scale = 0.8 + rng() * 0.4;
      const rotation = -15 + rng() * 30;
      const zIndex = Math.floor(y);

      flowers.push({ id: i, x, y, svg, scale, rotation, zIndex, dayNumber: i + 1, date: dateStr });
    } else {
      // Grid is full — place at random position (overlapping allowed)
      const x = rng() * 100;
      const y = rng() * 100;
      const svg = FLOWER_SVGS[Math.floor(rng() * FLOWER_SVGS.length)];
      const scale = 0.8 + rng() * 0.4;
      const rotation = -15 + rng() * 30;
      const zIndex = Math.floor(y);

      flowers.push({ id: i, x, y, svg, scale, rotation, zIndex, dayNumber: i + 1, date: dateStr });
    }
  }

  return flowers;
}
