import { catalog } from "@learning-platform/core/api";
import { requireRole } from "@/lib/authz";
import { routeEnvelope } from "@/lib/api-route";
import { z } from "zod";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const ROUTE = "/api/courses/:id/lessons";

const ALL_ROLES = ["super_admin", "center_admin", "teacher", "student"] as const;
const ADMIN_ROLES = ["super_admin", "center_admin"] as const;

/**
 * GET /api/courses/:id/lessons — lessons of a course in display order.
 * Visibility mirrors the course: students/teachers need the course published,
 * admins see lessons of any course. 404 when the course is not visible.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const env = routeEnvelope(request, ROUTE);
  try {
    const { id } = await ctx.params;
    const courseId = z.string().uuid().safeParse(id).success ? id : null;
    if (!courseId) return env.respond({ error: "Invalid course id", requestId: env.requestId }, 400);

    const gate = await requireRole(ALL_ROLES);
    if (!gate.ok) return env.respond({ error: "Unauthorized", requestId: env.requestId }, gate.response.status);

    const isAdmin = ADMIN_ROLES.includes(gate.user.role as (typeof ADMIN_ROLES)[number]);
    const course = await catalog.getCourse(gate.user.tenantId, courseId, {
      includeNonPublished: isAdmin,
    });
    if (!course) return env.respond({ error: "Not found", requestId: env.requestId }, 404, { tenantId: gate.user.tenantId, userId: gate.user.id });

    const lessons = await catalog.listLessons(gate.user.tenantId, courseId, {
      includeNonPublished: isAdmin,
    });
    return env.respond(lessons, 200, { tenantId: gate.user.tenantId, userId: gate.user.id });
  } catch (err) {
    return env.capture(err);
  }
}
