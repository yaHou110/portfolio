/**
 * M4-0 (Session 015) — the `requireRole` helper is the single place where
 * the route-authorization decision lives. Every authenticated route in
 * `apps/web` should go through it. This test pins its behavior so future
 * refactors do not silently change who can call what.
 *
 * The helper is mocked at the `auth` module boundary so we do not need
 * a real Next.js request context or a real session cookie. The test is
 * pure: deterministic, fast, no DB.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();

vi.mock("../src/auth.js", () => ({
  auth: () => authMock(),
}));

// Import AFTER the mock is set up.
const { requireRole } = await import("../src/lib/authz.js");

const baseSession = {
  user: {
    id: "u1",
    email: "u@example.com",
    name: "U",
    role: "center_admin" as const,
    tenantId: "t1",
  },
};

describe("requireRole (M4-0)", () => {
  beforeEach(() => {
    authMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);
    const r = await requireRole(["center_admin"]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(401);
    }
  });

  it("returns 401 when the session has no user", async () => {
    authMock.mockResolvedValue({});
    const r = await requireRole(["center_admin"]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(401);
    }
  });

  it("returns 403 for a role not in the allowlist", async () => {
    authMock.mockResolvedValue({
      user: { ...baseSession.user, role: "student" },
    });
    const r = await requireRole(["center_admin", "super_admin"]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(403);
    }
  });

  it("returns the user for a role in the allowlist (center_admin)", async () => {
    authMock.mockResolvedValue(baseSession);
    const r = await requireRole(["center_admin", "super_admin"]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.user.role).toBe("center_admin");
      expect(r.user.tenantId).toBe("t1");
    }
  });

  it("returns the user for a role in the allowlist (super_admin)", async () => {
    authMock.mockResolvedValue({
      user: { ...baseSession.user, role: "super_admin" },
    });
    const r = await requireRole(["center_admin", "super_admin"]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.user.role).toBe("super_admin");
    }
  });

  it("explicitly does NOT allow teacher to list users (regression for M4-0)", async () => {
    authMock.mockResolvedValue({
      user: { ...baseSession.user, role: "teacher" },
    });
    const r = await requireRole(["center_admin", "super_admin"]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(403);
    }
  });
});
