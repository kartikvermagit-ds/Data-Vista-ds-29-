import "@google/model-viewer";
import type { Teacher } from "./lib/auth"; import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, BellRing, BookOpenCheck, BrainCircuit, Calculator, CalendarDays, Download, FileSpreadsheet, LayoutDashboard, LogOut, Plus, Save, Settings, Trash2, TrendingUp, Users, UserCircle2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { EXAMS, SUBJECTS, calculateClassHealth, createAssignmentFromForm, createStudentFromForm, exportBackupJson, exportStudentsCsv, fetchLatestStateForTeacher, getGradeFromScore, getOverallScore, loadState, loadStateForTeacher, markTodayForStudent, resetStateForTeacher, saveStateForTeacher, summarizeAttendance, type AttendanceStatus, type ClassSettings, type DataVistaState, type ExamName, type Student, type Subject } from "@/lib/datavista";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type PageId = "dashboard" | "students" | "attendance" | "marks" | "assignments" | "predictions" | "insights" | "calculator" | "settings";
type RiskFilter = "All" | "Low" | "Medium" | "High";

type AddStudentForm = { name: string; guardianName: string; phone: string; email: string; marksAverage: string; attendanceRate: string; assignmentCompletion: string; participation: string };
type AddAssignmentForm = { title: string; subject: Subject; dueDate: string; submitted: string; onTime: string; late: string };

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

const nav = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["students", "Students", Users],
  ["attendance", "Attendance", CalendarDays],
  ["marks", "Marks & Exams", FileSpreadsheet],
  ["assignments", "Assignments", BookOpenCheck],
  ["predictions", "Predictions", TrendingUp],
  ["insights", "AI Insights", BrainCircuit],
  ["calculator", "Calculator", Calculator],
  ["settings", "Settings", Settings],
] as const;

const riskTone: Record<string, string> = { Low: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200", Medium: "border-amber-400/20 bg-amber-400/10 text-amber-200", High: "border-rose-400/20 bg-rose-400/10 text-rose-200" };
const trendTone: Record<string, string> = { Rising: "text-emerald-300", Steady: "text-sky-300", Falling: "text-rose-300" };
const emptyForm: AddStudentForm = { name: "", guardianName: "", phone: "", email: "", marksAverage: "", attendanceRate: "", assignmentCompletion: "", participation: "" };
const emptyAssignmentForm: AddAssignmentForm = { title: "", subject: "Mathematics", dueDate: "", submitted: "", onTime: "", late: "" };
const tooltipStyle = { background: "rgba(14,12,10,.96)", border: "1px solid rgba(192,160,98,.18)", borderRadius: "16px", color: "#f3e7c2" };

export default function App({ teacher, onLogout }: { teacher: Teacher; onLogout: () => void }) {
  const [state, setState] = useState<DataVistaState>(() => loadState(teacher));
  const [stateReady, setStateReady] = useState(false);
  const [active, setActive] = useState<PageId>("dashboard"); const [jumping, setJumping] = useState(false); const [vibgyorIndex, setVibgyorIndex] = useState(0);
  const [selectedId, setSelectedId] = useState(state.students[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [risk, setRisk] = useState<RiskFilter>("All");
  const [addOpen, setAddOpen] = useState(false);
  const [addAssignmentOpen, setAddAssignmentOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [form, setForm] = useState<AddStudentForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [assignmentForm, setAssignmentForm] = useState<AddAssignmentForm>(emptyAssignmentForm);
  const [assignmentErrors, setAssignmentErrors] = useState<Record<string, string>>({});
  const [settingsDraft, setSettingsDraft] = useState(state.settings);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => { document.documentElement.classList.add("dark"); document.documentElement.style.colorScheme = "dark"; }, []);
  useEffect(() => {
    let cancelled = false;

    setStateReady(false);
    void loadStateForTeacher(teacher).then((nextState) => {
      if (cancelled) return;
      setState(nextState);
      setSelectedId((current) => (nextState.students.some((student) => student.id === current) ? current : nextState.students[0]?.id ?? ""));
      setStateReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [teacher]);
  useEffect(() => {
    if (!stateReady) return;
    void saveStateForTeacher(state, teacher);
  }, [state, stateReady, teacher]);
  useEffect(() => { setSettingsDraft(state.settings); }, [state.settings]);
  useEffect(() => { if (!state.students.some((s) => s.id === selectedId)) setSelectedId(state.students[0]?.id ?? ""); }, [selectedId, state.students]);
  useEffect(() => {
    if (!stateReady || !teacher.id) return;

    let cancelled = false;
    const syncLatest = async () => {
      const latest = await fetchLatestStateForTeacher(teacher);
      if (!latest || cancelled) return;
      const currentSerialized = JSON.stringify(state);
      const latestSerialized = JSON.stringify(latest);
      if (currentSerialized !== latestSerialized) {
        setState(latest);
      }
    };

    const intervalId = window.setInterval(() => {
      void syncLatest();
    }, 10000);

    const onFocus = () => {
      void syncLatest();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncLatest();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [state, stateReady, teacher]);

  const selected = state.students.find((s) => s.id === selectedId) ?? state.students[0] ?? null;
  const filtered = useMemo(() => state.students.filter((s) => (s.name.toLowerCase().includes(deferredSearch.toLowerCase()) || s.rollNo.includes(deferredSearch)) && (risk === "All" || s.riskLevel === risk)), [deferredSearch, risk, state.students]);
  const top = useMemo(() => [...state.students].sort((a, b) => getOverallScore(b) - getOverallScore(a)).slice(0, 5), [state.students]);
  const classHealth = useMemo(() => calculateClassHealth(state.students), [state.students]);
  const trend = useMemo(() => ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"].map((month, i) => ({ month, avg: avg(state.students.map((s) => s.trajectory[i]?.score ?? s.marksAverage)) })), [state.students]);
  const grades = useMemo(() => ["A+", "A", "B+", "B", "C", "D"].map((g) => ({ grade: g, students: state.students.filter((s) => getGradeFromScore(getOverallScore(s)) === g).length })), [state.students]);
  const attendanceMix = useMemo(() => { const t = state.students.reduce((a, s) => { const n = summarizeAttendance(s.attendanceMonth); a.present += n.present; a.absent += n.absent; a.leave += n.leave; return a; }, { present: 0, absent: 0, leave: 0 }); return [{ name: "Present", value: t.present, color: "#34d399" }, { name: "Absent", value: t.absent, color: "#fb7185" }, { name: "Leave", value: t.leave, color: "#f59e0b" }]; }, [state.students]);
  const histogram = useMemo(() => [{ range: "40-49", min: 40, max: 49 }, { range: "50-59", min: 50, max: 59 }, { range: "60-69", min: 60, max: 69 }, { range: "70-79", min: 70, max: 79 }, { range: "80-89", min: 80, max: 89 }, { range: "90-100", min: 90, max: 100 }].map((b) => ({ range: b.range, count: state.students.filter((s) => s.marksAverage >= b.min && s.marksAverage <= b.max).length })), [state.students]);
  const subjectCards = useMemo(() => SUBJECTS.map((subject) => ({ subject, avgScore: avg(state.students.map((s) => s.subjectScores[subject])), avgAttendance: avg(state.students.map((s) => s.subjectAttendance[subject])) })), [state.students]);
  const assignmentsByStudent = useMemo(() => state.students.map((s) => ({ name: s.name.split(" ")[0], onTime: s.assignmentStats.onTime, late: s.assignmentStats.late, pending: s.assignmentStats.pending })), [state.students]);
  const scatter = useMemo(() => state.students.map((s) => ({ x: s.attendanceRate, y: s.marksAverage, name: s.name })), [state.students]);
  const insights = useMemo(() => {
    const atRisk = state.students.filter((s) => s.riskLevel === "High");
    const down = state.students.filter((s) => s.trend === "Falling");
    return [
      atRisk.length ? { id: "risk", tone: "rose", title: `${atRisk.length} students need intervention`, detail: `${atRisk.map((s) => s.name.split(" ")[0]).join(", ")} are below the current threshold.` } : null,
      down.length ? { id: "trend", tone: "amber", title: "Declining trend detected", detail: `${down.map((s) => s.name.split(" ")[0]).join(", ")} show downward movement this term.` } : null,
      { id: "leaders", tone: "emerald", title: "Top performers lift class momentum", detail: `${top.slice(0, 2).map((s) => s.name.split(" ")[0]).join(" and ")} are consistently above 85 overall.` },
    ].filter(Boolean) as Array<{ id: string; tone: string; title: string; detail: string }>;
  }, [state.students, top]);

  const summary = { students: state.students.length, marks: avg(state.students.map((s) => s.marksAverage)), attendance: avg(state.students.map((s) => s.attendanceRate)), risk: state.students.filter((s) => s.riskLevel === "High").length };

  function go(page: PageId) {
    const update = () => setActive(page); if ("startViewTransition" in document) {
      document.startViewTransition(() => startTransition(update)); return;
    } startTransition(update);
  }
  function download(name: string, content: string, type: string) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }
  function exportCsv() { download("datavista-students.csv", exportStudentsCsv(state.students), "text/csv;charset=utf-8"); toast.success("CSV export is ready."); }
  function exportBackup() { download("datavista-backup.json", exportBackupJson(state), "application/json;charset=utf-8"); toast.success("Backup file downloaded."); }
  function markToday() { if (!selected) return; setState((c) => ({ ...c, students: c.students.map((s) => s.id === selected.id ? markTodayForStudent(s) : s) })); toast.success(`Today's attendance was updated for ${selected.name}.`); }
  function saveSettings() { setState((c) => ({ ...c, settings: settingsDraft })); toast.success("Settings saved."); }
  function resetDemo() { void resetStateForTeacher(teacher).then((next) => { setState(next); setSelectedId(next.students[0]?.id ?? ""); toast.info("Class data refreshed from the default snapshot."); }); }
  async function deleteAccount() {
    if (!isSupabaseConfigured || !supabase) {
      toast.error("Account deletion is available only for Supabase-backed accounts.");
      return;
    }

    const confirmed = window.confirm("Delete this account permanently? This will remove your login and all synced class data.");
    if (!confirmed) return;

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken) {
      toast.error("Your session has expired. Please sign in again.");
      return;
    }

    const response = await fetch(apiUrl("/api/delete-account"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      toast.error(payload.error ?? "Unable to delete account.");
      return;
    }

    toast.success("Account deleted.");
    onLogout();
  }
  function notifyParent() { if (!selected) return; toast.success(`Parent notification queued for ${selected.guardianName}.`); }
  function deleteStudent() { if (!selected) return; const name = selected.name; setState((c) => ({ ...c, students: c.students.filter((s) => s.id !== selected.id) })); setDetailOpen(false); toast.success(`${name} deleted.`); } function generateReport() { if (!selected) return; download(`${selected.name.replace(/\s+/g, "-").toLowerCase()}-report.txt`, [`${selected.name} (${selected.rollNo})`, `Overall: ${getOverallScore(selected)}`, `Attendance: ${selected.attendanceRate}%`, `Marks: ${selected.marksAverage}%`, `Assignments: ${selected.assignmentCompletion}%`, `Prediction: ${selected.predictedGrade} (${selected.trend})`].join("\n"), "text/plain;charset=utf-8"); toast.success("Student report generated."); }
  function openStudent(s: Student) { setSelectedId(s.id); setDetailOpen(true); }
  function validate() { const e: Record<string, string> = {}; if (!form.name.trim()) e.name = "Required"; if (!form.guardianName.trim()) e.guardianName = "Required"; if (!/^\d{10}$/.test(form.phone.trim())) e.phone = "10-digit phone"; if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = "Valid email"; for (const k of ["marksAverage", "attendanceRate", "assignmentCompletion", "participation"] as const) { const v = Number(form[k]); if (form[k] === "" || Number.isNaN(v) || v < 0 || v > 100) e[k] = "0-100"; } setErrors(e); return !Object.keys(e).length; }
  function addStudent() { if (!validate()) return; const student = createStudentFromForm({ name: form.name, guardianName: form.guardianName, phone: form.phone, email: form.email, marksAverage: Number(form.marksAverage), attendanceRate: Number(form.attendanceRate), assignmentCompletion: Number(form.assignmentCompletion), participation: Number(form.participation) }); setState((c) => ({ ...c, students: [student, ...c.students], assignments: c.assignments.map((a) => ({ ...a, totalStudents: c.students.length + 1 })) })); setSelectedId(student.id); setAddOpen(false); setForm(emptyForm); setErrors({}); toast.success(`${student.name} added.`); }
  function validateAssignment() { const e: Record<string, string> = {}; const submitted = Number(assignmentForm.submitted); const onTime = Number(assignmentForm.onTime); const late = Number(assignmentForm.late); if (!assignmentForm.title.trim()) e.title = "Required"; if (!assignmentForm.dueDate) e.dueDate = "Required"; if (assignmentForm.submitted === "" || Number.isNaN(submitted) || submitted < 0 || submitted > state.students.length) e.submitted = `0-${state.students.length}`; if (assignmentForm.onTime === "" || Number.isNaN(onTime) || onTime < 0 || onTime > submitted) e.onTime = "Must be <= submitted"; if (assignmentForm.late === "" || Number.isNaN(late) || late < 0 || late > Math.max(0, submitted - onTime)) e.late = "Invalid late count"; setAssignmentErrors(e); return !Object.keys(e).length; }
  function addAssignment() { if (!validateAssignment()) return; const assignment = createAssignmentFromForm({ title: assignmentForm.title, subject: assignmentForm.subject, dueDate: assignmentForm.dueDate, submitted: Number(assignmentForm.submitted), onTime: Number(assignmentForm.onTime), late: Number(assignmentForm.late), totalStudents: state.students.length }); setState((c) => ({ ...c, assignments: [assignment, ...c.assignments] })); setAddAssignmentOpen(false); setAssignmentForm(emptyAssignmentForm); setAssignmentErrors({}); toast.success(`${assignment.title} added.`); }
  function deleteAssignment(assignmentId: string) { const assignment = state.assignments.find((item) => item.id === assignmentId); if (!assignment) return; setState((current) => ({ ...current, assignments: current.assignments.filter((item) => item.id !== assignmentId) })); toast.success(`${assignment.title} deleted.`); }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_20%_0%,rgba(192,160,98,0.14),transparent_26%),radial-gradient(circle_at_85%_18%,rgba(255,255,255,0.05),transparent_18%),linear-gradient(180deg,#050505_0%,#090909_48%,#070707_100%)] text-[#EDEDED]">
      <div className="mx-auto grid min-h-screen w-full min-w-0 max-w-[1600px] gap-3 px-2 py-2 sm:gap-4 sm:px-4 sm:py-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6 lg:px-6">
        <aside className="min-w-0 rounded-[24px] border border-[#C0A062]/18 bg-[rgba(12,12,12,0.82)] p-3 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:rounded-[32px] sm:p-4">
          <div className="flex min-w-0 items-center gap-3 rounded-[22px] border border-[#C0A062]/18 bg-[linear-gradient(135deg,rgba(192,160,98,0.1),rgba(255,255,255,0.03))] px-3 py-3 sm:rounded-[28px] sm:px-4 sm:py-4"><div className="icon shrink-0 h-11 w-11 overflow-hidden rounded-xl flex items-center justify-center"><img src="/logo.png" alt="DataVista logo" className="h-full w-full object-cover scale-[1.4]" /></div><div className="min-w-0"><button onClick={() => { setJumping(true); setVibgyorIndex((i) => (i + 1) % 7); go("dashboard"); setTimeout(() => setJumping(false), 700); }} className={cn("mt-1 inline-block max-w-full truncate whitespace-nowrap font-['Playfair_Display'] text-base font-semibold uppercase tracking-[0.1em] text-[#E7D19A] transition-all duration-300 hover:scale-[1.03] hover:text-[#F2DEAE] sm:text-lg sm:tracking-[0.15em]", jumping && "animate-bounce")} style={{ textShadow: "0 0 18px rgba(192,160,98,0.22)" }}>DATA VISTA</button></div></div>
          <div className="mt-6 flex gap-2 overflow-x-auto pb-2 lg:flex-col">{nav.map(([id, label, Icon]) => <button key={id} onClick={() => go(id as PageId)} className={cn("flex min-w-fit items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-300", active === id ? "border-[#C0A062]/45 bg-[#C0A062] text-[#16120B] shadow-[0_0_18px_rgba(192,160,98,0.25)]" : "border-transparent text-[#D7D2C7] hover:border-[#C0A062]/20 hover:bg-white/[0.04] hover:text-[#F5E8C8]")}><Icon className="h-5 w-5" /><span className="text-sm font-medium">{label}</span>{active === id ? <ArrowUpRight className="ml-auto h-4 w-4" /> : null}</button>)}</div>
          <div className="mt-6 rounded-[28px] border border-[#C0A062]/14 bg-white/[0.03] p-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#C0A062]/25 bg-[#C0A062]/12 text-[#D9BE7A] flex-shrink-0"><UserCircle2 className="h-6 w-6" /></div><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-[#F5F0E6] truncate">{teacher.name}</p><p className="text-xs text-[#A7A093] truncate">{teacher.position}</p></div><button onClick={onLogout} title="Logout" className="text-[#7E776B] hover:text-rose-300 transition-colors flex-shrink-0"><LogOut className="h-4 w-4" /></button></div><Card className="mt-3 rounded-[28px] border-[#C0A062]/14 bg-white/[0.03] p-5"><p className="text-xs uppercase tracking-[0.2em] text-[#8F856F]">Active Class</p><p className="mt-3 text-xl font-semibold text-[#F5F0E6]">{state.settings.className} {state.settings.section}</p><p className="mt-1 text-sm text-[#A7A093]">{state.settings.classTeacher}</p><div className="mt-5 grid grid-cols-2 gap-3"><MiniStat label="Roster" value={state.students.length} /><MiniStat label="Health" value={classHealth} /></div></Card>
        </aside>
        <main className="min-w-0 overflow-hidden rounded-[24px] border border-[#C0A062]/14 bg-[rgba(12,12,12,0.68)] p-3 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:rounded-[32px] sm:p-5 xl:p-8" style={{ viewTransitionName: "app-page" }}>
          <header className="mb-8 flex flex-col gap-4 border-b border-[#C0A062]/12 pb-6 xl:flex-row xl:items-center xl:justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-[#8F856F]">{state.settings.schoolName}</p><h2 className="mt-2 text-2xl font-semibold text-[#F5F0E6] sm:text-3xl xl:text-4xl">{nav.find(([id]) => id === active)?.[1]}</h2><p className="mt-2 text-sm text-[#A7A093]">{state.settings.term} for {state.settings.className} {state.settings.section}</p></div><div className="grid w-full gap-3 sm:flex sm:w-auto sm:flex-wrap"><Button variant="outline" className="w-full rounded-full border-[#C0A062]/18 bg-transparent text-[#E7DFC9] hover:bg-[#C0A062]/10 hover:text-[#F7EBCB] sm:w-auto" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />CSV Export</Button><Button variant="outline" className="w-full rounded-full border-[#C0A062]/18 bg-transparent text-[#E7DFC9] hover:bg-[#C0A062]/10 hover:text-[#F7EBCB] sm:w-auto" onClick={notifyParent}><BellRing className="mr-2 h-4 w-4" />Notify Parent</Button>{active === "assignments" ? <Button className="w-full rounded-full bg-[#C0A062] text-[#16120B] hover:bg-[#D4B370] sm:w-auto" onClick={() => setAddAssignmentOpen(true)}><Plus className="mr-2 h-4 w-4" />Add Assignment</Button> : <Button className="w-full rounded-full bg-[#C0A062] text-[#16120B] hover:bg-[#D4B370] sm:w-auto" onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" />Add Student</Button>}</div></header>
          {active === "dashboard" ? <DashboardPage summary={summary} trend={trend} attendanceMix={attendanceMix} grades={grades} top={top} onOpenStudent={openStudent} students={state.students} /> : null}
          {active === "students" ? <StudentsPage filtered={filtered} search={search} setSearch={setSearch} risk={risk} setRisk={setRisk} onOpenStudent={openStudent} /> : null}
          {active === "attendance" && selected ? <AttendancePage students={state.students} selected={selected} selectedId={selectedId} onSelect={setSelectedId} onMarkToday={markToday} /> : null}
          {active === "marks" && selected ? <MarksPage students={state.students} selected={selected} selectedId={selectedId} onSelect={setSelectedId} histogram={histogram} subjectCards={subjectCards} /> : null}
          {active === "assignments" ? <AssignmentsPage assignments={state.assignments} data={assignmentsByStudent} onAddAssignment={() => setAddAssignmentOpen(true)} onDeleteAssignment={deleteAssignment} /> : null}
          {active === "predictions" && selected ? <PredictionsPage students={state.students} selected={selected} selectedId={selectedId} onSelect={setSelectedId} /> : null}
          {active === "insights" ? <InsightsPage insights={insights} classHealth={classHealth} scatter={scatter} /> : null}
          {active === "calculator" ? <CalculatorPage /> : null}
          {active === "settings" ? <SettingsPage settingsDraft={settingsDraft} setSettingsDraft={setSettingsDraft} saveSettings={saveSettings} exportCsv={exportCsv} exportBackup={exportBackup} resetDemo={resetDemo} deleteAccount={deleteAccount} /> : null}
        </main>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogContent className="max-w-2xl rounded-[28px] border-[#C0A062]/18 bg-[#0E0C0A] text-[#EDEDED]"><DialogHeader><DialogTitle className="text-2xl text-[#F5E8C8]">Add Student</DialogTitle><DialogDescription className="text-[#A79B84]">Create a new profile with enough data to place the student into every analytics view.</DialogDescription></DialogHeader><div className="grid gap-4 md:grid-cols-2">{(["name", "guardianName", "phone", "email", "marksAverage", "attendanceRate", "assignmentCompletion", "participation"] as const).map((field) => <Field key={field} label={field} error={errors[field]}><Input type={field.includes("Rate") || field.includes("Average") || field === "participation" || field === "assignmentCompletion" ? "number" : "text"} value={form[field]} onChange={(e) => setForm((c) => ({ ...c, [field]: e.target.value }))} className="h-11 rounded-2xl border-[#2A241A] bg-[#121212] text-[#EDEDED] placeholder:text-[#5F584C] focus-visible:ring-[#C0A062]/35" /></Field>)}</div><DialogFooter><Button variant="outline" className="rounded-full border-[#C0A062]/18 bg-transparent text-[#E7DFC9] hover:bg-[#C0A062]/10" onClick={() => setAddOpen(false)}>Cancel</Button><Button className="rounded-full bg-[#C0A062] text-[#16120B] hover:bg-[#D4B370]" onClick={addStudent}><Plus className="mr-2 h-4 w-4" />Add Student</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={addAssignmentOpen} onOpenChange={setAddAssignmentOpen}><DialogContent className="max-w-2xl rounded-[28px] border-[#C0A062]/18 bg-[#0E0C0A] text-[#EDEDED]"><DialogHeader><DialogTitle className="text-2xl text-[#F5E8C8]">Add Assignment</DialogTitle><DialogDescription className="text-[#A79B84]">Create a new assignment and track class submission progress.</DialogDescription></DialogHeader><div className="grid gap-4 md:grid-cols-2"><Field label="title" error={assignmentErrors.title}><Input value={assignmentForm.title} onChange={(e) => setAssignmentForm((c) => ({ ...c, title: e.target.value }))} className="h-11 rounded-2xl border-[#2A241A] bg-[#121212] text-[#EDEDED] placeholder:text-[#5F584C] focus-visible:ring-[#C0A062]/35" /></Field><Field label="subject"><select value={assignmentForm.subject} onChange={(e) => setAssignmentForm((c) => ({ ...c, subject: e.target.value as Subject }))} className="h-11 w-full rounded-2xl border border-[#2A241A] bg-[#121212] px-4 text-[#EDEDED] outline-none focus:border-[#C0A062]/60">{SUBJECTS.map((subject) => <option key={subject} value={subject} className="bg-[#121212]">{subject}</option>)}</select></Field><Field label="dueDate" error={assignmentErrors.dueDate}><Input type="date" value={assignmentForm.dueDate} onChange={(e) => setAssignmentForm((c) => ({ ...c, dueDate: e.target.value }))} className="h-11 rounded-2xl border-[#2A241A] bg-[#121212] text-[#EDEDED] focus-visible:ring-[#C0A062]/35" /></Field><Field label="submitted" error={assignmentErrors.submitted}><Input type="number" value={assignmentForm.submitted} onChange={(e) => setAssignmentForm((c) => ({ ...c, submitted: e.target.value }))} className="h-11 rounded-2xl border-[#2A241A] bg-[#121212] text-[#EDEDED] focus-visible:ring-[#C0A062]/35" /></Field><Field label="onTime" error={assignmentErrors.onTime}><Input type="number" value={assignmentForm.onTime} onChange={(e) => setAssignmentForm((c) => ({ ...c, onTime: e.target.value }))} className="h-11 rounded-2xl border-[#2A241A] bg-[#121212] text-[#EDEDED] focus-visible:ring-[#C0A062]/35" /></Field><Field label="late" error={assignmentErrors.late}><Input type="number" value={assignmentForm.late} onChange={(e) => setAssignmentForm((c) => ({ ...c, late: e.target.value }))} className="h-11 rounded-2xl border-[#2A241A] bg-[#121212] text-[#EDEDED] focus-visible:ring-[#C0A062]/35" /></Field></div><DialogFooter><Button variant="outline" className="rounded-full border-[#C0A062]/18 bg-transparent text-[#E7DFC9] hover:bg-[#C0A062]/10" onClick={() => setAddAssignmentOpen(false)}>Cancel</Button><Button className="rounded-full bg-[#C0A062] text-[#16120B] hover:bg-[#D4B370]" onClick={addAssignment}><Plus className="mr-2 h-4 w-4" />Add Assignment</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}><DialogContent className="max-w-4xl rounded-[28px] border-white/10 bg-slate-950 text-slate-100">{selected ? <><DialogHeader><DialogTitle className="text-2xl">{selected.name}</DialogTitle><DialogDescription>Roll {selected.rollNo} � {selected.guardianName} � {selected.phone}</DialogDescription></DialogHeader><div className="grid gap-4 md:grid-cols-4"><MiniCard label="Overall" value={`${getOverallScore(selected)}%`} /><MiniCard label="Attendance" value={`${selected.attendanceRate}%`} /><MiniCard label="Grade" value={selected.predictedGrade} /><MiniCard label="Confidence" value={`${selected.confidence}%`} /></div><div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]"><Panel title="Exam Scores" subtitle="Latest marks across assessments"><div className="space-y-4">{EXAMS.map((exam) => <div key={exam}><p className="mb-2 text-sm uppercase tracking-[0.18em] text-slate-500">{exam}</p><div className="grid grid-cols-2 gap-2 md:grid-cols-5">{SUBJECTS.map((subject) => <div key={subject} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3"><p className="text-xs text-slate-500">{shortSubject(subject)}</p><p className="mt-2 text-lg font-semibold text-white">{selected.examScores[exam][subject]}</p></div>)}</div></div>)}</div></Panel><Panel title="Student Snapshot" subtitle="Quick action card for parent outreach and reports"><div className="space-y-4"><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="font-medium text-white">Trend</p><p className={cn("mt-2 text-2xl font-semibold", trendTone[selected.trend])}>{selected.trend}</p><p className="mt-2 text-sm text-slate-400">Assignment completion is at {selected.assignmentCompletion}% with {selected.participation}% classroom participation.</p></div><div className="grid gap-3 md:grid-cols-2"><Button className="rounded-full bg-sky-500 text-slate-950 hover:bg-sky-400" onClick={notifyParent}><BellRing className="mr-2 h-4 w-4" />Notify Parent</Button><Button variant="outline" className="rounded-full border-white/10 bg-transparent text-slate-200 hover:bg-white/10" onClick={generateReport}><Download className="mr-2 h-4 w-4" />Generate Report</Button><Button variant="outline" className="rounded-full border-rose-400/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20 col-span-2 md:col-span-2" onClick={deleteStudent}><Trash2 className="mr-2 h-4 w-4" />Delete Student</Button></div></div></Panel></div></> : null}</DialogContent></Dialog>
    </div>
  );
}

function DashboardPage({ summary, trend, attendanceMix, grades, top, onOpenStudent, students }: { summary: { students: number; marks: number; attendance: number; risk: number }; trend: Array<{ month: string; avg: number }>; attendanceMix: Array<{ name: string; value: number; color: string }>; grades: Array<{ grade: string; students: number }>; top: Student[]; onOpenStudent: (student: Student) => void; students: Student[] }) {
  return <div className="space-y-6"><Hero /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Students" value={summary.students} hint="Active roster" /><Metric label="Avg Marks" value={`${summary.marks}%`} hint="Across all subjects" /><Metric label="Attendance" value={`${summary.attendance}%`} hint="This month" /><Metric label="At Risk" value={summary.risk} hint="Immediate follow-up" /></div><div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]"><Panel title="Performance Trend" subtitle="Average class score across six checkpoints"><Chart><LineChart data={trend}><CartesianGrid stroke="#1f3346" strokeDasharray="4 4" /><XAxis dataKey="month" stroke="#7f96ad" /><YAxis domain={[40, 100]} stroke="#7f96ad" /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="avg" stroke="#38bdf8" strokeWidth={3} dot={{ fill: "#f59e0b", r: 4 }} /></LineChart></Chart></Panel><Panel title="Attendance Mix" subtitle="Present, absent, and leave"><Chart><PieChart><Pie data={attendanceMix} innerRadius={58} outerRadius={92} paddingAngle={4} dataKey="value">{attendanceMix.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></Chart></Panel></div><div className="grid gap-6 xl:grid-cols-[1.2fr_1fr_1fr]"><Panel title="Grade Distribution" subtitle="Overall grade bands"><Chart><BarChart data={grades}><CartesianGrid stroke="#1f3346" vertical={false} /><XAxis dataKey="grade" stroke="#7f96ad" /><YAxis allowDecimals={false} stroke="#7f96ad" /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="students" fill="#34d399" radius={[8, 8, 0, 0]} /></BarChart></Chart></Panel><Panel title="Top 5 Leaderboard" subtitle="Best overall performers"><div className="space-y-3">{top.map((student, i) => <button key={student.id} onClick={() => onOpenStudent(student)} className="flex w-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-400/15 text-sm font-semibold text-sky-200">{i + 1}</div><div><p className="font-medium text-slate-100">{student.name}</p><p className="text-xs text-slate-400">{student.predictedGrade} projected</p></div></div><p className="font-semibold text-emerald-300">{getOverallScore(student)}%</p></button>)}</div></Panel><Panel title="At-Risk Alerts" subtitle="Students under the configured threshold"><div className="space-y-3">{students.filter((student) => student.riskLevel === "High").map((student) => <div key={student.id} className="rounded-2xl border border-rose-400/15 bg-rose-400/8 p-4"><div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="font-medium text-slate-100">{student.name}</p><Badge className={cn("border", riskTone[student.riskLevel])}>{student.riskLevel}</Badge></div><p className="text-sm text-slate-300">{student.attendanceRate}% attendance, {student.marksAverage}% marks.</p></div>)}</div></Panel></div></div>;
}

function StudentsPage({ filtered, search, setSearch, risk, setRisk, onOpenStudent }: { filtered: Student[]; search: string; setSearch: (value: string) => void; risk: RiskFilter; setRisk: (value: RiskFilter) => void; onOpenStudent: (student: Student) => void }) {
  return <div className="space-y-6"><Section eyebrow="Roster" title="Students" description="Search, filter, and open any learner for a quick intervention summary." /><div className="grid gap-4 lg:grid-cols-[1fr_auto]"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or roll number" className="h-12 rounded-2xl border-[#2A241A] bg-[#121212] text-[#EDEDED] placeholder:text-[#5F584C] focus-visible:ring-[#C0A062]/35" /><div className="flex flex-wrap gap-2">{(["All", "Low", "Medium", "High"] as const).map((r) => <Button key={r} variant="outline" className={cn("rounded-full border-[#C0A062]/12 bg-transparent text-[#C9C1B0] hover:bg-white/[0.06] hover:text-[#F5E8C8]", risk === r && "border-[#C0A062]/40 bg-[#C0A062]/12 text-[#F4E6C4]")} onClick={() => setRisk(r)}>{r}</Button>)}</div></div><Panel title="Student Directory" subtitle={`${filtered.length} visible students`}><div className="overflow-x-auto rounded-3xl border border-[#C0A062]/12"><div className="min-w-[760px]"><div className="grid grid-cols-[100px_1.5fr_1fr_1fr_1fr_0.9fr] bg-white/[0.03] px-4 py-3 text-xs uppercase tracking-[0.2em] text-[#8F856F]"><span>Roll</span><span>Name</span><span>Overall</span><span>Attendance</span><span>Prediction</span><span>Risk</span></div><div className="divide-y divide-[#C0A062]/10">{filtered.map((student) => <button key={student.id} className="grid w-full grid-cols-[100px_1.5fr_1fr_1fr_1fr_0.9fr] items-center gap-3 bg-[rgba(255,255,255,0.015)] px-4 py-4 text-left hover:bg-white/[0.04]" onClick={() => onOpenStudent(student)}><span className="text-sm text-[#C9C1B0]">{student.rollNo}</span><div><p className="font-medium text-[#F5F0E6]">{student.name}</p><p className="text-xs text-[#A7A093]">{student.guardianName}</p></div><div><p className="mb-2 text-sm font-medium text-[#F5F0E6]">{getOverallScore(student)}%</p><Progress value={getOverallScore(student)} className="h-2 bg-white/10" /></div><div><p className="mb-2 text-sm font-medium text-[#F5F0E6]">{student.attendanceRate}%</p><Progress value={student.attendanceRate} className="h-2 bg-white/10" /></div><div className="space-y-2"><Badge className="border border-[#C0A062]/20 bg-[#C0A062]/10 text-[#E7D19A]">{student.predictedGrade}</Badge><p className={cn("text-sm font-medium", trendTone[student.trend])}>{student.trend}</p></div><Badge className={cn("justify-center border", riskTone[student.riskLevel])}>{student.riskLevel}</Badge></button>)}</div></div></div></Panel></div>;
}

function AttendancePage({ students, selected, selectedId, onSelect, onMarkToday }: { students: Student[]; selected: Student; selectedId: string; onSelect: (id: string) => void; onMarkToday: () => void }) { return <div className="space-y-6"><Section eyebrow="Tracking" title="Attendance" description="Follow monthly presence patterns, compare subject attendance, and mark today instantly." action={<Button className="w-full rounded-full bg-emerald-400 text-slate-950 hover:bg-emerald-300 sm:w-auto" onClick={onMarkToday}><CalendarDays className="mr-2 h-4 w-4" />Mark Today</Button>} /><StudentTabs students={students} selectedId={selectedId} onSelect={onSelect} /><div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]"><Panel title={`${selected.name}'s Monthly Calendar`} subtitle="Present, absent, and leave timeline"><div className="overflow-x-auto"><div className="grid min-w-[560px] grid-cols-7 gap-2">{selected.attendanceMonth.map((entry) => <div key={entry.day} className={cn("rounded-2xl border px-3 py-3 text-center text-sm font-medium", attendanceClass(entry.status))}><p>{entry.day}</p><p className="mt-1 text-[11px] uppercase tracking-[0.18em]">{entry.status}</p></div>)}</div></div></Panel><Panel title="Subject-Wise Attendance" subtitle={`${selected.name}'s present rate per subject`}><Chart><BarChart data={SUBJECTS.map((subject) => ({ subject: shortSubject(subject), attendance: selected.subjectAttendance[subject] }))}><CartesianGrid stroke="#1f3346" vertical={false} /><XAxis dataKey="subject" stroke="#7f96ad" /><YAxis domain={[50, 100]} stroke="#7f96ad" /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="attendance" fill="#22c55e" radius={[8, 8, 0, 0]} /></BarChart></Chart></Panel></div><Panel title="Attendance Ranking" subtitle="Class-wide attendance comparison"><Chart className="h-[340px]"><BarChart layout="vertical" data={[...students].sort((a, b) => b.attendanceRate - a.attendanceRate).map((s) => ({ name: s.name, attendance: s.attendanceRate }))}><CartesianGrid stroke="#1f3346" horizontal={false} /><XAxis type="number" domain={[50, 100]} stroke="#7f96ad" /><YAxis type="category" dataKey="name" width={120} stroke="#7f96ad" /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="attendance" fill="#38bdf8" radius={[0, 8, 8, 0]} /></BarChart></Chart></Panel></div>; }

function MarksPage({ students, selected, selectedId, onSelect, histogram, subjectCards }: { students: Student[]; selected: Student; selectedId: string; onSelect: (id: string) => void; histogram: Array<{ range: string; count: number }>; subjectCards: Array<{ subject: string; avgScore: number; avgAttendance: number }> }) { return <div className="space-y-6"><Section eyebrow="Assessment" title="Marks & Exams" description="Review subject strength, exam trends, and distribution across the class." /><StudentTabs students={students} selectedId={selectedId} onSelect={onSelect} /><div className="grid gap-6 xl:grid-cols-[1fr_1fr]"><Panel title="Subject Comparison Radar" subtitle={`${selected.name}'s subject profile`}><Chart><RadarChart data={SUBJECTS.map((subject) => ({ subject: shortSubject(subject), score: selected.subjectScores[subject] }))}><PolarGrid stroke="#28455f" /><PolarAngleAxis dataKey="subject" tick={{ fill: "#cbd5e1", fontSize: 12 }} /><PolarRadiusAxis domain={[40, 100]} tick={{ fill: "#7f96ad", fontSize: 11 }} /><Radar dataKey="score" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.3} strokeWidth={2} /></RadarChart></Chart></Panel><Panel title="Score Distribution" subtitle="Where current class marks sit"><Chart><BarChart data={histogram}><CartesianGrid stroke="#1f3346" vertical={false} /><XAxis dataKey="range" stroke="#7f96ad" /><YAxis allowDecimals={false} stroke="#7f96ad" /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="count" fill="#f59e0b" radius={[8, 8, 0, 0]} /></BarChart></Chart></Panel></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{subjectCards.map((card) => <Card key={card.subject} className="rounded-[28px] border-white/10 bg-slate-950/70 p-5"><p className="text-sm uppercase tracking-[0.2em] text-slate-500">{shortSubject(card.subject)}</p><p className="mt-4 text-3xl font-semibold text-white">{card.avgScore}%</p><p className="mt-2 text-sm text-slate-400">{card.avgAttendance}% avg attendance</p></Card>)}</div><Panel title="Exam Results" subtitle="Unit test and half-yearly breakdown"><Tabs defaultValue={EXAMS[0]}><TabsList className="h-auto w-full justify-start overflow-x-auto rounded-full bg-white/5 p-1">{EXAMS.map((exam) => <TabsTrigger key={exam} value={exam} className="rounded-full data-[state=active]:bg-sky-500 data-[state=active]:text-slate-950">{exam}</TabsTrigger>)}</TabsList>{EXAMS.map((exam) => <TabsContent key={exam} value={exam}><div className="mt-4 overflow-x-auto rounded-3xl border border-white/10"><div className="min-w-[720px]"><div className="grid grid-cols-[1.5fr_repeat(5,1fr)] bg-white/5 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-400"><span>Student</span>{SUBJECTS.map((subject) => <span key={subject}>{shortSubject(subject)}</span>)}</div><div className="divide-y divide-white/10">{students.map((student) => <div key={`${student.id}-${exam}`} className="grid grid-cols-[1.5fr_repeat(5,1fr)] px-4 py-3 text-sm text-slate-200"><span>{student.name}</span>{SUBJECTS.map((subject) => <span key={subject}>{student.examScores[exam as ExamName][subject]}</span>)}</div>)}</div></div></div></TabsContent>)}</Tabs></Panel></div>; }
function AssignmentsPage({ assignments, data, onAddAssignment, onDeleteAssignment }: { assignments: DataVistaState["assignments"]; data: Array<{ name: string; onTime: number; late: number; pending: number }>; onAddAssignment: () => void; onDeleteAssignment: (assignmentId: string) => void }) { return <div className="space-y-6"><Section eyebrow="Coursework" title="Assignments" description="Track submission health across the class and identify students slipping on deadlines." action={<Button className="rounded-full bg-[#C0A062] text-[#16120B] hover:bg-[#D4B370]" onClick={onAddAssignment}><Plus className="mr-2 h-4 w-4" />Add Assignment</Button>} /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{assignments.map((assignment) => { const completion = Math.round((assignment.submitted / assignment.totalStudents) * 100); return <Card key={assignment.id} className="rounded-[28px] border-[#C0A062]/12 bg-white/[0.03] p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-sm uppercase tracking-[0.2em] text-[#8F856F]">{shortSubject(assignment.subject)}</p><h3 className="mt-2 text-xl font-semibold text-[#F5F0E6]">{assignment.title}</h3></div><div className="flex items-start gap-2"><Badge className="border border-[#C0A062]/20 bg-[#C0A062]/10 text-[#E7D19A]">{completion}%</Badge><Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-rose-300 hover:bg-rose-400/10 hover:text-rose-200" onClick={() => onDeleteAssignment(assignment.id)} aria-label={`Delete ${assignment.title}`}><Trash2 className="h-4 w-4" /></Button></div></div><p className="mt-3 text-sm text-[#A7A093]">Due {assignment.dueDate}</p><div className="mt-4 space-y-2"><Progress value={completion} className="h-2 bg-white/10" /><div className="flex justify-between text-xs uppercase tracking-[0.16em] text-[#8F856F]"><span>{assignment.submitted} submitted</span><span>{assignment.totalStudents - assignment.submitted} pending</span></div></div></Card>; })}</div><Panel title="Submission Mix by Student" subtitle="On-time, late, and pending assignment counts"><Chart className="h-[360px]"><BarChart data={data}><CartesianGrid stroke="#2B2418" vertical={false} /><XAxis dataKey="name" stroke="#9D8F72" /><YAxis allowDecimals={false} stroke="#9D8F72" /><Tooltip contentStyle={tooltipStyle} /><Legend /><Bar dataKey="onTime" stackId="a" fill="#C0A062" /><Bar dataKey="late" stackId="a" fill="#8E6E2C" /><Bar dataKey="pending" stackId="a" fill="#6A3B33" /></BarChart></Chart></Panel></div>; }

function PredictionsPage({ students, selected, selectedId, onSelect }: { students: Student[]; selected: Student; selectedId: string; onSelect: (id: string) => void }) {
  const highRiskCount = students.filter((student) => student.riskLevel === "High").length;
  const useAiPredictions = () => {
    toast.success(`AI predictions applied for ${students.length} students. ${highRiskCount} intervention alerts found.`);
  };

  return <div className="space-y-6"><Section eyebrow="Forecasting" title="Predictions" description="Surface grade forecasts, momentum direction, and confidence for intervention planning." action={<Button className="rounded-full bg-[#C0A062] text-[#16120B] hover:bg-[#D4B370]" onClick={useAiPredictions}><BrainCircuit className="mr-2 h-4 w-4" />Use AI Predictions</Button>} /><div className="grid gap-6 xl:grid-cols-[0.82fr_1.38fr]"><Panel title="AI Forecast Table" subtitle="Predicted final outcome for each student"><div className="mb-4 rounded-2xl border border-[#C0A062]/16 bg-[#C0A062]/8 px-4 py-3 text-sm text-[#E7D19A]"><span className="font-semibold">AI ready:</span> review grades, confidence, and trends, then use the button above to apply intervention planning.</div><div className="space-y-3">{students.map((student) => <div key={student.id} className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 sm:grid-cols-[1.4fr_0.7fr_0.8fr_1fr] sm:items-center"><div><p className="font-medium text-white">{student.name}</p><p className="text-xs text-slate-400">Overall {getOverallScore(student)}%</p></div><Badge className="w-fit border border-sky-400/20 bg-sky-400/10 text-sky-200">{student.predictedGrade}</Badge><div className={cn("text-sm font-medium", trendTone[student.trend])}>{student.trend}</div><div><div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-slate-500"><span>Confidence</span><span>{student.confidence}%</span></div><Progress value={student.confidence} className="h-2 bg-white/10" /></div></div>)}</div></Panel><Panel title="3D Robot Model" subtitle="Interactive AI assistant preview"><div className="grid gap-5 2xl:grid-cols-[minmax(520px,1.55fr)_minmax(220px,0.45fr)]"><RobotModelViewer modelPath="/robot.glb" /><PredictionFormulaCard /></div><Button className="mt-4 w-full rounded-full bg-sky-400 text-slate-950 hover:bg-sky-300" onClick={useAiPredictions}><BrainCircuit className="mr-2 h-4 w-4" />Run AI Forecast</Button></Panel></div><StudentTabs students={students} selectedId={selectedId} onSelect={onSelect} /><Panel title="Trajectory Line" subtitle={`${selected.name}'s recent score movement`}><Chart><LineChart data={selected.trajectory}><CartesianGrid stroke="#1f3346" strokeDasharray="4 4" /><XAxis dataKey="month" stroke="#7f96ad" /><YAxis domain={[40, 100]} stroke="#7f96ad" /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="score" stroke="#a78bfa" strokeWidth={3} dot={{ fill: "#38bdf8", r: 4 }} /></LineChart></Chart></Panel></div>;
}

function InsightsPage({ insights, classHealth, scatter }: { insights: Array<{ id: string; tone: string; title: string; detail: string }>; classHealth: number; scatter: Array<{ x: number; y: number; name: string }> }) { return <div className="space-y-6"><Section eyebrow="Intelligence" title="AI Insights" description="Automated flags across class health, intervention candidates, and performance clusters." /><div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]"><Panel title="Flagged Insights" subtitle="Machine-guided reading of the current class state"><div className="space-y-3">{insights.map((insight) => <div key={insight.id} className={cn("rounded-2xl border p-4", insight.tone === "rose" && "border-rose-400/15 bg-rose-400/8", insight.tone === "amber" && "border-amber-400/15 bg-amber-400/8", insight.tone === "emerald" && "border-emerald-400/15 bg-emerald-400/8")}><p className="font-medium text-white">{insight.title}</p><p className="mt-1 text-sm text-slate-300">{insight.detail}</p></div>)}</div></Panel><Panel title="Class Health Score" subtitle="Composite performance pulse"><Chart><PieChart><Pie data={[{ name: "Healthy", value: classHealth, color: "#34d399" }, { name: "Gap", value: 100 - classHealth, color: "#223548" }]} innerRadius={64} outerRadius={94} dataKey="value" startAngle={90} endAngle={-270}>{[{ name: "Healthy", value: classHealth, color: "#34d399" }, { name: "Gap", value: 100 - classHealth, color: "#223548" }].map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></Chart><div className="-mt-8 text-center"><p className="text-5xl font-semibold text-white">{classHealth}</p><p className="text-sm uppercase tracking-[0.22em] text-slate-500">out of 100</p></div></Panel></div><Panel title="Attendance vs Marks" subtitle="Students clustered by reliability and academic output"><Chart className="h-[360px]"><ScatterChart><CartesianGrid stroke="#1f3346" /><XAxis type="number" dataKey="x" name="Attendance" unit="%" stroke="#7f96ad" /><YAxis type="number" dataKey="y" name="Marks" unit="%" stroke="#7f96ad" /><Tooltip contentStyle={tooltipStyle} formatter={(value) => `${value}%`} cursor={{ strokeDasharray: "4 4" }} /><Scatter data={scatter} fill="#38bdf8" /></ScatterChart></Chart></Panel></div>; }

function CalculatorPage() {
  const [expression, setExpression] = useState("0");
  const [preview, setPreview] = useState("");

  const push = (value: string) => {
    setExpression((current) => {
      const next = current === "0" || current === "Error" ? value : `${current}${value}`;
      return next.replace(/([+\-*/])([+\-*/])+$/g, "$2");
    });
  };
  const clear = () => { setExpression("0"); setPreview(""); };
  const backspace = () => setExpression((current) => current.length > 1 && current !== "Error" ? current.slice(0, -1) : "0");
  const toggleSign = () => setExpression((current) => current.startsWith("-") ? current.slice(1) || "0" : current === "0" ? "-0" : `-${current}`);
  const calculate = () => {
    try {
      const answer = formatCalculatorNumber(evaluateCalculatorExpression(expression));
      setPreview(expression);
      setExpression(answer);
    } catch {
      setPreview(expression);
      setExpression("Error");
    }
  };

  const buttons = [
    ["AC", "+/-", "%", "/"],
    ["7", "8", "9", "*"],
    ["4", "5", "6", "-"],
    ["1", "2", "3", "+"],
    ["0", ".", "DEL", "="],
  ];

  return <div className="space-y-6"><Section eyebrow="Utility" title="Calculator" description="Quick calculations for marks, averages, percentages, and class planning." /><div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]"><Panel title="Basic Calculator" subtitle="Use operators, decimals, brackets, and percentages."><div className="rounded-[28px] border border-[#C0A062]/14 bg-[#080807] p-4 shadow-[inset_0_0_34px_rgba(192,160,98,0.05)] sm:p-5"><div className="mb-4 min-h-[132px] rounded-[24px] border border-[#C0A062]/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4 text-right"><p className="min-h-6 truncate text-sm text-[#8F856F]">{preview}</p><p className="mt-4 break-all font-mono text-4xl font-semibold text-[#F5F0E6] sm:text-5xl">{expression}</p></div><div className="grid grid-cols-4 gap-2 sm:gap-3">{buttons.flat().map((label) => { const isOperator = ["/", "*", "-", "+", "="].includes(label); const isUtility = ["AC", "+/-", "%", "DEL"].includes(label); return <Button key={label} type="button" variant="outline" className={cn("h-14 rounded-2xl border-[#C0A062]/14 bg-white/[0.04] font-mono text-lg text-[#F5F0E6] hover:bg-white/[0.08] hover:text-[#F5F0E6] sm:h-16", isOperator && "border-[#C0A062]/30 bg-[#C0A062]/16 text-[#F2DEAE] hover:bg-[#C0A062]/24 hover:text-[#FFF3D1]", label === "=" && "bg-[#C0A062] text-[#16120B] hover:bg-[#D4B370] hover:text-[#16120B]", isUtility && "text-[#C9C1B0]")} onClick={() => { if (label === "AC") clear(); else if (label === "DEL") backspace(); else if (label === "+/-") toggleSign(); else if (label === "=") calculate(); else push(label); }}>{label === "*" ? "x" : label === "/" ? "÷" : label}</Button>; })}</div></div></Panel><Panel title="Useful Shortcuts" subtitle="Classroom-friendly examples"><div className="grid gap-3 sm:grid-cols-2"><CalculatorExample label="Average marks" expression="(78+84+91)/3" onUse={setExpression} /><CalculatorExample label="Attendance rate" expression="23/26*100" onUse={setExpression} /><CalculatorExample label="10% improvement" expression="68+68*10%" onUse={setExpression} /><CalculatorExample label="Weighted score" expression="82*0.6+91*0.4" onUse={setExpression} /></div><div className="mt-5 rounded-2xl border border-[#C0A062]/12 bg-white/[0.03] p-4 text-sm leading-6 text-[#A7A093]">Tip: Percent works as a postfix operator, so <span className="font-mono text-[#E7D19A]">10%</span> becomes <span className="font-mono text-[#E7D19A]">0.1</span>.</div></Panel></div></div>;
}

function CalculatorExample({ label, expression, onUse }: { label: string; expression: string; onUse: (expression: string) => void }) {
  return <button type="button" onClick={() => onUse(expression)} className="rounded-2xl border border-[#C0A062]/12 bg-white/[0.03] p-4 text-left transition hover:border-[#C0A062]/28 hover:bg-white/[0.06]"><p className="text-sm font-medium text-[#F5F0E6]">{label}</p><p className="mt-2 font-mono text-sm text-[#E7D19A]">{expression}</p></button>;
}

function SettingsPage({ settingsDraft, setSettingsDraft, saveSettings, exportCsv, exportBackup, resetDemo, deleteAccount }: { settingsDraft: ClassSettings; setSettingsDraft: React.Dispatch<React.SetStateAction<ClassSettings>>; saveSettings: () => void; exportCsv: () => void; exportBackup: () => void; resetDemo: () => void; deleteAccount: () => void }) { return <div className="space-y-6"><Section eyebrow="Configuration" title="Settings" description="Tune thresholds, export your working data, or restore the saved demo setup." /><div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]"><Panel title="Class Configuration" subtitle="Core identity and teacher ownership"><div className="grid gap-4 md:grid-cols-2"><Field label="School Name"><Input value={settingsDraft.schoolName} onChange={(e) => setSettingsDraft((c) => ({ ...c, schoolName: e.target.value }))} className="h-11 rounded-2xl border-white/10 bg-slate-900/70" /></Field><Field label="Class Teacher"><Input value={settingsDraft.classTeacher} onChange={(e) => setSettingsDraft((c) => ({ ...c, classTeacher: e.target.value }))} className="h-11 rounded-2xl border-white/10 bg-slate-900/70" /></Field><Field label="Class"><Input value={settingsDraft.className} onChange={(e) => setSettingsDraft((c) => ({ ...c, className: e.target.value }))} className="h-11 rounded-2xl border-white/10 bg-slate-900/70" /></Field><Field label="Section"><Input value={settingsDraft.section} onChange={(e) => setSettingsDraft((c) => ({ ...c, section: e.target.value }))} className="h-11 rounded-2xl border-white/10 bg-slate-900/70" /></Field><Field label="Term"><Input value={settingsDraft.term} onChange={(e) => setSettingsDraft((c) => ({ ...c, term: e.target.value }))} className="h-11 rounded-2xl border-white/10 bg-slate-900/70" /></Field></div></Panel><Panel title="Thresholds & Actions" subtitle="Intervention controls and data utilities"><div className="space-y-4"><NumberField label="At-Risk Threshold" value={settingsDraft.atRiskThreshold} onChange={(value) => setSettingsDraft((c) => ({ ...c, atRiskThreshold: value }))} /><NumberField label="Attendance Threshold" value={settingsDraft.attendanceThreshold} onChange={(value) => setSettingsDraft((c) => ({ ...c, attendanceThreshold: value }))} /><NumberField label="Marks Threshold" value={settingsDraft.marksThreshold} onChange={(value) => setSettingsDraft((c) => ({ ...c, marksThreshold: value }))} /><Toggle label="Send parent alerts" checked={settingsDraft.sendAlerts} onChange={(checked) => setSettingsDraft((c) => ({ ...c, sendAlerts: checked }))} /><Toggle label="Weekly digest" checked={settingsDraft.weeklyDigest} onChange={(checked) => setSettingsDraft((c) => ({ ...c, weeklyDigest: checked }))} /><div className="grid gap-3 pt-2"><Button className="w-full rounded-full bg-sky-500 text-slate-950 hover:bg-sky-400 sm:w-auto" onClick={saveSettings}><Save className="mr-2 h-4 w-4" />Save Settings</Button><Button variant="outline" className="w-full rounded-full border-white/10 bg-transparent text-slate-200 hover:bg-white/10 sm:w-auto" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Export CSV</Button><Button variant="outline" className="w-full rounded-full border-white/10 bg-transparent text-slate-200 hover:bg-white/10 sm:w-auto" onClick={exportBackup}><FileSpreadsheet className="mr-2 h-4 w-4" />Backup JSON</Button><Button variant="outline" className="w-full rounded-full border-rose-400/20 bg-transparent text-rose-200 hover:bg-rose-400/10 sm:w-auto" onClick={resetDemo}>Reset to Saved Demo</Button><Button variant="outline" className="w-full rounded-full border-rose-500/35 bg-rose-500/10 text-rose-200 hover:bg-rose-500/18 sm:w-auto" onClick={deleteAccount}><Trash2 className="mr-2 h-4 w-4" />Delete Account</Button><p className="text-xs text-[#A79B84]">This permanently removes your login and synced class data from DataVista.</p></div></div></Panel></div></div>; }

function Hero() { return <Card className="overflow-hidden rounded-[24px] border-[#C0A062]/14 bg-[linear-gradient(135deg,rgba(192,160,98,0.12),rgba(14,12,10,0.98)_46%,rgba(192,160,98,0.16))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.4)] sm:rounded-[36px] sm:p-6 xl:p-8"><p className="text-[11px] uppercase tracking-[0.2em] text-[#C8B07A] sm:text-xs sm:tracking-[0.28em]">Command Center</p><h3 className="mt-3 max-w-2xl text-2xl font-semibold leading-tight text-[#FFF7E8] sm:text-4xl xl:text-5xl">One place to see class performance, risk signals, and next actions.</h3><p className="mt-3 max-w-2xl text-sm leading-6 text-[#B9B09E] sm:mt-4 sm:text-base">DataVista 2.0 brings dashboard analytics, attendance control, predictions, and AI insights into one artifact.</p></Card>; }
function Section({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div className="min-w-0"><p className="text-[11px] uppercase tracking-[0.2em] text-[#8F856F] sm:text-xs sm:tracking-[0.24em]">{eyebrow}</p><h3 className="mt-2 text-2xl font-semibold text-[#F5F0E6] sm:text-3xl">{title}</h3><p className="mt-2 text-sm leading-6 text-[#A7A093]">{description}</p></div>{action}</div>; }
function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <Card className="min-w-0 rounded-[22px] border-[#C0A062]/12 bg-white/[0.03] p-4 sm:rounded-[30px] sm:p-5 xl:p-6"><div className="mb-4 sm:mb-5"><h4 className="text-lg font-semibold text-[#F5F0E6] sm:text-xl">{title}</h4><p className="mt-1 text-sm leading-6 text-[#A7A093]">{subtitle}</p></div>{children}</Card>; }
function Chart({ children, className }: { children: React.ReactNode; className?: string }) { return <div className={cn("h-[240px] w-full min-w-0 sm:h-[300px]", className)}><ResponsiveContainer width="100%" height="100%">{children as React.ReactElement}</ResponsiveContainer></div>; }
function PredictionFormulaCard() {
  return <div className="relative min-h-[420px] overflow-hidden rounded-[22px] border border-sky-300/18 bg-[radial-gradient(circle_at_20%_0%,rgba(56,189,248,0.18),transparent_34%),linear-gradient(160deg,rgba(8,13,22,0.96),rgba(5,5,5,0.96))] p-4 shadow-[inset_0_0_34px_rgba(56,189,248,0.06)] sm:min-h-[620px] sm:rounded-[26px] sm:p-5"><div className="pointer-events-none absolute -right-16 top-8 h-40 w-40 rounded-full bg-[#C0A062]/10 blur-3xl" /><div className="pointer-events-none absolute bottom-12 left-4 h-32 w-32 rounded-full bg-sky-400/10 blur-3xl" /><p className="text-[11px] uppercase tracking-[0.2em] text-sky-200/70 sm:text-xs sm:tracking-[0.24em]">Prediction Math</p><h5 className="mt-3 text-xl font-semibold text-[#F5F0E6] sm:text-2xl">Random Forest Formula</h5><div className="mt-5 space-y-3 font-mono text-xs sm:mt-6 sm:space-y-4 sm:text-sm"><div className="rounded-2xl border border-white/10 bg-black/35 p-3 text-[#E7D19A] sm:p-4"><p>score = 0.38M + 0.22T</p><p className="mt-1">+ 0.18A + 0.12P</p><p className="mt-1">+ 0.06C - penalties</p></div><div className="rounded-2xl border border-sky-300/14 bg-sky-300/8 p-3 text-sky-100 sm:p-4"><p>grade = mode(tree_1...tree_n)</p><p className="mt-1">confidence = votes / n</p></div><div className="rounded-2xl border border-emerald-300/14 bg-emerald-300/8 p-3 text-emerald-100 sm:p-4"><p>trend = last_test - previous</p><p className="mt-1">Rising if trend &gt;= 5</p></div></div><div className="mt-5 grid grid-cols-2 gap-2 text-xs sm:mt-6 sm:gap-3"><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="text-[#8F856F]">M</p><p className="mt-1 font-semibold text-[#F5F0E6]">Marks</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="text-[#8F856F]">T</p><p className="mt-1 font-semibold text-[#F5F0E6]">Test</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="text-[#8F856F]">A</p><p className="mt-1 font-semibold text-[#F5F0E6]">Assignment</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="text-[#8F856F]">P</p><p className="mt-1 font-semibold text-[#F5F0E6]">Presence</p></div></div></div>;
}
function RobotModelViewer({ modelPath }: { modelPath: string }) {
  return <div className="relative min-h-[360px] overflow-hidden rounded-[22px] border border-[#C0A062]/12 bg-[radial-gradient(circle_at_top,rgba(192,160,98,0.16),transparent_46%),linear-gradient(180deg,#090909_0%,#050505_100%)] sm:min-h-[620px] sm:rounded-[26px]"><model-viewer src={modelPath} camera-controls auto-rotate camera-orbit="0deg 74deg 24%" min-camera-orbit="auto auto 16%" max-camera-orbit="auto auto 52%" field-of-view="16deg" rotation-per-second="18deg" shadow-intensity="1.25" exposure="1.18" environment-image="neutral" interaction-prompt="auto" tone-mapping="commerce" className="block h-[360px] w-full bg-transparent sm:h-[620px]" style={{ "--progress-bar-color": "#C0A062", "--progress-bar-height": "4px" } as React.CSSProperties}><button className="rounded-full border border-[#C0A062]/20 bg-black/65 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-[#F5F0E6]" slot="poster">Tap To Load Model</button></model-viewer><div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" /></div>;
}
function Metric({ label, value, hint }: { label: string; value: string | number; hint: string }) { return <Card className="rounded-[22px] border-[#C0A062]/12 bg-white/[0.03] p-4 sm:rounded-[28px] sm:p-5"><p className="text-xs uppercase tracking-[0.16em] text-[#8F856F] sm:text-sm sm:tracking-[0.18em]">{label}</p><p className="mt-2 text-3xl font-semibold text-[#F5F0E6] sm:text-4xl">{value}</p><p className="mt-2 text-sm text-[#A7A093]">{hint}</p></Card>; }
function MiniStat({ label, value }: { label: string; value: string | number }) { return <div className="rounded-2xl border border-[#C0A062]/12 bg-white/[0.03] px-3 py-3"><p className="text-xs uppercase tracking-[0.18em] text-[#8F856F]">{label}</p><p className="mt-1 text-lg font-semibold text-[#F5F0E6]">{value}</p></div>; }
function MiniCard({ label, value }: { label: string; value: string | number }) { return <Card className="rounded-[24px] border-[#C0A062]/12 bg-white/[0.03] p-4"><p className="text-xs uppercase tracking-[0.2em] text-[#8F856F]">{label}</p><p className="mt-2 text-2xl font-semibold text-[#F5F0E6]">{value}</p></Card>; }
function StudentTabs({ students, selectedId, onSelect }: { students: Student[]; selectedId: string; onSelect: (id: string) => void }) { return <div className="flex gap-2 overflow-x-auto pb-1">{students.map((student) => <button key={student.id} onClick={() => onSelect(student.id)} className={cn("rounded-full border px-4 py-2 text-sm transition", selectedId === student.id ? "border-[#C0A062]/40 bg-[#C0A062]/12 text-[#F4E6C4]" : "border-[#C0A062]/12 bg-white/[0.03] text-[#C9C1B0] hover:bg-white/[0.06]")}>{student.name}</button>)}</div>; }
function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) { return <label className="space-y-2"><span className="text-sm font-medium capitalize text-[#D7D2C7]">{label.replace(/([A-Z])/g, " $1")}</span>{children}{error ? <span className="text-sm text-rose-300">{error}</span> : null}</label>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <Field label={label}><Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-11 rounded-2xl border-[#2A241A] bg-[#121212] text-[#EDEDED] focus-visible:ring-[#C0A062]/35" /></Field>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="flex items-center justify-between rounded-2xl border border-[#C0A062]/12 bg-white/[0.03] px-4 py-3"><span className="text-sm text-[#E7DFC9]">{label}</span><button type="button" onClick={() => onChange(!checked)} className={cn("h-7 w-14 rounded-full border p-1 transition", checked ? "border-[#C0A062]/40 bg-[#C0A062]/18" : "border-[#2A241A] bg-[#121212]")}><span className={cn("block h-5 w-5 rounded-full transition", checked ? "translate-x-7 bg-[#D4B370]" : "translate-x-0 bg-[#6C6457]")} /></button></label>; }
function attendanceClass(status: AttendanceStatus) { if (status === "present") return "border-emerald-400/15 bg-emerald-400/10 text-emerald-200"; if (status === "leave") return "border-amber-400/15 bg-amber-400/10 text-amber-200"; return "border-rose-400/15 bg-rose-400/10 text-rose-200"; }
function shortSubject(subject: string) { if (subject === "Social Studies") return "Social"; if (subject === "Mathematics") return "Math"; return subject; }
function avg(values: number[]) { return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0; }
function formatCalculatorNumber(value: number) { return Number(value.toFixed(10)).toString(); }
function evaluateCalculatorExpression(expression: string) {
  const source = expression.replace(/\s/g, "");
  if (!source || !/^[\d+\-*/().%]+$/.test(source)) throw new Error("Invalid expression");
  let index = 0;

  const peek = () => source[index];
  const match = (char: string) => {
    if (source[index] !== char) return false;
    index += 1;
    return true;
  };
  const parseExpression = (): number => {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      value = match("+") ? value + parseTerm() : value - parseTerm();
    }
    return value;
  };
  const parseTerm = (): number => {
    let value = parseFactor();
    while (peek() === "*" || peek() === "/") {
      value = match("*") ? value * parseFactor() : value / parseFactor();
    }
    return value;
  };
  const parseFactor = (): number => {
    if (match("+")) return parseFactor();
    if (match("-")) return -parseFactor();

    let value: number;
    if (match("(")) {
      value = parseExpression();
      if (!match(")")) throw new Error("Missing closing bracket");
    } else {
      const start = index;
      while (/\d|\./.test(peek() ?? "")) index += 1;
      if (start === index) throw new Error("Expected number");
      value = Number(source.slice(start, index));
      if (Number.isNaN(value)) throw new Error("Invalid number");
    }

    while (match("%")) value /= 100;
    return value;
  };

  const result = parseExpression();
  if (index !== source.length || !Number.isFinite(result)) throw new Error("Invalid calculation");
  return result;
}
