import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";

const toLocalIso = (d: Date) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export const StartTimeInput = ({ value, onChange }: Props) => {
  const { t } = useI18n();
  const [showPicker, setShowPicker] = useState(false);

  const setNow = () => onChange(toLocalIso(new Date()));
  const addMin = (m: number) => {
    const base = value ? new Date(value) : new Date();
    base.setMinutes(base.getMinutes() + m);
    onChange(toLocalIso(base));
  };
  const display = value
    ? new Date(value).toLocaleString([], {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div>
      <Label className="label-clinical flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" /> {t("startTime")}
      </Label>
      <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-700">{display}</span>
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs bg-brand hover:bg-brand/90 text-brand-foreground"
            onClick={setNow}
          >
            Now
          </Button>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {[15, 30, 60, 120, 240].map((m) => (
            <Button
              key={m}
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs px-1"
              onClick={() => addMin(m)}
            >
              +{m >= 60 ? `${m / 60}h` : `${m}m`}
            </Button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowPicker((s) => !s)}
          className="text-xs text-brand underline-offset-2 hover:underline"
        >
          {showPicker ? "Hide" : "Custom time"}
        </button>
        {showPicker && (
          <Input
            type="datetime-local"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 bg-white"
          />
        )}
      </div>
    </div>
  );
};
