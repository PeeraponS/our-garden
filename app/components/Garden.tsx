'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { FlowerData, EmojiData } from '@/lib/garden';
import { TEXT_SETS, ROTATING_COUNT } from '@/lib/gardenConfig';
import { mulberry32 } from '@/lib/random';
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

// --- Particles ---
interface Particle {
    id: number;
    x: number;
    y: number;
    size: number;
    duration: number;
    delay: number;
    type: 'firefly' | 'petal' | 'leaf' | 'butterfly';
    drift: number;
    color?: string;
}

const BUTTERFLY_COLORS = [
    ['#f9a8d4', '#f472b6'], // pink
    ['#fde68a', '#f59e0b'], // yellow
    ['#93c5fd', '#3b82f6'], // blue
    ['#c4b5fd', '#8b5cf6'], // purple
    ['#fdba74', '#f97316'], // orange
    ['#86efac', '#22c55e'], // green
];

function generateParticles(timeOfDay: TimeOfDay): Particle[] {
    const particles: Particle[] = [];
    const isNighty =
        timeOfDay === 'night' || timeOfDay === 'dusk' || timeOfDay === 'dawn';

    const count = isNighty ? 20 : 25;
    for (let i = 0; i < count; i++) {
        const type: Particle['type'] = isNighty
            ? 'firefly'
            : i % 3 === 0
              ? 'leaf'
              : 'petal';
        particles.push({
            id: i,
            x: -10 + Math.random() * 110,
            y: -10 + Math.random() * 110,
            size: isNighty
                ? 2 + Math.random() * 3
                : type === 'leaf'
                  ? 12 + Math.random() * 10
                  : 8 + Math.random() * 8,
            duration: isNighty ? 4 + Math.random() * 6 : 7 + Math.random() * 6,
            delay: Math.random() * 12,
            type,
            drift: 40 + Math.random() * 80,
        });
    }

    // Add butterflies during daytime
    if (!isNighty) {
        const butterflyCount = 6 + Math.floor(Math.random() * 4);
        for (let i = 0; i < butterflyCount; i++) {
            const colorPair =
                BUTTERFLY_COLORS[
                    Math.floor(Math.random() * BUTTERFLY_COLORS.length)
                ];
            particles.push({
                id: count + i,
                x: 5 + Math.random() * 90,
                y: 10 + Math.random() * 80,
                size: 10 + Math.random() * 8,
                duration: 12 + Math.random() * 10,
                delay: Math.random() * 10,
                type: 'butterfly',
                drift: -60 + Math.random() * 120,
                color: colorPair[0],
            });
        }
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
const BASE_SPECIES = [
    'forgetmenot',
    'lily',
    'peony',
    'rose',
    'tulip',
    'sunflower',
] as const;

export default function Garden({
    flowers,
    total,
    emojis,
}: {
    flowers: FlowerData[];
    total: number;
    emojis: EmojiData[];
}) {
    const [selectedFlower, setSelectedFlower] = useState<FlowerData | null>(
        null,
    );
    const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('day');
    const [particles, setParticles] = useState<Particle[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [activeTextSet, setActiveTextSet] = useState<string | null>(null);
    const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
    useAmbientAudio(timeOfDay);

    // Pick which rotating emojis are visible this hour
    const visibleEmojis = useMemo(() => {
        const always = emojis.filter((e) => e.alwaysShow);
        const rotating = emojis.filter((e) => !e.alwaysShow);
        if (rotating.length <= ROTATING_COUNT) return emojis;
        // Use hour as seed to pick ROTATING_COUNT emojis
        const rng = mulberry32(currentHour * 9973 + 42);
        const shuffled = [...rotating].sort(() => rng() - 0.5);
        return [...always, ...shuffled.slice(0, ROTATING_COUNT)];
    }, [emojis, currentHour]);

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
            const now = new Date();
            const tod = getTimeOfDay(now.getHours());
            setTimeOfDay(tod);
            setParticles(generateParticles(tod));
            setCurrentHour(now.getHours());
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

    // Discover which text sets have at least 1 flower planted
    const discoveredTextSets = useMemo(
        () =>
            TEXT_SETS.filter((ts) =>
                flowers.some((f) => f.textSetId === ts.id),
            ),
        [flowers],
    );

    useEffect(() => {
        setSelectedFlower(null);
    }, [activeTextSet]);
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
            <div className="pointer-events-none absolute inset-0 overflow-hidden z-[5000]">
                {particles.map((p) =>
                    p.type === 'butterfly' ? (
                        <div
                            key={`particle-${p.id}`}
                            className="absolute animate-flutter"
                            style={{
                                left: `${p.x}%`,
                                top: `${p.y}%`,
                                width: p.size,
                                height: p.size,
                                animationDuration: `${p.duration}s`,
                                animationDelay: `${p.delay}s`,
                                ['--drift' as string]: `${p.drift}px`,
                            }}
                        >
                            {/* Left wing */}
                            <span
                                className="absolute top-0 left-0 animate-wing-left"
                                style={{
                                    width: '50%',
                                    height: '100%',
                                    background: p.color,
                                    borderRadius: '50% 0 50% 50%',
                                    opacity: 0.85,
                                    transformOrigin: 'right center',
                                }}
                            />
                            {/* Right wing */}
                            <span
                                className="absolute top-0 right-0 animate-wing-right"
                                style={{
                                    width: '50%',
                                    height: '100%',
                                    background: p.color,
                                    borderRadius: '0 50% 50% 50%',
                                    opacity: 0.85,
                                    transformOrigin: 'left center',
                                }}
                            />
                        </div>
                    ) : (
                        <div
                            key={`particle-${p.id}`}
                            className={
                                p.type === 'firefly'
                                    ? 'absolute rounded-full bg-yellow-200 shadow-[0_0_6px_2px_rgba(253,230,138,0.5)] animate-firefly'
                                    : 'absolute animate-blow'
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
                                              'radial-gradient(ellipse, rgba(255,180,195,0.85), rgba(255,140,165,0.5))',
                                          borderRadius: '50% 0 50% 0',
                                      }
                                    : {}),
                                ...(p.type === 'leaf'
                                    ? {
                                          background:
                                              'linear-gradient(135deg, rgba(100,170,60,0.85), rgba(60,130,30,0.6))',
                                          borderRadius: '40% 0 60% 0',
                                      }
                                    : {}),
                            }}
                        />
                    ),
                )}
            </div>

            {/* Emojis */}
            {visibleEmojis.map((e) => (
                <div
                    key={`emoji-${e.id}`}
                    className="pointer-events-none absolute select-none"
                    style={{
                        left: `${e.x}%`,
                        top: `${e.y}%`,
                        transform: `translate(-50%, -50%) scale(${e.scale}) rotate(${e.rotation}deg)`,
                        fontSize: 'clamp(18px, 4.5vw, 32px)',
                        zIndex: e.zIndex,
                        opacity: activeTextSet !== null ? 0.15 : 0.85,
                        transition: 'opacity 0.35s ease',
                    }}
                >
                    {e.emoji}
                </div>
            ))}

            {/* Flowers */}
            {flowers.map((f) => {
                const isSelected = selectedFlower?.id === f.id;
                // Deterministic sway: use flower id to pick animation delay & duration
                const swayDelay = (f.id * 0.37) % 4;
                const swayDuration = 3 + (f.id % 5) * 0.5;
                const typeName = f.svg.split('-')[0];
                const isEnabled = typeVisibility[typeName] ?? true;
                const isTextFlower = !!f.textSetId;
                const isNewestFlower =
                    newestFlowerId !== null &&
                    f.id === newestFlowerId;
                const fadeByToggle = !isEnabled;
                const fadeByReveal =
                    activeTextSet !== null &&
                    (!isTextFlower || f.textSetId !== activeTextSet);
                const shouldFade = fadeByToggle || fadeByReveal;
                const filterParts: string[] = [];
                if (isNight) filterParts.push('brightness(0.45) saturate(0.6)');
                else if (isDusk) filterParts.push('brightness(0.75)');
                const baseZIndex = isSelected
                    ? 100000
                    : isTextFlower
                      ? 200 + Math.round(f.zIndex * 10)
                      : f.id;
                // const auraShadow = isNewestFlower
                //     ? '0 0 20px rgba(255,255,255,0.95), 0 0 40px rgba(255,180,200,0.8), 0 0 60px rgba(255,150,180,0.4)'
                //     : 'none';

                return (
                    <div key={f.id} className="absolute" style={{
                        left: `${f.x}%`,
                        top: `${f.y}%`,
                        zIndex: baseZIndex,
                    }}>
                        {/* Pulsing ring beacon for newest flower */}
                        {/* {isNewestFlower && !shouldFade && (
                            <>
                                <div
                                    className="pointer-events-none absolute animate-ping-ring"
                                    style={{
                                        width: 'clamp(50px, 12vw, 90px)',
                                        height: 'clamp(50px, 12vw, 90px)',
                                        transform: 'translate(-50%, -50%)',
                                        borderRadius: '50%',
                                        border: '2px solid rgba(255, 255, 255, 0.7)',
                                    }}
                                />
                                <div
                                    className="pointer-events-none absolute animate-ping-ring"
                                    style={{
                                        width: 'clamp(50px, 12vw, 90px)',
                                        height: 'clamp(50px, 12vw, 90px)',
                                        transform: 'translate(-50%, -50%)',
                                        borderRadius: '50%',
                                        border: '2px solid rgba(255, 180, 200, 0.6)',
                                        animationDelay: '1s',
                                    }}
                                />
                                <div
                                    className="pointer-events-none absolute animate-newest-glow"
                                    style={{
                                        width: 'clamp(40px, 10vw, 70px)',
                                        height: 'clamp(40px, 10vw, 70px)',
                                        transform: 'translate(-50%, -50%)',
                                        borderRadius: '50%',
                                        background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,200,220,0.2) 40%, transparent 70%)',
                                    }}
                                />
                            </>
                        )} */}
                        <button
                            onClick={() => handleFlowerClick(f)}
                            className="absolute border-0 bg-transparent p-0 cursor-pointer animate-sway"
                            style={{
                                width: FLOWER_SIZE,
                                height: FLOWER_SIZE,
                                transform: `translate(-50%, -50%) scale(${isSelected ? f.scale * 2.2 : f.scale}) rotate(${f.rotation}deg)`,
                                filter: filterParts.length
                                    ? filterParts.join(' ')
                                    : 'none',
                                transition:
                                    'transform 0.3s ease, filter 0.35s ease, opacity 0.35s ease, box-shadow 0.45s ease',
                                opacity: shouldFade ? 0.15 : 1,
                                pointerEvents: fadeByToggle ? 'none' : 'auto',
                                animationDelay: `${swayDelay}s`,
                                animationDuration: `${swayDuration}s`,
                                boxShadow: 'none',
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
                    </div>
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

            <FloatingPanel total={total} />

            {/* Flower type filter */}
            <div className="pointer-events-none absolute bottom-4 right-4 z-[600000] flex flex-col items-end gap-3">
                {isFilterOpen && (
                    <div className="filter-menu pointer-events-auto relative z-[610000] w-60 rounded-2xl border border-white/15 bg-zinc-900/95 p-3 text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                        {discoveredTextSets.length > 0 && (
                            <div className="mb-3 rounded-2xl bg-white/5 px-3 py-2">
                                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-white/60">
                                    Hidden Messages
                                </div>
                                <ul className="space-y-1">
                                    {discoveredTextSets.map((ts) => {
                                        const isActive =
                                            activeTextSet === ts.id;
                                        return (
                                            <li key={ts.id}>
                                                <button
                                                    type="button"
                                                    className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-sm transition hover:bg-white/5"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setActiveTextSet(
                                                            (prev) =>
                                                                prev === ts.id
                                                                    ? null
                                                                    : ts.id,
                                                        );
                                                    }}
                                                >
                                                    <span>{ts.label}</span>
                                                    <span
                                                        className={`flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] ${
                                                            isActive
                                                                ? 'text-emerald-300'
                                                                : 'text-white/40'
                                                        }`}
                                                    >
                                                        {isActive
                                                            ? 'On'
                                                            : 'Off'}
                                                        <span
                                                            className={`inline-flex h-4 w-7 items-center rounded-full border border-white/20 px-0.5 transition ${
                                                                isActive
                                                                    ? 'bg-emerald-400/80'
                                                                    : 'bg-zinc-700'
                                                            }`}
                                                        >
                                                            <span
                                                                className={`block h-3 w-3 rounded-full bg-white transition ${
                                                                    isActive
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

                <button
                    type="button"
                    className={`pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold shadow-lg backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-white transition ${
                        activeTextSet !== null
                            ? 'bg-emerald-400 text-emerald-950'
                            : 'bg-zinc-900/90 text-white'
                    }`}
                    aria-label="Toggle flower filter menu"
                    aria-expanded={isFilterOpen}
                    onClick={(event) => {
                        event.stopPropagation();
                        setIsFilterOpen((prev) => !prev);
                    }}
                >
                    ✨
                </button>
            </div>
        </div>
    );
}

function FloatingPanel({ total }: { total: number }) {
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

                <p className="mt-3 border-t border-white/20 pt-3 text-[3.5vw] text-rose-300 font-semibold min-[390px]:text-sm md:text-lg">
                    Happy Valentine&apos;s Day
                </p>

                <p className="mt-3 text-[2.5vw] uppercase tracking-widest text-slate-400 min-[390px]:text-[10px] md:text-xs">
                    Tap to hide — refresh to show again
                </p>
            </button>
        </div>
    );
}
