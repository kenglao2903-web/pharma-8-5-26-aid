import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MemberSession {
  id: string;
  employee_id: string;
  display_name: string;
}

interface AuthCtx {
  member: MemberSession | null;
  setMember: (m: MemberSession | null) => void;
  logActivity: (action: string, details?: Record<string, unknown>) => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);
const KEY = "pharmcalc.member";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [member, setMemberState] = useState<MemberSession | null>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const setMember = (m: MemberSession | null) => {
    setMemberState(m);
    if (m) localStorage.setItem(KEY, JSON.stringify(m));
    else localStorage.removeItem(KEY);
  };

  const logActivity = async (action: string, details?: Record<string, unknown>) => {
    if (!member) return;
    await supabase.from("activity_logs").insert([
      {
        member_id: member.id,
        employee_id: member.employee_id,
        display_name: member.display_name,
        action,
        details: (details ?? null) as never,
      },
    ]);
  };

  useEffect(() => {
    if (member) {
      // Re-verify status occasionally
      supabase
        .from("members")
        .select("status")
        .eq("id", member.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data || data.status !== "approved") setMember(null);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Ctx.Provider value={{ member, setMember, logActivity }}>{children}</Ctx.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
