import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Trash2, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

interface Member {
  id: string;
  employee_id: string;
  display_name: string;
  status: string;
}
interface Msg {
  id: string;
  recipient_member_id: string | null;
  is_broadcast: boolean;
  subject: string;
  body: string;
  created_at: string;
}

interface Props {
  members: Member[];
}

export const AdminMessages = ({ members }: Props) => {
  const { t } = useI18n();
  const [recipientId, setRecipientId] = useState<string>("__broadcast__");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);

  const approved = members.filter((m) => m.status === "approved");

  const load = async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setMsgs((data as Msg[]) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const send = async () => {
    if (!body.trim()) {
      toast.error("Message body required");
      return;
    }
    setSending(true);
    const isBroadcast = recipientId === "__broadcast__";
    const payload = isBroadcast
      ? { is_broadcast: true, recipient_member_id: null, recipient_employee_id: null, subject, body }
      : {
          is_broadcast: false,
          recipient_member_id: recipientId,
          recipient_employee_id:
            approved.find((m) => m.id === recipientId)?.employee_id ?? null,
          subject,
          body,
        };
    const { error } = await supabase.from("messages").insert(payload);
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success(t("sent"));
    setSubject("");
    setBody("");
    load();
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const nameFor = (m: Msg) => {
    if (m.is_broadcast) return t("everyone");
    const member = members.find((x) => x.id === m.recipient_member_id);
    return member ? `${member.display_name} #${member.employee_id}` : "—";
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="clinical-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Send className="h-4 w-4 text-brand" />
          <h3 className="font-semibold">{t("sendMessage")}</h3>
        </div>
        <div className="space-y-3">
          <div>
            <Label className="label-clinical">{t("recipient")}</Label>
            <Select value={recipientId} onValueChange={setRecipientId}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__broadcast__">
                  📢 {t("broadcastAll")}
                </SelectItem>
                {approved.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.display_name} · #{m.employee_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="label-clinical">{t("subject")}</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="label-clinical">{t("messageBody")}</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="mt-1"
            />
          </div>
          <Button
            onClick={send}
            disabled={sending}
            className="w-full bg-brand hover:bg-brand/90 text-brand-foreground"
          >
            <Send className="h-4 w-4 mr-2" /> {t("send")}
          </Button>
        </div>
      </Card>

      <Card className="clinical-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Megaphone className="h-4 w-4 text-brand" />
          <h3 className="font-semibold">{t("sent")}</h3>
        </div>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {msgs.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-6">{t("noMessages")}</div>
          ) : (
            msgs.map((m) => (
              <div key={m.id} className="border border-slate-200 rounded-md p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs text-slate-500">
                    {t("to")}: <span className="font-medium text-slate-700">{nameFor(m)}</span>
                    {m.is_broadcast && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        {t("everyone")}
                      </Badge>
                    )}
                    <div>{new Date(m.created_at).toLocaleString()}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => del(m.id)}>
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </div>
                {m.subject && <div className="font-semibold text-sm mt-1">{m.subject}</div>}
                <div className="text-sm text-slate-700 whitespace-pre-wrap">{m.body}</div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
