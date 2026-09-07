import { catalog, COURSE_STATUSES } from "@learning-platform/core/api";
import { requireRole } from "@/lib/authz";
import { rateLimit } from "@/lib/rate-limit";
import { parseBody } from "@/lib/validation";
import { routeEnvelope } from "@/lib/api-route";
import { z } from "zod";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const ROUTE = "/api/courses/:id";

const ALL_ROLES = ["super_admin", "center_admin", "teacher", "student"] as const;
const ADMIN_ROLES = ["super_admin", "center_admin"] as const;

const UpdateCourseSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(4000).nullable().optional(),
    status: z.enum(COURSE_STATUSES).optional(),
  })
  .strict();

async function courseIdOf(params: Promise<{ id: string }>) {
  const { id } = await params;
  const parsed = z.string().uuid().safeParse(id);
  return parsed.success ? parsed.data : null;
}

/**
 * GET /api/courses/:id — one course. Students/teachers get it only when
 * published; admins see draft/archived too. 404 when not visible.
 *
 * PATCH /api/courses/:id — partial update (admin only, course.write).
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const env = routeEnvelope(request, ROUTE);
  try {
    const courseId = await courseIdOf(ctx.params);
    if (!courseId) return env.respond({ error: "Invalid course id", requestId: env.requestId }, 400);

    const gate = await requireRole(ALL_ROLES);
    if (!gate.ok) return env.respond({ error: "Unauthorized", requestId: env.requestId }, gate.response.status);

    const isAdmin = ADMIN_ROLES.includes(gate.user.role as (typeof ADMIN_ROLES)[number]);
    const course = await catalog.getCourse(gate.user.tenantId, courseId, {
      includeNonPublished: isAdmin,
    });
    if (!course) return env.respond({ error: "Not found", requestId: env.requestId }, 404, { tenantId: gate.user.tenantId, userId: gate.user.id });

    return env.respond(course, 200, { tenantId: gate.user.tenantId, userId: gate.user.id });
  } catch (err) {
    return env.capture(err);
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const env = routeEnvelope(request, ROUTE);
  try {
    const courseId = await courseIdOf(ctx.params);
    if (!courseId) return env.respond({ error: "Invalid course id", requestId: env.requestId }, 400);

    const gate = await requireRole(ADMIN_ROLES);
    if (!gate.ok) return env.respond({ error: gate.response.status === 401 ? "Unauthorized" : "Forbidden", requestId: env.requestId }, gate.response.status);

    const limiter = rateLimit({ key: `courses:${gate.user.id}`, capacity: 10, refillPerSec: 1 });
    if (!limiter.ok) return env.respond({ error: "Too many requests", requestId: env.requestId }, 429, { tenantId: gate.user.tenantId, userId: gate.user.id });

    const body = await parseBody(request, UpdateCourseSchema);
    if (!body.ok) return env.respond({ error: "Invalid request body", issues: body.issues }, 400, { tenantId: gate.user.tenantId, userId: gate.user.id });

    const course = await catalog.updateCourse(gate.user.tenantId, courseId, body.data);
    if (!course) return env.respond({ error: "Not found", requestId: env.requestId }, 404, { tenantId: gate.user.tenantId, userId: gate.user.id });

    return env.respond(course, 200, { tenantId: gate.user.tenantId, userId: gate.user.id });
  } catch (err) {
    return env.capture(err);
  }
}
