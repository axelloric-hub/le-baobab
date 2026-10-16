/** Couche service de Learn. Une fonction par endpoint. */
import { authed, type Page } from "@/lib/api/authed";
import type {
  Assignment,
  Attempt,
  BlockKind,
  Certificate,
  ChapterContent,
  Classroom,
  ClassroomDetail,
  ClassroomMember,
  Course,
  CourseLevel,
  CourseOutline,
  Enrollment,
  Progress,
  Quiz,
  QuizSummary,
  Student,
  Submission,
} from "./types";

const cl = (slug: string) => `/classrooms/${encodeURIComponent(slug)}`;

export interface PriceInput {
  is_free: boolean;
  price_minor?: number | null;
  currency?: string;
}

export const learnApi = {
  catalog: (params: { q?: string; level?: string; free?: string }, path?: string) => {
    if (path) return authed<Page<Course>>(path);
    const query = new URLSearchParams({ limit: "24" });
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
    return authed<Page<Course>>(`/courses/?${query}`);
  },
  enrollments: (path?: string) => authed<Page<Enrollment>>(path ?? "/me/enrollments/?limit=50"),
  teaching: (path?: string) => authed<Page<Course>>(path ?? "/me/teaching/"),
  course: (id: string) => authed<CourseOutline>(`/courses/${id}/`),
  updateCourse: (id: string, input: Partial<Pick<Course, "title" | "description" | "level" | "language" | "certificate_enabled">>) =>
    authed<Course>(`/courses/${id}/`, { method: "PATCH", body: input }),
  publishCourse: (id: string) => authed<Course>(`/courses/${id}/publish/`, { method: "POST", body: {} }),
  enroll: (id: string) => authed<{ status: string; created: boolean }>(`/courses/${id}/enroll/`, { method: "POST", body: {} }),
  drop: (id: string) => authed<void>(`/courses/${id}/enroll/`, { method: "DELETE" }),
  students: (id: string, path?: string) => authed<Page<Student>>(path ?? `/courses/${id}/students/`),
  addModule: (courseId: string, input: { title: string; description?: string } & PriceInput) =>
    authed<{ id: string; position: number }>(`/courses/${courseId}/modules/`, { method: "POST", body: input }),
  addChapter: (moduleId: string, input: { title: string; estimated_minutes: number } & PriceInput) =>
    authed<{ id: string; position: number }>(`/modules/${moduleId}/chapters/`, { method: "POST", body: input }),
  addBlock: (chapterId: string, input: { kind: BlockKind; title?: string; body?: string; file?: string; url?: string; ref_id?: string; payload?: Record<string, unknown> }) =>
    authed<{ id: string; position: number }>(`/chapters/${chapterId}/blocks/`, { method: "POST", body: input }),
  chapter: (id: string) => authed<ChapterContent>(`/chapters/${id}/content/`),
  progress: (chapterId: string, percent: number, seconds: number) =>
    authed<{ status: string; percent: number; course: Progress }>(`/chapters/${chapterId}/progress/`, { method: "POST", body: { percent, seconds } }),

  classrooms: (q: string, path?: string) => authed<Page<Classroom>>(path ?? `/classrooms/?limit=24${q ? `&q=${encodeURIComponent(q)}` : ""}`),
  myClassrooms: (path?: string) => authed<Page<Classroom>>(path ?? "/me/classrooms/"),
  classroom: (slug: string) => authed<ClassroomDetail>(`${cl(slug)}/`),
  createClassroom: (input: { title: string; slug: string; description: string; privacy: string; is_paid: boolean; price_minor?: number | null; currency?: string }) =>
    authed<Classroom>("/classrooms/", { method: "POST", body: input }),
  joinClassroom: (slug: string) => authed<{ status: string }>(`${cl(slug)}/join/`, { method: "POST", body: {} }),
  leaveClassroom: (slug: string) => authed<void>(`${cl(slug)}/leave/`, { method: "POST", body: {} }),
  classroomMembers: (slug: string, status?: string) => authed<Page<ClassroomMember>>(`${cl(slug)}/members/${status ? `?status=${status}` : ""}`),
  reviewMember: (slug: string, memberId: string, approve: boolean) => authed(`${cl(slug)}/members/${memberId}/review/`, { method: "POST", body: { approve } }),
  inviteToClassroom: (slug: string, username: string, role: string) => authed(`${cl(slug)}/invite/`, { method: "POST", body: { username, role } }),
  createCourse: (slug: string, input: { title: string; slug: string; description: string; level: CourseLevel; language: string; certificate_enabled: boolean } & PriceInput) =>
    authed<Course>(`${cl(slug)}/courses/`, { method: "POST", body: input }),

  quizzes: (courseId: string) => authed<QuizSummary[]>(`/courses/${courseId}/quizzes/`),
  createQuiz: (courseId: string, input: { title: string; pass_percent: number; max_attempts: number; chapter?: string }) =>
    authed<{ id: string }>(`/courses/${courseId}/quizzes/`, { method: "POST", body: input }),
  addQuestion: (
    quizId: string,
    input: { kind: string; prompt: string; points: number; choices?: Array<{ label: string; is_correct?: boolean; correct_order?: number }>; accepted?: string[]; explanation?: string },
  ) => authed<{ id: string }>(`/quizzes/${quizId}/questions/`, { method: "POST", body: input }),
  publishQuiz: (quizId: string, published: boolean) => authed(`/quizzes/${quizId}/publish/`, { method: "POST", body: { published } }),
  quiz: (id: string) => authed<Quiz>(`/quizzes/${id}/`),
  attempts: (quizId: string) => authed<Attempt[]>(`/quizzes/${quizId}/attempts/`),
  startAttempt: (quizId: string) => authed<Attempt>(`/quizzes/${quizId}/attempts/`, { method: "POST", body: {} }),
  submitAttempt: (attemptId: string, answers: Record<string, { selected?: string[]; text?: string }>) =>
    authed<Attempt>(`/attempts/${attemptId}/submit/`, { method: "POST", body: { answers } }),

  assignments: (courseId: string) => authed<Assignment[]>(`/courses/${courseId}/assignments/`),
  assignment: (id: string) => authed<Assignment>(`/assignments/${id}/`),
  createAssignment: (courseId: string, input: { title: string; instructions: string; max_points: number; due_at?: string; allow_late: boolean; max_attempts: number }) =>
    authed<Assignment>(`/courses/${courseId}/assignments/`, { method: "POST", body: input }),
  submissions: (assignmentId: string, path?: string) => authed<Page<Submission>>(path ?? `/assignments/${assignmentId}/submissions/`),
  submit: (assignmentId: string, input: { text: string; files: string[] }) => authed<Submission>(`/assignments/${assignmentId}/submissions/`, { method: "POST", body: input }),
  grade: (submissionId: string, input: { points: number; feedback: string }) => authed<{ points: number; feedback: string }>(`/submissions/${submissionId}/grade/`, { method: "POST", body: input }),

  certificates: () => authed<Certificate[]>("/me/certificates/"),
};
