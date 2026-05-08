import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Clock, Printer, AlertTriangle, Droplet } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { StartTimeInput } from "./StartTimeInput";
import { PrintHeader } from "./PrintHeader";

const nowLocalIso = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const fmtTime = (d: Date) =>
  d.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const fmtDuration = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h} h ${m} min`;
};

export const FluidDurationCalculator = () => {
  const { t } = useI18n();
  const { logActivity } = useAuth();
  const [bags, setBags] = useState("3");
  const [bagSize, setBagSize] = useState("1000");
  const [dripRate, setDripRate] = useState("80");
  const [startTime, setStartTime] = useState(nowLocalIso());

  const result = useMemo(() => {
    const n = parseInt(bags);
    const v = parseFloat(bagSize);
    const r = parseFloat(dripRate);
    if (!n || !v || !r) return null;
    const perBagMin = (v / r) * 60;
    const start = new Date(startTime);
    const sets = Array.from({ length: n }, (_, i) => ({
      n: i + 1,
      out: new Date(start.getTime() + perBagMin * (i + 1) * 60_000),
    }));
    return { perBagMin, totalMin: perBagMin * n, sets, start };
  }, [bags, bagSize, dripRate, startTime]);

  const highRate = result && parseFloat(dripRate) > 250;

  const handlePrint = () => {
    logActivity("print_fluid_duration", { bags, bagSize, dripRate });
    window.print();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="clinical-card p-6 lg:col-span-2 no-print">
        <div className="flex items-center gap-2 mb-5">
          <Droplet className="h-5 w-5 text-brand" />
          <h2 className="text-lg font-semibold">{t("fluidDuration")}</h2>
        </div>
        <div className="space-y-4">
          <div>
            <Label className="label-clinical">{t("bagsCount")}</Label>
            <div className="mt-1 grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant={bags === String(n) ? "default" : "outline"}
                  className={
                    bags === String(n)
                      ? "h-10 bg-brand hover:bg-brand/90 text-brand-foreground"
                      : "h-10"
                  }
                  onClick={() => setBags(String(n))}
                >
                  {n}
                </Button>
              ))}
            </div>
            <Input
              type="number"
              min="1"
              value={bags}
              onChange={(e) => setBags(e.target.value)}
              className="mt-2 h-9"
              placeholder="Or type custom count"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="label-clinical">{t("bagSize")}</Label>
              <Input type="number" value={bagSize} onChange={(e) => setBagSize(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="label-clinical">{t("dripRate")}</Label>
              <Input type="number" value={dripRate} onChange={(e) => setDripRate(e.target.value)} className="mt-1" />
            </div>
          </div>
          <StartTimeInput value={startTime} onChange={setStartTime} />
        </div>
      </Card>

      <div className="lg:col-span-3 space-y-4">
        {highRate && (
          <Alert className="border-danger/50 bg-danger/10">
            <AlertTriangle className="h-4 w-4 text-danger" />
            <AlertTitle className="text-danger">{t("highFlowRate")}</AlertTitle>
            <AlertDescription>{t("highRateWarn")}</AlertDescription>
          </Alert>
        )}

        {result && (
          <Card className="clinical-card p-6 print-area">
            <PrintHeader />
            <div className="print-title hidden print:block">
              IV Fluid {bagSize}ml × {bags} @ {dripRate} ml/hr
            </div>

            <div className="flex items-center gap-2 mb-4 no-print">
              <Clock className="h-5 w-5 text-success" />
              <h2 className="text-lg font-semibold">{t("schedule")}</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 no-print">
              <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                <div className="label-clinical">{t("durationPerBag")}</div>
                <div className="text-xl font-bold mt-1">{fmtDuration(result.perBagMin)}</div>
              </div>
              <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-200">
                <div className="label-clinical text-emerald-700">{t("totalDuration")}</div>
                <div className="text-xl font-bold text-emerald-700 mt-1">
                  {fmtDuration(result.totalMin)}
                </div>
              </div>
            </div>

            <div className="print-section">
              <h3 className="font-semibold mb-2">{t("timeline")}</h3>
              <div className="space-y-1.5">
                {result.sets.map((s) => (
                  <div
                    key={s.n}
                    className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1 last:border-0"
                  >
                    <span className="font-medium">
                      {t("setRunsOut")} {s.n} {t("runsOut")}
                    </span>
                    <span className="font-mono font-bold">{fmtTime(s.out)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        <div className="flex gap-2 no-print">
          <Button onClick={handlePrint} className="w-full bg-brand hover:bg-brand/90 text-brand-foreground">
            <Printer className="h-4 w-4 mr-2" /> {t("printSticker")}
          </Button>
        </div>
      </div>
    </div>
  );
};
