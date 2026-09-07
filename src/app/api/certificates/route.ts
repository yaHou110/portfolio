import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { credentials } from '@learning-platform/core/api';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const IssueSchema = z.object({
  enrollmentId: z.string().uuid(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = IssueSchema.parse(await request.json());
    const result = await credentials.issueCertificate(body.enrollmentId);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'ENROLLMENT_NOT_FOUND_OR_NOT_COMPLETED') {
      return NextResponse.json(
        { error: 'Enrollment not found or not completed' },
        { status: 404 }
      );
    }
    console.error('Error issuing certificate:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
