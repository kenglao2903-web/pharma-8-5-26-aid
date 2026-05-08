import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Theme = "light" | "dark";

interface ThemeCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const saved = localStorage.getItem("pharmcalc.theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem("pharmcalc.theme", theme);
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);
  const toggleTheme = () => setThemeState((p) => (p === "dark" ? "light" : "dark"));

  return <Ctx.Provider value={{ theme, setTheme, toggleTheme }}>{children}</Ctx.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
};
