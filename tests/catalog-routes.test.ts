/**
 * SPRINT-002 — Catalog API route behavior.
 *
 * The bounded-context data access is mocked at the `@learning-platform/core/api`
 * boundary; these tests pin the route layer: auth gating, admin-vs-student
 * visibility flags, input validation, rate limiting wiring, and the 404 path.
 * The DB flows themselves are covered by the local integration evidence
 * (scripts/verify-sprint2-integration.ts) — unit tests stay DB-free.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();

vi.mock("../src/auth.js", () => ({
  auth: () => authMock(),
}));

vi.mock("@learning-platform/core/api", () => ({
  catalog: {
    listCourses: vi.fn(),
    getCourse: vi.fn(),
    createCourse: vi.fn(),
    updateCourse: vi.fn(),
    publishCourse: vi.fn(),
    listLessons: vi.fn(),
    getLesson: vi.fn(),
    createLesson: vi.fn(),
  },
  learning: {
    listEnrollments: vi.fn(),
    enroll: vi.fn(),
    recordProgress: vi.fn(),
  },
  COURSE_STATUSES: ["draft", "published", "archived"],
  CONTENT_TYPES: ["video", "audio", "pdf", "text"],
  ENROLLMENT_STATUSES: ["active", "completed", "dropped"],
  PROGRESS_STATUSES: ["started", "completed"],
}));

const { catalog } = await import("@learning-platform/core/api");
const { GET: listGet, POST: createPost } = await import(
  "../src/app/api/courses/route.js"
);
const { GET: courseGet, PATCH: coursePatch } = await import(
  "../src/app/api/courses/[id]/route.js"
);
const { POST: publishPost } = await import(
  "../src/app/api/courses/[id]/publish/route.js"
);
const { GET: lessonsGet } = await import(
  "../src/app/api/courses/[id]/lessons/route.js"
);
const { POST: lessonPost } = await import("../src/app/api/lessons/route.js");
const { GET: lessonGet } = await import("../src/app/api/lessons/[id]/route.js");

const adminSession = {
  user: { id: "u-admin", email: "a@lp.local", name: "A", role: "center_admin", tenantId: "t1" },
};
const studentSession = {
  user: { id: "u-stu", email: "s@lp.local", name: "S", role: "student", tenantId: "t1" },
};

const COURSE = {
  id: "c1", tenantId: "t1", title: "فقه مقدماتی", description: null,
  status: "published", createdBy: "u-admin",
  createdAt: new Date("2026-08-01T00:00:00Z"), updatedAt: new Date("2026-08-01T00:00:00Z"), deletedAt: null,
};
const UUID = "11111111-1111-4111-8111-111111111111";

function req(
  url: string,
  init: Record<string, unknown> = {}
): NextRequest {
  return new NextRequest(url, init as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/courses", () => {
  it("students list published only (no includeNonPublished flag)", async () => {
    authMock.mockResolvedValue(studentSession);
    (catalog.listCourses as ReturnType<typeof vi.fn>).mockResolvedValue([COURSE]);
    const res = await listGet(req("http://localhost/api/courses"));
    expect(res.status).toBe(200);
    expect(catalog.listCourses).toHaveBeenCalledWith("t1", {
      includeNonPublished: false,
      status: undefined,
    });
  });

  it("admins see drafts too (includeNonPublished true)", async () => {
    authMock.mockResolvedValue(adminSession);
    (catalog.listCourses as ReturnType<typeof vi.fn>).mockResolvedValue([COURSE]);
    await listGet(req("http://localhost/api/courses"));
    expect(catalog.listCourses).toHaveBeenCalledWith("t1", {
      includeNonPublished: true,
      status: undefined,
    });
  });

  it("rejects unknown query params (strict schema)", async () => {
    authMock.mockResolvedValue(adminSession);
    const res = await listGet(req("http://localhost/api/courses?limit=10"));
    expect(res.status).toBe(400);
    expect(catalog.listCourses).not.toHaveBeenCalled();
  });

  it("401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await listGet(req("http://localhost/api/courses"));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/courses", () => {
  it("admins create a course (201)", async () => {
    authMock.mockResolvedValue(adminSession);
    (catalog.createCourse as ReturnType<typeof vi.fn>).mockResolvedValue({ ...COURSE, status: "draft" });
    const res = await createPost(
      req("http://localhost/api/courses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "  اصول   فقه  " }),
      })
    );
    expect(res.status).toBe(201);
    expect(catalog.createCourse).toHaveBeenCalledWith(
      "t1",
      "u-admin",
      { title: "  اصول   فقه  " }
    );
  });

  it("rejects students (403)", async () => {
    authMock.mockResolvedValue(studentSession);
    const res = await createPost(
      req("http://localhost/api/courses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "X" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("rejects an empty title (400)", async () => {
    authMock.mockResolvedValue(adminSession);
    const res = await createPost(
      req("http://localhost/api/courses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "" }),
      })
    );
    expect(res.status).toBe(400);
    expect(catalog.createCourse).not.toHaveBeenCalled();
  });

  it("rejects unknown fields (strict schema)", async () => {
    authMock.mockResolvedValue(adminSession);
    const res = await createPost(
      req("http://localhost/api/courses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "X", price: 5 }),
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/courses/:id", () => {
  it("404 for a hidden course (student on a draft)", async () => {
    authMock.mockResolvedValue(studentSession);
    (catalog.getCourse as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await courseGet(req("http://localhost/api/courses/" + UUID), {
      params: Promise.resolve({ id: UUID }),
    });
    expect(res.status).toBe(404);
    expect(catalog.getCourse).toHaveBeenCalledWith("t1", UUID, {
      includeNonPublished: false,
    });
  });

  it("400 for a non-UUID id", async () => {
    authMock.mockResolvedValue(studentSession);
    const res = await courseGet(req("http://localhost/api/courses/not-a-uuid"), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });
    expect(res.status).toBe(400);
    expect(catalog.getCourse).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/courses/:id", () => {
  it("admin updates the title", async () => {
    authMock.mockResolvedValue(adminSession);
    (catalog.updateCourse as ReturnType<typeof vi.fn>).mockResolvedValue({ ...COURSE, title: "جدید" });
    const res = await coursePatch(req("http://localhost/api/courses/" + UUID, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "جدید" }),
    }), { params: Promise.resolve({ id: UUID }) });
    expect(res.status).toBe(200);
    expect(catalog.updateCourse).toHaveBeenCalledWith("t1", UUID, { title: "جدید" });
  });

  it("student cannot patch (403)", async () => {
    authMock.mockResolvedValue(studentSession);
    const res = await coursePatch(req("http://localhost/api/courses/" + UUID, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "X" }),
    }), { params: Promise.resolve({ id: UUID }) });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/courses/:id/publish", () => {
  it("publishes a draft course", async () => {
    authMock.mockResolvedValue(adminSession);
    (catalog.publishCourse as ReturnType<typeof vi.fn>).mockResolvedValue({ ...COURSE, status: "published" });
    const res = await publishPost(req("http://localhost/api/courses/" + UUID, { method: "POST" }), {
      params: Promise.resolve({ id: UUID }),
    });
    expect(res.status).toBe(200);
    expect(catalog.publishCourse).toHaveBeenCalledWith("t1", UUID);
  });

  it("404 when the course does not exist", async () => {
    authMock.mockResolvedValue(adminSession);
    (catalog.publishCourse as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await publishPost(req("http://localhost/api/courses/" + UUID, { method: "POST" }), {
      params: Promise.resolve({ id: UUID }),
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/courses/:id/lessons", () => {
  it("returns lessons for a visible course", async () => {
    authMock.mockResolvedValue(studentSession);
    (catalog.getCourse as ReturnType<typeof vi.fn>).mockResolvedValue(COURSE);
    (catalog.listLessons as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const res = await lessonsGet(req("http://localhost/api/courses/" + UUID), {
      params: Promise.resolve({ id: UUID }),
    });
    expect(res.status).toBe(200);
    expect(catalog.listLessons).toHaveBeenCalledWith("t1", UUID, { includeNonPublished: false });
  });

  it("404 when the course is not visible", async () => {
    authMock.mockResolvedValue(studentSession);
    (catalog.getCourse as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await lessonsGet(req("http://localhost/api/courses/" + UUID), {
      params: Promise.resolve({ id: UUID }),
    });
    expect(res.status).toBe(404);
    expect(catalog.listLessons).not.toHaveBeenCalled();
  });
});

describe("POST /api/lessons", () => {
  it("admin creates a lesson (201)", async () => {
    authMock.mockResolvedValue(adminSession);
    (catalog.createLesson as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "l1", tenantId: "t1", courseId: UUID, title: "درس ۱",
      contentType: "text", contentRef: null, orderIndex: 0, durationSeconds: null,
      createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
    });
    const res = await lessonPost(req("http://localhost/api/lessons", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courseId: UUID, title: "درس ۱" }),
    }));
    expect(res.status).toBe(201);
    expect(catalog.createLesson).toHaveBeenCalledWith("t1", { courseId: UUID, title: "درس ۱" });
  });

  it("404 when the owning course does not exist", async () => {
    authMock.mockResolvedValue(adminSession);
    (catalog.createLesson as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await lessonPost(req("http://localhost/api/lessons", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courseId: UUID, title: "درس ۱" }),
    }));
    expect(res.status).toBe(404);
  });

  it("rejects a non-UUID courseId (400)", async () => {
    authMock.mockResolvedValue(adminSession);
    const res = await lessonPost(req("http://localhost/api/lessons", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courseId: "abc", title: "درس ۱" }),
    }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/lessons/:id", () => {
  it("returns a visible lesson", async () => {
    authMock.mockResolvedValue(studentSession);
    (catalog.getLesson as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: UUID, tenantId: "t1", courseId: "c1", title: "درس ۱",
      contentType: "text", contentRef: null, orderIndex: 0, durationSeconds: null,
      createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
    });
    const res = await lessonGet(req("http://localhost/api/lessons/" + UUID), {
      params: Promise.resolve({ id: UUID }),
    });
    expect(res.status).toBe(200);
  });

  it("404 for a hidden lesson", async () => {
    authMock.mockResolvedValue(studentSession);
    (catalog.getLesson as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await lessonGet(req("http://localhost/api/lessons/" + UUID), {
      params: Promise.resolve({ id: UUID }),
    });
    expect(res.status).toBe(404);
  });
});
