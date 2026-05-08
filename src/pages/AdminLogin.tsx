import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { LangSwitcher } from "@/components/LangSwitcher";

const ACCESS_CODE = "25031998";
export const ADMIN_KEY = "pharmcalc.admin";

const AdminLogin = () => {
  const { t } = useI18n();
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (code.trim() !== ACCESS_CODE) {
      setLoading(false);
      toast.error(t("invalidCode"));
      return;
    }
    localStorage.setItem(ADMIN_KEY, "1");
    toast.success("Admin signed in");
    nav("/admin");
  };

  return (
    <div className="min-h-screen bg-clinical-bg grid place-items-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-slate-900 text-white grid place-items-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="font-bold">{t("adminLogin")}</span>
          </div>
          <LangSwitcher />
        </div>
        <Card className="clinical-card p-6">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="label-clinical">{t("accessCode")}</Label>
              <Input
                type="password"
                inputMode="numeric"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 font-mono tracking-widest text-center"
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {t("signIn")}
            </Button>
          </form>
          <div className="text-xs text-slate-500 mt-4 text-center">
            <Link to="/login" className="hover:underline">← {t("back")}</Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogin;
