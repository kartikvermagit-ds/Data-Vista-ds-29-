export interface Student {
  id: string;
  name: string;
  attendance: number; // 0-100 percentage
  marks: number; // 0-100
  assignmentScore: number; // 0-100
  addedAt: string;
}

export type Prediction = 'improving' | 'stable' | 'declining';

const STORAGE_KEY = 'datavista_students';

export function getStudents(): Student[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveStudents(students: Student[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
}

export function addStudent(student: Omit<Student, 'id' | 'addedAt'>): Student {
  const students = getStudents();
  const newStudent: Student = {
    ...student,
    id: crypto.randomUUID(),
    addedAt: new Date().toISOString(),
  };
  students.push(newStudent);
  saveStudents(students);
  return newStudent;
}

export function deleteStudent(id: string) {
  const students = getStudents().filter(s => s.id !== id);
  saveStudents(students);
}

export function updateStudent(id: string, data: Partial<Omit<Student, 'id' | 'addedAt'>>) {
  const students = getStudents().map(s => s.id === id ? { ...s, ...data } : s);
  saveStudents(students);
}

export function getOverallScore(s: Student): number {
  return Math.round(s.marks * 0.4 + s.assignmentScore * 0.35 + s.attendance * 0.25);
}

export function getPrediction(s: Student): Prediction {
  const overall = getOverallScore(s);
  // Rule-based prediction
  if (s.attendance >= 80 && s.assignmentScore >= 70 && s.marks < 60) return 'improving';
  if (s.attendance >= 75 && s.assignmentScore >= 60 && overall >= 50 && overall < 70) return 'improving';
  if (overall >= 70) return 'stable';
  if (s.attendance < 50 || overall < 40) return 'declining';
  return 'stable';
}

export function getTopStudents(students: Student[], count = 5): Student[] {
  return [...students].sort((a, b) => getOverallScore(b) - getOverallScore(a)).slice(0, count);
}

export function getWeakStudents(students: Student[], threshold = 50): Student[] {
  return students.filter(s => getOverallScore(s) < threshold).sort((a, b) => getOverallScore(a) - getOverallScore(b));
}

export function getClassAverage(students: Student[]) {
  if (students.length === 0) return { marks: 0, attendance: 0, assignment: 0, overall: 0 };
  const sum = students.reduce(
    (acc, s) => ({
      marks: acc.marks + s.marks,
      attendance: acc.attendance + s.attendance,
      assignment: acc.assignment + s.assignmentScore,
      overall: acc.overall + getOverallScore(s),
    }),
    { marks: 0, attendance: 0, assignment: 0, overall: 0 }
  );
  const n = students.length;
  return {
    marks: Math.round(sum.marks / n),
    attendance: Math.round(sum.attendance / n),
    assignment: Math.round(sum.assignment / n),
    overall: Math.round(sum.overall / n),
  };
}
