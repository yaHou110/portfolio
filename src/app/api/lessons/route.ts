import { catalog, CONTENT_TYPES } from "@learning-platform/core/api";
import { requireRole } from "@/lib/authz";
import { rateLimit } from "@/lib/rate-limit";
import { parseBody } from "@/lib/validation";
import { routeEnvelope } from "@/lib/api-route";
import { z } from "zod";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const ROUTE = "/api/lessons";

const ADMIN_ROLES = ["super_admin", "center_admin"] as const;

const CreateLessonSchema = z
  .object({
    courseId: z.string().uuid(),
    title: z.string().min(1).max(200),
    contentType: z.enum(CONTENT_TYPES).optional(),
    contentRef: z.string().max(500).optional(),
    orderIndex: z.number().int().min(0).optional(),
    durationSeconds: z.number().int().min(0).optional(),
  })
  .strict();

/**
 * POST /api/lessons — create a lesson inside a course (admin only).
 * `orderIndex` defaults to the next slot (max order + 1). 404 when the
 * owning course does not exist in the tenant.
 */
export async function POST(request: NextRequest) {
  const env = routeEnvelope(request, ROUTE);
  try {
    const gate = await requireRole(ADMIN_ROLES);
    if (!gate.ok) return env.respond({ error: gate.response.status === 401 ? "Unauthorized" : "Forbidden", requestId: env.requestId }, gate.response.status);

    const limiter = rateLimit({ key: `lessons:${gate.user.id}`, capacity: 20, refillPerSec: 1 });
    if (!limiter.ok) return env.respond({ error: "Too many requests", requestId: env.requestId }, 429, { tenantId: gate.user.tenantId, userId: gate.user.id });

    const body = await parseBody(request, CreateLessonSchema);
    if (!body.ok) return env.respond({ error: "Invalid request body", issues: body.issues }, 400, { tenantId: gate.user.tenantId, userId: gate.user.id });

    const lesson = await catalog.createLesson(gate.user.tenantId, body.data);
    if (!lesson) return env.respond({ error: "Course not found", requestId: env.requestId }, 404, { tenantId: gate.user.tenantId, userId: gate.user.id });

    return env.respond(lesson, 201, { tenantId: gate.user.tenantId, userId: gate.user.id });
  } catch (err) {
    return env.capture(err);
  }
}
