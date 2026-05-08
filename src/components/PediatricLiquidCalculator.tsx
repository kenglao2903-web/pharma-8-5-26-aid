import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, Baby, ChevronDown, Clock, Copy, Eye, FileDown, Maximize2, Minimize2, Pill, Printer, RotateCcw, ShieldAlert, Sticker, X } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import bphLogo from "@/assets/bangkok-hospital-logo.png";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const toLocalIso = (d: Date) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};

const FREQ_OPTIONS = [
  { value: "1", labelEn: "OD", subEn: "Once daily", labelTh: "วันละครั้ง", subTh: "1 ครั้ง/วัน" },
  { value: "2", labelEn: "BID", subEn: "Twice daily", labelTh: "วันละ 2 ครั้ง", subTh: "ทุก 12 ชม." },
  { value: "3", labelEn: "TID", subEn: "Three times daily", labelTh: "วันละ 3 ครั้ง", subTh: "ทุก 8 ชม." },
  { value: "4", labelEn: "QID", subEn: "Four times daily", labelTh: "วันละ 4 ครั้ง", subTh: "ทุก 6 ชม." },
] as const;

const BOTTLE_OPTIONS = ["30", "60", "90", "120"] as const;

type ScheduleItem = {
  idx: number;
  days: number;
  startDate: Date;
  endDate: Date;
  used: number;          // ml actually administered from this bottle
  bottleSize: number;
  discarded: number;     // ml wasted (stability cut-off)
  remainingInBottle: number; // ml still available in this bottle at depletion/discard time
  remainingCourse: number;   // ml still owed for the full prescription after this bottle
  stabilityLimited: boolean;
};

export function PediatricLiquidCalculator() {
  const { lang } = useI18n();
  const { logActivity } = useAuth();
  const TH = lang === "th";

  const [drugName, setDrugName] = useState("");
  const [dose, setDose] = useState("");
  const [freq, setFreq] = useState<string>("3");
  const [duration, setDuration] = useState("");
  const [bottle, setBottle] = useState<string>("60");
  const [stability, setStability] = useState("");
  const [prepTime, setPrepTime] = useState<string>(() => toLocalIso(new Date()));
  const [treatmentStart, setTreatmentStart] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  });
  const [showPrepPicker, setShowPrepPicker] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [showSchedule, setShowSchedule] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const numbers = useMemo(() => ({
    d: parseFloat(dose),
    f: parseFloat(freq),
    dur: parseFloat(duration),
    b: parseFloat(bottle),
    stab: stability.trim() === "" ? Infinity : parseFloat(stability),
  }), [dose, freq, duration, bottle, stability]);

  const errors = useMemo(() => {
    const e: string[] = [];
    const { d, f, dur, b, stab } = numbers;
    if (!(d > 0)) e.push(TH ? "ขนาดยา/ครั้ง ต้องมากกว่า 0" : "Dose must be > 0");
    if (!(f > 0)) e.push(TH ? "ความถี่ ต้องมากกว่า 0" : "Frequency must be > 0");
    if (!(dur > 0)) e.push(TH ? "ระยะเวลา ต้องมากกว่า 0" : "Duration must be > 0");
    if (!(b > 0)) e.push(TH ? "ปริมาตรต่อขวด ต้องมากกว่า 0" : "Bottle volume must be > 0");
    if (stability.trim() !== "" && !(stab > 0)) e.push(TH ? "อายุความคงตัว ต้องมากกว่า 0" : "Stability must be > 0");
    return e;
  }, [numbers, TH, stability]);

  const schedule = useMemo<ScheduleItem[]>(() => {
    if (errors.length) return [];
    const { d, f, dur, b, stab } = numbers;
    const dailyMl = d * f;
    const totalCourseMl = dailyMl * dur;
    const startDate = treatmentStart ? new Date(treatmentStart + "T00:00:00") : new Date();
    startDate.setHours(0, 0, 0, 0);

    // Round DOWN: each bottle lasts a whole number of days.
    const naturalDaysPerBottle = Math.max(1, Math.floor(b / dailyMl));
    const cap = Math.min(naturalDaysPerBottle, Math.floor(Number.isFinite(stab) ? stab : naturalDaysPerBottle));
    const daysPerBottleWhole = Math.max(1, cap);

    const items: ScheduleItem[] = [];
    let daysRemaining = dur;
    let mlOwedRemaining = totalCourseMl;
    let cursorDate = new Date(startDate);
    let idx = 1;
    // hard cap to avoid runaway loops on bad inputs
    while (daysRemaining > 0.0001 && idx <= 365) {
      const daysThisBottle = Math.min(daysPerBottleWhole, Math.ceil(daysRemaining));
      const stabilityLimited = Number.isFinite(stab) && stab < (b / dailyMl) - 0.0001;
      const used = Math.min(b, daysThisBottle * dailyMl);
      const remainingInBottle = Math.max(0, b - used);
      const discarded = (stabilityLimited || daysThisBottle < naturalDaysPerBottle) ? remainingInBottle : 0;

      const start = new Date(cursorDate);
      const end = new Date(cursorDate);
      end.setDate(end.getDate() + daysThisBottle - 1);

      mlOwedRemaining = Math.max(0, mlOwedRemaining - used);
      daysRemaining = Math.max(0, daysRemaining - daysThisBottle);

      items.push({
        idx,
        days: daysThisBottle,
        startDate: start,
        endDate: end,
        used,
        bottleSize: b,
        discarded,
        remainingInBottle,
        remainingCourse: mlOwedRemaining,
        stabilityLimited,
      });

      cursorDate = new Date(end);
      cursorDate.setDate(cursorDate.getDate() + 1);
      idx++;
    }
    return items;
  }, [numbers, errors.length, treatmentStart]);

  const result = useMemo(() => {
    if (errors.length || schedule.length === 0) return null;
    const { d, f, dur, b } = numbers;
    const dailyMl = d * f;
    const totalMl = dailyMl * dur;
    const bottles = schedule.length;
    const totalDispensed = bottles * b;
    const totalDiscarded = schedule.reduce((s, x) => s + x.discarded, 0);
    const daysPerBottleWhole = Math.max(1, Math.floor(b / dailyMl));
    const daysPerBottle = Number.isFinite(numbers.stab)
      ? Math.min(daysPerBottleWhole, Math.floor(numbers.stab))
      : daysPerBottleWhole;
    return { totalMl, bottles, daysPerBottle, totalDispensed, totalDiscarded, totalDays: dur };
  }, [errors.length, schedule, numbers]);

  // Subsequent mixing schedule: when each bottle should be prepared/mixed.
  // Bottle 1 is prepared at prepTime; subsequent bottles are mixed on the day the previous one ends.
  const bottlePrepDates = useMemo(() => {
    if (!result || schedule.length === 0) return [];
    return schedule.map((s) => s.startDate);
  }, [result, schedule]);

  const reset = () => {
    setDrugName("");
    setDose("");
    setFreq("3");
    setDuration("");
    setBottle("60");
    setStability("");
    setPrepTime(toLocalIso(new Date()));
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setTreatmentStart(d.toISOString().slice(0, 10));
  };

  const setPrepNow = () => setPrepTime(toLocalIso(new Date()));
  const addPrepMin = (m: number) => {
    const base = prepTime ? new Date(prepTime) : new Date();
    base.setMinutes(base.getMinutes() + m);
    setPrepTime(toLocalIso(base));
  };
  const prepDisplay = prepTime
    ? new Date(prepTime).toLocaleString(TH ? "th-TH" : "en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const handleCalculate = () => {
    if (errors.length || !result) {
      toast({ title: TH ? "กรุณากรอกข้อมูลให้ครบ" : "Please fill in all fields correctly" });
      return;
    }
    logActivity("pediatric_liquid_calc", {
      total_ml: result.totalMl,
      bottles: result.bottles,
      stability_days: Number.isFinite(numbers.stab) ? numbers.stab : null,
    });
  };

  const instruction = useMemo(() => {
    const { d, f } = numbers;
    if (!(d > 0) || !(f > 0)) return "";
    const opt = FREQ_OPTIONS.find((o) => o.value === String(f));
    const freqWord = TH
      ? opt?.labelTh ?? `วันละ ${f} ครั้ง`
      : opt?.subEn?.toLowerCase() ?? `${f} times daily`;
    return TH
      ? `รับประทาน ${d} มล. ${freqWord} หลังอาหาร`
      : `Take ${d} ml ${freqWord} after meals`;
  }, [numbers, TH]);

  const formatDate = (d: Date) =>
    d.toLocaleDateString(TH ? "th-TH" : "en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const copyResult = async () => {
    if (!result) return;
    const sched = schedule
      .map((s) =>
        TH
          ? `ขวด ${s.idx}: ${formatDate(s.startDate)} – ${formatDate(s.endDate)} (${s.days.toFixed(1)} วัน) | ใช้ ${s.used.toFixed(1)}/${s.bottleSize} มล. | คงเหลือในขวด ${s.remainingInBottle.toFixed(1)} มล.${s.stabilityLimited ? ` | ทิ้ง ${s.discarded.toFixed(1)} มล. (หมดอายุความคงตัว)` : ""} | คงเหลือคอร์ส ${s.remainingCourse.toFixed(1)} มล.`
          : `Bottle ${s.idx}: ${formatDate(s.startDate)} – ${formatDate(s.endDate)} (${s.days.toFixed(1)} d) | used ${s.used.toFixed(1)}/${s.bottleSize} ml | remaining in bottle ${s.remainingInBottle.toFixed(1)} ml${s.stabilityLimited ? ` | discard ${s.discarded.toFixed(1)} ml (stability)` : ""} | course remaining ${s.remainingCourse.toFixed(1)} ml`,
      )
      .join("\n");
    const text = TH
      ? `ระยะเวลา: ${result.totalDays} วัน\nปริมาตรรวมที่ต้องใช้: ${result.totalMl} มล.\nจำนวนขวด: ${result.bottles}\nจ่ายรวม: ${result.totalDispensed} มล. (ทิ้ง ${result.totalDiscarded.toFixed(1)} มล.)\nวิธีใช้: ${instruction}\n\nตารางขวด:\n${sched}`
      : `Duration: ${result.totalDays} days\nTotal volume needed: ${result.totalMl} ml\nBottles: ${result.bottles}\nDispensed: ${result.totalDispensed} ml (discarded ${result.totalDiscarded.toFixed(1)} ml)\nSig: ${instruction}\n\nBottle schedule:\n${sched}`;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: TH ? "คัดลอกแล้ว" : "Copied to clipboard" });
    } catch {
      toast({ title: TH ? "คัดลอกไม่สำเร็จ" : "Copy failed" });
    }
  };

  const overVolume = result && result.totalMl > 1000;
  const stabilityActive = Number.isFinite(numbers.stab) && result && numbers.stab < numbers.dur;

  // Precise expiration date & time = preparation moment + stability (days)
  // Example: prep 01/01/26 10:00 + 1 day → expires 02/01/26 10:00
  const expiration = useMemo(() => {
    if (!prepTime || !Number.isFinite(numbers.stab)) return null;
    const prep = new Date(prepTime);
    if (isNaN(prep.getTime())) return null;
    const exp = new Date(prep.getTime() + numbers.stab * 24 * 3600 * 1000);
    return { prep, exp };
  }, [prepTime, numbers.stab]);

  // Refill = 1 day before current bottle expires (continuity buffer)
  const refillDate = useMemo(() => {
    if (!expiration) return null;
    return new Date(expiration.exp.getTime() - 24 * 3600 * 1000);
  }, [expiration]);

  // Proactive refill comparison — does picking up the next bottle 1 day before
  // expiry change the total number of bottles needed for the full course?
  const refillComparison = useMemo(() => {
    if (!result) return null;
    const dpb = Math.max(1, result.daysPerBottle);
    const bottlesStandard = Math.max(1, Math.ceil(result.totalDays / dpb));
    const proactiveDpb = Math.max(1, dpb - 1);
    const bottlesProactive = Math.max(1, Math.ceil(result.totalDays / proactiveDpb));
    return {
      bottlesStandard,
      bottlesProactive,
      dpb,
      proactiveDpb,
      extra: bottlesProactive - bottlesStandard,
    };
  }, [result]);

  // Sticker bottle schedule — starts at treatment start; each subsequent bottle
  // starts on the day before previous expires (proactive refill timing).
  const stickerSchedule = useMemo(() => {
    if (!result) return [] as { idx: number; date: Date }[];
    const startStr = treatmentStart || new Date().toISOString().slice(0, 10);
    const start = new Date(startStr + "T00:00:00");
    const dpb = Math.max(1, result.daysPerBottle);
    const stride = Math.max(1, dpb - 1); // proactive: 1-day overlap
    const total = refillComparison?.bottlesProactive ?? result.bottles;
    const out: { idx: number; date: Date }[] = [];
    for (let i = 0; i < total; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i * stride);
      out.push({ idx: i + 1, date: d });
    }
    return out;
  }, [result, treatmentStart, refillComparison]);

  const fmtDateTime = (d: Date) =>
    d.toLocaleString(TH ? "th-TH" : "en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const pdfRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const openPreview = () => {
    if (!result) return;
    setPreviewOpen(true);
  };

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
        let rendered = 0;
        let first = true;
        while (rendered < canvas.height) {
          const sliceH = Math.min(pageHpx, canvas.height - rendered);
          const slice = document.createElement("canvas");
          slice.width = canvas.width;
          slice.height = sliceH;
          const ctx = slice.getContext("2d")!;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, slice.width, slice.height);
          ctx.drawImage(canvas, 0, rendered, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
          if (!first) pdf.addPage();
          pdf.addImage(slice.toDataURL("image/png"), "PNG", margin, margin, imgW, sliceH / pxPerMm);
          rendered += sliceH;
          first = false;
        }
      }
      pdf.save(`pediatric-liquid-${new Date().toISOString().slice(0, 10)}.pdf`);
      logActivity("pediatric_liquid_pdf", { bottles: result.bottles });
      toast({ title: TH ? "ส่งออก PDF เรียบร้อย" : "PDF exported" });
    } catch (err) {
      console.error(err);
      toast({ title: TH ? "ส่งออก PDF ไม่สำเร็จ" : "PDF export failed" });
    } finally {
      node.style.cssText = prev;
      setExporting(false);
    }
  };

  const printSticker = () => {
    if (!result) return;
    const total = stickerSchedule.length;
    const fmt = (d: Date) =>
      d.toLocaleDateString(TH ? "th-TH" : "en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const rows = stickerSchedule
      .map(
        (s) =>
          `<tr><td style="padding:4px 8px;border-bottom:1px dashed #cbd5e1;font-weight:700;color:#1e3a8a;width:42%">${
            TH ? `ขวดที่ ${s.idx}` : `Bottle #${s.idx}`
          }${s.idx === 1 ? `<span style="font-weight:400;font-size:10px;color:#64748b"> (${TH ? "เตรียมครั้งแรก" : "initial"})</span>` : ""}</td><td style="padding:4px 8px;border-bottom:1px dashed #cbd5e1;text-align:right;font-variant-numeric:tabular-nums;font-weight:700">${fmt(s.date)}</td></tr>`,
      )
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Refill Sticker</title>
<style>
  @page { size: A6; margin: 6mm; }
  body { font-family: 'Sarabun','Noto Sans Thai',Tahoma,system-ui,sans-serif; color:#0f172a; margin:0; }
  .sticker { border:2px dashed #1e3a8a; border-radius:10px; padding:12px; max-width:340px; }
  .title { font-size:13px; font-weight:800; color:#1e3a8a; text-transform:uppercase; letter-spacing:.5px; text-align:center; }
  .sub { font-size:11px; color:#475569; text-align:center; margin-bottom:8px; }
  .bottles { font-size:18px; font-weight:900; color:#b91c1c; text-align:center; margin:6px 0; }
  table { width:100%; border-collapse:collapse; font-size:12px; margin-top:6px; }
  .footer { margin-top:8px; font-size:9px; color:#64748b; text-align:center; }
  @media print { .noprint { display:none } }
</style></head><body>
<div class="noprint" style="padding:8px;text-align:right">
  <button onclick="window.print()" style="padding:6px 12px">${TH ? "พิมพ์" : "Print"}</button>
</div>
<div class="sticker">
  <div class="title">${TH ? "ตารางรับยา" : "Medication Refill"}</div>
  <div class="sub">${drugName.trim() ? drugName.trim() + " · " : ""}${TH ? "ติดบนถุงยา" : "Attach to medication bag"}</div>
  <div class="bottles">${TH ? `ทั้งหมด ${total} ขวด` : `Total: ${total} bottles`}</div>
  <table>${rows}</table>
  <div class="footer">${TH ? "มารับยาขวดถัดไปก่อนยาขวดปัจจุบันหมด 1 วัน" : "Refill 1 day before current bottle expires"}</div>
</div>
<script>setTimeout(()=>window.print(),300);</script>
</body></html>`;
    const w = window.open("", "_blank", "width=480,height=640");
    if (!w) {
      toast({ title: TH ? "ไม่สามารถเปิดหน้าต่างพิมพ์" : "Could not open print window" });
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    logActivity("pediatric_liquid_sticker", { bottles: total });
  };

  return (
    <>

    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Baby className="h-5 w-5 text-brand" />
            {TH ? "คำนวณยาน้ำเด็ก" : "Pediatric Liquid Medication"}
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
              type="text"
              value={drugName}
              onChange={(e) => setDrugName(e.target.value)}
              placeholder={TH ? "เช่น Amoxicillin syrup" : "e.g. Amoxicillin syrup"}
            />
            <p className="text-[11px] text-slate-500">
              {TH
                ? "หากกรอก จะถูกแสดงบน PDF สำหรับผู้ป่วย"
                : "If entered, will be shown on the patient PDF."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dose">{TH ? "ขนาดต่อครั้ง (มล.)" : "Dose per administration (ml)"}</Label>
            <Input
              id="dose"
              type="number"
              inputMode="decimal"
              min={0}
              value={dose}
              onChange={(e) => setDose(e.target.value)}
              placeholder="5"
            />
          </div>

          <div className="space-y-2">
            <Label>{TH ? "ความถี่" : "Frequency"}</Label>
            <ToggleGroup
              type="single"
              value={freq}
              onValueChange={(v) => v && setFreq(v)}
              className="grid grid-cols-2 sm:grid-cols-4 gap-2"
            >
              {FREQ_OPTIONS.map((o) => (
                <ToggleGroupItem
                  key={o.value}
                  value={o.value}
                  className="flex h-auto flex-col items-center gap-0.5 rounded-md border bg-background px-2 py-3 data-[state=on]:bg-brand data-[state=on]:text-primary-foreground data-[state=on]:border-brand"
                >
                  <span className="text-base font-semibold">{TH ? o.labelTh : o.labelEn}</span>
                  <span className="text-[10px] opacity-80">{TH ? o.subTh : o.subEn}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dur">{TH ? "ระยะเวลา (วัน)" : "Duration (days)"}</Label>
            <Input
              id="dur"
              type="number"
              inputMode="decimal"
              min={0}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="15"
            />
          </div>

          <div className="space-y-2">
            <Label>{TH ? "ปริมาตรต่อขวด (มล.)" : "Bottle volume (ml)"}</Label>
            <ToggleGroup
              type="single"
              value={bottle}
              onValueChange={(v) => v && setBottle(v)}
              className="grid grid-cols-4 gap-2"
            >
              {BOTTLE_OPTIONS.map((b) => (
                <ToggleGroupItem
                  key={b}
                  value={b}
                  className="h-11 rounded-md border bg-background data-[state=on]:bg-brand data-[state=on]:text-primary-foreground data-[state=on]:border-brand"
                >
                  <span className="font-semibold">{b}</span>
                  <span className="ml-1 text-xs opacity-80">ml</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stab" className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              {TH ? "อายุความคงตัวหลังเตรียมยา (วัน) " : "Stability after preparation (days) — optional"}
            </Label>
            <Input
              id="stab"
              type="number"
              inputMode="decimal"
              min={0}
              value={stability}
              onChange={(e) => setStability(e.target.value)}
              placeholder={TH ? "เช่น 14" : "e.g. 14"}
            />
            <p className="text-[11px] text-slate-500">
              {TH
                ? "หากระบุและน้อยกว่าระยะเวลารักษา จำนวนขวดจะถูกคำนวณจากข้อจำกัดนี้"
                : "If set and less than the treatment duration, the bottle count is computed from this limit."}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-brand" />
              {TH ? "เวลาเตรียมยา" : "Preparation time"}
            </Label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-700">{prepDisplay}</span>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs bg-brand hover:bg-brand/90 text-brand-foreground"
                  onClick={setPrepNow}
                >
                  {TH ? "ตอนนี้" : "Now"}
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
                    onClick={() => addPrepMin(m)}
                  >
                    +{m >= 60 ? `${m / 60}h` : `${m}m`}
                  </Button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowPrepPicker((s) => !s)}
                className="text-xs text-brand underline-offset-2 hover:underline"
              >
                {showPrepPicker ? (TH ? "ซ่อน" : "Hide") : (TH ? "เลือกเวลาเอง" : "Custom time")}
              </button>
              {showPrepPicker && (
                <Input
                  type="datetime-local"
                  value={prepTime}
                  onChange={(e) => setPrepTime(e.target.value)}
                  className="h-9 bg-white"
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="treatmentStart" className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-brand" />
              {TH ? "วันที่เริ่มใช้ยา" : "Treatment start date"}
            </Label>
            <Input
  id="treatmentStart"
  type="date"
  value={treatmentStart}
  onChange={(e) => setTreatmentStart(e.target.value)}
  className="h-10"
/>
            <p className="text-[11px] text-slate-500">
              {TH
                ? "วันที่ผู้ป่วยเริ่มรับประทาน (อาจต่างจากวันเตรียมยา)"
                : "Date the patient actually starts taking the medication (may differ from preparation date)."}
            </p>
          </div>

          {errors.length > 0 && (dose || duration) && (
            <ul className="text-xs text-destructive space-y-1">
              {errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
  asChild
  className="bg-red-500 hover:bg-red-600 text-white"
>
  <a
    href="https://docs.google.com/spreadsheets/d/1xOXuaBvsJETkqVSEnPhKxG5UOFBOaz3U75cCcuaLzWI/edit?usp=sharing"
    target="_blank"
    rel="noopener noreferrer"
  >
    {TH ? "ตรวจสอบวันหมดอายุ" : "Check Expiry"}
  </a>
</Button>
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-1" /> {TH ? "ล้างข้อมูล" : "Reset"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className={expanded ? "fixed inset-0 z-50 overflow-auto bg-background/95 backdrop-blur-sm p-4 sm:p-8 space-y-4" : "space-y-4"}>
        <Card className="border-brand/30 bg-brand/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              {TH ? "สรุปผลการคำนวณ" : "Calculation Summary"}
            </CardTitle>
            <div className="flex items-center gap-1">
              {result && (
                <>
                  <Button variant="outline" size="sm" onClick={openPreview} disabled={exporting}>
                    <Eye className="h-4 w-4 mr-1" />
                    <span className="text-xs">{TH ? "ดูตัวอย่าง PDF" : "Preview PDF"}</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={printSticker}>
                    <Printer className="h-4 w-4 mr-1" />
                    <span className="text-xs">{TH ? "พิมพ์สติกเกอร์" : "Print sticker"}</span>
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded((v) => !v)}
                aria-label={expanded ? "Collapse" : "Expand"}
              >
                {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                <span className="ml-1 text-xs">
                  {expanded ? (TH ? "ย่อ" : "Collapse") : (TH ? "ขยาย" : "Full view")}
                </span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {result ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="rounded-lg bg-background p-3 border">
                    <div className="text-xs text-slate-500">{TH ? "ระยะเวลา" : "Duration"}</div>
                    <div className="text-2xl font-bold tabular-nums">{result.totalDays}</div>
                    <div className="text-xs text-slate-500">{TH ? "วัน" : "Days"}</div>
                  </div>
                  <div className="rounded-lg bg-background p-3 border">
                    <div className="text-xs text-slate-500">{TH ? "ปริมาตรรวม" : "Total volume"}</div>
                    <div className="text-2xl font-bold tabular-nums">{result.totalMl}</div>
                    <div className="text-xs text-slate-500">ml</div>
                  </div>
                  <div className="rounded-lg bg-background p-3 border">
                    <div className="text-xs text-slate-500">{TH ? "จำนวนขวด" : "Bottles"}</div>
                    <div className="text-2xl font-bold tabular-nums">{result.bottles}</div>
                    <div className="text-xs text-slate-500">{TH ? "ขวด" : "bottles"}</div>
                  </div>
                  <div className="rounded-lg bg-background p-3 border">
                    <div className="text-xs text-slate-500">{TH ? "ต่อขวด" : "Days/bottle"}</div>
                    <div className="text-2xl font-bold tabular-nums">{result.daysPerBottle}</div>
                    <div className="text-xs text-slate-500">{TH ? "วัน" : "days"}</div>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  <strong>{TH ? "ระยะเวลา:" : "Duration:"}</strong> {result.totalDays} {TH ? "วัน" : "Days"} ·{" "}
                  <strong>{TH ? "จ่าย:" : "Dispensed:"}</strong> {result.totalDispensed} ml
                  {result.totalDiscarded > 0 && (
                    <>
                      {" "}· <strong>{TH ? "ทิ้ง:" : "Discarded:"}</strong> {result.totalDiscarded.toFixed(1)} ml
                    </>
                  )}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                {TH ? "กรอกข้อมูลเพื่อดูผลลัพธ์" : "Enter values to see results."}
              </p>
            )}

            {result && (
              <div className="mt-4 space-y-3">
                <div className="rounded-md border bg-background p-3">
                  <div className="text-xs text-slate-500 mb-1">
                    {TH ? "วิธีใช้สำหรับผู้ป่วย" : "Patient instruction"}
                  </div>
                  <div className="text-sm font-medium">{instruction}</div>
                </div>
                {expiration && (
                  <div className="rounded-md border bg-background p-3">
                    <div className="text-xs text-slate-500 mb-1">
                      {TH ? "วันหมดอายุหลังเตรียมยา" : "Expiration after preparation"}
                    </div>
                    <div className="text-sm">
                      <div>
                        <span className="text-slate-500">{TH ? "เตรียม: " : "Prepared: "}</span>
                        <span className="font-medium tabular-nums">{fmtDateTime(expiration.prep)}</span>
                      </div>
                      <div className="text-rose-700">
                        <span className="text-rose-700/80">{TH ? "หมดอายุ: " : "Expires: "}</span>
                        <span className="font-semibold tabular-nums">{fmtDateTime(expiration.exp)}</span>
                        <span className="text-xs text-slate-500"> ({numbers.stab} {TH ? "วัน" : "d"})</span>
                      </div>
                    </div>
                  </div>
                )}
                {bottlePrepDates.length > 1 && (
                  <div className="rounded-md border bg-background p-3">
                    <div className="text-xs text-slate-500 mb-2">
                      {TH ? "ตารางการเตรียมยาแต่ละขวด" : "Preparation schedule"}
                    </div>
                    <ul className="text-sm space-y-1">
                      {bottlePrepDates.map((d, i) => (
                        <li key={i} className="flex justify-between">
                          <span className="text-slate-600">
                            {TH ? `ขวดที่ ${i + 1}` : `Bottle #${i + 1}`}
                            {i === 0 && (
                              <span className="ml-1 text-[10px] text-slate-400">
                                ({TH ? "เตรียมครั้งแรก" : "initial prep"})
                              </span>
                            )}
                          </span>
                          <span className="font-medium tabular-nums">{formatDate(d)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {refillComparison && (
                  <div className="rounded-md border bg-background p-3">
                    <div className="text-xs text-slate-500 mb-2">
                      {TH ? "เปรียบเทียบจำนวนขวด: รับยาตรงวันหมด vs. รับยาล่วงหน้า 1 วัน" : "Refill scenarios: on-expiry vs. proactive (1 day early)"}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded border p-2">
                        <div className="text-[10px] uppercase text-slate-500">{TH ? "รับวันหมดอายุ" : "On expiry"}</div>
                        <div className="text-lg font-bold tabular-nums">{refillComparison.bottlesStandard}</div>
                        <div className="text-[10px] text-slate-500">{TH ? "ขวด" : "bottles"}</div>
                      </div>
                      <div className={`rounded border p-2 ${refillComparison.extra > 0 ? "border-amber-400 bg-amber-50/60" : "border-emerald-400 bg-emerald-50/60"}`}>
                        <div className="text-[10px] uppercase text-slate-500">{TH ? "รับล่วงหน้า 1 วัน" : "Proactive (-1 day)"}</div>
                        <div className="text-lg font-bold tabular-nums">{refillComparison.bottlesProactive}</div>
                        <div className="text-[10px] text-slate-500">
                          {refillComparison.extra > 0
                            ? (TH ? `+${refillComparison.extra} ขวด เพื่อความต่อเนื่อง` : `+${refillComparison.extra} extra for continuity`)
                            : (TH ? "ไม่ต้องเพิ่มขวด" : "No extra bottles needed")}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={copyResult}>
                  <Copy className="h-4 w-4 mr-1" />
                  {TH ? "คัดลอกผลลัพธ์" : "Copy result"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {stabilityActive && (
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>{TH ? "ข้อจำกัดด้านความคงตัว" : "Stability constraint applied"}</AlertTitle>
            <AlertDescription>
              {TH
                ? `อายุความคงตัว ${numbers.stab} วัน < ระยะเวลารักษา ${numbers.dur} วัน — ต้องใช้ ${result!.bottles} ขวด เนื่องจากยาหลังเตรียมจะหมดอายุก่อนใช้หมด`
                : `Stability ${numbers.stab} d < treatment ${numbers.dur} d — ${result!.bottles} the prepared medication expires before being fully consumed.`}
            </AlertDescription>
          </Alert>
        )}

        {overVolume && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{TH ? "ตรวจสอบขนาดยา" : "Check dosing"}</AlertTitle>
            <AlertDescription>
              {TH
                ? "ปริมาตรรวมเกิน 1000 มล. โปรดตรวจสอบขนาดยาและระยะเวลาอีกครั้ง"
                : "Total volume exceeds 1000 ml. Please verify the dose and duration."}
            </AlertDescription>
          </Alert>
        )}

        {result && schedule.length > 0 && (
          <Card>
            <Collapsible open={showSchedule} onOpenChange={setShowSchedule}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between p-4 text-left">
                  <span className="font-medium">
                    {TH ? "ตารางการใช้ยาแต่ละขวด" : "Bottle schedule & depletion"}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showSchedule ? "rotate-180" : ""}`}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4">
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-600">
                        <tr>
                          <th className="px-3 py-2 text-left">{TH ? "ขวด" : "Bottle"}</th>
                          <th className="px-3 py-2 text-left">{TH ? "เริ่มใช้" : "Start"}</th>
                          <th className="px-3 py-2 text-left">{TH ? "หมด/ทิ้ง" : "Ends"}</th>
                          <th className="px-3 py-2 text-right">{TH ? "วัน" : "Days"}</th>
                          <th className="px-3 py-2 text-right">{TH ? "ใช้ (มล.)" : "Used (ml)"}</th>
                          <th className="px-3 py-2 text-right">{TH ? "เหลือในขวด (มล.)" : "Remaining (ml)"}</th>
                          <th className="px-3 py-2 text-right">{TH ? "ทิ้ง (มล.)" : "Discard (ml)"}</th>
                          <th className="px-3 py-2 text-right">{TH ? "คงเหลือคอร์ส (มล.)" : "Course left (ml)"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedule.map((s) => (
                          <tr key={s.idx} className={`border-t ${s.stabilityLimited ? "bg-amber-50/60" : ""}`}>
                            <td className="px-3 py-2 font-medium">
                              #{s.idx}
                              {s.stabilityLimited && (
                                <span className="ml-1 inline-flex items-center text-amber-700" title="Stability limited">
                                  <ShieldAlert className="h-3 w-3" />
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 tabular-nums">{formatDate(s.startDate)}</td>
                            <td className="px-3 py-2 tabular-nums">{formatDate(s.endDate)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{s.days.toFixed(1)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {s.used.toFixed(1)}
                              <span className="text-[10px] text-slate-500"> / {s.bottleSize}</span>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{s.remainingInBottle.toFixed(1)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-amber-700">
                              {s.discarded > 0 ? s.discarded.toFixed(1) : "—"}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{s.remainingCourse.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    {TH
                      ? `* ปริมาตรรวมของคอร์ส: ${result!.totalMl} มล. · จ่ายรวม ${result!.totalDispensed} มล.${result!.totalDiscarded > 0 ? ` · ทิ้งจากความคงตัว ${result!.totalDiscarded.toFixed(1)} มล.` : ""} — เริ่มจากวันที่ปัจจุบัน`
                      : `* Total course volume: ${result!.totalMl} ml · Dispensed ${result!.totalDispensed} ml${result!.totalDiscarded > 0 ? ` · Stability discard ${result!.totalDiscarded.toFixed(1)} ml` : ""} — starting from today.`}
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {result && (
          <Card>
            <Collapsible open={showSteps} onOpenChange={setShowSteps}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between p-4 text-left">
                  <span className="font-medium">
                    {TH ? "รายละเอียดการคำนวณ" : "Detailed calculation"}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showSteps ? "rotate-180" : ""}`}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-2 text-sm font-mono">
                  <div>
                    {TH ? "1) ใช้ต่อวัน" : "1) Daily use"}: {numbers.d} × {numbers.f} = <b>{(numbers.d * numbers.f).toFixed(2)} ml/day</b>
                  </div>
                  <div>
                    {TH ? "2) ปริมาตรรวม" : "2) Total volume"}: {(numbers.d * numbers.f).toFixed(2)} × {numbers.dur} = <b>{result.totalMl} ml</b>
                  </div>
                  <div>
                    {TH ? "3) วันต่อขวด (ตามปริมาตร)" : "3) Days per bottle (volume)"}: {numbers.b} ÷ {(numbers.d * numbers.f).toFixed(2)} = <b>{result.daysPerBottle.toFixed(2)} {TH ? "วัน" : "days"}</b>
                  </div>
                  {Number.isFinite(numbers.stab) && (
                    <div>
                      {TH ? "4) ขีดจำกัดความคงตัว" : "4) Stability cap"}: <b>{numbers.stab} {TH ? "วัน/ขวด" : "days/bottle"}</b> → {TH ? "ใช้จริงต่อขวด" : "effective days/bottle"} = <b>{Math.min(result.daysPerBottle, numbers.stab).toFixed(2)}</b>
                    </div>
                  )}
                  <div>
                    {TH ? "5) จำนวนขวด" : "5) Bottles required"}: <b>{result.bottles}</b>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}
      </div>
    </div>

    {/* Hidden bilingual PDF template (rendered off-screen during export) */}
    <div
      ref={pdfRef}
      style={{ display: "none", fontFamily: "'Sarabun', 'Noto Sans Thai', 'Tahoma', system-ui, sans-serif", color: "#0f172a", padding: "24px" }}
    >
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
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#1e3a8a" }}>
              Pediatric Liquid Medication Summary
            </div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "#1e3a8a" }}>
              สรุปการใช้ยาน้ำสำหรับเด็ก
            </div>
            {drugName.trim() && (
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", marginTop: "6px" }}>
                {TH ? "ชื่อยา / Medication: " : "Medication / ชื่อยา: "}{drugName.trim()}
              </div>
            )}
            <div style={{ fontSize: "11px", color: "#475569", marginTop: "4px" }}>
              {TH ? "วันที่พิมพ์ / Printed: " : "Printed / วันที่พิมพ์: "}{new Date().toLocaleString(lang === "th" ? "th-TH" : "en-GB")}
            </div>
            <div style={{ fontSize: "11px", color: "#475569" }}>
              {TH ? "เวลาเตรียมยา / Preparation: " : "Preparation / เวลาเตรียมยา: "}
              {prepTime ? new Date(prepTime).toLocaleString(lang === "th" ? "th-TH" : "en-GB") : "—"}
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", marginBottom: "16px" }}>
            <tbody>
              {[
                ["Dose / ขนาดต่อครั้ง", `${numbers.d} ml`],
                ["Frequency / ความถี่", `${numbers.f} ${"times/day · ครั้ง/วัน"}`],
                ["Duration / ระยะเวลา", `${result.totalDays} days · วัน`],
                ["Bottle size / ปริมาตรต่อขวด", `${numbers.b} ml`],
                ["Bottles required / จำนวนขวด", `${result.bottles}`],
                ...(Number.isFinite(numbers.stab)
                  ? [["Stability / อายุความคงตัว", `${numbers.stab} days · วัน`]]
                  : []),
                ...(expiration
                  ? [["Prepared / เตรียมเมื่อ", fmtDateTime(expiration.prep)]]
                  : []),
              ].map(([k, v], i) => (
                <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "6px 8px", color: "#475569", width: "50%" }}>{k}</td>
                  <td style={{ padding: "6px 8px", fontWeight: 600 }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {expiration && (
            <div style={{ border: "4px solid #b91c1c", background: "#fef2f2", borderRadius: "10px", padding: "16px", marginBottom: "14px" }}>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "#b91c1c", letterSpacing: "1.5px", textTransform: "uppercase", textAlign: "center" }}>
                ⚠ Expiration Warning · คำเตือนวันหมดอายุ ⚠
              </div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#7f1d1d", marginTop: "10px", textAlign: "center", lineHeight: 1.4 }}>
                This prepared medication expires on
              </div>
              <div style={{ fontSize: "28px", fontWeight: 900, color: "#b91c1c", margin: "6px 0", textAlign: "center", letterSpacing: "0.5px" }}>
                {fmtDateTime(expiration.exp)}
              </div>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "#b91c1c", textAlign: "center", textTransform: "uppercase" }}>
                DO NOT consume after this time
              </div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#7f1d1d", marginTop: "8px", textAlign: "center", lineHeight: 1.4 }}>
                ยาที่เตรียมนี้จะหมดอายุวันที่ดังกล่าว · <span style={{ textDecoration: "underline" }}>ห้ามรับประทานหลังเวลานี้</span>
              </div>
            </div>
          )}

          <div style={{ background: "#ecfdf5", border: "2px solid #059669", borderRadius: "8px", padding: "12px", marginBottom: "14px", textAlign: "center" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#065f46", textTransform: "uppercase", letterSpacing: "1px" }}>
              Total Duration of Use · ระยะเวลาการรักษารวม
            </div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "#065f46", marginTop: "4px" }}>
              {result.totalDays} days · {result.totalDays} วัน
            </div>
          </div>

          {refillDate && result.bottles > 1 && (
            <div style={{ background: "#fffbeb", border: "2px solid #d97706", borderRadius: "8px", padding: "12px", marginBottom: "14px" }}>
              <div style={{ fontSize: "12px", fontWeight: 800, color: "#92400e", textTransform: "uppercase", letterSpacing: "1px", textAlign: "center" }}>
                ⏰ Return for Refill · นัดมารับยาขวดถัดไป
              </div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#92400e", marginTop: "6px", textAlign: "center" }}>
                {fmtDateTime(refillDate)}
              </div>
              <div style={{ fontSize: "11px", color: "#78350f", marginTop: "4px", textAlign: "center", lineHeight: 1.4 }}>
                Please return 1 day before the current bottle expires to ensure continuous treatment.
                <br />
                กรุณามารับยาขวดใหม่ก่อนยาขวดปัจจุบันหมดอายุ 1 วัน เพื่อการรักษาต่อเนื่อง
              </div>
            </div>
          )}

          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "6px", padding: "12px", marginBottom: "14px" }}>
            <div style={{ fontSize: "12px", color: "#1e3a8a", fontWeight: 700, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Patient Instruction · วิธีใช้
            </div>
            <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "2px" }}>
              EN: Take {numbers.d} ml {FREQ_OPTIONS.find((o) => o.value === String(numbers.f))?.subEn?.toLowerCase() ?? `${numbers.f} times daily`} after meals.
            </div>
            <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "4px" }}>
              ไทย: รับประทาน {numbers.d} มล. {FREQ_OPTIONS.find((o) => o.value === String(numbers.f))?.labelTh ?? `วันละ ${numbers.f} ครั้ง`} หลังอาหาร
            </div>
          </div>

          <div style={{ marginTop: "20px", paddingTop: "10px", borderTop: "1px dashed #cbd5e1", fontSize: "10px", color: "#64748b", display: "flex", justifyContent: "space-between" }}>
            <span>For pharmacist use · Verify before dispense / สำหรับเภสัชกร · ตรวจสอบก่อนจ่ายยา</span>
            <span>Printed · พิมพ์เมื่อ: {new Date().toLocaleString(lang === "th" ? "th-TH" : "en-GB")}</span>
          </div>
        </div>
      )}
    </div>

    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-brand" />
            {TH ? "ตัวอย่าง PDF ก่อนสร้าง" : "PDF Preview"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto rounded-md border bg-slate-100 p-3">
          {result && (
            <div className="mx-auto bg-white shadow-sm" style={{ width: "794px", maxWidth: "100%", fontFamily: "'Sarabun', 'Noto Sans Thai', 'Tahoma', system-ui, sans-serif", color: "#0f172a", padding: "24px" }}>
              <div style={{ borderBottom: "2px solid #1e3a8a", paddingBottom: "8px", marginBottom: "16px" }}>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "#1e3a8a" }}>Pediatric Liquid Medication Summary</div>
                <div style={{ fontSize: "16px", fontWeight: 600, color: "#1e3a8a" }}>สรุปการใช้ยาน้ำสำหรับเด็ก</div>
                {drugName.trim() && (
                  <div style={{ fontSize: "15px", fontWeight: 700, marginTop: "6px" }}>
                    {TH ? "ชื่อยา / Medication: " : "Medication / ชื่อยา: "}{drugName.trim()}
                  </div>
                )}
                <div style={{ fontSize: "11px", color: "#475569", marginTop: "4px" }}>
                  {TH ? "วันที่พิมพ์: " : "Printed: "}{new Date().toLocaleString(TH ? "th-TH" : "en-GB")}
                </div>
                <div style={{ fontSize: "11px", color: "#475569" }}>
                  {TH ? "เวลาเตรียมยา: " : "Preparation: "}
                  {prepTime ? new Date(prepTime).toLocaleString(TH ? "th-TH" : "en-GB") : "—"}
                </div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", marginBottom: "12px" }}>
                <tbody>
                  {[
                    [TH ? "ขนาดต่อครั้ง" : "Dose", `${numbers.d} ml`],
                    [TH ? "ความถี่" : "Frequency", `${numbers.f} ${TH ? "ครั้ง/วัน" : "times/day"}`],
                    [TH ? "ระยะเวลา" : "Duration", `${result.totalDays} ${TH ? "วัน" : "days"}`],
                    [TH ? "ปริมาตรต่อขวด" : "Bottle size", `${numbers.b} ml`],
                    [TH ? "จำนวนขวด" : "Bottles", `${result.bottles}`],
                    ...(Number.isFinite(numbers.stab) ? [[TH ? "อายุความคงตัว" : "Stability", `${numbers.stab} ${TH ? "วัน" : "days"}`]] : []),
                    ...(expiration ? [
                      [TH ? "เตรียมเมื่อ" : "Prepared", fmtDateTime(expiration.prep)],
                    ] : []),
                  ].map(([k, v], i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "5px 8px", color: "#475569", width: "50%" }}>{k}</td>
                      <td style={{ padding: "5px 8px", fontWeight: 600 }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {expiration && (
                <div style={{ border: "4px solid #b91c1c", background: "#fef2f2", borderRadius: "10px", padding: "14px", marginBottom: "12px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#b91c1c", letterSpacing: "1.5px", textTransform: "uppercase", textAlign: "center" }}>
                    ⚠ {TH ? "คำเตือนวันหมดอายุ" : "Expiration Warning"} ⚠
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#7f1d1d", marginTop: "8px", textAlign: "center" }}>
                    {TH ? "ขวดที่เตรียมนี้จะหมดอายุวันที่" : "This prepared bottle expires on"}
                  </div>
                  <div style={{ fontSize: "26px", fontWeight: 900, color: "#b91c1c", margin: "4px 0", textAlign: "center" }}>
                    {fmtDateTime(expiration.exp)}
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 800, color: "#b91c1c", textAlign: "center", textTransform: "uppercase" }}>
                    {TH ? "ห้ามรับประทานหลังเวลานี้" : "DO NOT consume after this time"}
                  </div>
                </div>
              )}
              <div style={{ background: "#ecfdf5", border: "2px solid #059669", borderRadius: "8px", padding: "10px", marginBottom: "12px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#065f46", textTransform: "uppercase", letterSpacing: "1px" }}>
                  {TH ? "ระยะเวลาการรักษารวม" : "Total Duration of Use"}
                </div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#065f46", marginTop: "4px" }}>
                  {result.totalDays} {TH ? "วัน" : "days"}
                </div>
              </div>
              {refillDate && result.bottles > 1 && (
                <div style={{ background: "#fffbeb", border: "2px solid #d97706", borderRadius: "8px", padding: "10px", marginBottom: "12px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 800, color: "#92400e", textTransform: "uppercase", letterSpacing: "1px", textAlign: "center" }}>
                    ⏰ {TH ? "นัดมารับยาขวดถัดไป" : "Return for Refill"}
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#92400e", marginTop: "4px", textAlign: "center" }}>
                    {fmtDateTime(refillDate)}
                  </div>
                  <div style={{ fontSize: "10px", color: "#78350f", marginTop: "4px", textAlign: "center" }}>
                    {TH
                      ? "กรุณามารับยาขวดใหม่ก่อนยาขวดปัจจุบันหมดอายุ 1 วัน"
                      : "Please return 1 day before the current bottle expires."}
                  </div>
                </div>
              )}
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "6px", padding: "10px", marginBottom: "12px", fontSize: "13px" }}>
                <div style={{ fontWeight: 700, color: "#1e3a8a", fontSize: "11px", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {TH ? "วิธีใช้สำหรับผู้ป่วย" : "Patient instruction"}
                </div>
                <div>EN: Take {numbers.d} ml {FREQ_OPTIONS.find((o) => o.value === String(numbers.f))?.subEn?.toLowerCase() ?? `${numbers.f} times daily`} after meals.</div>
                <div>ไทย: รับประทาน {numbers.d} มล. {FREQ_OPTIONS.find((o) => o.value === String(numbers.f))?.labelTh ?? `วันละ ${numbers.f} ครั้ง`} หลังอาหาร</div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setPreviewOpen(false)}>
            <X className="h-4 w-4 mr-1" /> {TH ? "ปิด" : "Close"}
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
