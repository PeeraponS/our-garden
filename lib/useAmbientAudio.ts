'use client';

import { useEffect, useRef } from 'react';

type TimeOfDay = 'night' | 'dawn' | 'morning' | 'day' | 'sunset' | 'dusk';
type AmbientScene = 'day' | 'night';

const SCENE_AUDIO: Record<
    AmbientScene,
    { src: string; maxVolume: number; label: string }
> = {
    day: {
        src: '/sounds/freesound_community-garden-sunny-day-54490.mp3',
        maxVolume: 0.4,
        label: 'Sunny garden ambience',
    },
    night: {
        src: '/sounds/freesound_community-night-ambience-17064.mp3',
        maxVolume: 0.38,
        label: 'Night fireflies ambience',
    },
};

const NIGHT_SCENES: TimeOfDay[] = ['night', 'dusk', 'dawn'];
const FADE_DURATION = 2200;

export function useAmbientAudio(timeOfDay: TimeOfDay) {
    const scene: AmbientScene = NIGHT_SCENES.includes(timeOfDay)
        ? 'night'
        : 'day';
    const audioMapRef = useRef<Record<AmbientScene, HTMLAudioElement | null>>({
        day: null,
        night: null,
    });
    const fadeRafRef = useRef<number | null>(null);
    const fadeStateRef = useRef<{
        start: number;
        from: Record<AmbientScene, number>;
        to: Record<AmbientScene, number>;
    } | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const created: Record<AmbientScene, HTMLAudioElement> = {
            day: createAudioElement('day'),
            night: createAudioElement('night'),
        };
        audioMapRef.current.day = created.day;
        audioMapRef.current.night = created.night;

        const tryPlayAll = () => {
            Object.values(created).forEach((audio) => {
                if (audio.paused) {
                    void audio.play().catch(() => {
                        /* ignore */
                    });
                }
            });
        };

        const resumeHandler = () => {
            tryPlayAll();
            detachResume();
        };

        const attachResume = () => {
            ['pointerdown', 'touchstart', 'keydown'].forEach((event) => {
                document.addEventListener(event, resumeHandler, {
                    once: true,
                    passive: true,
                });
            });
        };

        const detachResume = () => {
            ['pointerdown', 'touchstart', 'keydown'].forEach((event) => {
                document.removeEventListener(event, resumeHandler);
            });
        };

        tryPlayAll();
        attachResume();
        return () => {
            detachResume();
            Object.entries(audioMapRef.current).forEach(([key, audio]) => {
                if (!audio) return;
                audio.pause();
                audio.remove();
                audioMapRef.current[key as AmbientScene] = null;
            });
            if (fadeRafRef.current) {
                cancelAnimationFrame(fadeRafRef.current);
                fadeRafRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        const targetVolumes: Record<AmbientScene, number> = {
            day: 0,
            night: 0,
        };
        targetVolumes[scene] = SCENE_AUDIO[scene].maxVolume;
        startFade(targetVolumes);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene]);

    const startFade = (targets: Record<AmbientScene, number>) => {
        const audios = audioMapRef.current;
        if (!audios.day && !audios.night) return;
        const startVolumes: Record<AmbientScene, number> = {
            day: audios.day?.volume ?? 0,
            night: audios.night?.volume ?? 0,
        };
        fadeStateRef.current = {
            start: performance.now(),
            from: startVolumes,
            to: targets,
        };
        if (fadeRafRef.current) {
            cancelAnimationFrame(fadeRafRef.current);
        }
        const step = () => {
            const state = fadeStateRef.current;
            if (!state) return;
            const elapsed = performance.now() - state.start;
            const t = Math.min(1, elapsed / FADE_DURATION);
            const eased = easeInOut(t);
            (['day', 'night'] as AmbientScene[]).forEach((key) => {
                const audio = audios[key];
                if (!audio) return;
                const from = state.from[key] ?? 0;
                const to = state.to[key] ?? 0;
                audio.volume = from + (to - from) * eased;
            });
            if (t < 1) {
                fadeRafRef.current = requestAnimationFrame(step);
            }
        };
        fadeRafRef.current = requestAnimationFrame(step);
    };

    return null;
}

function createAudioElement(scene: AmbientScene): HTMLAudioElement {
    const audio = new Audio(SCENE_AUDIO[scene].src);
    audio.loop = true;
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('data-ambient-scene', scene);
    audio.volume = 0;
    audio.setAttribute('aria-label', SCENE_AUDIO[scene].label);
    document.body?.appendChild(audio);
    audio.load();
    return audio;
}

function easeInOut(t: number) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
