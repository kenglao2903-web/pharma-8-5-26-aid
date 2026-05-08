import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Activity } from "lucide-react";
import { LangSwitcher } from "@/components/LangSwitcher";

const Register = () => {
  const { t } = useI18n();
  const nav = useNavigate();
  const [employeeId, setEid] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[0-9]{6}$/.test(employeeId)) return toast.error(t("invalidId"));
    if (!name.trim()) return toast.error(t("displayName"));
    setLoading(true);
    const { error } = await supabase
      .from("members")
      .insert([{ employee_id: employeeId, display_name: name.trim(), status: "pending" }]);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("registrationSubmitted"));
    nav("/login");
  };

  return (
    <div className="min-h-screen bg-clinical-bg grid place-items-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-brand text-brand-foreground grid place-items-center">
              <Activity className="h-4 w-4" />
            </div>
            <span className="font-bold">{t("appName")}</span>
          </div>
          <LangSwitcher />
        </div>
        <Card className="clinical-card p-6">
          <h1 className="text-lg font-semibold mb-4">{t("register")}</h1>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="label-clinical">{t("employeeId")}</Label>
              <Input
                inputMode="numeric"
                maxLength={6}
                value={employeeId}
                onChange={(e) => setEid(e.target.value.replace(/\D/g, ""))}
                className="mt-1 tracking-widest text-center font-mono"
                placeholder="000000"
              />
            </div>
            <div>
              <Label className="label-clinical">{t("displayName")}</Label>
              <Input
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-brand hover:bg-brand/90 text-brand-foreground">
              {t("register")}
            </Button>
          </form>
          <div className="text-sm text-slate-600 mt-4 text-center">
            {t("haveAccount")}{" "}
            <Link to="/login" className="text-brand font-medium hover:underline">
              {t("signInNow")}
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Register;
