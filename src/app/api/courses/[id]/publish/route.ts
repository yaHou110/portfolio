// apps/web/src/app/api/courses/[id]/publish/route.ts
import { catalog } from "@learning-platform/core/api";
import { requireRole } from "@/lib/authz";
import { rateLimit } from "@/lib/rate-limit";
import { routeEnvelope } from "@/lib/api-route";
import { z } from "zod";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const ROUTE = "/api/courses/:id/publish";

/**
 * POST /api/courses/:id/publish — publish a draft course (admin only).
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const env = routeEnvelope(request, ROUTE);
  try {
    const courseId = (await ctx.params).id;
    const parsed = z.string().uuid().safeParse(courseId);
    if (!parsed.success) {
      const headers = new Headers({
        "Content-Type": "application/json",
        "x-request-id": env.requestId ?? "",
      });
      return new Response(JSON.stringify({ error: "Invalid course id" }), {
        status: 400,
        headers,
      });
    }

    const gate = await requireRole(["super_admin", "center_admin"]);
    if (!gate.ok) {
      const headers = new Headers({
        "Content-Type": "application/json",
        "x-request-id": env.requestId ?? "",
      });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: gate.response.status,
        headers,
      });
    }

    const limiter = rateLimit({
      key: `publish:${gate.user.id}`,
      capacity: 5,
      refillPerSec: 1,
    });
    if (!limiter.ok) {
      const headers = new Headers({
        "Content-Type": "application/json",
        "x-request-id": env.requestId ?? "",
      });
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers,
      });
    }

    const published = await catalog.publishCourse(gate.user.tenantId, courseId);
    if (!published) {
      const headers = new Headers({
        "Content-Type": "application/json",
        "x-request-id": env.requestId ?? "",
      });
      return new Response(JSON.stringify({ error: "Course not found or not draft" }), {
        status: 404,
        headers,
      });
    }

    const headers = new Headers({
      "Content-Type": "application/json",
      "x-request-id": env.requestId ?? "",
    });
    return new Response(JSON.stringify(published), {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error(err);
    const headers = new Headers({
      "Content-Type": "application/json",
      "x-request-id": env.requestId ?? "",
    });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers,
    });
  }
}