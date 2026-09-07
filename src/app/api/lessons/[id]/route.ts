import { catalog } from "@learning-platform/core/api";
import { requireRole } from "@/lib/authz";
import { routeEnvelope } from "@/lib/api-route";
import { z } from "zod";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const ROUTE = "/api/lessons/:id";

const ALL_ROLES = ["super_admin", "center_admin", "teacher", "student"] as const;
const ADMIN_ROLES = ["super_admin", "center_admin"] as const;

/**
 * GET /api/lessons/:id — one lesson. Visibility mirrors its course:
 * students/teachers need the course published; admins see any lesson.
 * 404 when the lesson (or its course) is not visible.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const env = routeEnvelope(request, ROUTE);
  try {
    const { id } = await ctx.params;
    const lessonId = z.string().uuid().safeParse(id).success ? id : null;
    if (!lessonId) return env.respond({ error: "Invalid lesson id", requestId: env.requestId }, 400);

    const gate = await requireRole(ALL_ROLES);
    if (!gate.ok) return env.respond({ error: "Unauthorized", requestId: env.requestId }, gate.response.status);

    const isAdmin = ADMIN_ROLES.includes(gate.user.role as (typeof ADMIN_ROLES)[number]);
    const lesson = await catalog.getLesson(gate.user.tenantId, lessonId, {
      includeNonPublished: isAdmin,
    });
    if (!lesson) return env.respond({ error: "Not found", requestId: env.requestId }, 404, { tenantId: gate.user.tenantId, userId: gate.user.id });

    return env.respond(lesson, 200, { tenantId: gate.user.tenantId, userId: gate.user.id });
  } catch (err) {
    return env.capture(err);
  }
}
