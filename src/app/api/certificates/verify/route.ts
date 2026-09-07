import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { credentials } from '@learning-platform/core/api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const hash = searchParams.get('hash');

    if (!hash) {
      return NextResponse.json(
        { error: 'Missing hash parameter' },
        { status: 400 }
      );
    }

    const cert = await credentials.verifyCertificate(hash);

    const now = new Date();
    if (cert.status !== 'active') {
      return NextResponse.json(
        { error: 'Certificate is not active' },
        { status: 410 }
      );
    }

    if (cert.expirationDate && new Date(cert.expirationDate) < now) {
      return NextResponse.json(
        { error: 'Certificate has expired' },
        { status: 410 }
      );
    }

    return NextResponse.json({
      id: cert.id,
      tenantId: cert.tenantId,
      userId: cert.userId,
      courseId: cert.courseId,
      enrollmentId: cert.enrollmentId,
      issueDate: cert.issueDate,
      expirationDate: cert.expirationDate,
      status: cert.status,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'CERTIFICATE_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Certificate not found' },
        { status: 404 }
      );
    }
    console.error('Error verifying certificate:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
