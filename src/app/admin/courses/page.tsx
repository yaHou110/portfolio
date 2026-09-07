import Link from "next/link";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { catalog } from "@learning-platform/core/api";
import AppShell from "@/components/AppShell";
import type { Role } from "@learning-platform/core/db/schema";

export const dynamic = "force-dynamic";

const ADMIN_ROLES: readonly Role[] = ["super_admin", "center_admin"];

const STATUS_LABEL: Record<string, string> = {
  draft: "پیش‌نویس",
  published: "منتشرشده",
  archived: "بایگانی",
};

/**
 * /admin/courses — course management (admin only): create a course, list
 * all with status, publish drafts, and manage lessons.
 */
export default async function AdminCoursesPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!ADMIN_ROLES.includes(session.user.role)) redirect("/courses");

  const { tenantId, role } = session.user;
  const courses = await catalog.listCourses(tenantId, { includeNonPublished: true });

  async function createCourseAction(formData: FormData): Promise<void> {
    "use server";
    const s = await auth();
    if (!s?.user || !ADMIN_ROLES.includes(s.user.role)) redirect("/login");
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim() || undefined;
    if (!title) return;
    await catalog.createCourse(s.user.tenantId, s.user.id, {
      title,
      description,
      status: "draft",
    });
    revalidatePath("/admin/courses");
    revalidatePath("/courses");
  }

  async function publishCourseAction(courseId: string): Promise<void> {
    "use server";
    const s = await auth();
    if (!s?.user || !ADMIN_ROLES.includes(s.user.role)) redirect("/login");
    await catalog.publishCourse(s.user.tenantId, courseId);
    revalidatePath("/admin/courses");
    revalidatePath("/courses");
  }

  return (
    <AppShell user={{ name: session.user.name, role }}>
      <h1 className="mb-1 text-2xl font-bold">مدیریت دوره‌ها</h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500">
        ساخت دوره، انتشار پیش‌نویس‌ها و مدیریت درس‌ها.
      </p>

      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5 shadow-sm">
        <h2 className="mb-3 text-base font-bold">دوره جدید</h2>
        <form action={createCourseAction} className="flex flex-col gap-3">
          <input
            name="title"
            required
            placeholder="عنوان دوره (مثلاً: دوره مقدماتی فقه)"
            className="rounded border border-gray-300 dark:border-gray-600 p-2 text-sm"
          />
          <textarea
            name="description"
            rows={2}
            placeholder="توضیح کوتاه (اختیاری)"
            className="rounded border border-gray-300 dark:border-gray-600 p-2 text-sm"
          />
          <button
            type="submit"
            className="self-start rounded bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-800"
          >
            ایجاد دوره (پیش‌نویس)
          </button>
        </form>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold">دوره‌ها ({courses.length})</h2>
      <div className="space-y-2">
        {courses.map((course) => (
          <div
            key={course.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 px-4 py-3 shadow-sm"
          >
            <div className="min-w-0">
              <div className="font-medium">{course.title}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500">
                {STATUS_LABEL[course.status] ?? course.status} ·{" "}
                {course.createdAt.toLocaleDateString("fa-IR")}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {course.status === "draft" ? (
                <form action={publishCourseAction.bind(null, course.id)}>
                  <button
                    type="submit"
                    className="rounded bg-emerald-700 px-3 py-1.5 text-xs text-white hover:bg-emerald-800"
                  >
                    انتشار
                  </button>
                </form>
              ) : null}
              <Link
                href={`/admin/courses/${course.id}/lessons`}
                className="rounded border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                درس‌ها
              </Link>
              <Link
                href={`/courses/${course.id}`}
                className="rounded border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                مشاهده
              </Link>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
