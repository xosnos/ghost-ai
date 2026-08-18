"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Theme = "dark" | "light" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "dark" | "light";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = "ghost_ai_theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let ignore = false;
    const init = async () => {
      await Promise.resolve();
      if (ignore) return;
      setMounted(true);
      try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
        if (saved && (saved === "dark" || saved === "light" || saved === "system")) {
          setThemeState(saved);
        } else {
          setThemeState("dark");
        }
      } catch {
        setThemeState("dark");
      }
    };
    void init();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function applyTheme() {
      let target: "dark" | "light" = "dark";
      if (theme === "system") {
        target = mediaQuery.matches ? "dark" : "light";
      } else {
        target = theme;
      }

      setResolvedTheme(target);
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(target);
      root.setAttribute("data-theme", target);
      root.style.colorScheme = target;
    }

    applyTheme();

    function handleChange() {
      if (theme === "system") {
        applyTheme();
      }
    }

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, mounted]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setThemeState(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore
    }
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: "dark",
      resolvedTheme: "dark",
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return context;
}
