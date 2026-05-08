import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Clock, Printer, AlertTriangle, Droplet, Syringe } from "lucide-react";
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
  d.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const fmtDuration = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h} h ${m} min`;
};

export const InfusionCalculator = () => {
  const { t } = useI18n();
  const { logActivity } = useAuth();
  const [criticalMode, setCriticalMode] = useState(true);
  const [startTime, setStartTime] = useState(nowLocalIso());

  const [drugAmount, setDrugAmount] = useState("4");
  const [unit, setUnit] = useState<"mg" | "mcg">("mg");
  const [vials, setVials] = useState("1");
  const [baseVol, setBaseVol] = useState("100");
  const [weight, setWeight] = useState("60");
  const [rate, setRate] = useState("0.1");
  // mcg/kg/min | mcg/min | mg/kg/min | mg/min | mg/hr
  const [rateUnit, setRateUnit] = useState<
    "mcg/kg/min" | "mcg/kg/hr" | "mcg/min" | "mg/kg/min" | "mg/min" | "mg/hr"
  >("mcg/kg/min");

  const [totalVol, setTotalVol] = useState("1000");
  const [dripRate, setDripRate] = useState("80");

  useEffect(() => {
    setStartTime(nowLocalIso());
  }, [criticalMode]);

  const critical = useMemo(() => {
    const da = parseFloat(drugAmount);
    const v = parseFloat(vials);
    const bv = parseFloat(baseVol);
    const w = parseFloat(weight);
    const r = parseFloat(rate);
    if (!da || !v || !bv || !w || !r) return null;
    const totalMcg = da * v * (unit === "mg" ? 1000 : 1);
    // Convert rate -> mcg/min
    let consumptionPerMin = 0;
    switch (rateUnit) {
      case "mcg/kg/min": consumptionPerMin = r * w; break;
      case "mcg/kg/hr":  consumptionPerMin = (r * w) / 60; break;
      case "mcg/min":    consumptionPerMin = r; break;
      case "mg/kg/min":  consumptionPerMin = r * w * 1000; break;
      case "mg/min":     consumptionPerMin = r * 1000; break;
      case "mg/hr":      consumptionPerMin = (r * 1000) / 60; break;
    }
    const durationMin = totalMcg / consumptionPerMin;
    const start = new Date(startTime);
    const sets = [1, 2, 3].map((i) => ({
      n: i,
      out: new Date(start.getTime() + durationMin * i * 60_000),
    }));
    return { totalMcg, consumptionPerMin, durationMin, sets, start };
  }, [drugAmount, unit, vials, baseVol, weight, rate, rateUnit, startTime]);

  const standard = useMemo(() => {
    const tv = parseFloat(totalVol);
    const dr = parseFloat(dripRate);
    if (!tv || !dr) return null;
    const durationMin = (tv / dr) * 60;
    const start = new Date(startTime);
    const out = new Date(start.getTime() + durationMin * 60_000);
    return { durationMin, out, start };
  }, [totalVol, dripRate, startTime]);

  const highRate = !criticalMode && standard && parseFloat(dripRate) > 250;
  const highDrugRate =
    criticalMode && critical && critical.consumptionPerMin > 50 && parseFloat(rate) > 0.5;

  const handlePrint = () => {
    logActivity("print_infusion", {
      mode: criticalMode ? "critical" : "standard",
      ...(criticalMode
        ? { drug: drugAmount + unit, vials, weight, rate }
        : { totalVol, dripRate }),
    });
    window.print();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="clinical-card p-6 lg:col-span-2 no-print">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            {criticalMode ? (
              <Syringe className="h-5 w-5 text-brand" />
            ) : (
              <Droplet className="h-5 w-5 text-brand" />
            )}
            <h2 className="text-lg font-semibold">
              {criticalMode ? t("criticalDrug") : t("standardIV")}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{t("weightBased")}</span>
            <Switch checked={criticalMode} onCheckedChange={setCriticalMode} />
          </div>
        </div>

        {criticalMode ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label className="label-clinical">{t("drugPerVial")}</Label>
                <Input
                  type="number"
                  value={drugAmount}
                  onChange={(e) => setDrugAmount(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="label-clinical">{t("unit")}</Label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as "mg" | "mcg")}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="mg">mg</option>
                  <option value="mcg">mcg</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="label-clinical">{t("vialsAmps")}</Label>
                <Input
                  type="number"
                  value={vials}
                  onChange={(e) => setVials(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="label-clinical">{t("baseVol")}</Label>
                <Input
                  type="number"
                  value={baseVol}
                  onChange={(e) => setBaseVol(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="label-clinical">{t("weight")}</Label>
                <Input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="label-clinical">{t("rate")}</Label>
                <div className="mt-1 flex gap-1">
                  <Input
                    type="number"
                    step="0.01"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="flex-1"
                  />
                  <select
                    value={rateUnit}
                    onChange={(e) => setRateUnit(e.target.value as typeof rateUnit)}
                    className="h-10 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="mcg/kg/min">mcg/kg/min</option>
                    <option value="mcg/kg/hr">mcg/kg/hr</option>
                    <option value="mcg/min">mcg/min</option>
                    <option value="mg/kg/min">mg/kg/min</option>
                    <option value="mg/min">mg/min</option>
                    <option value="mg/hr">mg/hr</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="label-clinical">{t("totalVolume")}</Label>
              <Input
                type="number"
                value={totalVol}
                onChange={(e) => setTotalVol(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="label-clinical">{t("dripRate")}</Label>
              <Input
                type="number"
                value={dripRate}
                onChange={(e) => setDripRate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        )}

        <div className="mt-4">
          <StartTimeInput value={startTime} onChange={setStartTime} />
        </div>
      </Card>

      <div className="lg:col-span-3 space-y-4">
        {(highRate || highDrugRate) && (
          <Alert className="border-danger/50 bg-danger/10">
            <AlertTriangle className="h-4 w-4 text-danger" />
            <AlertTitle className="text-danger">{t("highFlowRate")}</AlertTitle>
            <AlertDescription>
              {highRate && t("highRateWarn")}
              {highDrugRate && t("highDrugWarn")}
            </AlertDescription>
          </Alert>
        )}

        <Card className="clinical-card p-6 print-area">
          <PrintHeader />
          <div className="print-title hidden print:block">
            {criticalMode ? "Critical Infusion" : "IV Fluid"} —{" "}
            {fmtTime(new Date(startTime))}
          </div>

          <div className="flex items-center gap-2 mb-4 no-print">
            <Clock className="h-5 w-5 text-success" />
            <h2 className="text-lg font-semibold">{t("schedule")}</h2>
          </div>

          {criticalMode && critical && (
            <>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                  <div className="label-clinical">{t("totalDrug")}</div>
                  <div className="text-xl font-bold mt-1">
                    {(critical.totalMcg / 1000).toFixed(2)}{" "}
                    <span className="text-sm font-medium text-slate-500">mg</span>
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                  <div className="label-clinical">{t("consumption")}</div>
                  <div className="text-xl font-bold mt-1">
                    {critical.consumptionPerMin.toFixed(1)}{" "}
                    <span className="text-sm font-medium text-slate-500">mcg/min</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 mb-6">
                <div className="label-clinical text-emerald-700">{t("durationPerBag")}</div>
                <div className="text-2xl font-bold text-emerald-700 mt-1">
                  {fmtDuration(critical.durationMin)}
                </div>
              </div>

              <div className="print-section">
                <h3 className="font-semibold mb-2">{t("timeline")}</h3>
                <div className="space-y-2">
                  {critical.sets.map((s) => (
                    <div
                      key={s.n}
                      className="flex justify-between items-center border-b border-dashed border-slate-200 pb-2 last:border-0"
                    >
                      <span className="font-medium">
                        {t("setRunsOut")} {s.n} {t("runsOut")}
                      </span>
                      <span className="font-mono font-bold">{fmtTime(s.out)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {!criticalMode && standard && (
            <>
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 mb-4">
                <div className="label-clinical text-emerald-700">{t("fluidRunsOutIn")}</div>
                <div className="text-2xl font-bold text-emerald-700 mt-1">
                  {fmtDuration(standard.durationMin)}
                </div>
              </div>
              <div className="print-section">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{t("estimatedRunout")}</span>
                  <span className="font-mono font-bold text-lg">
                    {fmtTime(standard.out)}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2 text-sm text-slate-600">
                  <span>{t("started")}</span>
                  <span className="font-mono">{fmtTime(standard.start)}</span>
                </div>
              </div>
            </>
          )}
        </Card>

        <div className="flex gap-2 no-print">
          <Button
            onClick={handlePrint}
            className="w-full bg-brand hover:bg-brand/90 text-brand-foreground"
          >
            <Printer className="h-4 w-4 mr-2" /> {t("printSticker")}
          </Button>
        </div>
      </div>
    </div>
  );
};
