"use client";

import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useRef,
} from "react";

import { useEffect } from "react";

interface FocusContextType {
    isLockdownActive: boolean;
    startLockdown: (duration: number) => void;
    endLockdown: () => void;
}

const FocusContext = createContext<FocusContextType | undefined>(undefined);

export const FocusProvider: React.FC<{ children: ReactNode }> = ({
    children,
}) => {
    const [isLockdownActive, setIsLockdownActive] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const oscillatorNodeRef1 = useRef<OscillatorNode | null>(null);
    const oscillatorNodeRef2 = useRef<OscillatorNode | null>(null);

    const startLockdown = (duration: number) => {
        if (document.hidden) return;
        setIsLockdownActive(true);
        playBinauralBeat(40);
    };

    const endLockdown = () => {
        setIsLockdownActive(false);
        stopBinauralBeat();
    };

    useEffect(() => {
        const handleVisibility = () => {
            if (document.hidden && isLockdownActive) {
                endLockdown();
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);
        return () =>
            document.removeEventListener("visibilitychange", handleVisibility);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLockdownActive]);

    const playBinauralBeat = (frequency: number) => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (
                window.AudioContext || (window as any).webkitAudioContext
            )();
        }
        const audioContext = audioContextRef.current;

        const baseFrequency = 200;
        const binauralFrequency = frequency;

        const oscillator1 = audioContext.createOscillator();
        oscillator1.type = "sine";
        oscillator1.frequency.setValueAtTime(
            baseFrequency,
            audioContext.currentTime,
        );

        const oscillator2 = audioContext.createOscillator();
        oscillator2.type = "sine";
        oscillator2.frequency.setValueAtTime(
            baseFrequency + binauralFrequency,
            audioContext.currentTime,
        );

        const merger = audioContext.createChannelMerger(2);

        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);

        oscillator1.connect(merger, 0, 0);
        oscillator2.connect(merger, 0, 1);
        merger.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator1.start();
        oscillator2.start();

        oscillatorNodeRef1.current = oscillator1;
        oscillatorNodeRef2.current = oscillator2;
    };

    const stopBinauralBeat = () => {
        if (oscillatorNodeRef1.current) {
            oscillatorNodeRef1.current.stop();
            oscillatorNodeRef1.current = null;
        }
        if (oscillatorNodeRef2.current) {
            oscillatorNodeRef2.current.stop();
            oscillatorNodeRef2.current = null;
        }
        if (
            audioContextRef.current &&
            audioContextRef.current.state !== "closed"
        ) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
    };

    const value = React.useMemo(() => ({
        isLockdownActive,
        startLockdown,
        endLockdown
    }), [isLockdownActive]);

    return (
        <FocusContext.Provider value={value}>
            {children}
        </FocusContext.Provider>
    );
};

export const useFocus = () => {
    const context = useContext(FocusContext);
    if (context === undefined) {
        throw new Error("useFocus must be used within a FocusProvider");
    }
    return context;
};
