import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRightLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type U = "mcg" | "mg" | "g";
const FACTORS: Record<U, number> = { mcg: 1, mg: 1000, g: 1_000_000 };

export const UnitConverter = () => {
  const { t } = useI18n();
  const [amount, setAmount] = useState("1");
  const [from, setFrom] = useState<U>("mg");
  const [to, setTo] = useState<U>("mcg");

  const a = parseFloat(amount);
  const result = !isNaN(a) ? (a * FACTORS[from]) / FACTORS[to] : null;

  return (
    <div className="grid gap-6 lg:grid-cols-2 max-w-3xl">
      <Card className="clinical-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <ArrowRightLeft className="h-5 w-5 text-brand" />
          <h2 className="text-lg font-semibold">{t("unitConvert")}</h2>
        </div>
        <div className="space-y-4">
          <div>
            <Label className="label-clinical">{t("amount")}</Label>
            <Input
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="label-clinical">{t("fromUnit")}</Label>
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value as U)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="mcg">mcg</option>
                <option value="mg">mg</option>
                <option value="g">g</option>
              </select>
            </div>
            <div>
              <Label className="label-clinical">{t("toUnit")}</Label>
              <select
                value={to}
                onChange={(e) => setTo(e.target.value as U)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="mcg">mcg</option>
                <option value="mg">mg</option>
                <option value="g">g</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      <Card className="clinical-card p-6 flex flex-col justify-center">
        <div className="label-clinical">{t("conversionResult")}</div>
        <div className="text-3xl font-bold mt-2">
          {result !== null ? result.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "—"}{" "}
          <span className="text-base font-medium text-slate-500">{to}</span>
        </div>
        <div className="text-sm text-slate-500 mt-2">
          {amount} {from} = {result?.toLocaleString(undefined, { maximumFractionDigits: 6 })} {to}
        </div>
      </Card>
    </div>
  );
};
