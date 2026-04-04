import type { Teacher } from "./auth";
import { isSupabaseConfigured, supabase } from "./supabase";

export const SUBJECTS = ["Mathematics", "Science", "English", "Social Studies", "Computer"] as const;
export const EXAMS = ["Unit 1", "Unit 2", "Half Yearly"] as const;
export const MONTHS = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"] as const;

export type Subject = (typeof SUBJECTS)[number];
export type ExamName = (typeof EXAMS)[number];
export type TrendDirection = "Rising" | "Steady" | "Falling";
export type RiskLevel = "Low" | "Medium" | "High";
export type AttendanceStatus = "present" | "absent" | "leave";

export interface AttendanceEntry {
  day: number;
  status: AttendanceStatus;
}

export interface AssignmentStats {
  submitted: number;
  onTime: number;
  late: number;
  pending: number;
}

export interface Student {
  id: string;
  rollNo: string;
  name: string;
  guardianName: string;
  phone: string;
  email: string;
  attendanceRate: number;
  marksAverage: number;
  assignmentCompletion: number;
  participation: number;
  predictedGrade: string;
  confidence: number;
  riskLevel: RiskLevel;
  trend: TrendDirection;
  subjectScores: Record<Subject, number>;
  subjectAttendance: Record<Subject, number>;
  examScores: Record<ExamName, Record<Subject, number>>;
  attendanceMonth: AttendanceEntry[];
  trajectory: Array<{ month: string; score: number }>;
  assignmentStats: AssignmentStats;
}

export interface AssignmentItem {
  id: string;
  title: string;
  subject: Subject;
  dueDate: string;
  totalStudents: number;
  submitted: number;
  onTime: number;
  late: number;
}

export interface ClassSettings {
  className: string;
  section: string;
  classTeacher: string;
  term: string;
  schoolName: string;
  atRiskThreshold: number;
  attendanceThreshold: number;
  marksThreshold: number;
  sendAlerts: boolean;
  weeklyDigest: boolean;
}

export interface DataVistaState {
  students: Student[];
  assignments: AssignmentItem[];
  settings: ClassSettings;
}

const STORAGE_KEY = "datavista_v2_state";
const REMOTE_STATE_TABLE = "teacher_states";

const BASE_SETTINGS: ClassSettings = {
  className: "Grade 9",
  section: "A",
  classTeacher: "Ananya Sen",
  term: "2026 Term 2",
  schoolName: "DataVista Public School",
  atRiskThreshold: 60,
  attendanceThreshold: 75,
  marksThreshold: 55,
  sendAlerts: true,
  weeklyDigest: true,
};

const seedProfiles = [
  { name: "Aarav Mehta", guardianName: "Ritesh Mehta", phone: "9876543210", email: "aarav@datavista.edu", marks: 91, attendance: 96, assignments: 94, participation: 88, trend: "Rising" as const },
  { name: "Diya Nair", guardianName: "Sreeja Nair", phone: "9811122233", email: "diya@datavista.edu", marks: 84, attendance: 89, assignments: 86, participation: 78, trend: "Steady" as const },
  { name: "Kabir Khan", guardianName: "Imran Khan", phone: "9898989898", email: "kabir@datavista.edu", marks: 73, attendance: 82, assignments: 76, participation: 74, trend: "Rising" as const },
  { name: "Meera Joshi", guardianName: "Pooja Joshi", phone: "9822455511", email: "meera@datavista.edu", marks: 66, attendance: 79, assignments: 71, participation: 69, trend: "Steady" as const },
  { name: "Ishaan Roy", guardianName: "Sourav Roy", phone: "9900012345", email: "ishaan@datavista.edu", marks: 58, attendance: 67, assignments: 64, participation: 60, trend: "Falling" as const },
  { name: "Sara Thomas", guardianName: "Joseph Thomas", phone: "9745621300", email: "sara@datavista.edu", marks: 88, attendance: 92, assignments: 91, participation: 84, trend: "Rising" as const },
  { name: "Vihaan Patel", guardianName: "Kiran Patel", phone: "9988776655", email: "vihaan@datavista.edu", marks: 77, attendance: 85, assignments: 73, participation: 71, trend: "Steady" as const },
  { name: "Anika Bose", guardianName: "Sudipta Bose", phone: "9871002003", email: "anika@datavista.edu", marks: 95, attendance: 98, assignments: 96, participation: 91, trend: "Rising" as const },
  { name: "Rohan Iyer", guardianName: "Lakshmi Iyer", phone: "9123456780", email: "rohan@datavista.edu", marks: 62, attendance: 70, assignments: 59, participation: 57, trend: "Falling" as const },
  { name: "Tara Gupta", guardianName: "Nitin Gupta", phone: "9933557711", email: "tara@datavista.edu", marks: 81, attendance: 87, assignments: 83, participation: 76, trend: "Steady" as const },
];

function round(value: number) {
  return Math.round(value);
}

export function getOverallScore(student: Student) {
  return round(
    student.marksAverage * 0.5 +
      student.attendanceRate * 0.2 +
      student.assignmentCompletion * 0.2 +
      student.participation * 0.1,
  );
}

export function getGradeFromScore(score: number) {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  return "D";
}

export function getRiskLevel(score: number, attendance: number, assignmentCompletion: number): RiskLevel {
  if (score < 60 || attendance < 72 || assignmentCompletion < 65) return "High";
  if (score < 75 || attendance < 82 || assignmentCompletion < 78) return "Medium";
  return "Low";
}

function createSubjectScores(marksAverage: number, offset: number) {
  const math = clamp(marksAverage + 5 - offset * 2);
  const science = clamp(marksAverage + 2 + offset);
  const english = clamp(marksAverage - 3 + offset * 2);
  const social = clamp(marksAverage - 1 - offset);
  const computer = clamp(marksAverage + 6 + offset);

  return {
    Mathematics: math,
    Science: science,
    English: english,
    "Social Studies": social,
    Computer: computer,
  } satisfies Record<Subject, number>;
}

function createSubjectAttendance(attendanceRate: number, offset: number) {
  return {
    Mathematics: clamp(attendanceRate + 1 - offset),
    Science: clamp(attendanceRate + 2),
    English: clamp(attendanceRate - 2 + offset),
    "Social Studies": clamp(attendanceRate - 3),
    Computer: clamp(attendanceRate + 4 - offset),
  } satisfies Record<Subject, number>;
}

function createExamScores(subjectScores: Record<Subject, number>, trend: TrendDirection) {
  const delta = trend === "Rising" ? 6 : trend === "Falling" ? -5 : 1;

  const createExam = (shift: number) =>
    Object.fromEntries(
      SUBJECTS.map((subject, index) => [subject, clamp(subjectScores[subject] + shift - index)]),
    ) as Record<Subject, number>;

  return {
    "Unit 1": createExam(-4),
    "Unit 2": createExam(delta / 2),
    "Half Yearly": createExam(delta + 2),
  } satisfies Record<ExamName, Record<Subject, number>>;
}

function createAttendanceMonth(attendanceRate: number, offset: number): AttendanceEntry[] {
  const absentTarget = Math.max(1, round((100 - attendanceRate) / 8));
  const leaveTarget = Math.max(1, round((100 - attendanceRate) / 18));

  return Array.from({ length: 30 }, (_, index) => {
    const day = index + 1;
    if ((day + offset) % 11 === 0 && absentTarget > 0) {
      return { day, status: "absent" as const };
    }
    if ((day + offset) % 13 === 0 && leaveTarget > 0) {
      return { day, status: "leave" as const };
    }
    return { day, status: "present" as const };
  });
}

function createTrajectory(marksAverage: number, trend: TrendDirection) {
  const offsets =
    trend === "Rising"
      ? [-9, -6, -4, -2, 1, 4]
      : trend === "Falling"
        ? [6, 5, 3, 1, -2, -4]
        : [-2, -1, 0, 0, 1, 1];

  return MONTHS.map((month, index) => ({
    month,
    score: clamp(marksAverage + offsets[index]),
  }));
}

function createAssignmentStats(assignmentCompletion: number, offset: number): AssignmentStats {
  const total = 8;
  const submitted = clamp(round((assignmentCompletion / 100) * total), 0, total);
  const late = Math.min(2, Math.max(0, (offset + submitted) % 3));
  const onTime = Math.max(0, submitted - late);

  return {
    submitted,
    onTime,
    late,
    pending: total - submitted,
  };
}

function createStudent(profile: (typeof seedProfiles)[number], index: number): Student {
  const rollNo = `${101 + index}`;
  const subjectScores = createSubjectScores(profile.marks, index % 4);
  const examScores = createExamScores(subjectScores, profile.trend);
  const overall = round(profile.marks * 0.6 + profile.assignments * 0.25 + profile.attendance * 0.15);
  const predictedGrade = getGradeFromScore(overall);

  return {
    id: `student-${rollNo}`,
    rollNo,
    name: profile.name,
    guardianName: profile.guardianName,
    phone: profile.phone,
    email: profile.email,
    attendanceRate: profile.attendance,
    marksAverage: profile.marks,
    assignmentCompletion: profile.assignments,
    participation: profile.participation,
    predictedGrade,
    confidence: clamp(overall + (profile.trend === "Rising" ? 4 : profile.trend === "Falling" ? -6 : 0)),
    riskLevel: getRiskLevel(overall, profile.attendance, profile.assignments),
    trend: profile.trend,
    subjectScores,
    subjectAttendance: createSubjectAttendance(profile.attendance, index % 3),
    examScores,
    attendanceMonth: createAttendanceMonth(profile.attendance, index),
    trajectory: createTrajectory(profile.marks, profile.trend),
    assignmentStats: createAssignmentStats(profile.assignments, index),
  };
}

function createSeedAssignments(totalStudents: number): AssignmentItem[] {
  return [
    { id: "asg-1", title: "Linear Equations Worksheet", subject: "Mathematics", dueDate: "2026-04-05", totalStudents, submitted: 8, onTime: 7, late: 1 },
    { id: "asg-2", title: "Lab Observation Report", subject: "Science", dueDate: "2026-04-08", totalStudents, submitted: 7, onTime: 6, late: 1 },
    { id: "asg-3", title: "Reading Reflection", subject: "English", dueDate: "2026-04-11", totalStudents, submitted: 9, onTime: 8, late: 1 },
    { id: "asg-4", title: "Civics Presentation Deck", subject: "Social Studies", dueDate: "2026-04-14", totalStudents, submitted: 6, onTime: 5, late: 1 },
    { id: "asg-5", title: "Spreadsheet Dashboard", subject: "Computer", dueDate: "2026-04-18", totalStudents, submitted: 8, onTime: 8, late: 0 },
  ];
}

export function createSeedState(): DataVistaState {
  return {
    students: [],
    assignments: [],
    settings: BASE_SETTINGS,
  };
}

function isLegacySeedState(state: DataVistaState) {
  const legacyStudents = seedProfiles.map((profile) => profile.name).sort();
  const currentStudents = state.students.map((student) => student.name).sort();
  const legacyAssignmentIds = createSeedAssignments(seedProfiles.length).map((assignment) => assignment.id).sort();
  const currentAssignmentIds = state.assignments.map((assignment) => assignment.id).sort();

  return (
    currentStudents.length === legacyStudents.length &&
    currentStudents.every((name, index) => name === legacyStudents[index]) &&
    currentAssignmentIds.length === legacyAssignmentIds.length &&
    currentAssignmentIds.every((id, index) => id === legacyAssignmentIds[index])
  );
}

function resolveTeacherStorageKey(teacher?: string | Pick<Teacher, "id" | "email" | "username">) {
  if (!teacher) return STORAGE_KEY;
  if (typeof teacher === "string") return `${STORAGE_KEY}_${teacher}`;
  const owner = teacher.id ?? teacher.email ?? teacher.username;
  return owner ? `${STORAGE_KEY}_${owner}` : STORAGE_KEY;
}

function isStateShape(value: unknown): value is DataVistaState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DataVistaState>;
  return Array.isArray(candidate.students) && Array.isArray(candidate.assignments) && !!candidate.settings;
}

export function loadState(teacher?: string | Pick<Teacher, "id" | "email" | "username">): DataVistaState {
  if (typeof window === "undefined") {
    return createSeedState();
  }
  const key = resolveTeacherStorageKey(teacher);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return createSeedState();
    const parsed = JSON.parse(raw) as DataVistaState;
    if (!isStateShape(parsed) || !parsed.students?.length) return createSeedState();
    if (isLegacySeedState(parsed)) return createSeedState();
    return parsed;
  } catch {
    return createSeedState();
  }
}

export function saveState(state: DataVistaState, teacher?: string | Pick<Teacher, "id" | "email" | "username">) {
  if (typeof window === "undefined") return;
  const key = resolveTeacherStorageKey(teacher);
  window.localStorage.setItem(key, JSON.stringify(state));
}

export function resetState(teacher?: string | Pick<Teacher, "id" | "email" | "username">) {
  const seed = createSeedState();
  saveState(seed, teacher);
  return seed;
}

export async function loadStateForTeacher(teacher?: Teacher): Promise<DataVistaState> {
  const localState = loadState(teacher);

  if (!isSupabaseConfigured || !supabase || !teacher?.id) {
    return localState;
  }

  const { data, error } = await supabase
    .from(REMOTE_STATE_TABLE)
    .select("state")
    .eq("owner_id", teacher.id)
    .maybeSingle();

  if (error) {
    return localState;
  }

  if (!isStateShape(data?.state)) {
    await saveStateForTeacher(localState, teacher);
    return localState;
  }

  if (isLegacySeedState(data.state)) {
    const emptyState = createSeedState();
    await saveStateForTeacher(emptyState, teacher);
    return emptyState;
  }

  saveState(data.state, teacher);
  return data.state;
}

export async function saveStateForTeacher(state: DataVistaState, teacher?: Teacher) {
  saveState(state, teacher);

  if (!isSupabaseConfigured || !supabase || !teacher?.id) {
    return;
  }

  await supabase.from(REMOTE_STATE_TABLE).upsert(
    {
      owner_id: teacher.id,
      owner_email: teacher.email ?? null,
      state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" },
  );
}

export async function fetchLatestStateForTeacher(teacher?: Teacher): Promise<DataVistaState | null> {
  if (!isSupabaseConfigured || !supabase || !teacher?.id) {
    return null;
  }

  const { data, error } = await supabase
    .from(REMOTE_STATE_TABLE)
    .select("state")
    .eq("owner_id", teacher.id)
    .maybeSingle();

  if (error || !isStateShape(data?.state)) {
    return null;
  }

  return data.state;
}

export async function resetStateForTeacher(teacher?: Teacher) {
  const seed = createSeedState();
  await saveStateForTeacher(seed, teacher);
  return seed;
}

export function exportStudentsCsv(students: Student[]) {
  const header = [
    "Roll No",
    "Name",
    "Guardian",
    "Phone",
    "Email",
    "Attendance",
    "Marks",
    "Assignments",
    "Participation",
    "Overall",
    "Predicted Grade",
    "Confidence",
    "Risk",
    "Trend",
  ];

  const rows = students.map((student) => [
    student.rollNo,
    student.name,
    student.guardianName,
    student.phone,
    student.email,
    student.attendanceRate,
    student.marksAverage,
    student.assignmentCompletion,
    student.participation,
    getOverallScore(student),
    student.predictedGrade,
    student.confidence,
    student.riskLevel,
    student.trend,
  ]);

  return [header, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");
}

export function exportBackupJson(state: DataVistaState) {
  return JSON.stringify(state, null, 2);
}

export function createStudentFromForm(input: {
  name: string;
  guardianName: string;
  phone: string;
  email: string;
  marksAverage: number;
  attendanceRate: number;
  assignmentCompletion: number;
  participation: number;
}): Student {
  const marksAverage = clamp(input.marksAverage);
  const attendanceRate = clamp(input.attendanceRate);
  const assignmentCompletion = clamp(input.assignmentCompletion);
  const participation = clamp(input.participation);
  const trend: TrendDirection =
    marksAverage >= 85 && attendanceRate >= 85 ? "Rising" : marksAverage < 65 || attendanceRate < 72 ? "Falling" : "Steady";
  const subjectScores = createSubjectScores(marksAverage, 1);
  const overall = round(marksAverage * 0.6 + assignmentCompletion * 0.25 + attendanceRate * 0.15);
  const rollNo = `${Math.floor(Math.random() * 900) + 200}`;

  return {
    id: `student-${Date.now()}`,
    rollNo,
    name: input.name.trim(),
    guardianName: input.guardianName.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    attendanceRate,
    marksAverage,
    assignmentCompletion,
    participation,
    predictedGrade: getGradeFromScore(overall),
    confidence: clamp(overall + (trend === "Rising" ? 5 : trend === "Falling" ? -5 : 0)),
    riskLevel: getRiskLevel(overall, attendanceRate, assignmentCompletion),
    trend,
    subjectScores,
    subjectAttendance: createSubjectAttendance(attendanceRate, 1),
    examScores: createExamScores(subjectScores, trend),
    attendanceMonth: createAttendanceMonth(attendanceRate, 2),
    trajectory: createTrajectory(marksAverage, trend),
    assignmentStats: createAssignmentStats(assignmentCompletion, 2),
  };
}

export function createAssignmentFromForm(input: {
  title: string;
  subject: Subject;
  dueDate: string;
  submitted: number;
  onTime: number;
  late: number;
  totalStudents: number;
}): AssignmentItem {
  const totalStudents = Math.max(1, input.totalStudents);
  const submitted = clamp(input.submitted, 0, totalStudents);
  const onTime = clamp(input.onTime, 0, submitted);
  const late = clamp(input.late, 0, submitted - onTime);

  return {
    id: `asg-${Date.now()}`,
    title: input.title.trim(),
    subject: input.subject,
    dueDate: input.dueDate,
    totalStudents,
    submitted,
    onTime,
    late,
  };
}

export function calculateClassHealth(students: Student[]) {
  if (!students.length) return 0;
  const total = students.reduce((sum, student) => sum + getOverallScore(student), 0);
  return round(total / students.length);
}

export function summarizeAttendance(attendanceMonth: AttendanceEntry[]) {
  return attendanceMonth.reduce(
    (acc, entry) => {
      acc[entry.status] += 1;
      return acc;
    },
    { present: 0, absent: 0, leave: 0 },
  );
}

export function updateStudent(student: Student, partial: Partial<Student>): Student {
  const next = { ...student, ...partial };
  const overall = getOverallScore(next);
  return {
    ...next,
    predictedGrade: getGradeFromScore(overall),
    riskLevel: getRiskLevel(overall, next.attendanceRate, next.assignmentCompletion),
  };
}

export function markTodayForStudent(student: Student): Student {
  const today = new Date().getDate();
  const nextMonth = student.attendanceMonth.map((entry) =>
    entry.day === today ? { ...entry, status: entry.status === "present" ? "leave" : "present" } : entry,
  );
  const presentDays = nextMonth.filter((entry) => entry.status === "present").length;
  const attendanceRate = clamp(round((presentDays / nextMonth.length) * 100));
  return updateStudent(student, {
    attendanceMonth: nextMonth,
    attendanceRate,
    subjectAttendance: createSubjectAttendance(attendanceRate, 1),
  });
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, round(value)));
}
