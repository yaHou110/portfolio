// apps/web/src/app/api/courses/route.ts
import type { NextRequest } from 'next/server';
import { catalog } from '@learning-platform/core/api';
import { requireRole } from '@/lib/authz';
import { rateLimit } from '@/lib/rate-limit';
import { parseBody, parseQuery } from '@/lib/validation';
import { routeEnvelope } from '@/lib/api-route';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/courses';

const ADMIN_ROLES = ['super_admin', 'center_admin'] as const;

const CreateCourseSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
  })
  .strict();

/**
 * GET /api/courses — list published courses for the tenant.
 * Admins can see all statuses via ?includeNonPublished=true.
 */
export async function GET(request: NextRequest) {
  const env = routeEnvelope(request, ROUTE);
  try {
    const gate = await requireRole(['super_admin', 'center_admin', 'teacher', 'student']);
    if (!gate.ok) {
      return env.respond({ error: 'Unauthorized', requestId: env.requestId }, gate.response.status);
    }

    const q = parseQuery(request, z.object({ includeNonPublished: z.boolean().optional() }).strict());
    if (!q.ok) {
      return env.respond({ error: 'Invalid query parameters', issues: q.issues }, 400, {
        tenantId: gate.user.tenantId,
        userId: gate.user.id,
      });
    }

    const isAdmin = ADMIN_ROLES.includes(gate.user.role as typeof ADMIN_ROLES[number]);
    const includeNonPublished = isAdmin ? (q.data.includeNonPublished ?? true) : false;

    const courses = await catalog.listCourses(gate.user.tenantId, {
      includeNonPublished,
      status: undefined,
    });

    return env.respond({ courses }, 200, {
      tenantId: gate.user.tenantId,
      userId: gate.user.id,
    });
  } catch (err) {
    return env.capture(err);
  }
}

/**
 * POST /api/courses — create a new course (draft by default).
 */
export async function POST(request: NextRequest) {
  const env = routeEnvelope(request, ROUTE);
  try {
    const gate = await requireRole(['super_admin', 'center_admin']);
    if (!gate.ok) {
      return env.respond({ error: 'Unauthorized', requestId: env.requestId }, gate.response.status);
    }

    const limiter = rateLimit({ key: `courses:${gate.user.id}`, capacity: 10, refillPerSec: 1 });
    if (!limiter.ok) {
      return env.respond({ error: 'Too many requests', requestId: env.requestId }, 429, {
        tenantId: gate.user.tenantId,
        userId: gate.user.id,
      });
    }

    const body = await parseBody(request, CreateCourseSchema);
    if (!body.ok) {
      return env.respond({ error: 'Invalid request body', issues: body.issues }, 400, {
        tenantId: gate.user.tenantId,
        userId: gate.user.id,
      });
    }

    const course = await catalog.createCourse(gate.user.tenantId, gate.user.id, {
      title: body.data.title,
      description: body.data.description,
    });

    return env.respond({ course }, 201, {
      tenantId: gate.user.tenantId,
      userId: gate.user.id,
    });
  } catch (err) {
    return env.capture(err);
  }
}