/**
 * SPRINT-002 — Learning API route behavior (enroll + progress).
 *
 * Data access is mocked at the `@learning-platform/core/api` boundary; these
 * tests pin the route layer: enrollment gating (published-only for students),
 * idempotent enroll, own-vs-admin enrollment listing, the not-enrolled 403 on
 * progress, and input validation.
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

const { catalog, learning } = await import("@learning-platform/core/api");
const { GET: enrollmentsGet, POST: enrollPost } = await import(
  "../src/app/api/enrollments/route.js"
);
const { POST: progressPost } = await import(
  "../src/app/api/lessons/[id]/progress/route.js"
);

const adminSession = {
  user: { id: "u-admin", email: "a@lp.local", name: "A", role: "center_admin", tenantId: "t1" },
};
const studentSession = {
  user: { id: "u-stu", email: "s@lp.local", name: "S", role: "student", tenantId: "t1" },
};

const UUID = "11111111-1111-4111-8111-111111111111";
const ENROLLMENT = {
  id: "e1", tenantId: "t1", userId: "u-stu", courseId: UUID,
  status: "active", enrolledAt: new Date(), completedAt: null,
};

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

describe("GET /api/enrollments", () => {
  it("students see only their own enrollments (userId forced)", async () => {
    authMock.mockResolvedValue(studentSession);
    (learning.listEnrollments as ReturnType<typeof vi.fn>).mockResolvedValue([ENROLLMENT]);
    const res = await enrollmentsGet(req("http://localhost/api/enrollments"));
    expect(res.status).toBe(200);
    expect(learning.listEnrollments).toHaveBeenCalledWith("t1", { userId: "u-stu" });
  });

  it("admins may filter by ?userId=", async () => {
    authMock.mockResolvedValue(adminSession);
    (learning.listEnrollments as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const res = await enrollmentsGet(req("http://localhost/api/enrollments?userId=" + UUID));
    expect(res.status).toBe(200);
    expect(learning.listEnrollments).toHaveBeenCalledWith("t1", { userId: UUID });
  });

  it("a student cannot list another user via ?userId= (param ignored)", async () => {
    authMock.mockResolvedValue(studentSession);
    (learning.listEnrollments as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await enrollmentsGet(req("http://localhost/api/enrollments?userId=" + UUID));
    expect(learning.listEnrollments).toHaveBeenCalledWith("t1", { userId: "u-stu" });
  });

  it("rejects a malformed userId param (400)", async () => {
    authMock.mockResolvedValue(adminSession);
    const res = await enrollmentsGet(req("http://localhost/api/enrollments?userId=nope"));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/enrollments", () => {
  it("a student enrolls in a published course (201, published-only)", async () => {
    authMock.mockResolvedValue(studentSession);
    (learning.enroll as ReturnType<typeof vi.fn>).mockResolvedValue(ENROLLMENT);
    const res = await enrollPost(req("http://localhost/api/enrollments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courseId: UUID }),
    }));
    expect(res.status).toBe(201);
    expect(learning.enroll).toHaveBeenCalledWith("t1", "u-stu", UUID, {
      allowNonPublished: false,
    });
  });

  it("admins may enroll in draft courses", async () => {
    authMock.mockResolvedValue(adminSession);
    (learning.enroll as ReturnType<typeof vi.fn>).mockResolvedValue(ENROLLMENT);
    await enrollPost(req("http://localhost/api/enrollments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courseId: UUID }),
    }));
    expect(learning.enroll).toHaveBeenCalledWith("t1", "u-admin", UUID, {
      allowNonPublished: true,
    });
  });

  it("404 when the course is not enrollable (hidden/not published)", async () => {
    authMock.mockResolvedValue(studentSession);
    (learning.enroll as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await enrollPost(req("http://localhost/api/enrollments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courseId: UUID }),
    }));
    expect(res.status).toBe(404);
  });

  it("400 for a missing courseId", async () => {
    authMock.mockResolvedValue(studentSession);
    const res = await enrollPost(req("http://localhost/api/enrollments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(400);
    expect(learning.enroll).not.toHaveBeenCalled();
  });
});

describe("POST /api/lessons/:id/progress", () => {
  const LESSON = {
    id: UUID, tenantId: "t1", courseId: UUID, title: "درس ۱",
    contentType: "text", contentRef: null, orderIndex: 0, durationSeconds: null,
    createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
  };

  it("records progress for an enrolled student (200)", async () => {
    authMock.mockResolvedValue(studentSession);
    (catalog.getLesson as ReturnType<typeof vi.fn>).mockResolvedValue(LESSON);
    (learning.recordProgress as ReturnType<typeof vi.fn>).mockResolvedValue({
      progress: {
        id: "p1", tenantId: "t1", enrollmentId: "e1", lessonId: UUID,
        status: "completed", lastPositionSeconds: null,
        startedAt: new Date(), completedAt: new Date(),
      },
      enrollment: { ...ENROLLMENT, status: "completed" },
    });
    const res = await progressPost(req("http://localhost/api/lessons/" + UUID, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    }), { params: Promise.resolve({ id: UUID }) });
    expect(res.status).toBe(200);
    expect(learning.recordProgress).toHaveBeenCalledWith("t1", "u-stu", UUID, {
      status: "completed",
    });
  });

  it("403 when the caller is not enrolled", async () => {
    authMock.mockResolvedValue(studentSession);
    (catalog.getLesson as ReturnType<typeof vi.fn>).mockResolvedValue(LESSON);
    (learning.recordProgress as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await progressPost(req("http://localhost/api/lessons/" + UUID, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "started" }),
    }), { params: Promise.resolve({ id: UUID }) });
    expect(res.status).toBe(403);
  });

  it("400 for an invalid status value", async () => {
    authMock.mockResolvedValue(studentSession);
    const res = await progressPost(req("http://localhost/api/lessons/" + UUID, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "watched" }),
    }), { params: Promise.resolve({ id: UUID }) });
    expect(res.status).toBe(400);
  });

  it("400 for a non-UUID lesson id", async () => {
    authMock.mockResolvedValue(studentSession);
    const res = await progressPost(req("http://localhost/api/lessons/abc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "started" }),
    }), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(400);
  });
});
