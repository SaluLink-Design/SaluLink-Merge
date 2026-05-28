import { NextRequest, NextResponse } from 'next/server';
import {
  isEmailDeliveryConfigured,
  sendPatientClaimEmail,
} from '@/lib/email/sendPatientClaimEmail';

export const maxDuration = 30;

interface SendPatientClaimBody {
  patientEmail?: string;
  patientName?: string;
  practiceName?: string;
  doctorName?: string;
  attachmentFilename?: string;
  attachmentBase64?: string;
}

export async function GET() {
  return NextResponse.json({
    configured: isEmailDeliveryConfigured(),
    provider: 'resend',
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!isEmailDeliveryConfigured()) {
      return NextResponse.json(
        {
          error: 'Email delivery is not configured',
          configured: false,
          hint: 'Add RESEND_API_KEY and RESEND_FROM_EMAIL to .env.local',
        },
        { status: 503 }
      );
    }

    const body = (await request.json()) as SendPatientClaimBody;
    const {
      patientEmail,
      patientName,
      practiceName,
      doctorName,
      attachmentFilename,
      attachmentBase64,
    } = body;

    if (!patientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail)) {
      return NextResponse.json({ error: 'Valid patient email is required' }, { status: 400 });
    }
    if (!patientName?.trim()) {
      return NextResponse.json({ error: 'Patient name is required' }, { status: 400 });
    }
    if (!attachmentFilename || !attachmentBase64) {
      return NextResponse.json({ error: 'Claim attachment is required' }, { status: 400 });
    }

    const result = await sendPatientClaimEmail({
      patientEmail: patientEmail.trim(),
      patientName: patientName.trim(),
      practiceName: practiceName?.trim() || 'Your practice',
      doctorName: doctorName?.trim(),
      attachmentFilename,
      attachmentBase64,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      deliveryMethod: 'automated',
    });
  } catch (error) {
    console.error('send-patient-claim error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send claim email' },
      { status: 500 }
    );
  }
}
