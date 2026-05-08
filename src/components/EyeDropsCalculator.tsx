import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { Clock, Copy, Eye, FileDown, Maximize2, Minimize2, Pill, RotateCcw, ShieldAlert, X } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import bphLogo from "@/assets/bangkok-hospital-logo.png";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const toLocalIso = (d: Date) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};
const todayIso = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

type FreqMode = "preset" | "every" | "custom";

const PRESET_FREQ = [
  { value: "1", labelEn: "OD", subEn: "Once daily", labelTh: "วันละครั้ง", subTh: "1 ครั้ง/วัน" },
  { value: "2", labelEn: "BID", subEn: "Twice daily", labelTh: "วันละ 2 ครั้ง", subTh: "ทุก 12 ชม." },
  { value: "3", labelEn: "TID", subEn: "Three times daily", labelTh: "วันละ 3 ครั้ง", subTh: "ทุก 8 ชม." },
  { value: "4", labelEn: "QID", subEn: "Four times daily", labelTh: "วันละ 4 ครั้ง", subTh: "ทุก 6 ชม." },
] as const;

export function EyeDropsCalculator() {
  const { lang } = useI18n();
  const { logActivity } = useAuth();
  const TH = lang === "th";

  const [drugName, setDrugName] = useState("");
  const [dose, setDose] = useState("1"); // drops per administration
  const [freqMode, setFreqMode] = useState<FreqMode>("preset");
  const [freqPreset, setFreqPreset] = useState<string>("3");
  const [everyHours, setEveryHours] = useState<string>("4");
  const [freqCustom, setFreqCustom] = useState<string>("");
  const [duration, setDuration] = useState("");
  const [stability, setStability] = useState("");
  const [prepTime, setPrepTime] = useState<string>(() => toLocalIso(new Date()));
  const [treatmentStart, setTreatmentStart] = useState<string>(todayIso);
  const [showPrepPicker, setShowPrepPicker] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const dosesPerDay = useMemo(() => {
    if (freqMode === "preset") return parseFloat(freqPreset);
    if (freqMode === "every") {
      const h = parseFloat(everyHours);
      return h > 0 ? 24 / h : NaN;
    }
    return NaN; // custom free-text: not numeric
  }, [freqMode, freqPreset, everyHours]);

  const numbers = useMemo(() => ({
    d: parseFloat(dose),
    f: dosesPerDay,
    dur: parseFloat(duration),
    stab: stability.trim() === "" ? Infinity : parseFloat(stability),
  }), [dose, dosesPerDay, duration, stability]);

  const errors = useMemo(() => {
    const e: string[] = [];
    const { d, dur, stab } = numbers;
    if (!(d > 0)) e.push(TH ? "ขนาดยา/ครั้ง ต้องมากกว่า 0" : "Dose must be > 0");
    if (freqMode !== "custom" && !(numbers.f > 0)) e.push(TH ? "ความถี่ ต้องมากกว่า 0" : "Frequency must be > 0");
    if (freqMode === "custom" && !freqCustom.trim()) e.push(TH ? "กรุณากรอกความถี่" : "Please enter frequency");
    if (!(dur > 0)) e.push(TH ? "ระยะเวลา ต้องมากกว่า 0" : "Duration must be > 0");
    if (stability.trim() !== "" && !(stab > 0)) e.push(TH ? "อายุความคงตัว ต้องมากกว่า 0" : "Stability must be > 0");
    return e;
  }, [numbers, TH, stability, freqMode, freqCustom]);

  const result = useMemo(() => {
    if (errors.length) return null;
    const { d, f, dur, stab } = numbers;
    if (freqMode === "custom") {
      return { dailyDrops: NaN, totalDays: dur, bottlesNeeded: 1, daysPerBottle: Number.isFinite(stab) ? stab : dur };
    }
    const dailyDrops = d * f;
    const daysPerBottle = Number.isFinite(stab) ? Math.min(stab, dur) : dur;
    const bottlesNeeded = Number.isFinite(stab) && stab > 0 ? Math.max(1, Math.ceil(dur / stab)) : 1;
    return { dailyDrops, totalDays: dur, bottlesNeeded, daysPerBottle };
  }, [errors.length, numbers, freqMode]);

  const reset = () => {
    setDrugName("");
    setDose("1");
    setFreqMode("preset");
    setFreqPreset("3");
    setEveryHours("4");
    setFreqCustom("");
    setDuration("");
    setStability("");
    setPrepTime(toLocalIso(new Date()));
    setTreatmentStart(todayIso());
  };

  const setPrepNow = () => setPrepTime(toLocalIso(new Date()));
  const addPrepMin = (m: number) => {
    const base = prepTime ? new Date(prepTime) : new Date();
    base.setMinutes(base.getMinutes() + m);
    setPrepTime(toLocalIso(base));
  };
  const prepDisplay = prepTime
    ? new Date(prepTime).toLocaleString(TH ? "th-TH" : "en-GB", {
        weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      })
    : "—";

  const freqLabel = useMemo(() => {
    if (freqMode === "preset") {
      const opt = PRESET_FREQ.find((o) => o.value === freqPreset);
      return TH ? (opt?.labelTh ?? `วันละ ${freqPreset} ครั้ง`) : (opt?.subEn?.toLowerCase() ?? `${freqPreset} times daily`);
    }
    if (freqMode === "every") return TH ? `ทุก ${everyHours} ชั่วโมง` : `every ${everyHours} hours`;
    return freqCustom.trim();
  }, [freqMode, freqPreset, everyHours, freqCustom, TH]);

  const instruction = useMemo(() => {
    const { d } = numbers;
    if (!(d > 0) || !freqLabel) return "";
    return TH
      ? `หยอดตา ${d} หยด ${freqLabel}`
      : `Instill ${d} drop${d > 1 ? "s" : ""} ${freqLabel}`;
  }, [numbers, freqLabel, TH]);

  const expiration = useMemo(() => {
    if (!prepTime || !Number.isFinite(numbers.stab)) return null;
    const prep = new Date(prepTime);
    if (isNaN(prep.getTime())) return null;
    const exp = new Date(prep.getTime() + numbers.stab * 24 * 3600 * 1000);
    return { prep, exp };
  }, [prepTime, numbers.stab]);

  const fmtDateTime = (d: Date) =>
    d.toLocaleString(TH ? "th-TH" : "en-GB", {
      day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  const formatDate = (d: Date) =>
    d.toLocaleDateString(TH ? "th-TH" : "en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const copyResult = async () => {
    if (!result) return;
    const text = TH
      ? `ยา: ${drugName || "—"}\nวิธีใช้: ${instruction}\nระยะเวลา: ${result.totalDays} วัน${Number.isFinite(result.dailyDrops) ? `\nหยดต่อวัน: ${result.dailyDrops}` : ""}\nจำนวนขวด: ${result.bottlesNeeded}${expiration ? `\nหมดอายุ: ${fmtDateTime(expiration.exp)}` : ""}`
      : `Drug: ${drugName || "—"}\nSig: ${instruction}\nDuration: ${result.totalDays} days${Number.isFinite(result.dailyDrops) ? `\nDrops/day: ${result.dailyDrops}` : ""}\nBottles required: ${result.bottlesNeeded}${expiration ? `\nExpires: ${fmtDateTime(expiration.exp)}` : ""}`;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: TH ? "คัดลอกแล้ว" : "Copied to clipboard" });
    } catch {
      toast({ title: TH ? "คัดลอกไม่สำเร็จ" : "Copy failed" });
    }
  };

  const handleCalculate = () => {
    if (errors.length || !result) {
      toast({ title: TH ? "กรุณากรอกข้อมูลให้ครบ" : "Please fill in all fields correctly" });
      return;
    }
    logActivity("eye_drops_calc", { bottles: result.bottlesNeeded, days: result.totalDays });
  };

  const pdfRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const openPreview = () => { if (result) setPreviewOpen(true); };

  const exportPDF = async () => {
    if (!result || !pdfRef.current) return;
    setExporting(true);
    const node = pdfRef.current;
    const prev = node.style.cssText;
    node.style.cssText = "position:fixed;top:0;left:-10000px;width:794px;background:#fff;z-index:-1;display:block;";
    try {
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;
      const imgData = canvas.toDataURL("image/png");
      if (imgH <= pageH - margin * 2) {
        pdf.addImage(imgData, "PNG", margin, margin, imgW, imgH);
      } else {
        const pxPerMm = canvas.width / imgW;
        const pageHpx = (pageH - margin * 2) * pxPerMm;
        let rendered = 0; let first = true;
        while (rendered < canvas.height) {
          const sliceH = Math.min(pageHpx, canvas.height - rendered);
          const slice = document.createElement("canvas");
          slice.width = canvas.width; slice.height = sliceH;
          const ctx = slice.getContext("2d")!;
          ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, slice.width, slice.height);
          ctx.drawImage(canvas, 0, rendered, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
          if (!first) pdf.addPage();
          pdf.addImage(slice.toDataURL("image/png"), "PNG", margin, margin, imgW, sliceH / pxPerMm);
          rendered += sliceH; first = false;
        }
      }
      pdf.save(`eye-drops-${new Date().toISOString().slice(0, 10)}.pdf`);
      logActivity("eye_drops_pdf", {});
      toast({ title: TH ? "ส่งออก PDF เรียบร้อย" : "PDF exported" });
    } catch (err) {
      console.error(err);
      toast({ title: TH ? "ส่งออก PDF ไม่สำเร็จ" : "PDF export failed" });
    } finally {
      node.style.cssText = prev;
      setExporting(false);
    }
  };

  const treatmentStartDate = treatmentStart ? new Date(treatmentStart + "T00:00:00") : null;
  const treatmentEndDate = useMemo(() => {
    if (!treatmentStartDate || !(numbers.dur > 0)) return null;
    const d = new Date(treatmentStartDate);
    d.setDate(d.getDate() + Math.ceil(numbers.dur) - 1);
    return d;
  }, [treatmentStartDate, numbers.dur]);

  // Bottle start dates: 1st = treatment start; subsequent = previous + stability days
  const bottleStartDates = useMemo<Date[]>(() => {
    if (!result || !treatmentStartDate) return [];
    const stab = Number.isFinite(numbers.stab) ? numbers.stab : numbers.dur;
    const dates: Date[] = [];
    for (let i = 0; i < result.bottlesNeeded; i++) {
      const d = new Date(treatmentStartDate);
      d.setDate(d.getDate() + Math.round(i * stab));
      dates.push(d);
    }
    return dates;
  }, [result, treatmentStartDate, numbers.stab, numbers.dur]);

  return (
    <>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-brand" />
            {TH ? "คำนวณยาหยอดตา" : "Eye Drops Medication"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="drugName" className="flex items-center gap-2">
              <Pill className="h-4 w-4 text-brand" />
              {TH ? "ชื่อยา (ไม่บังคับ)" : "Medication name (optional)"}
            </Label>
            <Input
              id="drugName"
              value={drugName}
              onChange={(e) => setDrugName(e.target.value)}
              placeholder={TH ? "เช่น Tobramycin eye drops" : "e.g. Tobramycin eye drops"}
            />
          </div>

          <div className="space-y-2">
            <Label>{TH ? "ขนาดต่อครั้ง (หยด)" : "Dose per administration (Drops)"}</Label>
            <ToggleGroup
              type="single"
              value={dose}
              onValueChange={(v) => v && setDose(v)}
              className="grid grid-cols-5 gap-2"
            >
              {["1", "2", "3", "4", "5"].map((n) => (
                <ToggleGroupItem
                  key={n}
                  value={n}
                  className="flex h-auto flex-col items-center gap-0 rounded-md border bg-background py-3 data-[state=on]:bg-brand data-[state=on]:text-primary-foreground data-[state=on]:border-brand"
                >
                  <span className="text-lg font-bold leading-none">{n}</span>
                  <span className="text-[10px] opacity-80 mt-0.5">{TH ? "หยด" : n === "1" ? "drop" : "drops"}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="space-y-2">
            <Label>{TH ? "ความถี่" : "Frequency"}</Label>
            <ToggleGroup
              type="single" value={freqMode}
              onValueChange={(v) => v && setFreqMode(v as FreqMode)}
              className="grid grid-cols-3 gap-2"
            >
              <ToggleGroupItem value="preset" className="h-9 rounded-md border bg-background data-[state=on]:bg-brand data-[state=on]:text-primary-foreground data-[state=on]:border-brand text-xs">
                {TH ? "ค่ามาตรฐาน" : "Standard"}
              </ToggleGroupItem>
              <ToggleGroupItem value="every" className="h-9 rounded-md border bg-background data-[state=on]:bg-brand data-[state=on]:text-primary-foreground data-[state=on]:border-brand text-xs">
                {TH ? "ทุก X ชม." : "Every X hrs"}
              </ToggleGroupItem>
              <ToggleGroupItem value="custom" className="h-9 rounded-md border bg-background data-[state=on]:bg-brand data-[state=on]:text-primary-foreground data-[state=on]:border-brand text-xs">
                {TH ? "กำหนดเอง" : "Custom"}
              </ToggleGroupItem>
            </ToggleGroup>

            {freqMode === "preset" && (
              <ToggleGroup
                type="single" value={freqPreset}
                onValueChange={(v) => v && setFreqPreset(v)}
                className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2"
              >
                {PRESET_FREQ.map((o) => (
                  <ToggleGroupItem
                    key={o.value} value={o.value}
                    className="flex h-auto flex-col items-center gap-0.5 rounded-md border bg-background px-2 py-3 data-[state=on]:bg-brand data-[state=on]:text-primary-foreground data-[state=on]:border-brand"
                  >
                    <span className="text-base font-semibold">{TH ? o.labelTh : o.labelEn}</span>
                    <span className="text-[10px] opacity-80">{TH ? o.subTh : o.subEn}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}

            {freqMode === "every" && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-slate-600">{TH ? "ทุก" : "Every"}</span>
                <Input
                  type="number" inputMode="decimal" min={0}
                  value={everyHours} onChange={(e) => setEveryHours(e.target.value)}
                  className="w-24 h-10" placeholder="4"
                />
                <span className="text-sm text-slate-600">{TH ? "ชั่วโมง" : "hours"}</span>
                {Number.isFinite(numbers.f) && numbers.f > 0 && (
                  <span className="text-xs text-slate-500 ml-2">≈ {numbers.f.toFixed(1)} {TH ? "ครั้ง/วัน" : "doses/day"}</span>
                )}
              </div>
            )}

            {freqMode === "custom" && (
              <Input
                className="mt-2"
                value={freqCustom}
                onChange={(e) => setFreqCustom(e.target.value)}
                placeholder={TH ? "เช่น เมื่อมีอาการ, ก่อนนอน" : "e.g. as needed, at bedtime"}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dur">{TH ? "ระยะเวลา (วัน)" : "Duration (days)"}</Label>
            <Input
              id="dur" type="number" inputMode="decimal" min={0}
              value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="7"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stab" className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              {TH ? "อายุความคงตัวหลังผสม (วัน)" : "Stability after preparing (days)"}
            </Label>
            <Input
              id="stab" type="number" inputMode="decimal" min={0}
              value={stability} onChange={(e) => setStability(e.target.value)}
              placeholder={TH ? "เช่น 28" : "e.g. 28"}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-brand" />
              {TH ? "เวลาเตรียมยา / เปิดขวด" : "Preparation / opening time"}
            </Label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-700">{prepDisplay}</span>
                <Button type="button" size="sm" className="h-7 text-xs bg-brand hover:bg-brand/90 text-brand-foreground" onClick={setPrepNow}>
                  {TH ? "ตอนนี้" : "Now"}
                </Button>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {[15, 30, 60, 120, 240].map((m) => (
                  <Button key={m} type="button" size="sm" variant="outline" className="h-7 text-xs px-1" onClick={() => addPrepMin(m)}>
                    +{m >= 60 ? `${m / 60}h` : `${m}m`}
                  </Button>
                ))}
              </div>
              <button type="button" onClick={() => setShowPrepPicker((s) => !s)} className="text-xs text-brand underline-offset-2 hover:underline">
                {showPrepPicker ? (TH ? "ซ่อน" : "Hide") : (TH ? "เลือกเวลาเอง" : "Custom time")}
              </button>
              {showPrepPicker && (
                <Input type="datetime-local" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} className="h-9 bg-white" />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="treatmentStart" className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-brand" />
              {TH ? "วันที่เริ่มใช้ยา" : "Treatment start date"}
            </Label>
            <Input
              id="treatmentStart" type="date"
              value={treatmentStart} onChange={(e) => setTreatmentStart(e.target.value)}
              className="h-10"
            />
          </div>

          {errors.length > 0 && (dose || duration) && (
            <ul className="text-xs text-destructive space-y-1">
              {errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={handleCalculate} disabled={errors.length > 0} className="shimmer-border">{TH ? "คำนวณ" : "Calculate"}</Button>
            <Button variant="outline" onClick={reset} className="shimmer-border">
              <RotateCcw className="h-4 w-4 mr-1" /> {TH ? "ล้างข้อมูล" : "Reset"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className={expanded ? "fixed inset-0 z-50 overflow-auto bg-background/95 backdrop-blur-sm p-4 sm:p-8 space-y-4" : "space-y-4"}>
        <Card className="border-brand/30 bg-brand/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{TH ? "สรุปผลการคำนวณ" : "Calculation Summary"}</CardTitle>
            <div className="flex items-center gap-1">
              {result && (
                <Button variant="outline" size="sm" onClick={openPreview} disabled={exporting}>
                  <Eye className="h-4 w-4 mr-1" />
                  <span className="text-xs">{TH ? "ดูตัวอย่าง PDF" : "Preview PDF"}</span>
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
                {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                <span className="ml-1 text-xs">{expanded ? (TH ? "ย่อ" : "Collapse") : (TH ? "ขยาย" : "Full view")}</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {result ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-background p-3 border">
                    <div className="text-xs text-slate-500">{TH ? "ระยะเวลา" : "Duration"}</div>
                    <div className="text-2xl font-bold tabular-nums">{result.totalDays}</div>
                    <div className="text-xs text-slate-500">{TH ? "วัน" : "Days"}</div>
                  </div>
                  <div className="rounded-lg bg-background p-3 border">
                    <div className="text-xs text-slate-500">{TH ? "หยดต่อวัน" : "Drops/day"}</div>
                    <div className="text-2xl font-bold tabular-nums">{Number.isFinite(result.dailyDrops) ? result.dailyDrops : "—"}</div>
                    <div className="text-xs text-slate-500">{TH ? "หยด" : "drops"}</div>
                  </div>
                  <div className="rounded-lg bg-background p-3 border">
                    <div className="text-xs text-slate-500">{TH ? "จำนวนขวด" : "Bottles required"}</div>
                    <div className="text-2xl font-bold tabular-nums">{result.bottlesNeeded}</div>
                    <div className="text-xs text-slate-500">{TH ? "ขวด" : result.bottlesNeeded === 1 ? "bottle" : "bottles"}</div>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-md border bg-background p-3">
                    <div className="text-xs text-slate-500 mb-1">{TH ? "วิธีใช้สำหรับผู้ป่วย" : "Patient instruction"}</div>
                    <div className="text-sm font-medium">{instruction}</div>
                  </div>
                  {treatmentStartDate && treatmentEndDate && (
                    <div className="rounded-md border bg-background p-3 text-sm">
                      <span className="text-slate-500">{TH ? "ช่วงการรักษา: " : "Treatment period: "}</span>
                      <span className="font-medium">{formatDate(treatmentStartDate)} – {formatDate(treatmentEndDate)}</span>
                    </div>
                  )}
                  {expiration && (
                    <div className="rounded-md border-2 border-rose-300 bg-rose-50 p-3">
                      <div className="text-xs text-rose-700 font-semibold mb-1">{TH ? "วันหมดอายุ (หลังเปิดขวด)" : "Expiration (after opening)"}</div>
                      <div className="text-base font-bold text-rose-700 tabular-nums">{fmtDateTime(expiration.exp)}</div>
                    </div>
                  )}
                  <Button variant="outline" size="sm" onClick={copyResult}>
                    <Copy className="h-4 w-4 mr-1" />{TH ? "คัดลอกผลลัพธ์" : "Copy result"}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">{TH ? "กรอกข้อมูลเพื่อดูผลลัพธ์" : "Enter values to see results."}</p>
            )}
          </CardContent>
        </Card>

        {freqMode === "custom" && result && (
          <Alert>
            <AlertTitle>{TH ? "ความถี่กำหนดเอง" : "Custom frequency"}</AlertTitle>
            <AlertDescription>
              {TH ? "ไม่สามารถคำนวณจำนวนหยดรวมได้สำหรับความถี่แบบกำหนดเอง" : "Total drops cannot be auto-computed for free-text frequency."}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>

    {/* Hidden PDF template */}
    <div ref={pdfRef} style={{ display: "none", fontFamily: "'Sarabun', 'Noto Sans Thai', 'Tahoma', system-ui, sans-serif", color: "#0f172a", padding: "24px" }}>
      {result && (
        <div style={{ width: "100%" }}>
          <div style={{ borderBottom: "2px solid #1e3a8a", paddingBottom: "8px", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <img src={bphLogo} alt="Bangkok Hospital Pattaya" style={{ height: "44px", width: "auto" }} crossOrigin="anonymous" />
              <div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#1e3a8a", lineHeight: 1.1 }}>Bangkok Hospital Pattaya</div>
                <div style={{ fontSize: "11px", color: "#475569", lineHeight: 1.1 }}>Pharmacy Department · PharmCalc Pro</div>
              </div>
            </div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#1e3a8a" }}>Eye Drops Medication Summary</div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "#1e3a8a" }}>สรุปการใช้ยาหยอดตา</div>
            {drugName.trim() && (
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", marginTop: "6px" }}>
                {TH ? "ชื่อยา / Medication: " : "Medication / ชื่อยา: "}{drugName.trim()}
              </div>
            )}
            <div style={{ fontSize: "11px", color: "#475569", marginTop: "4px" }}>
              {TH ? "วันที่พิมพ์: " : "Printed: "}{new Date().toLocaleString(TH ? "th-TH" : "en-GB")}
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", marginBottom: "16px" }}>
            <tbody>
              {[
                ["Dose / ขนาดต่อครั้ง", `${numbers.d} ${numbers.d > 1 ? "drops" : "drop"} · หยด`],
                ["Frequency / ความถี่", freqLabel],
                ["Duration / ระยะเวลา", `${result.totalDays} days · วัน`],
                ...(treatmentStartDate ? [["Treatment start / เริ่มใช้ยา", formatDate(treatmentStartDate)]] : []),
                ...(treatmentEndDate ? [["Treatment end / สิ้นสุด", formatDate(treatmentEndDate)]] : []),
                ...(Number.isFinite(result.dailyDrops) ? [["Drops per day / หยดต่อวัน", `${result.dailyDrops}`]] : []),
                ...[["Bottles required / จำนวนขวด", `${result.bottlesNeeded}`]],
                ...(Number.isFinite(numbers.stab) ? [["Stability / อายุความคงตัว", `${numbers.stab} days · วัน`]] : []),
                ...(expiration ? [["Prepared / เตรียมเมื่อ", fmtDateTime(expiration.prep)]] : []),
              ].map(([k, v], i) => (
                <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "6px 8px", color: "#475569", width: "50%" }}>{k}</td>
                  <td style={{ padding: "6px 8px", fontWeight: 600 }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {expiration && (
            <div style={{ border: "3px solid #b91c1c", background: "#fef2f2", borderRadius: "8px", padding: "14px", marginBottom: "16px", textAlign: "center" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#b91c1c", letterSpacing: "1px", textTransform: "uppercase" }}>
                ⚠ Expiration Date / วันหมดอายุ ⚠
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#b91c1c", marginTop: "6px" }}>
                {fmtDateTime(expiration.exp)}
              </div>
              <div style={{ fontSize: "11px", color: "#7f1d1d", marginTop: "4px" }}>
                Do NOT use after this date · ห้ามใช้หลังจากวันที่นี้
              </div>
            </div>
          )}

          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "6px", padding: "10px", marginBottom: "16px" }}>
            <div style={{ fontSize: "11px", color: "#1e3a8a", fontWeight: 600 }}>Patient Instruction · วิธีใช้สำหรับผู้ป่วย</div>
            <div style={{ fontSize: "13px", marginTop: "4px" }}>
              EN: Instill {numbers.d} drop{numbers.d > 1 ? "s" : ""} {freqLabel}
            </div>
            <div style={{ fontSize: "13px", marginTop: "2px" }}>
              ไทย: หยอดตา {numbers.d} หยด {freqLabel}
            </div>
          </div>

          {(expiration || bottleStartDates.length > 1) && (
            <div style={{ marginTop: "12px", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#f8fafc" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#1e3a8a", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                Bottle Schedule · ตารางการเปิดขวด
              </div>
              {expiration && (
                <div style={{ fontSize: "12px", marginBottom: "4px" }}>
                  <strong>Expiration of opened bottle / วันหมดอายุหลังเปิดขวด:</strong> {fmtDateTime(expiration.exp)}
                </div>
              )}
              {bottleStartDates.length > 1 && bottleStartDates.slice(1).map((d, i) => (
                <div key={i} style={{ fontSize: "12px" }}>
                  Open bottle #{i + 2} on / เปิดขวดที่ {i + 2} วันที่: <strong>{formatDate(d)}</strong>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: "20px", paddingTop: "10px", borderTop: "1px dashed #cbd5e1", fontSize: "10px", color: "#64748b", display: "flex", justifyContent: "space-between" }}>
            <span>For pharmacist use · Verify before dispense</span>
            <span>Printed: {new Date().toLocaleString(TH ? "th-TH" : "en-GB")}</span>
          </div>
        </div>
      )}
    </div>

    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-brand" />{TH ? "ตัวอย่าง PDF" : "PDF Preview"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto rounded-md border bg-slate-100 p-3">
          {result && (
            <div className="mx-auto bg-white shadow-sm" style={{ width: "794px", maxWidth: "100%", fontFamily: "'Sarabun', 'Noto Sans Thai', 'Tahoma', system-ui, sans-serif", color: "#0f172a", padding: "24px" }}>
              <div style={{ borderBottom: "2px solid #1e3a8a", paddingBottom: "8px", marginBottom: "16px" }}>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "#1e3a8a" }}>Eye Drops Medication Summary</div>
                <div style={{ fontSize: "16px", fontWeight: 600, color: "#1e3a8a" }}>สรุปการใช้ยาหยอดตา</div>
                {drugName.trim() && <div style={{ fontSize: "15px", fontWeight: 700, marginTop: "6px" }}>{drugName.trim()}</div>}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", marginBottom: "12px" }}>
                <tbody>
                  {[
                    [TH ? "ขนาดต่อครั้ง" : "Dose", `${numbers.d} ${TH ? "หยด" : "drop(s)"}`],
                    [TH ? "ความถี่" : "Frequency", freqLabel],
                    [TH ? "ระยะเวลา" : "Duration", `${result.totalDays} ${TH ? "วัน" : "days"}`],
                    ...(treatmentStartDate ? [[TH ? "เริ่มใช้ยา" : "Start", formatDate(treatmentStartDate)]] : []),
                    ...(treatmentEndDate ? [[TH ? "สิ้นสุด" : "End", formatDate(treatmentEndDate)]] : []),
                    ...[[TH ? "จำนวนขวด" : "Bottles", `${result.bottlesNeeded}`]],
                    ...(Number.isFinite(numbers.stab) ? [[TH ? "อายุความคงตัว" : "Stability", `${numbers.stab} ${TH ? "วัน" : "days"}`]] : []),
                    ...(expiration ? [[TH ? "เตรียมเมื่อ" : "Prepared", fmtDateTime(expiration.prep)]] : []),
                  ].map(([k, v], i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "5px 8px", color: "#475569", width: "50%" }}>{k}</td>
                      <td style={{ padding: "5px 8px", fontWeight: 600 }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {expiration && (
                <div style={{ border: "3px solid #b91c1c", background: "#fef2f2", borderRadius: "8px", padding: "14px", marginBottom: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#b91c1c", letterSpacing: "1px", textTransform: "uppercase" }}>
                    ⚠ {TH ? "วันหมดอายุ" : "Expiration Date"} ⚠
                  </div>
                  <div style={{ fontSize: "26px", fontWeight: 800, color: "#b91c1c", marginTop: "6px" }}>{fmtDateTime(expiration.exp)}</div>
                  <div style={{ fontSize: "11px", color: "#7f1d1d", marginTop: "4px" }}>
                    {TH ? "ห้ามใช้หลังจากวันที่นี้" : "Do NOT use after this date"}
                  </div>
                </div>
              )}
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "6px", padding: "10px", fontSize: "13px" }}>
                <div style={{ fontWeight: 600, color: "#1e3a8a", fontSize: "11px", marginBottom: "4px" }}>{TH ? "วิธีใช้สำหรับผู้ป่วย" : "Patient instruction"}</div>
                <div>EN: Instill {numbers.d} drop{numbers.d > 1 ? "s" : ""} {freqLabel}</div>
                <div>ไทย: หยอดตา {numbers.d} หยด {freqLabel}</div>
              </div>
              {(expiration || bottleStartDates.length > 1) && (
                <div style={{ marginTop: "10px", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#f8fafc", fontSize: "12px" }}>
                  <div style={{ fontWeight: 700, color: "#1e3a8a", marginBottom: "4px" }}>{TH ? "ตารางการเปิดขวด" : "Bottle Schedule"}</div>
                  {expiration && (
                    <div style={{ marginBottom: "2px" }}>
                      <strong>{TH ? "วันหมดอายุหลังเปิดขวด: " : "Expires (after opening): "}</strong>{fmtDateTime(expiration.exp)}
                    </div>
                  )}
                  {bottleStartDates.slice(1).map((d, i) => (
                    <div key={i}>
                      {TH ? `เปิดขวดที่ ${i + 2} วันที่: ` : `Open bottle #${i + 2} on: `}<strong>{formatDate(d)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setPreviewOpen(false)}>
            <X className="h-4 w-4 mr-1" />{TH ? "ปิด" : "Close"}
          </Button>
          <Button onClick={async () => { await exportPDF(); setPreviewOpen(false); }} disabled={exporting}>
            <FileDown className="h-4 w-4 mr-1" />
            {exporting ? (TH ? "กำลังสร้าง..." : "Generating...") : (TH ? "ดาวน์โหลด PDF" : "Download PDF")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
