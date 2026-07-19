-- Specialist registration completion tracking
--
-- Lets the referral-accepting specialist submit the actual CIB registration
-- (ICD-10, diagnosis date, medication) against the shared case, and gives the
-- GP a signal to detect that the case is now registered so their next claim
-- on this patient is ongoing management, not another registration attempt.
--
-- No new RLS is required: `cases`, `case_medications`, and `case_referrals`
-- are already covered by the referral-recipient policies added in
-- 20260707130000_referral_workspace_sharing.sql.

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS diagnosis_date date;

COMMENT ON COLUMN cases.diagnosis_date IS
  'Date the chronic diagnosis was confirmed — required CIB evidence, previously only held in local wizard state and never persisted.';

ALTER TABLE case_referrals
  ADD COLUMN IF NOT EXISTS registration_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS registration_completed_by uuid REFERENCES auth.users(id);

COMMENT ON COLUMN case_referrals.registration_completed_at IS
  'Set when the specialist (target_workspace_id) submits the full CIB registration for this case — distinct from ownership_decided_at, which only marks the accept/return decision.';
COMMENT ON COLUMN case_referrals.registration_completed_by IS
  'auth.users.id of the specialist who submitted the registration.';

CREATE INDEX IF NOT EXISTS idx_case_referrals_registration_completed
  ON case_referrals(registration_completed_at);
