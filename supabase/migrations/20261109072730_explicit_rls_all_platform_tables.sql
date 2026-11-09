-- Make the RLS boundary explicit and reproducible for all platform tables.
-- Existing policies are retained; this statement is idempotent.
BEGIN;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adherence_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adherence_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
COMMIT;
