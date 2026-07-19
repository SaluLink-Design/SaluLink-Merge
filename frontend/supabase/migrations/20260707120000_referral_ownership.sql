-- Add care ownership tracking to case_referrals
-- Enables the mixed-model EEG referral workflow: GP refers with default ownership,
-- specialist assesses post-EEG, then explicitly accepts handover or returns to GP.

ALTER TABLE case_referrals
  ADD COLUMN IF NOT EXISTS care_ownership text NOT NULL DEFAULT 'pending_decision'
    CHECK (care_ownership IN ('pending_decision', 'gp_retained', 'specialist_accepted')),
  ADD COLUMN IF NOT EXISTS specialist_outcome_note text DEFAULT '',
  ADD COLUMN IF NOT EXISTS ownership_decided_at timestamptz;

COMMENT ON COLUMN case_referrals.care_ownership IS
  'pending_decision: awaiting specialist post-assessment decision; '
  'gp_retained: specialist returns patient to GP for CIB submission; '
  'specialist_accepted: specialist takes over chronic management and initiates CIB.';

COMMENT ON COLUMN case_referrals.specialist_outcome_note IS
  'Specialist EEG interpretation + plan returned to GP, or specialist management rationale.';

COMMENT ON COLUMN case_referrals.ownership_decided_at IS
  'Timestamp when specialist recorded the ownership decision.';
