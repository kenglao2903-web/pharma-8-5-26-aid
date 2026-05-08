import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import {
  ShieldCheck,
  LogOut,
  Check,
  X,
  Users,
  Activity as ActivityIcon,
  Trash2,
  MessageSquare,
} from "lucide-react";
import { LangSwitcher } from "@/components/LangSwitcher";
import { ADMIN_KEY } from "./AdminLogin";
import { AdminMessages } from "@/components/AdminMessages";

interface Member {
  id: string;
  employee_id: string;
  display_name: string;
  status: string;
  created_at: string;
}
interface LogRow {
  id: string;
  employee_id: string | null;
  display_name: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

const Admin = () => {
  const { t } = useI18n();
  const nav = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (localStorage.getItem(ADMIN_KEY) !== "1") {
      nav("/admin/login");
      return;
    }
    setAuthorized(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    const [{ data: m }, { data: l }] = await Promise.all([
      supabase.from("members").select("*").order("created_at", { ascending: false }),
      supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    setMembers((m as Member[]) ?? []);
    setLogs((l as LogRow[]) ?? []);
    setSelectedLogs(new Set());
  };

  const updateStatus = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase
      .from("members")
      .update({ status, approved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? t("approve") : t("reject"));
    load();
  };

  const deleteMember = async (id: string) => {
    const { error } = await supabase.from("members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("deleteMember"));
    load();
  };

  const clearAllLogs = async () => {
    const { error } = await supabase
      .from("activity_logs")
      .delete()
      .not("id", "is", null);
    if (error) return toast.error(error.message);
    toast.success(t("clearAllLogs"));
    load();
  };

  const deleteSelectedLogs = async () => {
    if (selectedLogs.size === 0) return;
    const { error } = await supabase
      .from("activity_logs")
      .delete()
      .in("id", Array.from(selectedLogs));
    if (error) return toast.error(error.message);
    toast.success(`Deleted ${selectedLogs.size}`);
    load();
  };

  const toggleLog = (id: string) => {
    setSelectedLogs((s) => {
      const ns = new Set(s);
      if (ns.has(id)) ns.delete(id);
      else ns.add(id);
      return ns;
    });
  };
  const toggleAllLogs = () => {
    setSelectedLogs((s) =>
      s.size === logs.length ? new Set() : new Set(logs.map((l) => l.id))
    );
  };

  const signOut = () => {
    localStorage.removeItem(ADMIN_KEY);
    nav("/admin/login");
  };

  if (authorized === null) {
    return <div className="min-h-screen grid place-items-center text-slate-500">…</div>;
  }

  const pending = members.filter((m) => m.status === "pending");

  return (
    <div className="min-h-screen bg-clinical-bg">
      <header className="border-b border-slate-200 bg-white">
        <div className="container max-w-6xl py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-slate-900 text-white grid place-items-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{t("adminPanel")}</h1>
              <p className="text-xs text-slate-500">{t("appName")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LangSwitcher />
            <Button variant="outline" size="sm" onClick={() => nav("/")}>{t("back")}</Button>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-1" /> {t("logout")}
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-6">
        <Tabs defaultValue="pending">
          <TabsList className="mb-4 flex-wrap h-auto">
            <TabsTrigger value="pending" className="gap-2">
              <Users className="h-4 w-4" /> {t("pendingMembers")}
              {pending.length > 0 && (
                <Badge variant="destructive" className="ml-1">{pending.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2">
              <Users className="h-4 w-4" /> {t("allMembers")}
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-2">
              <MessageSquare className="h-4 w-4" /> {t("messages")}
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <ActivityIcon className="h-4 w-4" /> {t("activityLogs")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card className="clinical-card p-4">
              {pending.length === 0 ? (
                <div className="text-sm text-slate-500 p-4 text-center">{t("noPending")}</div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {pending.map((m) => (
                    <div key={m.id} className="flex items-center justify-between py-3">
                      <div>
                        <div className="font-mono font-bold">{m.employee_id}</div>
                        <div className="text-sm text-slate-600">{m.display_name}</div>
                        <div className="text-xs text-slate-400">{new Date(m.created_at).toLocaleString()}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => updateStatus(m.id, "approved")} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                          <Check className="h-4 w-4 mr-1" /> {t("approve")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateStatus(m.id, "rejected")}>
                          <X className="h-4 w-4 mr-1" /> {t("reject")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="all">
            <Card className="clinical-card p-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="py-2 pr-4">{t("employeeId")}</th>
                    <th className="py-2 pr-4">{t("name")}</th>
                    <th className="py-2 pr-4">{t("status")}</th>
                    <th className="py-2 pr-4">{t("time")}</th>
                    <th className="py-2 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-t border-slate-200">
                      <td className="py-2 pr-4 font-mono">{m.employee_id}</td>
                      <td className="py-2 pr-4">{m.display_name}</td>
                      <td className="py-2 pr-4">
                        <Badge
                          variant={m.status === "approved" ? "default" : m.status === "pending" ? "secondary" : "destructive"}
                        >
                          {m.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-xs text-slate-500">{new Date(m.created_at).toLocaleString()}</td>
                      <td className="py-2 text-right">
                        <div className="flex gap-1 justify-end">
                          {m.status !== "approved" && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(m.id, "approved")}>
                              {t("approve")}
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <Trash2 className="h-4 w-4 text-danger" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("deleteMember")}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {m.display_name} · #{m.employee_id} — {t("confirmDelete")}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("back")}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMember(m.id)}>
                                  {t("delete")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </TabsContent>

          <TabsContent value="messages">
            <AdminMessages members={members} />
          </TabsContent>

          <TabsContent value="logs">
            <Card className="clinical-card p-4 overflow-x-auto">
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={logs.length > 0 && selectedLogs.size === logs.length}
                    onCheckedChange={toggleAllLogs}
                  />
                  <span className="text-xs text-slate-500">
                    {t("selectAll")} · {selectedLogs.size}/{logs.length}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={selectedLogs.size === 0}
                    onClick={deleteSelectedLogs}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> {t("deleteSelected")}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive" disabled={logs.length === 0}>
                        <Trash2 className="h-4 w-4 mr-1" /> {t("clearAllLogs")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("clearAllLogs")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {logs.length} entries — {t("confirmDelete")}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("back")}</AlertDialogCancel>
                        <AlertDialogAction onClick={clearAllLogs}>
                          {t("delete")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {logs.length === 0 ? (
                <div className="text-sm text-slate-500 p-4 text-center">{t("noLogs")}</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="py-2 pr-2 w-8"></th>
                      <th className="py-2 pr-4">{t("time")}</th>
                      <th className="py-2 pr-4">{t("employeeId")}</th>
                      <th className="py-2 pr-4">{t("name")}</th>
                      <th className="py-2 pr-4">{t("action")}</th>
                      <th className="py-2">{t("details")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id} className="border-t border-slate-200 align-top">
                        <td className="py-2 pr-2">
                          <Checkbox
                            checked={selectedLogs.has(l.id)}
                            onCheckedChange={() => toggleLog(l.id)}
                          />
                        </td>
                        <td className="py-2 pr-4 text-xs text-slate-500 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                        <td className="py-2 pr-4 font-mono">{l.employee_id}</td>
                        <td className="py-2 pr-4">{l.display_name}</td>
                        <td className="py-2 pr-4">
                          <Badge variant="secondary">{l.action}</Badge>
                        </td>
                        <td className="py-2 text-xs text-slate-600">
                          {l.details ? <code>{JSON.stringify(l.details)}</code> : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
