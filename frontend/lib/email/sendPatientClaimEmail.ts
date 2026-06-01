import { Resend } from 'resend';

export interface SendPatientClaimEmailInput {
  patientEmail: string;
  patientName: string;
  practiceName: string;
  doctorName?: string;
  attachmentFilename: string;
  attachmentBase64: string;
}

export interface SendPatientClaimEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export function isEmailDeliveryConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export async function sendPatientClaimEmail(
  input: SendPatientClaimEmailInput
): Promise<SendPatientClaimEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    return {
      success: false,
      error: 'Email delivery is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.',
    };
  }

  const resend = new Resend(apiKey);
  const senderLabel = input.doctorName
    ? `${input.practiceName} (${input.doctorName})`
    : input.practiceName;

  const { data, error } = await resend.emails.send({
    from: `${input.practiceName} <${fromEmail}>`,
    to: input.patientEmail,
    subject: `Your claim documents from ${input.practiceName}`,
    html: `
      <p>Dear ${input.patientName},</p>
      <p>Please find your claim package attached for submission to your medical aid.</p>
      <p>If you have questions, contact ${senderLabel}.</p>
      <p>Regards,<br/>${input.practiceName}</p>
    `,
    attachments: [
      {
        filename: input.attachmentFilename,
        content: Buffer.from(input.attachmentBase64, 'base64'),
      },
    ],
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, messageId: data?.id };
}
