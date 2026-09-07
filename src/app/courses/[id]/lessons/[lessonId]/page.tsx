import Link from "next/link";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { catalog, learning } from "@learning-platform/core/api";
import AppShell from "@/components/AppShell";
import type { Role } from "@learning-platform/core/db/schema";

export const dynamic = "force-dynamic";

const ADMIN_ROLES: readonly Role[] = ["super_admin", "center_admin"];

const CONTENT_TYPE_LABEL: Record<string, string> = {
  video: "ویدئو",
  audio: "صوت",
  pdf: "متن (PDF)",
  text: "متن",
};

/**
 * /courses/[id]/lessons/[lessonId] — lesson view.
 *
 * v1 has no object-storage playback (ADR-0010 proposed), so the content
 * area renders a placeholder keyed on contentType + contentRef. Enrolled
 * students can mark the lesson as viewed ("دیدم"), which records progress
 * through the Learning bounded context; completing the last lesson flips
 * the enrollment to completed.
 */
export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id: courseId, lessonId } = await params;
  const { tenantId, id: userId, role } = session.user;
  const isAdmin = ADMIN_ROLES.includes(role);

  const course = await catalog.getCourse(tenantId, courseId, { includeNonPublished: isAdmin });
  if (!course) notFound();
  const lesson = await catalog.getLesson(tenantId, lessonId, { includeNonPublished: isAdmin });
  if (!lesson || lesson.courseId !== courseId) notFound();

  const myEnrollments = await learning.listEnrollments(tenantId, { userId });
  const enrollment = myEnrollments.find((e) => e.courseId === courseId) ?? null;
  const done =
    enrollment !== null &&
    (await learning.listProgress(tenantId, enrollment.id)).some(
      (p) => p.lessonId === lessonId && p.status === "completed"
    );

  async function markViewedAction(): Promise<void> {
    "use server";
    const s = await auth();
    if (!s?.user) redirect("/login");
    await learning.recordProgress(s.user.tenantId, s.user.id, lessonId, {
      status: "completed",
    });
    revalidatePath(`/courses/${courseId}/lessons/${lessonId}`);
    revalidatePath(`/courses/${courseId}`);
  }

  return (
    <AppShell user={{ name: session.user.name, role }}>
      <Link
        href={`/courses/${courseId}`}
        className="text-sm text-emerald-700 hover:underline"
      >
        ← بازگشت به دوره
      </Link>

      <div className="mt-4 rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-gray-400 dark:text-gray-500">
              {CONTENT_TYPE_LABEL[lesson.contentType] ?? lesson.contentType} · درس{" "}
              {lesson.orderIndex + 1}
            </div>
            <h1 className="mt-1 text-xl font-bold">{lesson.title}</h1>
          </div>
          {done ? (
            <span className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-800">
              ✓ مشاهده شده
            </span>
          ) : null}
        </div>

        <div className="mt-6 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 p-10 text-center text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
          {lesson.contentType === "video" ? (
            <>
              <div className="mb-2 text-3xl">🎬</div>
              پخش ویدئو در v1 متصل نیست (ذخیره‌سازی اشیاء — ADR-0010 پیشنهادی).
              {lesson.contentRef ? (
                <div className="mt-2 text-xs">مرجع محتوا: {lesson.contentRef}</div>
              ) : null}
            </>
          ) : (
            <>
              <div className="mb-2 text-3xl">{lesson.contentType === "pdf" ? "📄" : "📖"}</div>
              محتوای درس در این نسخه به‌زودی قرار می‌گیرد.
              {lesson.contentRef ? (
                <div className="mt-2 text-xs">مرجع محتوا: {lesson.contentRef}</div>
              ) : null}
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          {enrollment ? (
            done ? (
              <p className="text-sm text-emerald-700">این درس را مشاهده کرده‌اید.</p>
            ) : (
              <form action={markViewedAction}>
                <button
                  type="submit"
                  className="rounded bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-800"
                >
                  علامت «دیدم» ✍️
                </button>
              </form>
            )
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
              برای ثبت پیشرفت، ابتدا در دوره{" "}
              <Link href={`/courses/${courseId}`} className="text-emerald-700 underline">
                ثبت‌نام
              </Link>{" "}
              کنید.
            </p>
          )}
          {lesson.durationSeconds ? (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              مدت: {Math.round(lesson.durationSeconds / 60)} دقیقه
            </span>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
