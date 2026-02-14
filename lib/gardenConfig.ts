import { TextMaskOptions } from './hiddenMessage';

export interface TextSetConfig {
    id: string;
    label: string;
    lines: string[];
    startDay: number;
    bounds: {
        width: number;
        height: number;
        offsetX?: number;
        offsetY?: number;
    };
    density: number;
    jitter: number;
    seed: number;
    maskOptions: TextMaskOptions;
    lineSpecies: string[][];
}

export const TEXT_SETS: TextSetConfig[] = [
    {
        id: 'valentine-2026',
        label: "Valentine's Day",
        lines: ['LOVE U', 'FOREVER', 'CHERRY'],
        startDay: 1600,
        bounds: { width: 80, height: 80, offsetX: 10, offsetY: 10 },
        density: 0.7,
        jitter: 0.1,
        seed: 1337,
        maskOptions: {
            charSpacing: 14,
            lineSpacing: 4,
            pixelScaleX: 3,
            pixelScaleY: 2,
        },
        lineSpecies: [
            ['peony', 'lily', 'forgetmenot', 'rose'],
            ['forgetmenot', 'rose', 'tulip'],
            ['tulip', 'lily', 'forgetmenot'],
        ],
    },
];
