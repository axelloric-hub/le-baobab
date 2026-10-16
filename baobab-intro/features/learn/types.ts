/** Learn : classes, cours, chapitres, contenus, inscriptions, progression, quiz, devoirs, certificats (apps/education, apps/assessments, apps/progress). */
import type { UserBrief } from "@/features/social/types";

export type CourseLevel = "beginner" | "intermediate" | "advanced";
export type ClassroomPrivacy = "public" | "private" | "invite_only";
export type AccessReason = "ok" | "not_published" | "membership_required" | "classroom_payment_required" | "enroll_required" | "payment_required";

export interface Progress {
  total_chapters: number;
  completed_chapters: number;
  percent: number;
  time_spent_seconds: number;
}

export interface Course {
  id: string;
  classroom: string;
  classroom_title: string;
  slug: string;
  title: string;
  description: string;
  level: CourseLevel;
  language: string;
  status: "draft" | "published" | "archived";
  is_free: boolean;
  price_minor: number | null;
  currency: string;
  certificate_enabled: boolean;
  published_at: string | null;
  instructors: string[];
  teachers: Array<UserBrief & { role: string }>;
  stats: { modules: number; chapters: number; minutes: number };
}

export interface ChapterSummary {
  id: string;
  position: number;
  title: string;
  estimated_minutes: number;
  is_free: boolean;
  price_minor: number | null;
  currency: string;
  is_published: boolean;
  access: { allowed: boolean; reason: AccessReason };
  my_progress?: { status: "in_progress" | "completed"; percent: number } | null;
}

export interface ModuleOutline {
  id: string;
  position: number;
  title: string;
  description: string;
  is_free: boolean;
  price_minor: number | null;
  currency: string;
  is_published: boolean;
  chapters: ChapterSummary[];
}

export interface CourseOutline extends Course {
  enrolled: boolean;
  is_staff: boolean;
  progress: Progress | null;
  modules: ModuleOutline[];
}

export type BlockKind =
  | "text"
  | "pdf"
  | "image"
  | "audio"
  | "video"
  | "code"
  | "notebook"
  | "presentation"
  | "document"
  | "link"
  | "embed"
  | "quiz"
  | "exercise"
  | "repository";

export interface ContentBlock {
  id: string;
  position: number;
  kind: BlockKind;
  title: string;
  body: string;
  url: string;
  file_url: string | null;
  ref_id: string | null;
  payload: Record<string, unknown>;
  duration_seconds: number | null;
}

export interface ChapterContent {
  id: string;
  title: string;
  course: string;
  module: string;
  estimated_minutes: number;
  blocks: ContentBlock[];
}

export interface Classroom {
  id: string;
  slug: string;
  title: string;
  description: string;
  privacy: ClassroomPrivacy;
  is_paid: boolean;
  price_minor: number | null;
  currency: string;
  my_role: "owner" | "instructor" | "assistant" | "student" | null;
  my_status: "active" | "pending" | "banned" | null;
  /** Invitation en attente pour moi (je ne suis pas encore membre). */
  my_invitation?: { id: string; role: string } | null;
  owner: UserBrief;
  member_count: number;
  course_count: number;
  created_at: string;
}

export interface ClassroomDetail extends Classroom {
  is_staff: boolean;
  courses: Course[];
}

export interface ClassroomMember extends UserBrief {
  id: string;
  role: string;
  status: "active" | "pending" | "banned";
}

export interface Enrollment {
  course: Course;
  status: "active" | "completed" | "dropped";
  enrolled_at: string;
  completed_at: string | null;
  progress: Progress;
}

export interface Student extends UserBrief {
  status: string;
  enrolled_at: string;
  progress: Progress;
}

export interface Certificate {
  id: string;
  course: string;
  verification_code: string;
  score_percent: number | null;
  issued_at: string;
}

export interface QuizSummary {
  id: string;
  title: string;
  is_published: boolean;
  chapter: string | null;
  questions: number;
  pass_percent: number;
  max_attempts: number;
}

export type QuestionKind = "single" | "multiple" | "true_false" | "text" | "code" | "ordering";

export interface Quiz {
  id: string;
  title: string;
  pass_percent: number;
  max_attempts: number;
  time_limit_seconds: number | null;
  questions: Array<{ id: string; position: number; kind: QuestionKind; prompt: string; points: number; choices: Array<{ id: string; position: number; label: string }> }>;
}

export interface Attempt {
  id: string;
  quiz: string;
  attempt_no: number;
  status: "in_progress" | "submitted" | "graded" | "pending_review" | string;
  started_at: string;
  submitted_at: string | null;
  score: number;
  max_score: number;
  passed: boolean | null;
  answers?: Array<{ question: string; is_correct: boolean | null; points: number; explanation: string }>;
}

export interface Assignment {
  id: string;
  course: string;
  title: string;
  instructions: string;
  max_points: number;
  due_at: string | null;
  allow_late: boolean;
  max_attempts: number;
  is_group: boolean;
  auto_grade: boolean;
  criteria: Array<{ id: string; label: string; max_points: number }>;
}

export interface Submission {
  id: string;
  assignment: string;
  student: UserBrief | null;
  group: string | null;
  submitted_by: UserBrief;
  attempt_no: number;
  status: string;
  text: string;
  is_late: boolean;
  submitted_at: string;
  attachments: Array<{ filename: string; size_bytes: number | null; url: string }>;
  ai_status: string;
  grade: { points: number; feedback: string; graded_at: string; source: string; ai_confidence: number | null } | null;
}
