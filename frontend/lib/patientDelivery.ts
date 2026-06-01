import { PATIENT_EMAIL_SETUP_HINT } from '@/lib/email/checkEmailDelivery';
import { downloadZipFile } from '@/lib/patientExport';
import { PDFExportService } from '@/lib/pdfExport';
import type { PatientCase } from '@/types';

export { PATIENT_EMAIL_SETUP_HINT };

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to encode attachment'));
        return;
      }
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('Failed to encode attachment'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read attachment'));
    reader.readAsDataURL(blob);
  });
}

function deliverViaMailto(
  patientCase: PatientCase,
  patientEmail: string,
  practiceName: string,
  filename: string,
  zipBlob: Blob
): void {
  downloadZipFile(zipBlob, filename);

  const subject = encodeURIComponent(`Your claim documents from ${practiceName}`);
  const body = encodeURIComponent(
    `Dear ${patientCase.patientName},\n\nPlease find your claim package attached. If the download did not start automatically, contact the practice.\n\nRegards,\n${practiceName}`
  );
  window.location.href = `mailto:${patientEmail}?subject=${subject}&body=${body}`;
}

export type PatientDeliveryResult =
  | { method: 'automated'; messageId?: string }
  | { method: 'manual'; reason: string };

export async function deliverClaimToPatient(
  patientCase: PatientCase,
  patientEmail: string,
  practiceName: string,
  doctorName?: string
): Promise<PatientDeliveryResult> {
  const pdfService = new PDFExportService();
  const { blob: zipBlob, downloadName } = await pdfService.buildClaimPackageZip(patientCase);
  const timestamp = new Date().toISOString().split('T')[0];
  const filename =
    downloadName ||
    `Patient_Claim_${patientCase.patientName.replace(/\s+/g, '_')}_${timestamp}.zip`;

  try {
    const attachmentBase64 = await blobToBase64(zipBlob);
    const response = await fetch('/api/send-patient-claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientEmail,
        patientName: patientCase.patientName,
        practiceName,
        doctorName,
        attachmentFilename: filename,
        attachmentBase64,
      }),
    });

    const payload = (await response.json()) as {
      success?: boolean;
      messageId?: string;
      error?: string;
      configured?: boolean;
    };

    if (response.ok && payload.success) {
      return { method: 'automated', messageId: payload.messageId };
    }

    const reason =
      response.status === 503
        ? PATIENT_EMAIL_SETUP_HINT
        : payload.error || 'Automated email failed';

    deliverViaMailto(patientCase, patientEmail, practiceName, filename, zipBlob);
    return { method: 'manual', reason };
  } catch (error) {
    deliverViaMailto(patientCase, patientEmail, practiceName, filename, zipBlob);
    return {
      method: 'manual',
      reason: error instanceof Error ? error.message : 'Network error',
    };
  }
}
