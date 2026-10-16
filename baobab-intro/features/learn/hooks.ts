"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { nextPath, type Page } from "@/lib/api/authed";
import { useDebounced } from "@/features/people/hooks";
import { learnApi } from "./api";
import type { Classroom, Course, CourseOutline, Enrollment, Student, Submission } from "./types";

export const learnKeys = {
  catalog: (params: Record<string, string>) => ["courses", "catalog", params] as const,
  enrollments: ["me", "enrollments-page"] as const,
  teaching: ["courses", "teaching"] as const,
  course: (id: string) => ["course", id] as const,
  chapter: (id: string) => ["chapter", id] as const,
  students: (id: string) => ["course", id, "students"] as const,
  quizzes: (id: string) => ["course", id, "quizzes"] as const,
  assignments: (id: string) => ["course", id, "assignments"] as const,
  classrooms: (q: string) => ["classrooms", "discover", q] as const,
  myClassrooms: ["classrooms", "mine"] as const,
  classroom: (slug: string) => ["classroom", slug] as const,
  classroomMembers: (slug: string, status: string) => ["classroom", slug, "members", status] as const,
  quiz: (id: string) => ["quiz", id] as const,
  attempts: (id: string) => ["quiz", id, "attempts"] as const,
  assignment: (id: string) => ["assignment", id] as const,
  submissions: (id: string) => ["assignment", id, "submissions"] as const,
  certificates: ["me", "certificates"] as const,
};

function usePaged<T>(key: readonly unknown[], first: () => Promise<Page<T>>, next: (path: string) => Promise<Page<T>>, enabled = true) {
  return useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => (pageParam ? next(pageParam) : first()),
    initialPageParam: null as string | null,
    getNextPageParam: (last: Page<T>) => nextPath(last.next),
    enabled,
    staleTime: 30_000,
  });
}

/* ------------------------------------------------------------------ */
/* Lectures                                                            */
/* ------------------------------------------------------------------ */

export function useCatalog(params: { q: string; level: string; free: string }) {
  const q = useDebounced(params.q.trim());
  const effective = { q: q.length >= 2 ? q : "", level: params.level, free: params.free };
  return usePaged<Course>(learnKeys.catalog(effective), () => learnApi.catalog(effective), (path) => learnApi.catalog({}, path));
}

export const useEnrollments = () => usePaged<Enrollment>(learnKeys.enrollments, () => learnApi.enrollments(), (path) => learnApi.enrollments(path));
export const useTeaching = () => usePaged<Course>(learnKeys.teaching, () => learnApi.teaching(), (path) => learnApi.teaching(path));

export function useCourse(id: string) {
  return useQuery({ queryKey: learnKeys.course(id), queryFn: () => learnApi.course(id), staleTime: 30_000, enabled: Boolean(id) });
}

export function useChapter(id: string) {
  return useQuery({ queryKey: learnKeys.chapter(id), queryFn: () => learnApi.chapter(id), staleTime: 60_000, retry: false });
}

export function useStudents(id: string, enabled: boolean) {
  return usePaged<Student>(learnKeys.students(id), () => learnApi.students(id), (path) => learnApi.students(id, path), enabled);
}

export function useQuizzes(courseId: string, enabled: boolean) {
  return useQuery({ queryKey: learnKeys.quizzes(courseId), queryFn: () => learnApi.quizzes(courseId), enabled, staleTime: 30_000 });
}

export function useAssignments(courseId: string, enabled: boolean) {
  return useQuery({ queryKey: learnKeys.assignments(courseId), queryFn: () => learnApi.assignments(courseId), enabled, staleTime: 30_000 });
}

export function useClassrooms(query: string) {
  const q = useDebounced(query.trim());
  const effective = q.length >= 2 ? q : "";
  return usePaged<Classroom>(learnKeys.classrooms(effective), () => learnApi.classrooms(effective), (path) => learnApi.classrooms(effective, path));
}

export const useMyClassrooms = () => usePaged<Classroom>(learnKeys.myClassrooms, () => learnApi.myClassrooms(), (path) => learnApi.myClassrooms(path));

export function useClassroom(slug: string) {
  return useQuery({ queryKey: learnKeys.classroom(slug), queryFn: () => learnApi.classroom(slug), staleTime: 30_000 });
}

export function useClassroomMembers(slug: string, status: string, enabled: boolean) {
  return useQuery({ queryKey: learnKeys.classroomMembers(slug, status), queryFn: () => learnApi.classroomMembers(slug, status || undefined).then((p) => p.results), enabled });
}

export function useQuiz(id: string) {
  return useQuery({ queryKey: learnKeys.quiz(id), queryFn: () => learnApi.quiz(id), staleTime: 5 * 60_000, retry: false });
}

export function useAttempts(id: string) {
  return useQuery({ queryKey: learnKeys.attempts(id), queryFn: () => learnApi.attempts(id), retry: false });
}

export function useAssignment(id: string) {
  return useQuery({ queryKey: learnKeys.assignment(id), queryFn: () => learnApi.assignment(id), staleTime: 60_000 });
}

export function useSubmissions(id: string) {
  return usePaged<Submission>(learnKeys.submissions(id), () => learnApi.submissions(id), (path) => learnApi.submissions(id, path));
}

export function useCertificates() {
  return useQuery({ queryKey: learnKeys.certificates, queryFn: learnApi.certificates, staleTime: 5 * 60_000 });
}

/* ------------------------------------------------------------------ */
/* Écritures                                                           */
/* ------------------------------------------------------------------ */

/** Inscription : le plan du cours, mes cours et le menu latéral « Mes cours » sont relus. */
export function useEnroll(courseId: string) {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: learnKeys.course(courseId) });
    void client.invalidateQueries({ queryKey: learnKeys.enrollments });
    void client.invalidateQueries({ queryKey: ["me", "enrollments"] });
  };
  return {
    enroll: useMutation({
      mutationFn: () => learnApi.enroll(courseId),
      onSuccess: () => {
        client.setQueryData<CourseOutline>(learnKeys.course(courseId), (c) => (c ? { ...c, enrolled: true } : c));
        refresh();
      },
    }),
    drop: useMutation({ mutationFn: () => learnApi.drop(courseId), onSuccess: refresh }),
  };
}

/** Progression d'un chapitre : met à jour le plan (coche) et la barre de progression du cours sans recharger. */
export function useRecordProgress(courseId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ chapterId, percent, seconds }: { chapterId: string; percent: number; seconds: number }) => learnApi.progress(chapterId, percent, seconds),
    onSuccess: (result, { chapterId }) => {
      client.setQueryData<CourseOutline>(learnKeys.course(courseId), (c) =>
        c
          ? {
              ...c,
              progress: result.course,
              modules: c.modules.map((m) => ({
                ...m,
                chapters: m.chapters.map((ch) => (ch.id === chapterId ? { ...ch, my_progress: { status: result.status as "in_progress" | "completed", percent: result.percent } } : ch)),
              })),
            }
          : c,
      );
      void client.invalidateQueries({ queryKey: ["me", "enrollments"] });
      void client.invalidateQueries({ queryKey: learnKeys.enrollments });
      if (result.course.percent >= 100) void client.invalidateQueries({ queryKey: learnKeys.certificates });
    },
  });
}

/** Modifications d'un cours par l'enseignant : on relit le plan après chaque ajout. */
export function useCourseEditor(courseId: string) {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: learnKeys.course(courseId) });
    void client.invalidateQueries({ queryKey: learnKeys.teaching });
  };
  return {
    refresh,
    update: useMutation({ mutationFn: (input: Parameters<typeof learnApi.updateCourse>[1]) => learnApi.updateCourse(courseId, input), onSuccess: refresh }),
    publish: useMutation({ mutationFn: () => learnApi.publishCourse(courseId), onSuccess: refresh }),
    addModule: useMutation({ mutationFn: (input: Parameters<typeof learnApi.addModule>[1]) => learnApi.addModule(courseId, input), onSuccess: refresh }),
    addChapter: useMutation({ mutationFn: ({ moduleId, input }: { moduleId: string; input: Parameters<typeof learnApi.addChapter>[1] }) => learnApi.addChapter(moduleId, input), onSuccess: refresh }),
    addBlock: useMutation({
      mutationFn: ({ chapterId, input }: { chapterId: string; input: Parameters<typeof learnApi.addBlock>[1] }) => learnApi.addBlock(chapterId, input),
      onSuccess: (_d, { chapterId }) => void client.invalidateQueries({ queryKey: learnKeys.chapter(chapterId) }),
    }),
  };
}

export function useCreateClassroom() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: learnApi.createClassroom,
    onSuccess: (c) => {
      void client.invalidateQueries({ queryKey: ["classrooms"] });
      client.setQueryData(learnKeys.classroom(c.slug), undefined);
    },
  });
}

export function useClassroomMembership(slug: string) {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: learnKeys.classroom(slug) });
    void client.invalidateQueries({ queryKey: ["classrooms"] });
    void client.invalidateQueries({ queryKey: ["classroom", slug, "members"] });
  };
  return {
    join: useMutation({ mutationFn: () => learnApi.joinClassroom(slug), onSuccess: refresh }),
    leave: useMutation({ mutationFn: () => learnApi.leaveClassroom(slug), onSuccess: refresh }),
    review: useMutation({ mutationFn: ({ id, approve }: { id: string; approve: boolean }) => learnApi.reviewMember(slug, id, approve), onSuccess: refresh }),
    invite: useMutation({ mutationFn: ({ username, role }: { username: string; role: string }) => learnApi.inviteToClassroom(slug, username, role) }),
    createCourse: useMutation({ mutationFn: (input: Parameters<typeof learnApi.createCourse>[1]) => learnApi.createCourse(slug, input), onSuccess: refresh }),
  };
}

export function useSubmitAssignment(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { text: string; files: string[] }) => learnApi.submit(id, input),
    onSuccess: () => void client.invalidateQueries({ queryKey: learnKeys.submissions(id) }),
  });
}

export function useGrade(assignmentId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, points, feedback }: { id: string; points: number; feedback: string }) => learnApi.grade(id, { points, feedback }),
    onSuccess: () => void client.invalidateQueries({ queryKey: learnKeys.submissions(assignmentId) }),
  });
}
