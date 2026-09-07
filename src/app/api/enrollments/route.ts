// apps/web/src/app/api/enrollments/route.ts
import type { NextRequest } from 'next/server';
import { learning } from '@learning-platform/core/api';
import { requireRole } from '@/lib/authz';
import { rateLimit } from '@/lib/rate-limit';
import { parseBody, parseQuery } from '@/lib/validation';
import { routeEnvelope } from '@/lib/api-route';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/enrollments';

const ALL_ROLES = ['super_admin', 'center_admin', 'teacher', 'student'] as const;
const ADMIN_ROLES = ['super_admin', 'center_admin'] as const;

const EnrollmentsQuerySchema = z
  .object({
    userId: z.string().uuid().optional(),
  })
  .strict();

const EnrollSchema = z
  .object({
    courseId: z.string().uuid(),
  })
  .strict();

/**
 * GET /api/enrollments — the caller's enrollments (any authenticated role).
 * Admins may pass `?userId=` to view another user's.
 */
export async function GET(request: NextRequest) {
  const env = routeEnvelope(request, ROUTE);
  try {
    const gate = await requireRole(ALL_ROLES);
    if (!gate.ok) {
      return env.respond({ error: 'Unauthorized', requestId: env.requestId }, gate.response.status);
    }

    const q = parseQuery(request, EnrollmentsQuerySchema);
    if (!q.ok) {
      return env.respond({ error: 'Invalid query parameters', issues: q.issues }, 400, {
        tenantId: gate.user.tenantId,
        userId: gate.user.id,
      });
    }

    const isAdmin = ADMIN_ROLES.includes(gate.user.role as typeof ADMIN_ROLES[number]);
    const userId = isAdmin && q.data.userId ? q.data.userId : gate.user.id;

    const enrollments = await learning.listEnrollments(gate.user.tenantId, { userId });

    return env.respond(enrollments, 200, {
      tenantId: gate.user.tenantId,
      userId: gate.user.id,
    });
  } catch (err) {
    return env.capture(err);
  }
}

/**
 * POST /api/enrollments — enroll in a course. Idempotent: re-enrolling returns the existing enrollment.
 * 404 when the course is not published (for students) or does not exist.
 */
export async function POST(request: NextRequest) {
  const env = routeEnvelope(request, ROUTE);
  try {
    const gate = await requireRole(ALL_ROLES);
    if (!gate.ok) {
      return env.respond({ error: 'Unauthorized', requestId: env.requestId }, gate.response.status);
    }

    const limiter = rateLimit({ key: `enroll:${gate.user.id}`, capacity: 5, refillPerSec: 1 });
    if (!limiter.ok) {
      return env.respond({ error: 'Too many requests', requestId: env.requestId }, 429, {
        tenantId: gate.user.tenantId,
        userId: gate.user.id,
      });
    }

    const body = await parseBody(request, EnrollSchema);
    if (!body.ok) {
      return env.respond({ error: 'Invalid request body', issues: body.issues }, 400, {
        tenantId: gate.user.tenantId,
        userId: gate.user.id,
      });
    }

    const isAdmin = ADMIN_ROLES.includes(gate.user.role as typeof ADMIN_ROLES[number]);
    const enrollment = await learning.enroll(gate.user.tenantId, gate.user.id, body.data.courseId, {
      allowNonPublished: isAdmin,
    });

    if (!enrollment) {
      return env.respond({ error: 'Course not found or not available', requestId: env.requestId }, 404, {
        tenantId: gate.user.tenantId,
        userId: gate.user.id,
      });
    }

    return env.respond(enrollment, 201, {
      tenantId: gate.user.tenantId,
      userId: gate.user.id,
    });
  } catch (err) {
    return env.capture(err);
  }
}