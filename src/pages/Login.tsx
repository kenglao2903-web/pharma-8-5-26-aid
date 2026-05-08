import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { LangSwitcher } from "@/components/LangSwitcher";
import { ArrowRight, ShieldCheck } from "lucide-react";
import bphLogo from "@/assets/bangkok-hospital-pattaya.png";
import heroImg from "@/assets/login-hero.jpg";

const Login = () => {
  const { t } = useI18n();
  const { setMember } = useAuth();
  const nav = useNavigate();
  const [employeeId, setEid] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[0-9]{6}$/.test(employeeId)) {
      toast.error(t("invalidId"));
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("members")
      .select("id, employee_id, display_name, status")
      .eq("employee_id", employeeId)
      .maybeSingle();
    setLoading(false);
    if (error || !data) {
      toast.error(t("notFound"));
      return;
    }
    if (data.status === "pending") return toast.error(t("pendingApproval"));
    if (data.status === "rejected") return toast.error(t("rejected"));
    const m = { id: data.id, employee_id: data.employee_id, display_name: data.display_name };
    setMember(m);
    await supabase.from("activity_logs").insert([
      {
        member_id: m.id,
        employee_id: m.employee_id,
        display_name: m.display_name,
        action: "login",
        details: null as never,
      },
    ]);
    toast.success(`${t("welcome")}, ${m.display_name}`);
    nav("/");
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      {/* Full-bleed background */}
      <img
        src={heroImg}
        alt=""
        width={1920}
        height={1280}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Clinical white wash for minimal feel */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-white/85 via-white/70 to-white/55 dark:from-background/90 dark:via-background/80 dark:to-background/60"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--brand)/0.10),transparent_55%)]"
      />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-end px-6 sm:px-10 py-5">
        <LangSwitcher />
      </header>

      {/* Centered glass form */}
      <section className="relative z-10 grid place-items-center px-4 pb-16 pt-2">
        <div className="w-full max-w-md">
          {/* Prominent hero logo */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              <div
                aria-hidden
                className="absolute inset-0 -m-6 rounded-full bg-brand/20 blur-2xl"
              />
              <div className="relative rounded-2xl bg-card/90 backdrop-blur-xl border border-border/60 shadow-[0_20px_60px_-20px_hsl(var(--brand)/0.45)] p-5">
                <img
                  src={bphLogo}
                  alt="Bangkok Hospital Pattaya"
                  className="h-24 sm:h-28 w-auto object-contain"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-[0_20px_60px_-20px_hsl(var(--brand)/0.35)]">
            <div className="px-7 pt-8 pb-7">
              <div className="flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground mb-6">
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
                BPH Pharmacy Department
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Sign in to <span className="text-brand">PharmCalc Pro</span>
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your 6-digit employee ID to continue.
              </p>

              <form onSubmit={submit} className="mt-7 space-y-5">
                <div>
                  <Label className="label-clinical">{t("employeeId")}</Label>
                  <Input
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={employeeId}
                    onChange={(e) => setEid(e.target.value.replace(/\D/g, ""))}
                    className="mt-2 h-14 text-center font-mono text-2xl tracking-[0.5em]"
                    placeholder="000000"
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="group w-full h-12 bg-brand hover:bg-brand/90 text-brand-foreground font-semibold text-base"
                >
                  {loading ? "…" : t("signIn")}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-muted-foreground">
                {t("noAccount")}{" "}
                <Link to="/register" className="font-semibold text-brand hover:underline">
                  {t("registerNow")}
                </Link>
              </div>
            </div>

            <div className="border-t border-border/60 px-7 py-3 flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-brand" />
                Secure access
              </span>
              <Link to="/admin/login" className="hover:text-foreground hover:underline">
                {t("adminLogin")}
              </Link>
            </div>
          </div>

          <p
            className="mt-6 text-center text-xs font-medium"
            style={{ color: "#397D54" }}
          >
            powered by Chanunyu R. Pharmacist
          </p>
        </div>
      </section>
    </main>
  );
};

export default Login;
