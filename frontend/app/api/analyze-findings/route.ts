import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clinical_note, condition, icd_code, test_findings } = body;

    if (!clinical_note && !test_findings) {
      return NextResponse.json(
        { error: 'Clinical note or test findings are required' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    const combinedNote = [
      clinical_note || '',
      condition ? `Suspected condition: ${condition}` : '',
      icd_code ? `ICD-10: ${icd_code}` : '',
      '--- Diagnostic test findings ---',
      test_findings || '',
    ].join('\n\n');

    try {
      const response = await fetch(`${backendUrl}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinical_note: combinedNote,
          workflow_mode: 'evidence_review',
          benefit_state: 'unregistered',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const conditions = data.matched_conditions || [];
      const top = conditions[0];

      const summary = [
        'Authi evidence review summary',
        '',
        top
          ? `Top matched condition: ${top.condition} (${top.icd_code}) — confidence ${Math.round((top.similarity_score || 0) * 100)}%`
          : 'Review documented findings against PMB CDL entry criteria.',
        '',
        data.extracted_keywords?.length
          ? `Key terms: ${data.extracted_keywords.slice(0, 8).join(', ')}`
          : '',
        '',
        'Confirm that diagnostic evidence supports chronic disease registration before submitting the CIB application.',
      ]
        .filter(Boolean)
        .join('\n');

      return NextResponse.json({ summary, ...data });
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Analysis request timed out. Please try again.' },
          { status: 504 }
        );
      }
      throw fetchError;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to analyze findings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
