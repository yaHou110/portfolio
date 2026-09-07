import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { catalog, learning } from "@learning-platform/core/api";
import type { Role } from "@learning-platform/core/db/schema";
import AppShell from "@/components/AppShell";
import CourseCatalog, {
  type CatalogCourse,
  type EnrollAction,
} from "@/components/CourseCatalog";

export const dynamic = "force-dynamic";

const ADMIN_ROLES: readonly Role[] = ["super_admin", "center_admin"];

/**
 * /courses — catalog browse. Students/teachers see published courses;
 * admins additionally see drafts and archived (management view). The server
 * enriches each course with the caller's enrollment state + lesson counts,
 * then hands a client component the serializable list for instant search.
 */
export default async function CoursesPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { tenantId, id: userId, role } = session.user;
  const isAdmin = ADMIN_ROLES.includes(role);

  // Safe fallbacks — render an empty catalog rather than crash on DB issues.
  let courses: Awaited<ReturnType<typeof catalog.listCourses>> = [];
  let enrollments: Awaited<ReturnType<typeof learning.listEnrollments>> = [];

  try {
    courses = await catalog.listCourses(tenantId, { includeNonPublished: isAdmin });
    enrollments = await learning.listEnrollments(tenantId, { userId });
  } catch {
    // DB unreachable in a degraded deploy.
  }

  // Per-course: lesson count + the caller's enrollment progress.
  const enriched: CatalogCourse[] = await Promise.all(
    courses.map(async (course) => {
      let lessonCount = 0;
      let enrollment: CatalogCourse["enrollment"] = null;

      try {
        const lessons = await catalog.listLessons(tenantId, course.id, {
          includeNonPublished: isAdmin,
        });
        lessonCount = lessons.length;

        const mine = enrollments.find((e) => e.courseId === course.id);
        if (mine) {
          const progress = await learning.listProgress(tenantId, mine.id);
          let completed = progress.filter((p) => p.status === "completed").length;
          // Completed enrollments imply every lesson finished; the progress
          // rows may be sparse in seeded data, so normalize (same as dashboard).
          if (mine.status === "completed" && lessons.length > 0 && completed < lessons.length) {
            completed = lessons.length;
          }
          enrollment = {
            status: mine.status as "active" | "completed" | "dropped",
            completedLessons: completed,
            pct: lessonCount > 0 ? Math.round((completed / lessonCount) * 100) : 0,
          };
        }
      } catch {
        // Skip per-course enrichment on DB issues; card still renders.
      }

      return {
        id: course.id,
        title: course.title,
        description: course.description,
        status: course.status as CatalogCourse["status"],
        lessonCount,
        enrollment,
      };
    })
  );

  async function enrollAction(courseId: string): Promise<void> {
    "use server";
    const s = await auth();
    if (!s?.user) redirect("/login");
    await learning.enroll(s.user.tenantId, s.user.id, courseId);
    revalidatePath("/courses");
  }

  return (
    <AppShell user={{ name: session.user.name, role }}>
      <CourseCatalog
        courses={enriched}
        isAdmin={isAdmin}
        enrollAction={enrollAction as EnrollAction}
      />
    </AppShell>
  );
}
