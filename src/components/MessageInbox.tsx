import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Msg {
  id: string;
  subject: string;
  body: string;
  is_broadcast: boolean;
  recipient_member_id: string | null;
  created_at: string;
}

export const MessageInbox = () => {
  const { member } = useAuth();
  const { t } = useI18n();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const load = async () => {
    if (!member) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`is_broadcast.eq.true,recipient_member_id.eq.${member.id}`)
      .order("created_at", { ascending: false })
      .limit(50);
    setMessages((data as Msg[]) ?? []);
    const { data: reads } = await supabase
      .from("message_reads")
      .select("message_id")
      .eq("member_id", member.id);
    setReadIds(new Set((reads ?? []).map((r) => r.message_id)));
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("msg-inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.id]);

  const markRead = async (id: string) => {
    if (!member || readIds.has(id)) return;
    setReadIds((s) => new Set(s).add(id));
    await supabase.from("message_reads").insert({ message_id: id, member_id: member.id });
  };

  const unread = messages.filter((m) => !readIds.has(m.id)).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative" title={t("inbox")}>
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold grid place-items-center">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-sm">{t("inbox")}</h3>
          {unread > 0 && <Badge variant="destructive">{unread} {t("newMessage")}</Badge>}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="p-4 text-sm text-slate-500 text-center">{t("noMessages")}</div>
          ) : (
            messages.map((m) => {
              const isUnread = !readIds.has(m.id);
              return (
                <Card
                  key={m.id}
                  onClick={() => markRead(m.id)}
                  className={`m-2 p-3 cursor-pointer border ${
                    isUnread ? "bg-brand/5 border-brand/30" : "bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs text-slate-500">
                      {new Date(m.created_at).toLocaleString()}
                      {m.is_broadcast && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          {t("everyone")}
                        </Badge>
                      )}
                    </div>
                    {isUnread && <span className="h-2 w-2 rounded-full bg-brand mt-1" />}
                  </div>
                  {m.subject && <div className="font-semibold text-sm mt-1">{m.subject}</div>}
                  <div className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{m.body}</div>
                </Card>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
