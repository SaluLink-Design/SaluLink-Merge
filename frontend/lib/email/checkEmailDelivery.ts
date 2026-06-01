export const PATIENT_EMAIL_SETUP_HINT =
  'Add RESEND_API_KEY and RESEND_FROM_EMAIL to .env.local (free key at https://resend.com), then restart npm run dev.';

export async function fetchEmailDeliveryConfigured(): Promise<boolean> {
  try {
    const response = await fetch('/api/send-patient-claim');
    const payload = (await response.json()) as { configured?: boolean };
    return Boolean(payload.configured);
  } catch {
    return false;
  }
}
