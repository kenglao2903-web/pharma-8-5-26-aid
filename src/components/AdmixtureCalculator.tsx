import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Beaker, Printer, AlertTriangle, CheckCircle2, GitMerge } from "lucide-react";
import { PrintHeader } from "./PrintHeader";
import { BASE_FLUIDS, ADDITIVES, DILUENTS } from "@/lib/fluids";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

type Mode = "dextrose-concentrate" | "dextrose-dilute" | "nacl-dilute";

// Format Date as "DD/MM/YY HH:mm"
const fmtDateTime = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const dd = pad(d.getDate());
  const mm = pad(d.getMonth() + 1);
  const yy = pad(d.getFullYear() % 100);
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
};

// Local datetime-local input value (YYYY-MM-DDTHH:mm) from a Date
const toLocalIso = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Alligation diagram component (Alligation Alternate)
type AlligationProps = {
  highPct: number;
  highLabel: string;
  lowPct: number;
  lowLabel: string;
  targetPct: number;
  units: string; // "%"
  large?: boolean;
  totalVol?: number;       // final bag volume (ml)
  volHigh?: number;        // ml of high (additive) to add
  volLow?: number;         // ml of low (base) to remain in bag
  withdrawFromBag?: number;// ml to withdraw from base bag before injecting
};

const AlligationDiagram = ({
  highPct, highLabel, lowPct, lowLabel, targetPct, units = "%", large,
  totalVol, volHigh, volLow, withdrawFromBag,
}: AlligationProps) => {
  const partsHigh = Math.max(0, targetPct - lowPct); // diagonal: high gets (target - low)
  const partsLow = Math.max(0, highPct - targetPct); // diagonal: low gets (high - target)
  const totalParts = partsHigh + partsLow;
  const ratioHigh = totalParts > 0 ? (partsHigh / totalParts) * 100 : 0;
  const ratioLow = totalParts > 0 ? (partsLow / totalParts) * 100 : 0;
  const sz = large ? "text-base" : "text-sm";
  const num = large ? "text-3xl" : "text-xl";
  const hasVolumes = totalVol != null && volHigh != null && volLow != null && withdrawFromBag != null;

  return (
    <div className={`w-full ${sz}`}>
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 sm:gap-4">
        {/* Left column: source concentrations */}
        <div className="space-y-3">
          <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-3 text-center">
            <div className="text-xs text-emerald-700 font-semibold uppercase tracking-wide">High</div>
            <div className={`${num} font-bold text-emerald-700`}>{highPct}{units}</div>
            <div className="text-xs text-emerald-700/80 mt-1 truncate" title={highLabel}>{highLabel}</div>
          </div>
          <div className="rounded-lg border-2 border-sky-300 bg-sky-50 p-3 text-center">
            <div className="text-xs text-sky-700 font-semibold uppercase tracking-wide">Low</div>
            <div className={`${num} font-bold text-sky-700`}>{lowPct}{units}</div>
            <div className="text-xs text-sky-700/80 mt-1 truncate" title={lowLabel}>{lowLabel}</div>
          </div>
        </div>

        {/* SVG diagonals */}
        <svg viewBox="0 0 100 120" className={large ? "h-40 w-20" : "h-24 w-14"} preserveAspectRatio="none">
          <line x1="5" y1="20" x2="95" y2="100" stroke="hsl(var(--brand))" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="5" y1="100" x2="95" y2="20" stroke="hsl(var(--brand))" strokeWidth="2.5" strokeLinecap="round" />
        </svg>

        {/* Center: target */}
        <div className="rounded-lg border-2 border-brand bg-brand/10 p-3 text-center">
          <div className="text-xs text-brand font-semibold uppercase tracking-wide">Target</div>
          <div className={`${num} font-bold text-brand`}>{targetPct}{units}</div>
          <div className="text-xs text-brand/80 mt-1">Final concentration</div>
        </div>

        {/* Arrows */}
        <svg viewBox="0 0 60 120" className={large ? "h-40 w-12" : "h-24 w-8"} preserveAspectRatio="none">
          <line x1="5" y1="20" x2="50" y2="20" stroke="#475569" strokeWidth="2" />
          <polygon points="50,15 58,20 50,25" fill="#475569" />
          <line x1="5" y1="100" x2="50" y2="100" stroke="#475569" strokeWidth="2" />
          <polygon points="50,95 58,100 50,105" fill="#475569" />
        </svg>

        {/* Right column: parts */}
        <div className="space-y-3">
          <div className="rounded-lg border border-emerald-300 bg-white p-3 text-center">
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Parts of High</div>
            <div className={`${num} font-bold text-emerald-700`}>{partsHigh.toFixed(2)}</div>
            <div className="text-xs text-slate-500 mt-1">= |{targetPct} − {lowPct}| · {ratioHigh.toFixed(1)}%</div>
          </div>
          <div className="rounded-lg border border-sky-300 bg-white p-3 text-center">
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Parts of Low</div>
            <div className={`${num} font-bold text-sky-700`}>{partsLow.toFixed(2)}</div>
            <div className="text-xs text-slate-500 mt-1">= |{highPct} − {targetPct}| · {ratioLow.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
        <b>Alligation Alternate:</b> subtract along each diagonal. The result is the
        ratio of <span className="text-emerald-700 font-semibold">High</span> to{" "}
        <span className="text-sky-700 font-semibold">Low</span> needed to reach the target —{" "}
        <b>{partsHigh.toFixed(2)} : {partsLow.toFixed(2)}</b>.
      </div>

      {hasVolumes && (
        <div className="mt-4 space-y-3">
          {/* Step-by-step process */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              Full Process — Scale ratio to {totalVol} ml total
            </div>
            <ol className="space-y-2 text-sm text-slate-700 list-decimal list-inside">
              <li>
                Total parts = {partsHigh.toFixed(2)} + {partsLow.toFixed(2)} ={" "}
                <b>{totalParts.toFixed(2)}</b>
              </li>
              <li>
                Volume of <span className="text-emerald-700 font-semibold">{highLabel}</span> ={" "}
                ({partsHigh.toFixed(2)} ÷ {totalParts.toFixed(2)}) × {totalVol} ={" "}
                <b className="text-emerald-700">{volHigh!.toFixed(2)} ml</b>
              </li>
              <li>
                Volume of <span className="text-sky-700 font-semibold">{lowLabel}</span> remaining ={" "}
                ({partsLow.toFixed(2)} ÷ {totalParts.toFixed(2)}) × {totalVol} ={" "}
                <b className="text-sky-700">{volLow!.toFixed(2)} ml</b>
              </li>
              <li>
                Withdraw from {lowLabel} bag = {totalVol} − {volLow!.toFixed(2)} ={" "}
                <b>{withdrawFromBag!.toFixed(2)} ml</b> (discard)
              </li>
              <li>
                Inject <b className="text-emerald-700">{volHigh!.toFixed(2)} ml</b> of{" "}
                {highLabel} into the bag → final volume {totalVol} ml at {targetPct}%
              </li>
            </ol>
          </div>

          {/* Conclusion */}
          <div className="rounded-lg border-2 border-brand bg-brand/5 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-brand mb-3">
              ✓ Conclusion — Exact Amounts
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-md bg-white border border-slate-200 p-3 text-center">
                <div className="text-xs text-slate-500 uppercase">Withdraw &amp; discard</div>
                <div className={`${num} font-bold text-slate-800`}>{withdrawFromBag!.toFixed(2)} <span className="text-sm">ml</span></div>
                <div className="text-xs text-slate-500 mt-1">from {lowLabel} bag</div>
              </div>
              <div className="rounded-md bg-emerald-50 border border-emerald-300 p-3 text-center">
                <div className="text-xs text-emerald-700 uppercase">Add (mix in)</div>
                <div className={`${num} font-bold text-emerald-700`}>{volHigh!.toFixed(2)} <span className="text-sm">ml</span></div>
                <div className="text-xs text-emerald-700/80 mt-1">of {highLabel}</div>
              </div>
              <div className="rounded-md bg-brand/10 border border-brand p-3 text-center">
                <div className="text-xs text-brand uppercase">Final bag</div>
                <div className={`${num} font-bold text-brand`}>{totalVol} <span className="text-sm">ml</span></div>
                <div className="text-xs text-brand/80 mt-1">@ {targetPct}{units}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const AdmixtureCalculator = () => {
  const { t } = useI18n();
  const { logActivity } = useAuth();
  const [mode, setMode] = useState<Mode>("dextrose-concentrate");
  const [targetPct, setTargetPct] = useState("7.5");
  const [targetVol, setTargetVol] = useState("500");
  const [baseKey, setBaseKey] = useState("D5S");
  const [additiveKey, setAdditiveKey] = useState("D50");
  const [diluentKey, setDiluentKey] = useState("Sterile Water");

  // Diagram fullscreen toggle (only opens on demand)
  const [diagramOpen, setDiagramOpen] = useState(false);

  const isDextrose = mode.startsWith("dextrose");
  const isDilution = mode.endsWith("dilute");

  const result = useMemo(() => {
    const tp = parseFloat(targetPct);
    const tv = parseFloat(targetVol);
    const base = BASE_FLUIDS.find((b) => b.value === baseKey)!;
    if (!tp || !tv || isNaN(tp) || isNaN(tv) || !base) return null;

    const basePct = isDextrose ? base.dextrose : base.nacl;

    if (mode === "dextrose-concentrate") {
      const add = ADDITIVES.find((a) => a.value === "D50")!;
      if (tp <= basePct || tp >= add.percent) {
        return { error: `Target % must be between ${basePct}% and ${add.percent}%.` };
      }
      const partsAdditive = tp - basePct;
      const partsBase = add.percent - tp;
      const totalParts = partsAdditive + partsBase;
      const volAdditive = (partsAdditive / totalParts) * tv;
      const volBase = (partsBase / totalParts) * tv;
      const vialsNeeded = Math.ceil(volAdditive / add.vialSize);
      const totalDrawn = vialsNeeded * add.vialSize;
      const discardFromVials = totalDrawn - volAdditive;
      return {
        kind: "concentrate" as const,
        tp, tv, base, add,
        volAdditive, volBase,
        vialsNeeded, discardFromVials,
        withdrawFromBag: tv - volBase,
      };
    }

    const dil = DILUENTS.find((d) => d.value === diluentKey)!;
    const dilPct = isDextrose ? dil.dextrose : dil.nacl;
    if (tp >= basePct) {
      return { error: `Dilution: target % must be lower than base (${basePct}%).` };
    }
    if (tp < dilPct) {
      return { error: `Target % cannot be lower than diluent (${dilPct}%).` };
    }
    const Vbase = ((tp - dilPct) * tv) / (basePct - dilPct);
    const Vdil = tv - Vbase;
    return {
      kind: "dilute" as const,
      tp, tv, base, dil,
      volBaseRemaining: Vbase,
      withdrawFromBag: Vdil,
      volDiluent: Vdil,
      labelSuffix: isDextrose ? "Dextrose" : "NaCl",
    };
  }, [targetPct, targetVol, baseKey, additiveKey, diluentKey, mode, isDextrose]);

  const overBag = result && !("error" in result) && result.tv > 1000;
  const heavyAdditive =
    result && !("error" in result) && result.kind === "concentrate" && result.volAdditive > 100;

  // Build alligation values — ALWAYS compares 50% Dextrose (additive) vs the
  // selected base fluid (source). Only meaningful in the concentrate workflow.
  const alligation = useMemo(() => {
    if (!result || "error" in result) return null;
    if (result.kind !== "concentrate") return null;
    return {
      highPct: result.add.percent, // 50% Dextrose
      highLabel: result.add.label.split(" (")[0],
      lowPct: result.base.dextrose, // base fluid dextrose %
      lowLabel: result.base.label.split(" (")[0],
      targetPct: result.tp,
      totalVol: result.tv,
      volHigh: result.volAdditive,
      volLow: result.volBase,
      withdrawFromBag: result.withdrawFromBag,
    };
  }, [result]);

  const handlePrint = () => {
    logActivity("print_admixture", {
      mode,
      target_pct: parseFloat(targetPct),
      target_vol: parseFloat(targetVol),
      base: baseKey,
    });
    window.print();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="clinical-card p-6 lg:col-span-2 no-print">
        <div className="flex items-center gap-2 mb-4">
          <Beaker className="h-5 w-5 text-brand" />
          <h2 className="text-lg font-semibold">{t("inputs")}</h2>
        </div>

        <div className="mb-5">
          <Label className="label-clinical">{t("admixtureType")}</Label>
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="mt-2">
            <TabsList className="grid grid-cols-1 sm:grid-cols-3 w-full h-auto gap-2 rounded-xl bg-muted/60 p-1.5 border border-border">
              <TabsTrigger
                value="dextrose-concentrate"
                className="w-full min-h-[44px] whitespace-normal text-center leading-tight text-xs sm:text-sm px-3 py-2.5 rounded-lg font-medium transition-all data-[state=active]:bg-brand data-[state=active]:text-brand-foreground data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground hover:data-[state=inactive]:bg-background/60"
              >
                {t("dextroseAdjust")}
              </TabsTrigger>
              <TabsTrigger
                value="dextrose-dilute"
                className="w-full min-h-[44px] whitespace-normal text-center leading-tight text-xs sm:text-sm px-3 py-2.5 rounded-lg font-medium transition-all data-[state=active]:bg-brand data-[state=active]:text-brand-foreground data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground hover:data-[state=inactive]:bg-background/60"
              >
                {t("dextroseDilute")}
              </TabsTrigger>
              <TabsTrigger
                value="nacl-dilute"
                className="w-full min-h-[44px] whitespace-normal text-center leading-tight text-xs sm:text-sm px-3 py-2.5 rounded-lg font-medium transition-all data-[state=active]:bg-brand data-[state=active]:text-brand-foreground data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground hover:data-[state=inactive]:bg-background/60"
              >
                {t("naclAdjust")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="mt-2 text-xs text-muted-foreground">{t("dextroseModeHelp")}</p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="label-clinical">{t("targetPct")}</Label>
              <Input
                type="number"
                step="0.01"
                value={targetPct}
                onChange={(e) => setTargetPct(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="label-clinical">{t("targetVolume")}</Label>
              <Input
                type="number"
                value={targetVol}
                onChange={(e) => setTargetVol(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label className="label-clinical">{t("baseFluid")}</Label>
            <Select value={baseKey} onValueChange={setBaseKey}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BASE_FLUIDS.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === "dextrose-concentrate" ? (
            <div>
              <Label className="label-clinical">{t("additive")}</Label>
              <Select value={additiveKey} onValueChange={setAdditiveKey}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADDITIVES.filter((a) => a.type === "dextrose").map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label className="label-clinical">{t("diluent")}</Label>
              <Select value={diluentKey} onValueChange={setDiluentKey}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DILUENTS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

        </div>
      </Card>

      <div className="lg:col-span-3 space-y-4">
        {result && "error" in result && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t("invalidRange")}</AlertTitle>
            <AlertDescription>{result.error}</AlertDescription>
          </Alert>
        )}

        {result && !("error" in result) && (
          <>
            {(overBag || heavyAdditive) && (
              <Alert className="border-warning/50 bg-warning/10 text-foreground">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertTitle className="text-warning">{t("caution")}</AlertTitle>
                <AlertDescription>
                  {overBag && t("overBagWarn")}
                  {heavyAdditive && t("heavyAdditiveWarn")}
                </AlertDescription>
              </Alert>
            )}

            {/* Alligation diagram is hidden — opens via small button next to result. */}

            <Card className="clinical-card p-6 print-area">
              <PrintHeader />
              <div className="print-title hidden print:block">
                {(isDextrose ? result.base.dextrose : result.base.nacl)}% → {result.tp}{isDextrose ? "%" : "%"} {result.kind === "dilute" ? result.labelSuffix : (isDextrose ? "Dextrose" : "NaCl")} × {result.tv} ml
              </div>
              <div className="print-header hidden print:flex justify-between items-center">
                <span>INITIAL: {(isDextrose ? result.base.dextrose : result.base.nacl)}%</span>
                <span>→</span>
                <span>FINAL: {result.tp}%</span>
              </div>

              <div className="flex items-center justify-between gap-2 mb-4 no-print">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <h2 className="text-lg font-semibold">{t("result")}</h2>
                </div>
                {alligation && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDiagramOpen(true)}
                    title="Show alligation diagram (50% Dextrose vs base fluid)"
                  >
                    <GitMerge className="h-4 w-4 mr-1" /> Alligation
                  </Button>
                )}
              </div>

              {result.kind === "concentrate" && (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-6 no-print">
                    <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                      <div className="label-clinical">{t("withdrawFromBag")}</div>
                      <div className="text-2xl font-bold mt-1">
                        {result.withdrawFromBag.toFixed(1)}{" "}
                        <span className="text-sm font-medium text-slate-500">ml</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{t("discardBeforeAdding")}</div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-200">
                      <div className="label-clinical text-emerald-700">{t("addAdditive")}</div>
                      <div className="text-2xl font-bold text-emerald-700 mt-1">
                        {result.volAdditive.toFixed(1)}{" "}
                        <span className="text-sm font-medium">ml</span>
                      </div>
                      <div className="text-xs text-emerald-700/80 mt-1">
                        {result.add.label.split(" (")[0]}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4 mb-6 no-print">
                    <div className="label-clinical mb-1">{t("totalVials")}</div>
                    <div className="text-base">
                      <span className="font-bold">{result.vialsNeeded}</span> ×{" "}
                      {result.add.vialSize} ml → {t("discard")}{" "}
                      <span className="font-bold">{result.discardFromVials.toFixed(1)} ml</span>{" "}
                      {t("excess")}
                    </div>
                  </div>

                  <div className="print-section">
                    <h3 className="font-semibold mb-2">{t("stepGuide")}</h3>
                    <ol className="space-y-1.5 text-sm">
                      <li>
                        <span className="font-bold">{t("step")} 1:</span> {t("stepPrepBag")}{" "}
                        {result.base.label.split(" (")[0]} ({result.tv} ml).
                      </li>
                      <li>
                        <span className="font-bold">{t("step")} 2:</span> {t("stepWithdraw")}{" "}
                        <b>{result.withdrawFromBag.toFixed(1)} ml</b> {t("stepFromBag")}.
                      </li>
                      <li>
                        <span className="font-bold">{t("step")} 3:</span> {t("stepDraw")}{" "}
                        <b>{result.volAdditive.toFixed(1)} ml</b> {t("stepFromVials")}{" "}
                        <b>{result.vialsNeeded}</b> × {result.add.vialSize} ml{" "}
                        {t("stepVialOf")} {result.add.label.split(" (")[0]}.
                      </li>
                      <li>
                        <span className="font-bold">{t("step")} 4:</span> {t("stepInject")}
                      </li>
                    </ol>
                    <div className="print-timestamp hidden print:block mt-2 pt-2 border-t border-dashed border-black text-xs">
                      <b>Printed:</b> {fmtDateTime(new Date())}
                    </div>
                  </div>
                </>
              )}

              {result.kind === "dilute" && (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-6 no-print">
                    <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                      <div className="label-clinical">{t("withdrawFromBag")}</div>
                      <div className="text-2xl font-bold mt-1">
                        {result.withdrawFromBag.toFixed(1)}{" "}
                        <span className="text-sm font-medium text-slate-500">ml</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {result.base.label.split(" (")[0]} • {t("discardBeforeAdding")}
                      </div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-200">
                      <div className="label-clinical text-emerald-700">{t("diluent")}</div>
                      <div className="text-2xl font-bold text-emerald-700 mt-1">
                        {result.volDiluent.toFixed(1)}{" "}
                        <span className="text-sm font-medium">ml</span>
                      </div>
                      <div className="text-xs text-emerald-700/80 mt-1">{result.dil.label}</div>
                    </div>
                  </div>

                  <div className="print-section">
                    <h3 className="font-semibold mb-2">{t("stepGuide")}</h3>
                    <ol className="space-y-1.5 text-sm">
                      <li>
                        <span className="font-bold">{t("step")} 1:</span> {t("stepPrepBag")}{" "}
                        {result.base.label.split(" (")[0]} ({result.tv} ml).
                      </li>
                      <li>
                        <span className="font-bold">{t("step")} 2:</span> {t("stepWithdraw")}{" "}
                        <b>{result.withdrawFromBag.toFixed(1)} ml</b> {t("stepFromBag")}.
                      </li>
                      <li>
                        <span className="font-bold">{t("step")} 3:</span> {t("stepDraw")}{" "}
                        <b>{result.volDiluent.toFixed(1)} ml</b> {t("stepFromVials")}{" "}
                        {result.dil.label}.
                      </li>
                      <li>
                        <span className="font-bold">{t("step")} 4:</span> {t("stepInject")}
                      </li>
                    </ol>
                    <div className="print-timestamp hidden print:block mt-2 pt-2 border-t border-dashed border-black text-xs">
                      <b>Printed:</b> {fmtDateTime(new Date())}
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
          </>
        )}
      </div>

      {/* Fullscreen alligation diagram */}
      <Dialog open={diagramOpen} onOpenChange={setDiagramOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5 text-brand" /> Alligation Alternate — Full View
            </DialogTitle>
          </DialogHeader>
          {alligation && <AlligationDiagram {...alligation} units="%" large />}
        </DialogContent>
      </Dialog>
    </div>
  );
};
