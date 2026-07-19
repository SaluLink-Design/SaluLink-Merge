import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const backendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    try {
      const response = await fetch(`${backendUrl}/ongoing-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return NextResponse.json(data);
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Ongoing assessment request timed out.' },
          { status: 504 }
        );
      }
      throw fetchError;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to run ongoing assessment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
