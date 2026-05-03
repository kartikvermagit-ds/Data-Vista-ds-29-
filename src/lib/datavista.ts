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
export type LectureStatus = "pending" | "done" | "skipped";

export interface LectureSlot {
  id: string;
  period: number;          // 1-6
  subject: Subject;
  topic: string;
  totalTopics: number;     // how many topics this subject has in the syllabus
  completedTopics: number; // running count
  status: LectureStatus;
  startTime: string;       // "09:00"
  endTime: string;         // "09:45"
}

export interface TimetableDay {
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri";
  slots: LectureSlot[];
}

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
  timetable: TimetableDay[];
}

const STORAGE_KEY = "datavista_v2_state";
const REMOTE_STATE_TABLE = "teacher_states";

const BASE_SETTINGS: ClassSettings = {
  className: "First year",
  section: "2026",
  classTeacher: "Faculty Advisor",
  term: "2026 First year",
  schoolName: "Data Vista",
  atRiskThreshold: 60,
  attendanceThreshold: 75,
  marksThreshold: 55,
  sendAlerts: true,
  weeklyDigest: true,
};

function normalizeSettings(settings?: Partial<ClassSettings>): ClassSettings {
  const merged: ClassSettings = {
    ...BASE_SETTINGS,
    ...settings,
  };

  const schoolName = merged.schoolName.trim();
  const className = merged.className.trim();
  const section = merged.section.trim();
  const term = merged.term.trim();
  const normalizedSchoolName = schoolName.toLowerCase().replace(/\s+/g, "");
  const normalizedClassName = className.toLowerCase().replace(/\s+/g, "");
  const normalizedSection = section.toLowerCase().replace(/\s+/g, "");
  const normalizedTerm = term.toLowerCase().replace(/\s+/g, "");

  if (normalizedSchoolName === "datavistapublicschool") {
    merged.schoolName = BASE_SETTINGS.schoolName;
  }

  if (
    (normalizedClassName === "grade9a" && normalizedTerm === "2026term2") ||
    (normalizedClassName === "b.tech" && normalizedSection === "cse") ||
    (normalizedClassName === "grade9a" && normalizedSection === "9a") ||
    (normalizedClassName === "grade9" && normalizedSection === "a")
  ) {
    merged.className = BASE_SETTINGS.className;
    merged.section = BASE_SETTINGS.section;
  }

  if (normalizedTerm === "2026term2" || normalizedTerm === "semester4") {
    merged.term = BASE_SETTINGS.term;
  }

  return merged;
}

function normalizeState(state: DataVistaState): DataVistaState {
  return {
    ...state,
    settings: normalizeSettings(state.settings),
    timetable: state.timetable?.length ? state.timetable : createSeedTimetable(),
  };
}

const seedProfiles = [
  { rollNo: "2513266", name: "Ayush Singh Kaintura", guardianName: "Mr. Kaintura", phone: "9812345601", email: "ayush@datavista.edu", marks: 91, attendance: 96, assignments: 94, participation: 88, trend: "Rising" as const },
  { rollNo: "2510944", name: "Ayush Tiwari", guardianName: "Mr. Tiwari", phone: "9812345602", email: "ayush.t@datavista.edu", marks: 84, attendance: 89, assignments: 86, participation: 78, trend: "Steady" as const },
  { rollNo: "2514027", name: "Charu Porwal", guardianName: "Mr. Porwal", phone: "9812345603", email: "charu@datavista.edu", marks: 73, attendance: 82, assignments: 76, participation: 74, trend: "Rising" as const },
  { rollNo: "2512843", name: "Chehak Goyal", guardianName: "Mr. Goyal", phone: "9812345604", email: "chehak@datavista.edu", marks: 66, attendance: 79, assignments: 71, participation: 69, trend: "Steady" as const },
  { rollNo: "2512265", name: "Deepti Patel", guardianName: "Mr. Patel", phone: "9812345605", email: "deepti@datavista.edu", marks: 58, attendance: 67, assignments: 64, participation: 60, trend: "Falling" as const },
  { rollNo: "2512910", name: "Devansh Mehrotra", guardianName: "Mr. Mehrotra", phone: "9812345606", email: "devansh.m@datavista.edu", marks: 88, attendance: 92, assignments: 91, participation: 84, trend: "Rising" as const },
  { rollNo: "2513654", name: "Devansh Mishra", guardianName: "Mr. Mishra", phone: "9812345607", email: "devansh.mi@datavista.edu", marks: 77, attendance: 85, assignments: 73, participation: 71, trend: "Steady" as const },
  { rollNo: "2511682", name: "Devansh Singh", guardianName: "Mr. Singh", phone: "9812345608", email: "devansh.s@datavista.edu", marks: 95, attendance: 98, assignments: 96, participation: 91, trend: "Rising" as const },
  { rollNo: "2510872", name: "Devesh Yadav", guardianName: "Mr. Yadav", phone: "9812345609", email: "devesh@datavista.edu", marks: 62, attendance: 70, assignments: 59, participation: 57, trend: "Falling" as const },
  { rollNo: "2512226", name: "Dharti Nautiyal", guardianName: "Mr. Nautiyal", phone: "9812345610", email: "dharti@datavista.edu", marks: 81, attendance: 87, assignments: 83, participation: 76, trend: "Steady" as const },
  { rollNo: "2512296", name: "Diksha Singh", guardianName: "Mr. Singh", phone: "9812345611", email: "diksha@datavista.edu", marks: 85, attendance: 90, assignments: 88, participation: 80, trend: "Rising" as const },
  { rollNo: "2511581", name: "Dipali", guardianName: "Mr. Dipali", phone: "9812345612", email: "dipali@datavista.edu", marks: 76, attendance: 84, assignments: 80, participation: 75, trend: "Steady" as const },
  { rollNo: "2513420", name: "Divyanshi Gupta", guardianName: "Mr. Gupta", phone: "9812345613", email: "divyanshi@datavista.edu", marks: 93, attendance: 97, assignments: 95, participation: 89, trend: "Rising" as const },
  { rollNo: "2513323", name: "Divyanshu Mishra", guardianName: "Mr. Mishra", phone: "9812345614", email: "divyanshu.m@datavista.edu", marks: 64, attendance: 72, assignments: 68, participation: 62, trend: "Falling" as const },
  { rollNo: "2510505", name: "Divyanshu Prajapati", guardianName: "Mr. Prajapati", phone: "9812345615", email: "divyanshu.p@datavista.edu", marks: 78, attendance: 83, assignments: 75, participation: 72, trend: "Steady" as const },
  { rollNo: "2511068", name: "Eshan Srivastava", guardianName: "Mr. Srivastava", phone: "9812345616", email: "eshan@datavista.edu", marks: 89, attendance: 91, assignments: 87, participation: 85, trend: "Rising" as const },
  { rollNo: "2513249", name: "Gaurav Kumar", guardianName: "Mr. Kumar", phone: "9812345617", email: "gaurav@datavista.edu", marks: 60, attendance: 68, assignments: 62, participation: 58, trend: "Falling" as const },
  { rollNo: "2513818", name: "Gauri Srivastava", guardianName: "Mr. Srivastava", phone: "9812345618", email: "gauri@datavista.edu", marks: 82, attendance: 88, assignments: 84, participation: 79, trend: "Steady" as const },
  { rollNo: "2512325", name: "Gopal Jee", guardianName: "Mr. Jee", phone: "9812345619", email: "gopal@datavista.edu", marks: 71, attendance: 78, assignments: 72, participation: 68, trend: "Steady" as const },
  { rollNo: "2514230", name: "Gyan Aryan", guardianName: "Mr. Aryan", phone: "9812345620", email: "gyan@datavista.edu", marks: 87, attendance: 93, assignments: 89, participation: 82, trend: "Rising" as const },
  { rollNo: "2512301", name: "Harshit Singh Chauhan", guardianName: "Mr. Chauhan", phone: "9812345621", email: "harshit@datavista.edu", marks: 92, attendance: 95, assignments: 93, participation: 87, trend: "Rising" as const },
  { rollNo: "2513884", name: "Harshita Jaiswal", guardianName: "Mr. Jaiswal", phone: "9812345622", email: "harshita@datavista.edu", marks: 68, attendance: 75, assignments: 70, participation: 65, trend: "Steady" as const },
  { rollNo: "2513467", name: "Himanshu Raja", guardianName: "Mr. Raja", phone: "9812345623", email: "himanshu@datavista.edu", marks: 74, attendance: 81, assignments: 78, participation: 73, trend: "Steady" as const },
  { rollNo: "2512143", name: "Irtiga Nazim", guardianName: "Mr. Nazim", phone: "9812345624", email: "irtiga@datavista.edu", marks: 86, attendance: 90, assignments: 85, participation: 81, trend: "Rising" as const },
  { rollNo: "2513128", name: "Ishan Kumar Singh", guardianName: "Mr. Singh", phone: "9812345625", email: "ishan@datavista.edu", marks: 63, attendance: 69, assignments: 60, participation: 59, trend: "Falling" as const },
  { rollNo: "2510155", name: "Ishika Goyal", guardianName: "Mr. Goyal", phone: "9812345626", email: "ishika@datavista.edu", marks: 90, attendance: 94, assignments: 92, participation: 86, trend: "Rising" as const },
  { rollNo: "2511360", name: "Ishika Mishra", guardianName: "Mr. Mishra", phone: "9812345627", email: "ishika.m@datavista.edu", marks: 79, attendance: 86, assignments: 82, participation: 77, trend: "Steady" as const },
  { rollNo: "2513449", name: "Jagrati Ramchandani", guardianName: "Mr. Ramchandani", phone: "9812345628", email: "jagrati@datavista.edu", marks: 83, attendance: 89, assignments: 86, participation: 80, trend: "Rising" as const },
  { rollNo: "2511415", name: "Jasmeet Singh Bedi", guardianName: "Mr. Bedi", phone: "9812345629", email: "jasmeet@datavista.edu", marks: 59, attendance: 66, assignments: 63, participation: 61, trend: "Falling" as const },
  { rollNo: "2513060", name: "Kajal Pal", guardianName: "Mr. Pal", phone: "9812345630", email: "kajal@datavista.edu", marks: 75, attendance: 82, assignments: 79, participation: 74, trend: "Steady" as const },
  { rollNo: "2511404", name: "Kartik Mishra", guardianName: "Mr. Mishra", phone: "9812345631", email: "kartik.m@datavista.edu", marks: 88, attendance: 91, assignments: 88, participation: 83, trend: "Rising" as const },
  { rollNo: "2513513", name: "Kartik Verma", guardianName: "Mr. Verma", phone: "9812345632", email: "kartik.v@datavista.edu", marks: 94, attendance: 98, assignments: 96, participation: 90, trend: "Rising" as const },
  { rollNo: "2510827", name: "Kartikey Pandey", guardianName: "Mr. Pandey", phone: "9812345633", email: "kartikey@datavista.edu", marks: 67, attendance: 76, assignments: 72, participation: 67, trend: "Steady" as const },
  { rollNo: "2512784", name: "Kavya Awasthi", guardianName: "Mr. Awasthi", phone: "9812345634", email: "kavya.a@datavista.edu", marks: 80, attendance: 85, assignments: 81, participation: 76, trend: "Steady" as const },
  { rollNo: "2512953", name: "Kavya Pratap Singh", guardianName: "Mr. Singh", phone: "9812345635", email: "kavya.s@datavista.edu", marks: 72, attendance: 80, assignments: 74, participation: 70, trend: "Steady" as const },
  { rollNo: "2511651", name: "Kavya Singh", guardianName: "Mr. Singh", phone: "9812345636", email: "kavya@datavista.edu", marks: 61, attendance: 68, assignments: 65, participation: 60, trend: "Falling" as const },
  { rollNo: "2510697", name: "Khushi Shukla", guardianName: "Mr. Shukla", phone: "9812345637", email: "khushi@datavista.edu", marks: 87, attendance: 93, assignments: 90, participation: 84, trend: "Rising" as const },
  { rollNo: "2513275", name: "Kiran Shukla", guardianName: "Mr. Shukla", phone: "9812345638", email: "kiran@datavista.edu", marks: 78, attendance: 84, assignments: 77, participation: 72, trend: "Steady" as const },
  { rollNo: "2512234", name: "Krishan Bhattacharya", guardianName: "Mr. Bhattacharya", phone: "9812345639", email: "krishan@datavista.edu", marks: 91, attendance: 96, assignments: 94, participation: 88, trend: "Rising" as const },
  { rollNo: "2514002", name: "Krishna Gupta", guardianName: "Mr. Gupta", phone: "9812345640", email: "krishna@datavista.edu", marks: 57, attendance: 65, assignments: 58, participation: 55, trend: "Falling" as const },
  { rollNo: "2510046", name: "Krishna Kumar", guardianName: "Mr. Kumar", phone: "9812345641", email: "krishna.k@datavista.edu", marks: 73, attendance: 81, assignments: 76, participation: 71, trend: "Steady" as const },
  { rollNo: "2513436", name: "Krishna Sahu", guardianName: "Mr. Sahu", phone: "9812345642", email: "krishna.s@datavista.edu", marks: 82, attendance: 87, assignments: 83, participation: 78, trend: "Steady" as const },
  { rollNo: "2511716", name: "Kriti Jaiswal", guardianName: "Mr. Jaiswal", phone: "9812345643", email: "kriti@datavista.edu", marks: 96, attendance: 99, assignments: 97, participation: 92, trend: "Rising" as const },
  { rollNo: "2512363", name: "Kshama Pal", guardianName: "Mr. Pal", phone: "9812345644", email: "kshama@datavista.edu", marks: 65, attendance: 74, assignments: 69, participation: 64, trend: "Steady" as const },
  { rollNo: "2513812", name: "Kushagra Agrawal", guardianName: "Mr. Agrawal", phone: "9812345645", email: "kushagra.a@datavista.edu", marks: 84, attendance: 89, assignments: 86, participation: 81, trend: "Rising" as const },
  { rollNo: "2510145", name: "Kushagra Dixit", guardianName: "Mr. Dixit", phone: "9812345646", email: "kushagra.d@datavista.edu", marks: 70, attendance: 78, assignments: 73, participation: 69, trend: "Steady" as const },
  { rollNo: "2511280", name: "Lav Pal", guardianName: "Mr. Pal", phone: "9812345647", email: "lav@datavista.edu", marks: 56, attendance: 63, assignments: 57, participation: 54, trend: "Falling" as const },
  { rollNo: "2513399", name: "Madhur Mishra", guardianName: "Mr. Mishra", phone: "9812345648", email: "madhur@datavista.edu", marks: 89, attendance: 92, assignments: 90, participation: 85, trend: "Rising" as const },
  { rollNo: "2512675", name: "Manya Mishra", guardianName: "Mr. Mishra", phone: "9812345649", email: "manya@datavista.edu", marks: 77, attendance: 85, assignments: 80, participation: 75, trend: "Steady" as const },
  { rollNo: "2513786", name: "Mayank Srivastava", guardianName: "Mr. Srivastava", phone: "9812345650", email: "mayank@datavista.edu", marks: 93, attendance: 96, assignments: 95, participation: 89, trend: "Rising" as const },
  { rollNo: "2510431", name: "Mohan Singh", guardianName: "Mr. Singh", phone: "9812345651", email: "mohan@datavista.edu", marks: 69, attendance: 77, assignments: 72, participation: 68, trend: "Steady" as const },
  { rollNo: "2510520", name: "Mohd Saad", guardianName: "Mr. Saad", phone: "9812345652", email: "saad@datavista.edu", marks: 81, attendance: 88, assignments: 84, participation: 79, trend: "Steady" as const },
  { rollNo: "2514011", name: "Mohd Wamiq Siddiqui", guardianName: "Mr. Siddiqui", phone: "9812345653", email: "wamiq@datavista.edu", marks: 74, attendance: 82, assignments: 77, participation: 72, trend: "Steady" as const },
  { rollNo: "2512699", name: "Naincy", guardianName: "Mr. Naincy", phone: "9812345654", email: "naincy@datavista.edu", marks: 62, attendance: 71, assignments: 64, participation: 61, trend: "Falling" as const },
  { rollNo: "2514048", name: "Nainsi Verma", guardianName: "Mr. Verma", phone: "9812345655", email: "nainsi@datavista.edu", marks: 86, attendance: 90, assignments: 87, participation: 82, trend: "Rising" as const },
  { rollNo: "2511523", name: "Naitik Gupta", guardianName: "Mr. Gupta", phone: "9812345656", email: "naitik@datavista.edu", marks: 76, attendance: 84, assignments: 79, participation: 74, trend: "Steady" as const },
  { rollNo: "2512027", name: "Namita Prakash Dwivedi", guardianName: "Mr. Dwivedi", phone: "9812345657", email: "namita@datavista.edu", marks: 90, attendance: 95, assignments: 92, participation: 87, trend: "Rising" as const },
  { rollNo: "2513342", name: "Nandani Gupta", guardianName: "Mr. Gupta", phone: "9812345658", email: "nandani@datavista.edu", marks: 55, attendance: 62, assignments: 56, participation: 53, trend: "Falling" as const },
  { rollNo: "2512400", name: "Nandini Gupta", guardianName: "Mr. Gupta", phone: "9812345659", email: "nandini.g@datavista.edu", marks: 83, attendance: 89, assignments: 85, participation: 80, trend: "Rising" as const },
  { rollNo: "2510667", name: "Nandini Sahu", guardianName: "Mr. Sahu", phone: "9812345660", email: "nandini.s@datavista.edu", marks: 71, attendance: 79, assignments: 75, participation: 70, trend: "Steady" as const },
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
  const rollNo = profile.rollNo;
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
    { id: "asg-1", title: "Linear Equations Worksheet", subject: "Mathematics", dueDate: "2026-04-05", totalStudents, submitted: Math.round(totalStudents * 0.9), onTime: Math.round(totalStudents * 0.8), late: Math.round(totalStudents * 0.1) },
    { id: "asg-2", title: "Lab Observation Report", subject: "Science", dueDate: "2026-04-08", totalStudents, submitted: Math.round(totalStudents * 0.85), onTime: Math.round(totalStudents * 0.75), late: Math.round(totalStudents * 0.1) },
    { id: "asg-3", title: "Reading Reflection", subject: "English", dueDate: "2026-04-11", totalStudents, submitted: Math.round(totalStudents * 0.95), onTime: Math.round(totalStudents * 0.85), late: Math.round(totalStudents * 0.1) },
    { id: "asg-4", title: "Civics Presentation Deck", subject: "Social Studies", dueDate: "2026-04-14", totalStudents, submitted: Math.round(totalStudents * 0.8), onTime: Math.round(totalStudents * 0.7), late: Math.round(totalStudents * 0.1) },
    { id: "asg-5", title: "Spreadsheet Dashboard", subject: "Computer", dueDate: "2026-04-18", totalStudents, submitted: Math.round(totalStudents * 0.92), onTime: Math.round(totalStudents * 0.88), late: Math.round(totalStudents * 0.04) },
  ];
}

function createSeedTimetable(): TimetableDay[] {
  type DayName = TimetableDay["day"];
  const DAYS: DayName[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const TIMES = [
    ["09:00", "09:45"],
    ["09:45", "10:30"],
    ["10:45", "11:30"],
    ["11:30", "12:15"],
    ["13:00", "13:45"],
    ["13:45", "14:30"],
  ];
  // Subject rotation per day (period 1-6)
  const SCHEDULE: Subject[][] = [
    ["Mathematics", "Science", "English", "Social Studies", "Computer", "Mathematics"],
    ["English", "Mathematics", "Computer", "Science", "Social Studies", "English"],
    ["Science", "Social Studies", "Mathematics", "English", "Mathematics", "Computer"],
    ["Computer", "English", "Social Studies", "Mathematics", "Science", "Social Studies"],
    ["Social Studies", "Computer", "Science", "Computer", "English", "Science"],
  ];
  const TOPICS: Record<Subject, string[]> = {
    Mathematics: ["Algebra Basics", "Linear Equations", "Quadratic Equations", "Polynomials", "Geometry Intro", "Triangles", "Circles", "Coordinate Geometry", "Statistics", "Probability"],
    Science: ["Matter & Properties", "Atoms & Molecules", "Motion & Force", "Work & Energy", "Light & Optics", "Electricity", "Magnetism", "Cell Biology", "Reproduction", "Ecosystems"],
    English: ["Reading Comprehension", "Essay Writing", "Grammar — Tenses", "Vocabulary", "Prose Analysis", "Poetry", "Letter Writing", "Speech", "Novel Study", "Revision"],
    "Social Studies": ["Ancient Civilizations", "Medieval History", "Modern History", "Geography — Maps", "Physical Geography", "Climate Zones", "Civics & Constitution", "Economy Basics", "Globalisation", "Current Affairs"],
    Computer: ["Intro to Computers", "Operating Systems", "MS Office", "Internet Basics", "HTML Basics", "Python Intro", "Variables & Data Types", "Loops & Functions", "Database Basics", "Cybersecurity"],
  };
  const topicIndex: Record<Subject, number> = { Mathematics: 0, Science: 0, English: 0, "Social Studies": 0, Computer: 0 };

  return DAYS.map((day, dayIdx) => ({
    day,
    slots: SCHEDULE[dayIdx].map((subject, periodIdx) => {
      const tIdx = topicIndex[subject] % TOPICS[subject].length;
      const topic = TOPICS[subject][tIdx];
      topicIndex[subject]++;
      return {
        id: `${day}-p${periodIdx + 1}`,
        period: periodIdx + 1,
        subject,
        topic,
        totalTopics: TOPICS[subject].length,
        completedTopics: periodIdx < 2 && dayIdx < 3 ? tIdx + 1 : tIdx,
        status: (periodIdx < 2 && dayIdx < 3 ? "done" : "pending") as LectureStatus,
        startTime: TIMES[periodIdx][0],
        endTime: TIMES[periodIdx][1],
      };
    }),
  }));
}

export function createSeedState(): DataVistaState {
  const students = seedProfiles.map((p, i) => createStudent(p, i));
  return {
    students,
    assignments: createSeedAssignments(students.length),
    settings: normalizeSettings(),
    timetable: createSeedTimetable(),
  };
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
    // We removed the legacy state wipe here so that current 10-student state can be updated manually
    // or reset by the user to get the 40-student state.
    return normalizeState(parsed);
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

  const normalizedState = normalizeState(data.state);
  saveState(normalizedState, teacher);
  return normalizedState;
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

  return normalizeState(data.state);
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
