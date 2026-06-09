import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  FieldValue,
  type Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import type {
  PracticeExam,
  ExamQuestion,
  PracticeExamSessionState,
} from "../exam/types";
import {
  getOriginalQuestionId,
  progressDocId,
} from "../exam/modules";
import type { SM2Card } from "../spaced-repetition/sm2";
import { createNewCard } from "../spaced-repetition/sm2";
import type { AssessmentGrade } from "../uq/types";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  enrolledCourses: string[];
  enrolledPrograms: string[];
  programTitles?: Record<string, string>;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface QuestionProgress {
  questionId: string;
  courseCode: string;
  topic: string;
  module?: string;
  sourceExamId?: string;
  assessmentId?: string;
  correct: number;
  total: number;
  sm2: SM2Card;
  lastResult?: boolean;
}

export interface GradeEntry {
  courseCode: string;
  courseTitle: string;
  units: number;
  assessments: AssessmentGrade[];
  updatedAt?: Timestamp;
}

export interface TimelineDateOverride {
  eventId: string;
  courseCode: string;
  userDate: string;
  updatedAt?: Timestamp;
}

export interface PracticeExamSession extends PracticeExamSessionState {
  examId: string;
  courseCode: string;
  updatedAt?: Timestamp;
}

function userRef(uid: string) {
  return doc(db, "users", uid);
}

/** Firestore rejects `undefined` anywhere in document data. */
function stripUndefined<T>(value: T): T {
  if (value instanceof FieldValue) {
    return value;
  }
  if (value === undefined || value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefined(item)) as T;
  }
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (val !== undefined) {
      result[key] = stripUndefined(val);
    }
  }
  return result as T;
}

export function buildUserProfile(
  uid: string,
  existing: UserProfile | null,
  patch: Partial<UserProfile>,
  fallback?: { email?: string; displayName?: string },
): UserProfile {
  return {
    uid,
    email: patch.email ?? existing?.email ?? fallback?.email ?? "",
    displayName:
      patch.displayName ?? existing?.displayName ?? fallback?.displayName ?? "",
    enrolledCourses: patch.enrolledCourses ?? existing?.enrolledCourses ?? [],
    enrolledPrograms: patch.enrolledPrograms ?? existing?.enrolledPrograms ?? [],
    programTitles: patch.programTitles ?? existing?.programTitles ?? {},
  };
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(userRef(uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function upsertUserProfile(
  uid: string,
  data: Partial<UserProfile>,
  fallback?: { email?: string; displayName?: string },
): Promise<void> {
  const existing = await getUserProfile(uid);
  const profile = buildUserProfile(uid, existing, data, fallback);
  await setDoc(
    userRef(uid),
    { ...profile, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function enrollCourse(
  uid: string,
  courseCode: string,
  fallback?: { email?: string; displayName?: string },
): Promise<void> {
  const code = courseCode.toUpperCase();
  const profile = await getUserProfile(uid);
  const enrolled = profile?.enrolledCourses ?? [];
  if (enrolled.includes(code)) return;

  await upsertUserProfile(
    uid,
    { enrolledCourses: [...enrolled, code] },
    fallback,
  );
}

export async function enrollCourses(
  uid: string,
  courseCodes: string[],
  fallback?: { email?: string; displayName?: string },
): Promise<void> {
  const profile = await getUserProfile(uid);
  const enrolled = new Set(profile?.enrolledCourses ?? []);
  for (const code of courseCodes) {
    enrolled.add(code.toUpperCase());
  }
  await upsertUserProfile(
    uid,
    { enrolledCourses: Array.from(enrolled).sort() },
    fallback,
  );
}

export async function removeCourse(uid: string, courseCode: string): Promise<void> {
  const profile = await getUserProfile(uid);
  if (!profile) return;
  await upsertUserProfile(uid, {
    enrolledCourses: profile.enrolledCourses.filter(
      (c) => c !== courseCode.toUpperCase(),
    ),
  });
}

export async function enrollProgram(
  uid: string,
  programId: string,
  programTitle: string,
  fallback?: { email?: string; displayName?: string },
): Promise<void> {
  const profile = await getUserProfile(uid);
  const enrolled = profile?.enrolledPrograms ?? [];
  const titles = profile?.programTitles ?? {};

  if (enrolled.includes(programId)) {
    await upsertUserProfile(
      uid,
      { programTitles: { ...titles, [programId]: programTitle } },
      fallback,
    );
    return;
  }

  await upsertUserProfile(
    uid,
    {
      enrolledPrograms: [...enrolled, programId],
      programTitles: { ...titles, [programId]: programTitle },
    },
    fallback,
  );
}

export async function removeProgram(uid: string, programId: string): Promise<void> {
  const profile = await getUserProfile(uid);
  if (!profile) return;
  const titles = { ...(profile.programTitles ?? {}) };
  delete titles[programId];
  await upsertUserProfile(uid, {
    enrolledPrograms: profile.enrolledPrograms.filter((p) => p !== programId),
    programTitles: titles,
  });
}

export async function savePracticeExam(
  uid: string,
  exam: Omit<PracticeExam, "id" | "userId" | "createdAt">,
): Promise<string> {
  const examRef = doc(collection(db, "users", uid, "practiceExams"));
  await setDoc(
    examRef,
    stripUndefined({
      ...exam,
      userId: uid,
      createdAt: new Date().toISOString(),
    }),
  );
  return examRef.id;
}

export async function getPracticeExams(
  uid: string,
  courseCode?: string,
): Promise<PracticeExam[]> {
  const examsRef = collection(db, "users", uid, "practiceExams");
  const q = courseCode
    ? query(examsRef, where("courseCode", "==", courseCode.toUpperCase()))
    : examsRef;
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PracticeExam);
}

export async function getQuestionProgress(
  uid: string,
  courseCode?: string,
): Promise<QuestionProgress[]> {
  const progressRef = collection(db, "users", uid, "questionProgress");
  const q = courseCode
    ? query(progressRef, where("courseCode", "==", courseCode.toUpperCase()))
    : progressRef;
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as QuestionProgress);
}

export async function updateQuestionProgress(
  uid: string,
  question: ExamQuestion,
  courseCode: string,
  correct: boolean,
  sm2: SM2Card,
): Promise<void> {
  const docId = progressDocId(question);
  const progressRef = doc(db, "users", uid, "questionProgress", docId);
  const existing = await getDoc(progressRef);
  let prev = existing.data() as QuestionProgress | undefined;

  const originalId = getOriginalQuestionId(question.id);
  const examId = question.sourceExamId;
  if (!prev && examId && examId !== "uploaded" && docId !== originalId) {
    const legacyRef = doc(db, "users", uid, "questionProgress", originalId);
    const legacySnap = await getDoc(legacyRef);
    if (legacySnap.exists()) {
      prev = legacySnap.data() as QuestionProgress;
      await deleteDoc(legacyRef);
    }
  }

  await setDoc(
    progressRef,
    stripUndefined({
      questionId: docId,
      courseCode: courseCode.toUpperCase(),
      topic: (question.topic ?? (question.module != null ? `Module ${question.module}` : "General")).slice(0, 200),
      module: question.module != null ? String(question.module).slice(0, 200) : undefined,
      sourceExamId: question.sourceExamId,
      assessmentId: question.assessmentId,
      correct: (prev?.correct ?? 0) + (correct ? 1 : 0),
      total: (prev?.total ?? 0) + 1,
      sm2,
      lastResult: correct,
    }),
  );
}

export async function updatePracticeExam(
  uid: string,
  examId: string,
  data: Pick<PracticeExam, "title" | "questions" | "courseCode">,
): Promise<void> {
  const examRef = doc(db, "users", uid, "practiceExams", examId);
  await setDoc(
    examRef,
    stripUndefined({
      ...data,
      courseCode: data.courseCode.toUpperCase(),
      userId: uid,
    }),
    { merge: true },
  );
}

export async function deleteQuestionProgressForExam(
  uid: string,
  exam: PracticeExam,
): Promise<void> {
  const progressSnap = await getDocs(
    collection(db, "users", uid, "questionProgress"),
  );
  const questionIds = new Set(
    exam.questions.flatMap((q) => [q.id, `${exam.id}:${q.id}`]),
  );

  const deletions = progressSnap.docs
    .filter((d) => {
      const data = d.data() as QuestionProgress;
      return (
        questionIds.has(d.id) ||
        questionIds.has(data.questionId) ||
        data.sourceExamId === exam.id
      );
    })
    .map((d) => deleteDoc(d.ref));

  await Promise.all(deletions);
}

export async function deletePracticeExamWithData(
  uid: string,
  examId: string,
): Promise<void> {
  const examRef = doc(db, "users", uid, "practiceExams", examId);
  const snap = await getDoc(examRef);
  if (snap.exists()) {
    const exam = { id: snap.id, ...snap.data() } as PracticeExam;
    await deleteQuestionProgressForExam(uid, exam);
  }
  await deletePracticeExamSession(uid, examId);
  await deleteDoc(examRef);
}

export async function saveGradeEntry(
  uid: string,
  entry: GradeEntry,
): Promise<void> {
  const gradeRef = doc(db, "users", uid, "gradeEntries", entry.courseCode);
  await setDoc(
    gradeRef,
    stripUndefined({
      ...entry,
      courseCode: entry.courseCode.toUpperCase(),
      updatedAt: serverTimestamp(),
    }),
  );
}

export async function getGradeEntries(uid: string): Promise<GradeEntry[]> {
  const snap = await getDocs(collection(db, "users", uid, "gradeEntries"));
  return snap.docs.map((d) => d.data() as GradeEntry);
}

function timelineDocId(eventId: string): string {
  return eventId.replace(/\//g, "_");
}

export async function getTimelineDates(
  uid: string,
): Promise<Record<string, string>> {
  try {
    const snap = await getDocs(collection(db, "users", uid, "timelineDates"));
    const map: Record<string, string> = {};
    for (const d of snap.docs) {
      const data = d.data() as TimelineDateOverride;
      if (data.userDate) map[data.eventId] = data.userDate;
    }
    return map;
  } catch (err) {
    console.warn("Could not load timeline dates:", err);
    return {};
  }
}

export async function saveTimelineDate(
  uid: string,
  eventId: string,
  courseCode: string,
  userDate: string,
): Promise<void> {
  const dateRef = doc(db, "users", uid, "timelineDates", timelineDocId(eventId));
  await setDoc(
    dateRef,
    stripUndefined({
      eventId,
      courseCode: courseCode.toUpperCase(),
      userDate,
      updatedAt: serverTimestamp(),
    }),
  );
}

export async function deleteTimelineDate(
  uid: string,
  eventId: string,
): Promise<void> {
  await deleteDoc(
    doc(db, "users", uid, "timelineDates", timelineDocId(eventId)),
  );
}

export async function getPracticeExamSession(
  uid: string,
  examId: string,
): Promise<PracticeExamSession | null> {
  try {
    const snap = await getDoc(
      doc(db, "users", uid, "practiceExamSessions", examId),
    );
    return snap.exists() ? (snap.data() as PracticeExamSession) : null;
  } catch (err) {
    console.warn("Could not load practice exam session:", err);
    return null;
  }
}

export async function savePracticeExamSession(
  uid: string,
  examId: string,
  courseCode: string,
  state: PracticeExamSessionState,
): Promise<void> {
  const sessionRef = doc(db, "users", uid, "practiceExamSessions", examId);
  await setDoc(
    sessionRef,
    stripUndefined({
      examId,
      courseCode: courseCode.toUpperCase(),
      ...state,
      updatedAt: serverTimestamp(),
    }),
  );
}

export async function deletePracticeExamSession(
  uid: string,
  examId: string,
): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "practiceExamSessions", examId));
}

export async function uploadExamFile(
  uid: string,
  file: File,
  courseCode: string,
): Promise<string> {
  const path = `users/${uid}/exams/${courseCode}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function deletePracticeExam(
  uid: string,
  examId: string,
): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "practiceExams", examId));
}

export { createNewCard };
