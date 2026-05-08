import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { Languages } from "lucide-react";

export const LangSwitcher = () => {
  const { lang, setLang } = useI18n();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setLang(lang === "en" ? "th" : "en")}
      className="gap-1"
      aria-label="Toggle language"
    >
      <Languages className="h-4 w-4" />
      <span className="font-mono text-xs">{lang === "en" ? "EN" : "TH"}</span>
    </Button>
  );
};
