import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Beaker, Clock, LogOut, Droplet, ArrowRightLeft, Baby, Eye } from "lucide-react";
import { AdmixtureCalculator } from "@/components/AdmixtureCalculator";
import { InfusionCalculator } from "@/components/InfusionCalculator";
import { FluidDurationCalculator } from "@/components/FluidDurationCalculator";
import { UnitConverter } from "@/components/UnitConverter";
import { PediatricLiquidCalculator } from "@/components/PediatricLiquidCalculator";
import { EyeDropsCalculator } from "@/components/EyeDropsCalculator";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Navigate, useNavigate } from "react-router-dom";
import { LangSwitcher } from "@/components/LangSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MessageInbox } from "@/components/MessageInbox";
import bphLogo from "@/assets/bangkok-hospital-logo.png";

const Index = () => {
  const { member, setMember, logActivity } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();

  if (!member) return <Navigate to="/login" replace />;

  const signOut = async () => {
    await logActivity("logout");
    setMember(null);
    nav("/login");
  };

  return (
    <div className="min-h-screen bg-clinical-bg">
      <header className="border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 no-print">
        <div className="container max-w-6xl py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={bphLogo}
              alt="Bangkok Hospital"
              className="h-10 w-auto object-contain shrink-0"
            />
            <div className="hidden sm:block h-8 w-px bg-border" aria-hidden />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground leading-tight">
                PharmCalc <span className="text-brand">Pro</span>
              </h1>
              <p className="text-[11px] sm:text-xs font-medium" style={{ color: "#397D54" }}>
                powered by Chanunyu R. Pharmacist
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block text-right mr-2">
              <div className="text-xs text-muted-foreground">{t("welcome")}</div>
              <div className="text-sm font-semibold text-foreground">
                {member.display_name}{" "}
                <span className="text-muted-foreground font-mono text-xs">#{member.employee_id}</span>
              </div>
            </div>
            <ThemeToggle />
            <LangSwitcher />
            <MessageInbox />
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-1" /> {t("logout")}
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-6 sm:py-10">
        <Tabs
          defaultValue="pediatric"
          className="w-full"
          onValueChange={(v) => logActivity("open_tab", { tab: v })}
        >
          <TabsList className="h-auto grid w-full max-w-3xl grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mb-6 no-print">
            <TabsTrigger value="pediatric" className="gap-2">
  <Baby className="h-4 w-4" /> {t("pediatricLiquid")}
</TabsTrigger>
<TabsTrigger value="eyedrops" className="gap-2">
  <Eye className="h-4 w-4" /> {t("eyeDrops")}
</TabsTrigger>
<TabsTrigger value="admixture" className="gap-2">
  <Beaker className="h-4 w-4" /> {t("admixture")}
</TabsTrigger>
<TabsTrigger value="infusion" className="gap-2">
  <Clock className="h-4 w-4" /> {t("infusionTime")}
</TabsTrigger>
<TabsTrigger value="fluid" className="gap-2">
  <Droplet className="h-4 w-4" /> {t("fluidDuration")}
</TabsTrigger>
<TabsTrigger value="convert" className="gap-2">
  <ArrowRightLeft className="h-4 w-4" /> {t("unitConvert")}
</TabsTrigger>
          </TabsList>
          <TabsContent value="pediatric"><PediatricLiquidCalculator /></TabsContent>
<TabsContent value="eyedrops"><EyeDropsCalculator /></TabsContent>
<TabsContent value="admixture"><AdmixtureCalculator /></TabsContent>
<TabsContent value="infusion"><InfusionCalculator /></TabsContent>
<TabsContent value="fluid"><FluidDurationCalculator /></TabsContent>
<TabsContent value="convert"><UnitConverter /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
