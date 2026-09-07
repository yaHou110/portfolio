import { catalog, learning, PROGRESS_STATUSES } from "@learning-platform/core/api";
import { requireRole } from "@/lib/authz";
import { rateLimit } from "@/lib/rate-limit";
import { parseBody } from "@/lib/validation";
import { routeEnvelope } from "@/lib/api-route";
import { z } from "zod";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const ROUTE = "/api/lessons/:id/progress";

const ALL_ROLES = ["super_admin", "center_admin", "teacher", "student"] as const;
const ADMIN_ROLES = ["super_admin", "center_admin"] as const;

const ProgressSchema = z
  .object({
    status: z.enum(PROGRESS_STATUSES),
    lastPositionSeconds: z.number().int().min(0).optional(),
  })
  .strict();

/**
 * POST /api/lessons/:id/progress — record progress on a lesson (any
 * authenticated role, but the caller must have an ACTIVE enrollment in the
 * lesson's course). Recording `completed` on the last remaining lesson flips
 * the enrollment to `completed`. 404 when the lesson is not visible;
 * 403 when visible but not enrolled.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const env = routeEnvelope(request, ROUTE);
  try {
    const { id } = await ctx.params;
    const lessonId = z.string().uuid().safeParse(id).success ? id : null;
    if (!lessonId) return env.respond({ error: "Invalid lesson id", requestId: env.requestId }, 400);

    const gate = await requireRole(ALL_ROLES);
    if (!gate.ok) return env.respond({ error: "Unauthorized", requestId: env.requestId }, gate.response.status);

    const limiter = rateLimit({ key: `progress:${gate.user.id}`, capacity: 30, refillPerSec: 1 });
    if (!limiter.ok) return env.respond({ error: "Too many requests", requestId: env.requestId }, 429, { tenantId: gate.user.tenantId, userId: gate.user.id });

    const body = await parseBody(request, ProgressSchema);
    if (!body.ok) return env.respond({ error: "Invalid request body", issues: body.issues }, 400, { tenantId: gate.user.tenantId, userId: gate.user.id });

    const isAdmin = ADMIN_ROLES.includes(gate.user.role as (typeof ADMIN_ROLES)[number]);
    const lesson = await catalog.getLesson(gate.user.tenantId, lessonId, {
      includeNonPublished: isAdmin,
    });
    if (!lesson) return env.respond({ error: "Not found", requestId: env.requestId }, 404, { tenantId: gate.user.tenantId, userId: gate.user.id });

    const result = await learning.recordProgress(gate.user.tenantId, gate.user.id, lessonId, body.data);
    if (!result) return env.respond({ error: "Not enrolled in this course", requestId: env.requestId }, 403, { tenantId: gate.user.tenantId, userId: gate.user.id });

    return env.respond(result, 200, { tenantId: gate.user.tenantId, userId: gate.user.id });
  } catch (err) {
    return env.capture(err);
  }
}
