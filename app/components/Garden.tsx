'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FlowerData } from '@/lib/garden';
import { FLOWER_SVGS } from '@/lib/flowers';
import {
    buildTextMask,
    generateFlowerPositionsFromMask,
    assignSpeciesToPoints,
} from '@/lib/hiddenMessage';
import { useAmbientAudio } from '@/lib/useAmbientAudio';

// --- Time of day ---
type TimeOfDay = 'night' | 'dawn' | 'morning' | 'day' | 'sunset' | 'dusk';

function getTimeOfDay(hour: number): TimeOfDay {
    if (hour >= 22 || hour < 5) return 'night';
    if (hour >= 5 && hour < 7) return 'dawn';
    if (hour >= 7 && hour < 10) return 'morning';
    if (hour >= 10 && hour < 17) return 'day';
    if (hour >= 17 && hour < 19) return 'sunset';
    return 'dusk';
}

// Top-view: looking down at grass, pastel tones per time of day
const GRASS_BG: Record<TimeOfDay, string> = {
    night: '#1e3a1e',
    dawn: '#b8ccaa',
    morning: '#c6d9b4',
    day: '#d0e2be',
    sunset: '#c8d4a8',
    dusk: '#8aa878',
};

const GRASS_BG2: Record<TimeOfDay, string> = {
    night: '#162e16',
    dawn: '#a8c09a',
    morning: '#b8d0a4',
    day: '#c0d8ae',
    sunset: '#bcc89c',
    dusk: '#7a9a6a',
};

const TINT_OVERLAY: Record<TimeOfDay, string> = {
    night: 'bg-black/25',
    dawn: 'bg-transparent',
    morning: 'bg-transparent',
    day: 'bg-transparent',
    sunset: 'bg-orange-900/5',
    dusk: 'bg-black/10',
};

// --- Countdown ---
function useCountdown(endDate: string, isPastValentine: boolean) {
    const [now, setNow] = useState<Date | null>(null);

    useEffect(() => {
        setNow(new Date());
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    if (!now || isPastValentine) return null;

    const end = new Date(endDate).getTime();
    const diff = end - now.getTime();
    if (diff <= 0) return null;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    return { days, hours, minutes, seconds };
}

// --- Particles ---
interface Particle {
    id: number;
    x: number;
    y: number;
    size: number;
    duration: number;
    delay: number;
    type: 'firefly' | 'petal' | 'sparkle';
    drift: number;
}

function generateParticles(timeOfDay: TimeOfDay): Particle[] {
    const particles: Particle[] = [];
    const isNighty =
        timeOfDay === 'night' || timeOfDay === 'dusk' || timeOfDay === 'dawn';

    for (let i = 0; i < 20; i++) {
        particles.push({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: isNighty ? 2 + Math.random() * 3 : 4 + Math.random() * 5,
            duration: 4 + Math.random() * 6,
            delay: Math.random() * 5,
            type: isNighty ? 'firefly' : i % 3 === 0 ? 'sparkle' : 'petal',
            drift: -30 + Math.random() * 60,
        });
    }
    return particles;
}

// --- Tooltip ---
function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

// --- Grass patch SVG (subtle top-view texture) ---
function GrassTexture({ color1, color2 }: { color1: string; color2: string }) {
    return (
        <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
        >
            <defs>
                <radialGradient id="grass-g1" cx="30%" cy="40%" r="60%">
                    <stop offset="0%" stopColor={color1} />
                    <stop offset="100%" stopColor={color2} />
                </radialGradient>
                {/* Subtle noise-like grass patches */}
                <filter id="grass-noise">
                    <feTurbulence
                        type="fractalNoise"
                        baseFrequency="0.9"
                        numOctaves="3"
                        seed="42"
                        result="noise"
                    />
                    <feColorMatrix
                        type="saturate"
                        values="0"
                        in="noise"
                        result="mono"
                    />
                    <feComponentTransfer in="mono" result="soft">
                        <feFuncA type="linear" slope="0.06" />
                    </feComponentTransfer>
                    <feBlend in="SourceGraphic" in2="soft" mode="overlay" />
                </filter>
            </defs>
            <rect
                width="100%"
                height="100%"
                fill="url(#grass-g1)"
                filter="url(#grass-noise)"
            />
        </svg>
    );
}

// Flower size — big enough to see clearly on all devices
const FLOWER_SIZE = 'clamp(22px, 5vw, 38px)';
const HIDDEN_MESSAGE_LINES = ['LOVE U', 'FOREVER', 'CHERRY'];
const HIDDEN_MESSAGE_SEED = 1337;
const BASE_SPECIES = [
    'forgetmenot',
    'lily',
    'peony',
    'rose',
    'tulip',
    'sunflower',
] as const;
const LINE_SPECIES: string[][] = [
    ['peony', 'lily', 'forgetmenot', 'rose'],
    ['forgetmenot', 'rose', 'sunflower', 'tulip'],
    ['tulip', 'peony', 'lily', 'sunflower'],
];

export default function Garden({
    flowers,
    total,
    endDate,
    isPastValentine,
}: {
    flowers: FlowerData[];
    total: number;
    endDate: string;
    isPastValentine: boolean;
}) {
    const [selectedFlower, setSelectedFlower] = useState<FlowerData | null>(
        null,
    );
    const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('day');
    const [particles, setParticles] = useState<Particle[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isHiddenMessage, setIsHiddenMessage] = useState(false);
    const countdown = useCountdown(endDate, isPastValentine);
    useAmbientAudio(timeOfDay);
    const isDev = process.env.NODE_ENV === 'development';
    const [isCountdownHintVisible, setIsCountdownHintVisible] = useState(false);
    const countdownHintTimeoutRef = useRef<ReturnType<
        typeof setTimeout
    > | null>(null);

    const speciesVariants = useMemo(() => {
        const map: Record<string, string[]> = {};
        FLOWER_SVGS.forEach((svg) => {
            const [species] = svg.split('-');
            if (!map[species]) map[species] = [];
            map[species].push(svg);
        });
        return map;
    }, []);

    const availableSpecies = useMemo(() => {
        const set = new Set<string>(BASE_SPECIES);
        flowers.forEach((f) => set.add(f.svg.split('-')[0]));
        return Array.from(set).sort();
    }, [flowers]);

    const [typeVisibility, setTypeVisibility] = useState<
        Record<string, boolean>
    >(() => {
        const initial: Record<string, boolean> = {};
        const allSpecies = new Set<string>(BASE_SPECIES);
        flowers.forEach((f) => allSpecies.add(f.svg.split('-')[0]));
        Array.from(allSpecies).forEach((type) => {
            initial[type] = true;
        });
        return initial;
    });

    useEffect(() => {
        setTypeVisibility((prev) => {
            let changed = false;
            const next: Record<string, boolean> = {};
            availableSpecies.forEach((type) => {
                next[type] = prev[type] ?? true;
                if (next[type] !== prev[type]) changed = true;
            });
            if (Object.keys(prev).length !== availableSpecies.length)
                changed = true;
            return changed ? next : prev;
        });
    }, [availableSpecies]);

    useEffect(() => {
        const update = () => {
            const tod = getTimeOfDay(new Date().getHours());
            setTimeOfDay(tod);
            setParticles(generateParticles(tod));
        };
        update();
        const id = setInterval(update, 60000);
        return () => clearInterval(id);
    }, []);

    const handleFlowerClick = useCallback((f: FlowerData) => {
        setSelectedFlower((prev) => (prev?.id === f.id ? null : f));
    }, []);

    const toggleFlowerType = useCallback((type: string) => {
        setTypeVisibility((prev) => ({
            ...prev,
            [type]: !(prev[type] ?? true),
        }));
    }, []);

    const resetFlowerTypes = useCallback(() => {
        const resetMap: Record<string, boolean> = {};
        availableSpecies.forEach((type) => {
            resetMap[type] = true;
        });
        setTypeVisibility(resetMap);
    }, [availableSpecies]);

    const enabledSpecies = useMemo(
        () => availableSpecies.filter((type) => typeVisibility[type]),
        [availableSpecies, typeVisibility],
    );

    const messageMaskResult = useMemo(
        () =>
            buildTextMask(HIDDEN_MESSAGE_LINES, {
                charSpacing: 8,
                pixelScaleX: 2,
            }),
        [],
    );

    const hiddenSpawnPoints = useMemo(
        () =>
            generateFlowerPositionsFromMask(
                messageMaskResult,
                {
                    width: 70,
                    height: 60,
                    offsetY: 18,
                    seed: HIDDEN_MESSAGE_SEED,
                    jitter: 0.2,
                },
                0.55,
            ),
        [messageMaskResult],
    );

    const assignedHiddenPoints = useMemo(
        () =>
            assignSpeciesToPoints(
                hiddenSpawnPoints,
                messageMaskResult,
                enabledSpecies,
                LINE_SPECIES,
            ),
        [hiddenSpawnPoints, messageMaskResult, enabledSpecies],
    );

    const hiddenFlowers = useMemo(() => {
        if (!assignedHiddenPoints.length) return [];
        const fallbackVariants =
            speciesVariants.rose ??
            FLOWER_SVGS.filter((svg) => svg.startsWith('rose-')) ??
            FLOWER_SVGS;
        let hiddenId = 0;
        return assignedHiddenPoints.map((point, index) => {
            const species = point.species ?? 'rose';
            const variants = speciesVariants[species] ?? fallbackVariants;
            return {
                id: -++hiddenId,
                x: point.x,
                y: point.y,
                svg: variants[index % variants.length] ?? variants[0],
                scale: 1.05,
                rotation: 0,
                zIndex: 200 + point.row,
                dayNumber: 0,
                date: '2025-02-14',
            } as FlowerData;
        });
    }, [assignedHiddenPoints, speciesVariants]);

    useEffect(() => {
        setSelectedFlower(null);
    }, [isHiddenMessage]);

    const renderFlowers = useMemo(
        () => [...flowers, ...hiddenFlowers],
        [flowers, hiddenFlowers],
    );
    const isCountdownBlocking = Boolean(countdown) && !isDev;
    const countdownLabel = useMemo(() => {
        if (!countdown) return null;
        const parts: string[] = [];
        if (countdown.days > 0) parts.push(`${countdown.days}d`);
        if (countdown.hours > 0 || parts.length)
            parts.push(`${countdown.hours}h`);
        parts.push(`${countdown.minutes}m`);
        return parts.join(' ');
    }, [countdown]);
    const showCountdownHint = useCallback(() => {
        if (!countdownLabel || !isCountdownBlocking) return;
        setIsCountdownHintVisible(true);
        if (countdownHintTimeoutRef.current) {
            clearTimeout(countdownHintTimeoutRef.current);
        }
        countdownHintTimeoutRef.current = setTimeout(() => {
            setIsCountdownHintVisible(false);
        }, 2500);
    }, [countdownLabel, isCountdownBlocking]);

    useEffect(() => {
        return () => {
            if (countdownHintTimeoutRef.current) {
                clearTimeout(countdownHintTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!isCountdownBlocking && isCountdownHintVisible) {
            setIsCountdownHintVisible(false);
        }
    }, [isCountdownBlocking, isCountdownHintVisible]);
    const newestFlowerId = flowers[flowers.length - 1]?.id ?? null;
    const isNight = timeOfDay === 'night';
    const isDusk = timeOfDay === 'dusk';

    return (
        <div
            className="relative h-dvh w-screen overflow-hidden"
            style={{
                backgroundColor: GRASS_BG[timeOfDay],
                transition: 'background-color 3s ease',
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    setSelectedFlower(null);
                    setIsFilterOpen(false);
                }
            }}
        >
            {/* Grass texture */}
            <GrassTexture
                color1={GRASS_BG[timeOfDay]}
                color2={GRASS_BG2[timeOfDay]}
            />

            {/* Time tint */}
            <div
                className={`pointer-events-none absolute inset-0 transition-colors duration-[3000ms] ${TINT_OVERLAY[timeOfDay]}`}
            />

            {/* Stars (night only) */}
            {(isNight || isDusk) && (
                <div className="pointer-events-none absolute inset-0">
                    {Array.from({ length: 40 }, (_, i) => (
                        <div
                            key={`star-${i}`}
                            className="absolute rounded-full bg-white animate-twinkle"
                            style={{
                                left: `${(i * 37 + 13) % 100}%`,
                                top: `${(i * 23 + 7) % 60}%`,
                                width: 1 + (i % 3),
                                height: 1 + (i % 3),
                                animationDelay: `${(i * 0.3) % 3}s`,
                                opacity: 0.3 + (i % 5) * 0.1,
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Floating particles */}
            <div className="pointer-events-none absolute inset-0 z-[2]">
                {particles.map((p) => (
                    <div
                        key={`particle-${p.id}`}
                        className={
                            p.type === 'firefly'
                                ? 'absolute rounded-full bg-yellow-200 shadow-[0_0_6px_2px_rgba(253,230,138,0.5)] animate-firefly'
                                : p.type === 'sparkle'
                                  ? 'absolute rounded-full bg-white/40 animate-sparkle'
                                  : 'absolute animate-petal'
                        }
                        style={{
                            left: `${p.x}%`,
                            top: `${p.y}%`,
                            width: p.size,
                            height: p.size,
                            animationDuration: `${p.duration}s`,
                            animationDelay: `${p.delay}s`,
                            ['--drift' as string]: `${p.drift}px`,
                            ...(p.type === 'petal'
                                ? {
                                      background:
                                          'radial-gradient(ellipse, rgba(255,200,210,0.5), rgba(255,160,180,0.15))',
                                      borderRadius: '50% 0 50% 0',
                                  }
                                : {}),
                        }}
                    />
                ))}
            </div>

            {/* Flowers */}
            {renderFlowers.map((f) => {
                const isSelected = selectedFlower?.id === f.id;
                // Deterministic sway: use flower id to pick animation delay & duration
                const swayDelay = (f.id * 0.37) % 4;
                const swayDuration = 3 + (f.id % 5) * 0.5;
                const typeName = f.svg.split('-')[0];
                const isEnabled = typeVisibility[typeName] ?? true;
                const isHiddenPixel = f.id < 0;
                const isNewestFlower =
                    !isHiddenPixel &&
                    newestFlowerId !== null &&
                    f.id === newestFlowerId;
                const fadeByToggle = !isEnabled;
                const fadeByReveal = isHiddenMessage && !isHiddenPixel;
                const shouldFade = fadeByToggle || fadeByReveal;
                const filterParts: string[] = [];
                if (isNight) filterParts.push('brightness(0.45) saturate(0.6)');
                else if (isDusk) filterParts.push('brightness(0.75)');
                const chronologicalLayer = Math.max(0, f.id);
                const depthLayer = Math.round(f.zIndex * 10);
                const baseZIndex = isSelected
                    ? 1000
                    : depthLayer * 100 + chronologicalLayer;
                const auraShadow = isNewestFlower
                    ? '0 0 18px rgba(255,255,255,0.85), 0 0 36px rgba(255,200,220,0.7)'
                    : 'none';

                return (
                    <button
                        key={f.id}
                        onClick={() => handleFlowerClick(f)}
                        className={`absolute border-0 bg-transparent p-0 cursor-pointer ${
                            isNewestFlower ? 'animate-newest' : 'animate-sway'
                        }`}
                        style={{
                            left: `${f.x}%`,
                            top: `${f.y}%`,
                            width: FLOWER_SIZE,
                            height: FLOWER_SIZE,
                            transform: `translate(-50%, -50%) scale(${isSelected ? f.scale * 2.2 : f.scale}) rotate(${f.rotation}deg)`,
                            zIndex: baseZIndex,
                            filter: filterParts.length
                                ? filterParts.join(' ')
                                : 'none',
                            transition:
                                'left 0.4s ease, top 0.4s ease, transform 0.3s ease, filter 0.35s ease, opacity 0.35s ease, box-shadow 0.45s ease',
                            opacity: shouldFade ? 0.15 : 1,
                            pointerEvents: fadeByToggle ? 'none' : 'auto',
                            animationDelay: `${swayDelay}s`,
                            animationDuration: `${swayDuration}s`,
                            boxShadow: auraShadow,
                        }}
                    >
                        <img
                            src={`/flowers/${f.svg}`}
                            alt=""
                            draggable={false}
                            className="h-full w-full"
                            style={{ pointerEvents: 'none' }}
                        />
                    </button>
                );
            })}

            {/* Flower tooltip */}
            {selectedFlower && (
                <div
                    className="pointer-events-none absolute z-[400000] animate-fade-in"
                    style={{
                        left: `${Math.min(Math.max(selectedFlower.x, 12), 88)}%`,
                        top: `${selectedFlower.y}%`,
                        transform: `translate(-50%, ${selectedFlower.y > 50 ? '-140%' : '60%'})`,
                    }}
                >
                    <div className="rounded-xl bg-white/90 px-3 py-2 text-center shadow-lg backdrop-blur-md">
                        <p className="text-xs font-bold text-emerald-700 sm:text-sm">
                            Day {selectedFlower.dayNumber.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-emerald-500 sm:text-xs">
                            {formatDate(selectedFlower.date)}
                        </p>
                    </div>
                </div>
            )}

            <FloatingPanel
                total={total}
                isPastValentine={isPastValentine}
                countdown={countdown}
            />

            {/* Flower type filter */}
            <div className="pointer-events-none absolute bottom-4 right-4 z-[200000] flex flex-col items-end gap-3">
                {isFilterOpen && (
                    <div className="filter-menu pointer-events-auto w-60 rounded-2xl bg-zinc-900/90 p-3 text-white shadow-2xl backdrop-blur">
                        <div className="mb-3 rounded-2xl bg-white/5 px-3 py-2">
                            <div className="flex items-center justify-between text-sm font-semibold">
                                <span>Hidden Message</span>
                                <button
                                    type="button"
                                    className={`flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] transition ${
                                        isHiddenMessage
                                            ? 'text-emerald-300'
                                            : 'text-white/40'
                                    }`}
                                    aria-pressed={isHiddenMessage}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setIsHiddenMessage((prev) => !prev);
                                    }}
                                >
                                    {isHiddenMessage ? 'On' : 'Off'}
                                    <span
                                        className={`inline-flex h-4 w-7 items-center rounded-full border border-white/20 px-0.5 transition ${
                                            isHiddenMessage
                                                ? 'bg-emerald-400/80'
                                                : 'bg-zinc-700'
                                        }`}
                                    >
                                        <span
                                            className={`block h-3 w-3 rounded-full bg-white transition ${
                                                isHiddenMessage
                                                    ? 'translate-x-3'
                                                    : 'translate-x-0'
                                            }`}
                                        />
                                    </span>
                                </button>
                            </div>
                            <p className="mt-1 text-[11px] text-white/60">
                                if you give up trying to find the hidden
                                message, you might as well just turn it on and
                                see what it is 🤣
                            </p>
                        </div>

                        <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/60">
                            <span>Flowers</span>
                            <button
                                type="button"
                                className="text-[10px] font-semibold tracking-wide text-emerald-300 hover:text-emerald-200"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    resetFlowerTypes();
                                }}
                            >
                                Reset
                            </button>
                        </div>
                        <ul className="space-y-1">
                            {availableSpecies.map((type) => {
                                const enabled = typeVisibility[type] ?? true;
                                const label =
                                    type.charAt(0).toUpperCase() +
                                    type.slice(1);
                                return (
                                    <li key={type}>
                                        <button
                                            type="button"
                                            className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-sm transition hover:bg-white/5"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                toggleFlowerType(type);
                                            }}
                                        >
                                            <span>{label}</span>
                                            <span
                                                className={`flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] ${
                                                    enabled
                                                        ? 'text-emerald-300'
                                                        : 'text-white/40'
                                                }`}
                                            >
                                                {enabled ? 'On' : 'Off'}
                                                <span
                                                    className={`inline-flex h-4 w-7 items-center rounded-full border border-white/20 px-0.5 transition ${
                                                        enabled
                                                            ? 'bg-emerald-400/80'
                                                            : 'bg-zinc-700'
                                                    }`}
                                                >
                                                    <span
                                                        className={`block h-3 w-3 rounded-full bg-white transition ${
                                                            enabled
                                                                ? 'translate-x-3'
                                                                : 'translate-x-0'
                                                        }`}
                                                    />
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                {isCountdownBlocking &&
                    countdownLabel &&
                    isCountdownHintVisible && (
                        <div className="pointer-events-auto rounded-full bg-black/70 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/80 shadow-lg">
                            {countdownLabel}
                        </div>
                    )}
                <button
                    type="button"
                    className={`pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold shadow-lg backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-white transition ${
                        isHiddenMessage
                            ? 'bg-emerald-400 text-emerald-950'
                            : 'bg-zinc-900/90 text-white'
                    } ${isCountdownBlocking ? 'cursor-not-allowed opacity-60' : ''}`}
                    aria-label="Toggle flower filter menu"
                    aria-expanded={isFilterOpen}
                    aria-disabled={isCountdownBlocking}
                    onClick={(event) => {
                        event.stopPropagation();
                        if (isCountdownBlocking) {
                            showCountdownHint();
                            return;
                        }
                        setIsFilterOpen((prev) => !prev);
                    }}
                >
                    ✨
                </button>
            </div>
        </div>
    );
}

function FloatingPanel({
    total,
    isPastValentine,
    countdown,
}: {
    total: number;
    isPastValentine: boolean;
    countdown: ReturnType<typeof useCountdown>;
}) {
    const [isHidden, setIsHidden] = useState(false);

    if (isHidden) {
        return null;
    }

    return (
        <div className="pointer-events-none absolute inset-0 z-[300000] flex items-center justify-center">
            <button
                type="button"
                className="pointer-events-auto w-[80vw] max-w-[300px] rounded-2xl bg-white/30 px-5 py-4 text-center text-white shadow-xl backdrop-blur-lg transition hover:bg-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 min-[390px]:w-[300px] md:max-w-[380px] md:px-10 md:py-7"
                onClick={() => setIsHidden(true)}
                aria-label="Hide Our Garden panel"
            >
                <h1 className="font-sans text-[7vw] font-bold leading-tight tracking-tight text-slate-700 min-[390px]:text-3xl md:text-5xl">
                    Our Garden
                </h1>
                <p className="mt-1 text-[3.5vw] text-slate-600 min-[390px]:text-sm md:mt-2 md:text-xl">
                    {total.toLocaleString()} flowers planted
                </p>

                {countdown && (
                    <div className="mt-3 border-t border-white/20 pt-3">
                        <p className="mb-1.5 text-[2.5vw] uppercase tracking-widest text-slate-500 min-[390px]:text-[10px] md:text-xs">
                            Valentine&apos;s Day
                        </p>
                        <div className="flex items-center justify-center gap-3 md:gap-4">
                            {[
                                { value: countdown.days, label: 'days' },
                                { value: countdown.hours, label: 'hrs' },
                                { value: countdown.minutes, label: 'min' },
                                { value: countdown.seconds, label: 'sec' },
                            ].map((item) => (
                                <div
                                    key={item.label}
                                    className="flex flex-col items-center"
                                >
                                    <span className="font-mono text-[5vw] font-bold tabular-nums text-slate-900 min-[390px]:text-xl md:text-3xl">
                                        {String(item.value).padStart(2, '0')}
                                    </span>
                                    <span className="text-[2vw] uppercase text-slate-400 min-[390px]:text-[9px] md:text-[11px]">
                                        {item.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {isPastValentine && (
                    <p className="mt-3 border-t border-white/20 pt-3 text-[3.5vw] text-rose-300 font-semibold min-[390px]:text-sm md:text-lg">
                        Happy Valentine&apos;s Day
                    </p>
                )}

                <p className="mt-3 text-[2.5vw] uppercase tracking-widest text-slate-400 min-[390px]:text-[10px] md:text-xs">
                    Tap to hide — refresh to show again
                </p>
            </button>
        </div>
    );
}
