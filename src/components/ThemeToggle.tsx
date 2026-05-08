import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { Moon, Sun } from "lucide-react";

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
};
