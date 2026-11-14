-- Cover the audit creator foreign key for predictable delete/update checks.
CREATE INDEX IF NOT EXISTS appointments_created_by_idx
  ON public.appointments (created_by);
