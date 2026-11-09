-- Owner RPCs are callable only by authenticated users and must not elevate
-- their privileges. Keep explicit role checks and let caller RLS remain active.
ALTER FUNCTION public.owner_create_clinic_with_owner(text, text, text, text)
  SECURITY INVOKER;
ALTER FUNCTION public.owner_review_clinic_payment(text, text, text, integer, text)
  SECURITY INVOKER;
