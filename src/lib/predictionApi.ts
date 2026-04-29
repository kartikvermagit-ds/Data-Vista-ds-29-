import type { Student } from "@/lib/studentStore";

const ML_API_URL = (import.meta.env.VITE_ML_API_URL ?? "").replace(/\/$/, "");

export interface PredictionFeatures {
  student_id?: string;
  student_name?: string;
  attendance_percentage: number;
  average_marks: number;
  last_test_score: number;
  previous_test_score: number;
  assignment_score: number;
  participation_score: number;
  missing_assignments: number;
  study_hours_per_week: number;
  late_submissions: number;
}

export interface StudentPrediction {
  student_id?: string;
  student_name?: string;
  predicted_grade: "A" | "B" | "C" | string;
  risk_label: "At Risk" | "Safe" | string;
  confidence: number;
  trend: "Rising" | "Falling" | "Stable" | string;
  feature_importance: Record<string, number>;
}

export const isMlApiConfigured = Boolean(ML_API_URL);

export function studentToPredictionFeatures(student: Student): PredictionFeatures {
  const overallSignal = Math.round(student.marks * 0.65 + student.assignmentScore * 0.2 + student.attendance * 0.15);
  const trendShift = student.marks >= 75 && student.attendance >= 80 ? 6 : student.marks < 55 || student.attendance < 65 ? -7 : 1;

  return {
    student_id: student.id,
    student_name: student.name,
    attendance_percentage: student.attendance,
    average_marks: student.marks,
    last_test_score: Math.max(0, Math.min(100, overallSignal + Math.max(-4, Math.min(4, student.assignmentScore - student.marks)))),
    previous_test_score: Math.max(0, Math.min(100, overallSignal - trendShift)),
    assignment_score: student.assignmentScore,
    participation_score: Math.round((student.assignmentScore + student.attendance) / 2),
    missing_assignments: Math.max(0, Math.round((100 - student.assignmentScore) / 20)),
    study_hours_per_week: Math.max(1, Math.round(student.marks / 10)),
    late_submissions: Math.max(0, Math.round((100 - student.attendance) / 25)),
  };
}

async function request<TResponse>(path: string, init: RequestInit): Promise<TResponse> {
  if (!ML_API_URL) {
    throw new Error("VITE_ML_API_URL is not configured.");
  }

  const response = await fetch(`${ML_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Prediction API failed with ${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}

export function predictStudent(features: PredictionFeatures) {
  return request<StudentPrediction>("/predict", {
    method: "POST",
    body: JSON.stringify(features),
  });
}

export async function predictStudents(students: Student[]) {
  const payload = {
    students: students.map(studentToPredictionFeatures),
  };
  const response = await request<{ predictions: StudentPrediction[] }>("/predict/batch", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.predictions;
}
