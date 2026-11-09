-- Remove four permissive legacy PUBLIC policies left by the original
-- manually-provisioned Production schema. Their equivalent least-privilege
-- authenticated policies are already created by the preceding alignment.
BEGIN;
DROP POLICY IF EXISTS adherence_config_access ON public.adherence_configs;
DROP POLICY IF EXISTS adherence_scores_access ON public.adherence_scores;
DROP POLICY IF EXISTS consents_access ON public.consents;
DROP POLICY IF EXISTS fcm_tokens_access ON public.fcm_tokens;
COMMIT;
