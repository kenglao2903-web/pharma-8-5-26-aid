-- Messages from admin to members (per-member or broadcast)
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_member_id UUID NULL REFERENCES public.members(id) ON DELETE CASCADE,
  recipient_employee_id TEXT NULL,
  is_broadcast BOOLEAN NOT NULL DEFAULT false,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.message_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, member_id)
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

-- Permissive read/write since admin gate is client-side and member login is by 6-digit ID
CREATE POLICY "Anyone can read messages"
ON public.messages FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can insert messages"
ON public.messages FOR INSERT TO anon, authenticated WITH CHECK (length(body) > 0);

CREATE POLICY "Anyone can delete messages"
ON public.messages FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Anyone can read message reads"
ON public.message_reads FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can mark read"
ON public.message_reads FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Allow admin to clear / delete logs (currently only insert/select allowed)
CREATE POLICY "Anyone can delete logs"
ON public.activity_logs FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX idx_messages_recipient ON public.messages(recipient_member_id);
CREATE INDEX idx_messages_broadcast ON public.messages(is_broadcast);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);