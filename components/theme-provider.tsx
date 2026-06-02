"use client";

import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useMemo,
} from "react";

type Theme = "light" | "dark";

type ThemeProviderProps = {
    children: React.ReactNode;
};

type TransitionCoordinates = {
    x: number;
    y: number;
} | null;

type ThemeProviderState = {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    triggerTransition: (
        coordinates: TransitionCoordinates,
        targetTheme: Theme,
    ) => void;
    isTransitioning: boolean;
    transitionCoordinates: TransitionCoordinates;
};

const initialState: ThemeProviderState = {
    theme: "light",
    setTheme: () => null,
    triggerTransition: () => null,
    isTransitioning: false,
    transitionCoordinates: null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({ children }: ThemeProviderProps) {
    const [theme, setThemeState] = useState<Theme>("light");
    const [mounted, setMounted] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [transitionCoordinates, setTransitionCoordinates] =
        useState<TransitionCoordinates>(null);

    useEffect(() => {
        setMounted(true);
        const savedTheme = localStorage.getItem(
            "ceo-dashboard-theme",
        ) as Theme | null;
        if (savedTheme) {
            setThemeState(savedTheme);
        }
    }, []);

    useEffect(() => {
        if (!mounted) return;

        const root = window.document.documentElement;

        if (theme === "dark") {
            root.setAttribute("data-theme", "dark");
        } else {
            root.removeAttribute("data-theme");
        }

        localStorage.setItem("ceo-dashboard-theme", theme);
    }, [theme, mounted]);

    // Trigger the radial transition animation
    const triggerTransition = useCallback(
        (coordinates: TransitionCoordinates, targetTheme: Theme) => {
            if (coordinates) {
                setTransitionCoordinates(coordinates);
                setIsTransitioning(true);
                // Theme will be applied after animation completes
            }
        },
        [],
    );

    // Handle transition completion
    const handleTransitionComplete = useCallback(() => {
        setIsTransitioning(false);
        setTransitionCoordinates(null);
    }, []);

    // Internal setTheme that can be called after animation
    const setTheme = useCallback((t: Theme) => {
        setThemeState(t);
    }, []);

    const value = useMemo(() => ({
        theme,
        setTheme,
        triggerTransition,
        isTransitioning,
        transitionCoordinates,
    }), [theme, setTheme, triggerTransition, isTransitioning, transitionCoordinates]);

    return (
        <ThemeProviderContext.Provider value={value}>
            {children}
        </ThemeProviderContext.Provider>
    );
}

export const useTheme = () => {
    const context = useContext(ThemeProviderContext);
    if (context === undefined)
        throw new Error("useTheme must be used within a ThemeProvider");
    return context;
};
