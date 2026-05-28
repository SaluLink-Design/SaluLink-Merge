import { NextRequest, NextResponse } from 'next/server';

// Increase timeout for Vercel Edge Functions (max 60s for hobby tier)
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clinical_note, benefit_state, workflow_mode } = body;

    if (!clinical_note) {
      return NextResponse.json(
        { error: 'Clinical note is required' },
        { status: 400 }
      );
    }

    // Call Python backend
    const backendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
    console.log('Calling backend:', backendUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); // 55 second timeout

    try {
      const response = await fetch(`${backendUrl}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clinical_note,
          benefit_state: benefit_state ?? 'unregistered',
          workflow_mode: workflow_mode ?? 'registration',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend error response:', errorText);
        throw new Error(`Backend returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('Analysis successful:', data.matched_conditions?.length || 0, 'conditions found');

      return NextResponse.json(data);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('Request timeout after 55 seconds');
        return NextResponse.json(
          { error: 'Analysis request timed out. The model may be initializing. Please try again in a moment.' },
          { status: 504 }
        );
      }
      throw fetchError;
    }
  } catch (error: any) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to analyze clinical note. Please check that the backend is accessible.',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}

