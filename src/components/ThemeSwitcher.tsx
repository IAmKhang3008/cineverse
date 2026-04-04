import { useTheme } from "@/contexts/ThemeContext";
import { Sun, Moon } from "lucide-react";

export default function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full bg-input-bg hover:opacity-80 transition-all border border-card-border"
    >
      {theme === "light" ? <Moon className="text-foreground w-5 h-5" /> : <Sun className="text-foreground w-5 h-5" />}
    </button>
  );
}