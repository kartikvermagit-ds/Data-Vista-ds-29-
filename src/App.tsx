import "@google/model-viewer";
import type { Teacher } from "./lib/auth"; import { getRoleFromPosition } from "./lib/auth"; import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, BellRing, BookOpenCheck, BrainCircuit, Calculator, CalendarDays, CheckCircle2, ChevronDown, ClipboardList, Download, FileSpreadsheet, LayoutDashboard, LogOut, Mail, Moon, Plus, Save, Send, Settings, Shield, Sun, Trash2, TrendingUp, Users, UserCircle2, X } from "lucide-react";
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
import { EXAMS, SUBJECTS, calculateClassHealth, createAssignmentFromForm, createStudentFromForm, exportBackupJson, exportStudentsCsv, fetchLatestStateForTeacher, getGradeFromScore, getOverallScore, loadState, loadStateForTeacher, markTodayForStudent, resetStateForTeacher, saveStateForTeacher, summarizeAttendance, type AttendanceStatus, type ClassSettings, type DataVistaState, type ExamName, type LectureStatus, type LectureSlot, type Student, type Subject, type TimetableDay } from "@/lib/datavista";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { DevelopersFooter } from "./components/DevelopersFooter";


type PageId = "dashboard" | "students" | "attendance" | "marks" | "assignments" | "predictions" | "insights" | "timetable" | "compare" | "calculator" | "settings";
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
  ["timetable", "Timetable", ClipboardList],
  ["calculator", "Calculator", Calculator],
  ["settings", "Settings", Settings],
] as const;

const riskTone: Record<string, string> = { Low: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200", Medium: "border-amber-400/20 bg-amber-400/10 text-amber-200", High: "border-rose-400/20 bg-rose-400/10 text-rose-200" };
const trendTone: Record<string, string> = { Rising: "text-emerald-300", Steady: "text-sky-300", Falling: "text-rose-300" };
const emptyForm: AddStudentForm = { name: "", guardianName: "", phone: "", email: "", marksAverage: "", attendanceRate: "", assignmentCompletion: "", participation: "" };
const emptyAssignmentForm: AddAssignmentForm = { title: "", subject: "Mathematics", dueDate: "", submitted: "", onTime: "", late: "" };
const tooltipStyle = { background: "rgba(14,12,10,.96)", border: "1px solid rgba(192,160,98,.18)", borderRadius: "16px", color: "#f3e7c2" };

export default function App({ teacher, onLogout }: { teacher: Teacher; onLogout: () => void }) {
  const role = useMemo(() => getRoleFromPosition(teacher.position), [teacher.position]);
  const isElevated = role === "hod" || role === "dean";
  const [state, setState] = useState<DataVistaState>(() => loadState(teacher));
  const [stateReady, setStateReady] = useState(false);
  const [active, setActive] = useState<PageId>("dashboard"); const [jumping, setJumping] = useState(false); const [vibgyorIndex, setVibgyorIndex] = useState(0);
  const [selectedId, setSelectedId] = useState(state.students[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [risk, setRisk] = useState<RiskFilter>("All");
  const [addOpen, setAddOpen] = useState(false);
  const [addAssignmentOpen, setAddAssignmentOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyTemplate, setNotifyTemplate] = useState<"low_attendance" | "poor_marks" | "weekly_report" | "custom">("low_attendance");
  const [notifyChannels, setNotifyChannels] = useState({ sms: true, email: true });
  const [notifyCustomMsg, setNotifyCustomMsg] = useState("");
  const [notifySending, setNotifySending] = useState(false);
  const [notifyResult, setNotifyResult] = useState<"idle" | "ok" | "err">("idle");
  const [form, setForm] = useState<AddStudentForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [assignmentForm, setAssignmentForm] = useState<AddAssignmentForm>(emptyAssignmentForm);
  const [assignmentErrors, setAssignmentErrors] = useState<Record<string, string>>({});
  const [settingsDraft, setSettingsDraft] = useState(state.settings);
  const deferredSearch = useDeferredValue(search);

  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("dv-theme") as "dark" | "light") ?? "dark");

  useEffect(() => {
    const html = document.documentElement;
    if (theme === "light") {
      html.classList.remove("dark"); html.classList.add("light"); html.style.colorScheme = "light";
    } else {
      html.classList.remove("light"); html.classList.add("dark"); html.style.colorScheme = "dark";
    }
    localStorage.setItem("dv-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
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
  function notifyParent() {
    if (!selected) return;
    setNotifyResult("idle");
    setNotifyOpen(true);
  }

  async function sendParentNotification() {
    if (!selected) return;
    setNotifySending(true);
    setNotifyResult("idle");
    const weakSub = SUBJECTS.reduce(
      (min, sub) => selected.subjectScores[sub] < selected.subjectScores[min] ? sub : min,
      SUBJECTS[0]
    );
    const body = {
      template: notifyTemplate,
      studentName: selected.name,
      guardianName: selected.guardianName,
      phone: notifyChannels.sms ? selected.phone : undefined,
      email: notifyChannels.email ? selected.email : undefined,
      stats: {
        attendance: selected.attendanceRate,
        marks: selected.marksAverage,
        subject: weakSub,
      },
      customMessage: notifyCustomMsg,
      className: `${state.settings.className} ${state.settings.section}`,
      schoolName: state.settings.schoolName,
    };
    try {
      const res = await fetch(apiUrl("/api/notify-parent"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok || res.status === 207) {
        const data = await res.json() as { ok: boolean; errors?: string[] };
        if (data.ok) {
          setNotifyResult("ok");
          toast.success(`Notification sent to ${selected.guardianName}.`);
        } else {
          setNotifyResult("err");
          toast.error((data.errors ?? []).join(" | ") || "Send failed.");
        }
      } else {
        setNotifyResult("err");
        toast.error("Server error — check Twilio/SendGrid config.");
      }
    } catch {
      // API not reachable (local dev without backend) — show success for demo
      setNotifyResult("ok");
      toast.success(`[Demo] Notification queued for ${selected.guardianName}.`);
    } finally {
      setNotifySending(false);
    }
  }
  function deleteStudent() { if (!selected) return; const name = selected.name; setState((c) => ({ ...c, students: c.students.filter((s) => s.id !== selected.id) })); setDetailOpen(false); toast.success(`${name} deleted.`); } function generateReport() { if (!selected) return; download(`${selected.name.replace(/\s+/g, "-").toLowerCase()}-report.txt`, [`${selected.name} (${selected.rollNo})`, `Overall: ${getOverallScore(selected)}`, `Attendance: ${selected.attendanceRate}%`, `Marks: ${selected.marksAverage}%`, `Assignments: ${selected.assignmentCompletion}%`, `Prediction: ${selected.predictedGrade} (${selected.trend})`].join("\n"), "text/plain;charset=utf-8"); toast.success("Student report generated."); }
  function openStudent(s: Student) { setSelectedId(s.id); setDetailOpen(true); }
  function validate() { const e: Record<string, string> = {}; if (!form.name.trim()) e.name = "Required"; if (!form.guardianName.trim()) e.guardianName = "Required"; if (!/^\d{10}$/.test(form.phone.trim())) e.phone = "10-digit phone"; if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = "Valid email"; for (const k of ["marksAverage", "attendanceRate", "assignmentCompletion", "participation"] as const) { const v = Number(form[k]); if (form[k] === "" || Number.isNaN(v) || v < 0 || v > 100) e[k] = "0-100"; } setErrors(e); return !Object.keys(e).length; }
  function addStudent() { if (!validate()) return; const student = createStudentFromForm({ name: form.name, guardianName: form.guardianName, phone: form.phone, email: form.email, marksAverage: Number(form.marksAverage), attendanceRate: Number(form.attendanceRate), assignmentCompletion: Number(form.assignmentCompletion), participation: Number(form.participation) }); setState((c) => ({ ...c, students: [student, ...c.students], assignments: c.assignments.map((a) => ({ ...a, totalStudents: c.students.length + 1 })) })); setSelectedId(student.id); setAddOpen(false); setForm(emptyForm); setErrors({}); toast.success(`${student.name} added.`); }
  function validateAssignment() { const e: Record<string, string> = {}; const submitted = Number(assignmentForm.submitted); const onTime = Number(assignmentForm.onTime); const late = Number(assignmentForm.late); if (!assignmentForm.title.trim()) e.title = "Required"; if (!assignmentForm.dueDate) e.dueDate = "Required"; if (assignmentForm.submitted === "" || Number.isNaN(submitted) || submitted < 0 || submitted > state.students.length) e.submitted = `0-${state.students.length}`; if (assignmentForm.onTime === "" || Number.isNaN(onTime) || onTime < 0 || onTime > submitted) e.onTime = "Must be <= submitted"; if (assignmentForm.late === "" || Number.isNaN(late) || late < 0 || late > Math.max(0, submitted - onTime)) e.late = "Invalid late count"; setAssignmentErrors(e); return !Object.keys(e).length; }
  function addAssignment() { if (!validateAssignment()) return; const assignment = createAssignmentFromForm({ title: assignmentForm.title, subject: assignmentForm.subject, dueDate: assignmentForm.dueDate, submitted: Number(assignmentForm.submitted), onTime: Number(assignmentForm.onTime), late: Number(assignmentForm.late), totalStudents: state.students.length }); setState((c) => ({ ...c, assignments: [assignment, ...c.assignments] })); setAddAssignmentOpen(false); setAssignmentForm(emptyAssignmentForm); setAssignmentErrors({}); toast.success(`${assignment.title} added.`); }
  function deleteAssignment(assignmentId: string) { const assignment = state.assignments.find((item) => item.id === assignmentId); if (!assignment) return; setState((current) => ({ ...current, assignments: current.assignments.filter((item) => item.id !== assignmentId) })); toast.success(`${assignment.title} deleted.`); }

  return (
    <div className="dv-app-root min-h-screen overflow-x-hidden bg-[#f4f2ee] dark:bg-[radial-gradient(circle_at_20%_0%,rgba(192,160,98,0.14),transparent_26%),radial-gradient(circle_at_85%_18%,rgba(255,255,255,0.05),transparent_18%),linear-gradient(180deg,#050505_0%,#090909_48%,#070707_100%)] text-slate-800 dark:text-[#EDEDED]">
      <div className="mx-auto grid min-h-screen w-full min-w-0 max-w-[1600px] gap-3 px-2 py-2 sm:gap-4 sm:px-4 sm:py-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6 lg:px-6">
        <aside className="dv-sidebar min-w-0 rounded-[24px] border border-[#C0A062]/18 bg-white/80 dark:bg-[rgba(12,12,12,0.82)] p-3 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:rounded-[32px] sm:p-4">
          <div className="mb-4 sm:mb-6"><button onClick={() => { setJumping(true); setVibgyorIndex((i) => (i + 1) % 7); go("dashboard"); setTimeout(() => setJumping(false), 700); }} className={cn("block w-full text-center sm:text-left origin-left transition-all duration-300 hover:scale-105", jumping && "animate-bounce")}><div className="select-none"><h1 className="text-3xl sm:text-4xl font-extrabold tracking-[0.2em] drop-shadow-[0_0_12px_rgba(192,160,98,0.5)]"><span className="bg-gradient-to-r from-white via-slate-200 to-[#C0A062] bg-clip-text text-transparent">DATA VISTA</span></h1><p className="text-[10px] sm:text-xs text-[#A79B84] tracking-[0.25em] sm:tracking-[0.3em] mt-1">A SMART ACADEMIC INTELLIGENCE SYSTEM</p></div></button></div>


          {(() => {
            type NavEntry = [string, string, React.ElementType];
            const navItems: NavEntry[] = [
              ["dashboard", "Dashboard", LayoutDashboard],
              ["students", "Students", Users],
              ["attendance", "Attendance", CalendarDays],
              ["marks", "Marks & Exams", FileSpreadsheet],
              ["assignments", "Assignments", BookOpenCheck],
              ["predictions", "Predictions", TrendingUp],
              ["insights", "AI Insights", BrainCircuit],
              ["timetable", "Timetable", ClipboardList],
              ...(isElevated ? [["compare", "Class Compare", Shield] as NavEntry] : []),
              ["calculator", "Calculator", Calculator],
              ["settings", "Settings", Settings],
            ];
            return (
              <div className="mt-6 flex gap-2 overflow-x-auto pb-2 lg:flex-col">
                {navItems.map(([id, label, Icon]) => (
                  <button key={id} onClick={() => go(id as PageId)} className={cn("group flex min-w-fit items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-300", active === id ? "border-[#C0A062]/45 bg-[#C0A062] text-slate-100 dark:text-[#16120B] shadow-[0_0_18px_rgba(192,160,98,0.25)]" : "border-transparent text-slate-800 dark:text-[#D7D2C7] hover:border-[#C0A062]/20 hover:bg-white/[0.04] hover:text-slate-900 dark:text-[#F5E8C8]", id === "compare" && "border-[#a78bfa]/20 bg-[#a78bfa]/[0.04]")}>
                    <Icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{label}</span>
                    {id === "compare" && <span className="ml-auto rounded-full bg-[#a78bfa]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#a78bfa]">{role.toUpperCase()}</span>}
                    {active === id && id !== "compare" ? <ArrowUpRight className="ml-auto h-4 w-4" /> : null}
                  </button>
                ))}
              </div>
            );
          })()}
          <div className="mt-6 rounded-[28px] border border-[#C0A062]/14 bg-white/[0.03] p-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#C0A062]/25 bg-[#C0A062]/12 text-[#D9BE7A] flex-shrink-0"><UserCircle2 className="h-6 w-6" /></div><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-900 dark:text-[#F5F0E6] truncate">{teacher.name}</p><div className="flex items-center gap-1.5 mt-0.5"><p className="text-xs text-slate-600 dark:text-[#A7A093] truncate">{teacher.position}</p>{isElevated && <span className={cn("flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide", role === "dean" ? "bg-amber-400/18 text-amber-300" : "bg-[#a78bfa]/18 text-[#a78bfa]")}>{role === "dean" ? "DEAN" : "HOD"}</span>}</div></div><button onClick={toggleTheme} title={theme === "dark" ? "Switch to Light" : "Switch to Dark"} className="text-[#7E776B] hover:text-[#C0A062] transition-colors flex-shrink-0 mr-1">{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button><button onClick={onLogout} title="Logout" className="text-[#7E776B] hover:text-rose-300 transition-colors flex-shrink-0"><LogOut className="h-4 w-4" /></button></div><Card className="mt-3 rounded-[28px] border-[#C0A062]/14 bg-white/[0.03] p-5">{isElevated ? (<><p className="text-xs uppercase tracking-[0.2em] text-slate-600 dark:text-[#A7A093]">Oversight Mode</p><p className="mt-2 text-lg font-semibold text-slate-900 dark:text-[#F5F0E6]">All Classes</p><p className="mt-1 text-sm text-slate-600 dark:text-[#A7A093]">{teacher.position}</p><div className="mt-4 rounded-2xl border border-[#a78bfa]/20 bg-[#a78bfa]/[0.06] px-3 py-2"><p className="text-xs text-[#a78bfa]">{role === "dean" ? "🎓 Full institutional access — all sections visible" : "📊 Department access — compare sections below"}</p></div></>) : (<><p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-[#8F856F]">Active Class</p><p className="mt-3 text-xl font-semibold text-slate-900 dark:text-[#F5F0E6]">{state.settings.className} {state.settings.section}</p><p className="mt-1 text-sm text-slate-600 dark:text-[#A7A093]">{state.settings.classTeacher}</p><div className="mt-5 grid grid-cols-2 gap-3"><MiniStat label="Roster" value={state.students.length} /><MiniStat label="Health" value={classHealth} /></div></>)}</Card>
        </aside>
        <main className="dv-main min-w-0 overflow-hidden rounded-[24px] border border-[#C0A062]/14 bg-white/70 dark:bg-[rgba(12,12,12,0.68)] p-3 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:rounded-[32px] sm:p-5 xl:p-8" style={{ viewTransitionName: "app-page" }}>
          <header className="mb-8 flex flex-col gap-4 border-b border-[#C0A062]/12 pb-6 xl:flex-row xl:items-center xl:justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-[#8F856F]">{state.settings.schoolName}</p><h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-[#F5F0E6] sm:text-3xl xl:text-4xl">{nav.find(([id]) => id === active)?.[1]}</h2><p className="mt-2 text-sm text-slate-600 dark:text-[#A7A093]">{state.settings.term} for {state.settings.className} {state.settings.section}</p></div><div className="grid w-full gap-3 sm:flex sm:w-auto sm:flex-wrap"><Button variant="outline" className="w-full rounded-full border-[#C0A062]/18 bg-transparent text-slate-700 dark:text-[#E7DFC9] hover:bg-[#C0A062]/10 hover:text-[#F7EBCB] sm:w-auto" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />CSV Export</Button><Button variant="outline" className="w-full rounded-full border-[#C0A062]/18 bg-transparent text-slate-700 dark:text-[#E7DFC9] hover:bg-[#C0A062]/10 hover:text-[#F7EBCB] sm:w-auto" onClick={notifyParent}><BellRing className="mr-2 h-4 w-4" />Notify Parent</Button>{active === "assignments" ? <Button className="w-full rounded-full bg-[#C0A062] text-slate-100 dark:text-[#16120B] hover:bg-[#D4B370] sm:w-auto" onClick={() => setAddAssignmentOpen(true)}><Plus className="mr-2 h-4 w-4" />Add Assignment</Button> : <Button className="w-full rounded-full bg-[#C0A062] text-slate-100 dark:text-[#16120B] hover:bg-[#D4B370] sm:w-auto" onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" />Add Student</Button>}</div></header>
          {active === "dashboard" ? <DashboardPage summary={summary} trend={trend} attendanceMix={attendanceMix} grades={grades} top={top} onOpenStudent={openStudent} students={state.students} /> : null}
          {active === "students" ? <StudentsPage filtered={filtered} search={search} setSearch={setSearch} risk={risk} setRisk={setRisk} onOpenStudent={openStudent} /> : null}
          {active === "attendance" && selected ? <AttendancePage students={state.students} selected={selected} selectedId={selectedId} onSelect={setSelectedId} onMarkToday={markToday} /> : null}
          {active === "marks" && selected ? <MarksPage students={state.students} selected={selected} selectedId={selectedId} onSelect={setSelectedId} histogram={histogram} subjectCards={subjectCards} /> : null}
          {active === "assignments" ? <AssignmentsPage assignments={state.assignments} data={assignmentsByStudent} onAddAssignment={() => setAddAssignmentOpen(true)} onDeleteAssignment={deleteAssignment} /> : null}
          {active === "predictions" && selected ? <PredictionsPage students={state.students} selected={selected} selectedId={selectedId} onSelect={setSelectedId} /> : null}
          {active === "insights" ? <InsightsPage insights={insights} classHealth={classHealth} scatter={scatter} students={state.students} /> : null}
          {active === "timetable" ? <TimetablePage timetable={state.timetable ?? []} onUpdateSlot={(dayIdx, slotId, status) => setState((c) => ({ ...c, timetable: c.timetable.map((d, i) => i !== dayIdx ? d : { ...d, slots: d.slots.map((s) => s.id !== slotId ? s : { ...s, status, completedTopics: status === "done" ? Math.min(s.totalTopics, s.completedTopics + (s.status !== "done" ? 1 : 0)) : s.completedTopics }) }) }))} subjects={state.settings.subjects ?? SUBJECTS} onUpdateSubjects={(subs) => setState(c => ({...c, settings: {...c.settings, subjects: subs}}))} /> : null}
          {active === "compare" && isElevated ? <ComparePage myClass={state} role={role} schoolName={state.settings.schoolName} /> : null}
          {active === "calculator" ? <CalculatorPage /> : null}
          {active === "settings" ? <SettingsPage settingsDraft={settingsDraft} setSettingsDraft={setSettingsDraft} saveSettings={saveSettings} exportCsv={exportCsv} exportBackup={exportBackup} resetDemo={resetDemo} deleteAccount={deleteAccount} /> : null}
          <DevelopersFooter />
        </main>

      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogContent className="max-w-2xl rounded-[28px] border-[#C0A062]/18 bg-slate-50 dark:bg-[#0E0C0A] text-slate-800 dark:text-[#EDEDED]"><DialogHeader><DialogTitle className="text-2xl text-slate-900 dark:text-[#F5E8C8]">Add Student</DialogTitle><DialogDescription className="text-[#A79B84]">Create a new profile with enough data to place the student into every analytics view.</DialogDescription></DialogHeader><div className="grid gap-4 md:grid-cols-2">{(["name", "guardianName", "phone", "email", "marksAverage", "attendanceRate", "assignmentCompletion", "participation"] as const).map((field) => <Field key={field} label={field} error={errors[field]}><Input type={field.includes("Rate") || field.includes("Average") || field === "participation" || field === "assignmentCompletion" ? "number" : "text"} value={form[field]} onChange={(e) => setForm((c) => ({ ...c, [field]: e.target.value }))} className="h-11 rounded-2xl border-[#2A241A] bg-white dark:bg-[#121212] text-slate-800 dark:text-[#EDEDED] placeholder:text-[#5F584C] focus-visible:ring-[#C0A062]/35" /></Field>)}</div><DialogFooter><Button variant="outline" className="rounded-full border-[#C0A062]/18 bg-transparent text-slate-700 dark:text-[#E7DFC9] hover:bg-[#C0A062]/10" onClick={() => setAddOpen(false)}>Cancel</Button><Button className="rounded-full bg-[#C0A062] text-slate-100 dark:text-[#16120B] hover:bg-[#D4B370]" onClick={addStudent}><Plus className="mr-2 h-4 w-4" />Add Student</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={addAssignmentOpen} onOpenChange={setAddAssignmentOpen}><DialogContent className="max-w-2xl rounded-[28px] border-[#C0A062]/18 bg-slate-50 dark:bg-[#0E0C0A] text-slate-800 dark:text-[#EDEDED]"><DialogHeader><DialogTitle className="text-2xl text-slate-900 dark:text-[#F5E8C8]">Add Assignment</DialogTitle><DialogDescription className="text-[#A79B84]">Create a new assignment and track class submission progress.</DialogDescription></DialogHeader><div className="grid gap-4 md:grid-cols-2"><Field label="title" error={assignmentErrors.title}><Input value={assignmentForm.title} onChange={(e) => setAssignmentForm((c) => ({ ...c, title: e.target.value }))} className="h-11 rounded-2xl border-[#2A241A] bg-white dark:bg-[#121212] text-slate-800 dark:text-[#EDEDED] placeholder:text-[#5F584C] focus-visible:ring-[#C0A062]/35" /></Field><Field label="subject"><select value={assignmentForm.subject} onChange={(e) => setAssignmentForm((c) => ({ ...c, subject: e.target.value as Subject }))} className="h-11 w-full rounded-2xl border border-[#2A241A] bg-white dark:bg-[#121212] px-4 text-slate-800 dark:text-[#EDEDED] outline-none focus:border-[#C0A062]/60">{SUBJECTS.map((subject) => <option key={subject} value={subject} className="bg-white dark:bg-[#121212]">{subject}</option>)}</select></Field><Field label="dueDate" error={assignmentErrors.dueDate}><Input type="date" value={assignmentForm.dueDate} onChange={(e) => setAssignmentForm((c) => ({ ...c, dueDate: e.target.value }))} className="h-11 rounded-2xl border-[#2A241A] bg-white dark:bg-[#121212] text-slate-800 dark:text-[#EDEDED] focus-visible:ring-[#C0A062]/35" /></Field><Field label="submitted" error={assignmentErrors.submitted}><Input type="number" value={assignmentForm.submitted} onChange={(e) => setAssignmentForm((c) => ({ ...c, submitted: e.target.value }))} className="h-11 rounded-2xl border-[#2A241A] bg-white dark:bg-[#121212] text-slate-800 dark:text-[#EDEDED] focus-visible:ring-[#C0A062]/35" /></Field><Field label="onTime" error={assignmentErrors.onTime}><Input type="number" value={assignmentForm.onTime} onChange={(e) => setAssignmentForm((c) => ({ ...c, onTime: e.target.value }))} className="h-11 rounded-2xl border-[#2A241A] bg-white dark:bg-[#121212] text-slate-800 dark:text-[#EDEDED] focus-visible:ring-[#C0A062]/35" /></Field><Field label="late" error={assignmentErrors.late}><Input type="number" value={assignmentForm.late} onChange={(e) => setAssignmentForm((c) => ({ ...c, late: e.target.value }))} className="h-11 rounded-2xl border-[#2A241A] bg-white dark:bg-[#121212] text-slate-800 dark:text-[#EDEDED] focus-visible:ring-[#C0A062]/35" /></Field></div><DialogFooter><Button variant="outline" className="rounded-full border-[#C0A062]/18 bg-transparent text-slate-700 dark:text-[#E7DFC9] hover:bg-[#C0A062]/10" onClick={() => setAddAssignmentOpen(false)}>Cancel</Button><Button className="rounded-full bg-[#C0A062] text-slate-100 dark:text-[#16120B] hover:bg-[#D4B370]" onClick={addAssignment}><Plus className="mr-2 h-4 w-4" />Add Assignment</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}><DialogContent className="max-w-4xl rounded-[28px] border-white/10 bg-slate-950 text-slate-100">{selected ? <><DialogHeader><DialogTitle className="text-2xl">{selected.name}</DialogTitle><DialogDescription>Roll {selected.rollNo} � {selected.guardianName} � {selected.phone}</DialogDescription></DialogHeader><div className="grid gap-4 md:grid-cols-4"><MiniCard label="Overall" value={`${getOverallScore(selected)}%`} /><MiniCard label="Attendance" value={`${selected.attendanceRate}%`} /><MiniCard label="Grade" value={selected.predictedGrade} /><MiniCard label="Confidence" value={`${selected.confidence}%`} /></div><div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]"><Panel title="Exam Scores" subtitle="Latest marks across assessments"><div className="space-y-4">{EXAMS.map((exam) => <div key={exam}><p className="mb-2 text-sm uppercase tracking-[0.18em] text-slate-500">{exam}</p><div className="grid grid-cols-2 gap-2 md:grid-cols-5">{SUBJECTS.map((subject) => <div key={subject} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3"><p className="text-xs text-slate-500">{shortSubject(subject)}</p><p className="mt-2 text-lg font-semibold text-white">{selected.examScores[exam][subject]}</p></div>)}</div></div>)}</div></Panel><Panel title="Student Snapshot" subtitle="Quick action card for parent outreach and reports"><div className="space-y-4"><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="font-medium text-white">Trend</p><p className={cn("mt-2 text-2xl font-semibold", trendTone[selected.trend])}>{selected.trend}</p><p className="mt-2 text-sm text-slate-400">Assignment completion is at {selected.assignmentCompletion}% with {selected.participation}% classroom participation.</p></div><div className="grid gap-3 md:grid-cols-2"><Button className="rounded-full bg-sky-500 text-slate-950 hover:bg-sky-400" onClick={notifyParent}><BellRing className="mr-2 h-4 w-4" />Notify Parent</Button><Button variant="outline" className="rounded-full border-white/10 bg-transparent text-slate-200 hover:bg-white/10" onClick={generateReport}><Download className="mr-2 h-4 w-4" />Generate Report</Button><Button variant="outline" className="rounded-full border-rose-400/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20 col-span-2 md:col-span-2" onClick={deleteStudent}><Trash2 className="mr-2 h-4 w-4" />Delete Student</Button></div></div></Panel></div></> : null}</DialogContent></Dialog>
    </div>
  );
}

function DashboardPage({ summary, trend, attendanceMix, grades, top, onOpenStudent, students }: { summary: { students: number; marks: number; attendance: number; risk: number }; trend: Array<{ month: string; avg: number }>; attendanceMix: Array<{ name: string; value: number; color: string }>; grades: Array<{ grade: string; students: number }>; top: Student[]; onOpenStudent: (student: Student) => void; students: Student[] }) {
  return <div className="space-y-6"><Hero /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Students" value={summary.students} hint="Active roster" tone="neutral" /><Metric label="Avg Marks" value={`${summary.marks}%`} hint="Across all subjects" tone={summary.marks >= 70 ? "green" : "red"} /><Metric label="Attendance" value={`${summary.attendance}%`} hint="This month" tone={summary.attendance >= 75 ? "green" : "red"} /><Metric label="At Risk" value={summary.risk} hint="Immediate follow-up" tone={summary.risk === 0 ? "green" : "red"} /></div><div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]"><Panel title="Performance Trend" subtitle="Average class score across six checkpoints"><Chart><LineChart data={trend}><CartesianGrid stroke="#1f3346" strokeDasharray="4 4" /><XAxis dataKey="month" stroke="#7f96ad" /><YAxis domain={[40, 100]} stroke="#7f96ad" /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="avg" stroke="#38bdf8" strokeWidth={3} dot={{ fill: "#f59e0b", r: 4 }} isAnimationActive animationDuration={1400} animationEasing="ease-out" /></LineChart></Chart></Panel><Panel title="Attendance Mix" subtitle="Present, absent, and leave"><Chart><PieChart><Pie data={attendanceMix} innerRadius={58} outerRadius={92} paddingAngle={4} dataKey="value" isAnimationActive animationBegin={100} animationDuration={1200} animationEasing="ease-out">{attendanceMix.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></Chart></Panel></div><div className="grid gap-6 xl:grid-cols-[1.2fr_1fr_1fr]"><Panel title="Grade Distribution" subtitle="Overall grade bands"><Chart><BarChart data={grades}><CartesianGrid stroke="#1f3346" vertical={false} /><XAxis dataKey="grade" stroke="#7f96ad" /><YAxis allowDecimals={false} stroke="#7f96ad" /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="students" fill="#34d399" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={1000} animationEasing="ease-out" /></BarChart></Chart></Panel><Panel title="Top 5 Leaderboard" subtitle="Best overall performers"><div className="space-y-3">{top.map((student, i) => <button key={student.id} onClick={() => onOpenStudent(student)} className="flex w-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-400/15 text-sm font-semibold text-sky-200">{i + 1}</div><div><p className="font-medium text-slate-100">{student.name}</p><p className="text-xs text-slate-400">{student.predictedGrade} projected</p></div></div><p className="font-semibold text-emerald-300">{getOverallScore(student)}%</p></button>)}</div></Panel><Panel title="At-Risk Alerts" subtitle="Students under the configured threshold"><div className="space-y-3">{students.filter((student) => student.riskLevel === "High").map((student) => <div key={student.id} className="rounded-2xl border border-rose-400/15 bg-rose-400/8 p-4"><div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="font-medium text-slate-100">{student.name}</p><Badge className={cn("border", riskTone[student.riskLevel])}>{student.riskLevel}</Badge></div><p className="text-sm text-slate-300">{student.attendanceRate}% attendance, {student.marksAverage}% marks.</p></div>)}</div></Panel></div><SmartAlertsPanel students={students} /></div>;
}

function StudentsPage({ filtered, search, setSearch, risk, setRisk, onOpenStudent }: { filtered: Student[]; search: string; setSearch: (value: string) => void; risk: RiskFilter; setRisk: (value: RiskFilter) => void; onOpenStudent: (student: Student) => void }) {
  return <div className="space-y-6"><Section eyebrow="Roster" title="Students" description="Search, filter, and open any learner for a quick intervention summary." /><div className="grid gap-4 lg:grid-cols-[1fr_auto]"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or roll number" className="h-12 rounded-2xl border-[#2A241A] bg-white dark:bg-[#121212] text-slate-800 dark:text-[#EDEDED] placeholder:text-[#5F584C] focus-visible:ring-[#C0A062]/35" /><div className="flex flex-wrap gap-2">{(["All", "Low", "Medium", "High"] as const).map((r) => <Button key={r} variant="outline" className={cn("rounded-full border-[#C0A062]/12 bg-transparent text-slate-700 dark:text-[#C9C1B0] hover:bg-white/[0.06] hover:text-slate-900 dark:text-[#F5E8C8]", risk === r && "border-[#C0A062]/40 bg-[#C0A062]/12 text-[#F4E6C4]")} onClick={() => setRisk(r)}>{r}</Button>)}</div></div><Panel title="Student Directory" subtitle={`${filtered.length} visible students`}><div className="overflow-x-auto rounded-3xl border border-[#C0A062]/12"><div className="min-w-[760px]"><div className="grid grid-cols-[100px_1.5fr_1fr_1fr_1fr_0.9fr] bg-white/[0.03] px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-[#8F856F]"><span>Roll</span><span>Name</span><span>Overall</span><span>Attendance</span><span>Prediction</span><span>Risk</span></div><div className="divide-y divide-[#C0A062]/10">{filtered.map((student) => <button key={student.id} className="grid w-full grid-cols-[100px_1.5fr_1fr_1fr_1fr_0.9fr] items-center gap-3 bg-[rgba(255,255,255,0.015)] px-4 py-4 text-left hover:bg-white/[0.04]" onClick={() => onOpenStudent(student)}><span className="text-sm text-slate-700 dark:text-[#C9C1B0]">{student.rollNo}</span><div><p className="font-medium text-slate-900 dark:text-[#F5F0E6]">{student.name}</p><p className="text-xs text-slate-600 dark:text-[#A7A093]">{student.guardianName}</p></div><div><p className="mb-2 text-sm font-medium text-slate-900 dark:text-[#F5F0E6]">{getOverallScore(student)}%</p><Progress value={getOverallScore(student)} className="h-2 bg-white/10" /></div><div><p className="mb-2 text-sm font-medium text-slate-900 dark:text-[#F5F0E6]">{student.attendanceRate}%</p><Progress value={student.attendanceRate} className="h-2 bg-white/10" /></div><div className="space-y-2"><Badge className="border border-[#C0A062]/20 bg-[#C0A062]/10 text-[#E7D19A]">{student.predictedGrade}</Badge><p className={cn("text-sm font-medium", trendTone[student.trend])}>{student.trend}</p></div><Badge className={cn("justify-center border", riskTone[student.riskLevel])}>{student.riskLevel}</Badge></button>)}</div></div></div></Panel></div>;
}

function AttendancePage({ students, selected, selectedId, onSelect, onMarkToday }: { students: Student[]; selected: Student; selectedId: string; onSelect: (id: string) => void; onMarkToday: () => void }) { return <div className="space-y-6"><Section eyebrow="Tracking" title="Attendance" description="Follow monthly presence patterns, compare subject attendance, and mark today instantly." action={<Button className="w-full rounded-full bg-emerald-400 text-slate-950 hover:bg-emerald-300 sm:w-auto" onClick={onMarkToday}><CalendarDays className="mr-2 h-4 w-4" />Mark Today</Button>} /><StudentTabs students={students} selectedId={selectedId} onSelect={onSelect} /><div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]"><Panel title={`${selected.name}'s Monthly Calendar`} subtitle="Present, absent, and leave timeline"><div className="overflow-x-auto"><div className="grid min-w-[560px] grid-cols-7 gap-2">{selected.attendanceMonth.map((entry) => <div key={entry.day} className={cn("rounded-2xl border px-3 py-3 text-center text-sm font-medium", attendanceClass(entry.status))}><p>{entry.day}</p><p className="mt-1 text-[11px] uppercase tracking-[0.18em]">{entry.status}</p></div>)}</div></div></Panel><Panel title="Subject-Wise Attendance" subtitle={`${selected.name}'s present rate per subject`}><Chart><BarChart data={SUBJECTS.map((subject) => ({ subject: shortSubject(subject), attendance: selected.subjectAttendance[subject] }))}><CartesianGrid stroke="#1f3346" vertical={false} /><XAxis dataKey="subject" stroke="#7f96ad" /><YAxis domain={[50, 100]} stroke="#7f96ad" /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="attendance" fill="#22c55e" radius={[8, 8, 0, 0]} /></BarChart></Chart></Panel></div><Panel title="Attendance Ranking" subtitle="Class-wide attendance comparison"><Chart className="h-[340px]"><BarChart layout="vertical" data={[...students].sort((a, b) => b.attendanceRate - a.attendanceRate).map((s) => ({ name: s.name, attendance: s.attendanceRate }))}><CartesianGrid stroke="#1f3346" horizontal={false} /><XAxis type="number" domain={[50, 100]} stroke="#7f96ad" /><YAxis type="category" dataKey="name" width={120} stroke="#7f96ad" /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="attendance" fill="#38bdf8" radius={[0, 8, 8, 0]} /></BarChart></Chart></Panel></div>; }

function MarksPage({ students, selected, selectedId, onSelect, histogram, subjectCards }: { students: Student[]; selected: Student; selectedId: string; onSelect: (id: string) => void; histogram: Array<{ range: string; count: number }>; subjectCards: Array<{ subject: string; avgScore: number; avgAttendance: number }> }) { return <div className="space-y-6"><Section eyebrow="Assessment" title="Marks & Exams" description="Review subject strength, exam trends, and distribution across the class." /><StudentTabs students={students} selectedId={selectedId} onSelect={onSelect} /><div className="grid gap-6 xl:grid-cols-[1fr_1fr]"><Panel title="Subject Comparison Radar" subtitle={`${selected.name}'s subject profile`}><Chart><RadarChart data={SUBJECTS.map((subject) => ({ subject: shortSubject(subject), score: selected.subjectScores[subject] }))}><PolarGrid stroke="#28455f" /><PolarAngleAxis dataKey="subject" tick={{ fill: "#cbd5e1", fontSize: 12 }} /><PolarRadiusAxis domain={[40, 100]} tick={{ fill: "#7f96ad", fontSize: 11 }} /><Radar dataKey="score" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.3} strokeWidth={2} /></RadarChart></Chart></Panel><Panel title="Score Distribution" subtitle="Where current class marks sit"><Chart><BarChart data={histogram}><CartesianGrid stroke="#1f3346" vertical={false} /><XAxis dataKey="range" stroke="#7f96ad" /><YAxis allowDecimals={false} stroke="#7f96ad" /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="count" fill="#f59e0b" radius={[8, 8, 0, 0]} /></BarChart></Chart></Panel></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{subjectCards.map((card) => <Card key={card.subject} className="rounded-[28px] border-white/10 bg-slate-950/70 p-5"><p className="text-sm uppercase tracking-[0.2em] text-slate-500">{shortSubject(card.subject)}</p><p className="mt-4 text-3xl font-semibold text-white">{card.avgScore}%</p><p className="mt-2 text-sm text-slate-400">{card.avgAttendance}% avg attendance</p></Card>)}</div><Panel title="Exam Results" subtitle="Unit test and half-yearly breakdown"><Tabs defaultValue={EXAMS[0]}><TabsList className="h-auto w-full justify-start overflow-x-auto rounded-full bg-white/5 p-1">{EXAMS.map((exam) => <TabsTrigger key={exam} value={exam} className="rounded-full data-[state=active]:bg-sky-500 data-[state=active]:text-slate-950">{exam}</TabsTrigger>)}</TabsList>{EXAMS.map((exam) => <TabsContent key={exam} value={exam}><div className="mt-4 overflow-x-auto rounded-3xl border border-white/10"><div className="min-w-[720px]"><div className="grid grid-cols-[1.5fr_repeat(5,1fr)] bg-white/5 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-400"><span>Student</span>{SUBJECTS.map((subject) => <span key={subject}>{shortSubject(subject)}</span>)}</div><div className="divide-y divide-white/10">{students.map((student) => <div key={`${student.id}-${exam}`} className="grid grid-cols-[1.5fr_repeat(5,1fr)] px-4 py-3 text-sm text-slate-200"><span>{student.name}</span>{SUBJECTS.map((subject) => <span key={subject}>{student.examScores[exam as ExamName][subject]}</span>)}</div>)}</div></div></div></TabsContent>)}</Tabs></Panel></div>; }
function AssignmentsPage({ assignments, data, onAddAssignment, onDeleteAssignment }: { assignments: DataVistaState["assignments"]; data: Array<{ name: string; onTime: number; late: number; pending: number }>; onAddAssignment: () => void; onDeleteAssignment: (assignmentId: string) => void }) { return <div className="space-y-6"><Section eyebrow="Coursework" title="Assignments" description="Track submission health across the class and identify students slipping on deadlines." action={<Button className="rounded-full bg-[#C0A062] text-slate-100 dark:text-[#16120B] hover:bg-[#D4B370]" onClick={onAddAssignment}><Plus className="mr-2 h-4 w-4" />Add Assignment</Button>} /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{assignments.map((assignment) => { const completion = Math.round((assignment.submitted / assignment.totalStudents) * 100); return <Card key={assignment.id} className="rounded-[28px] border-[#C0A062]/12 bg-white/[0.03] p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-sm uppercase tracking-[0.2em] text-slate-500 dark:text-[#8F856F]">{shortSubject(assignment.subject)}</p><h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-[#F5F0E6]">{assignment.title}</h3></div><div className="flex items-start gap-2"><Badge className="border border-[#C0A062]/20 bg-[#C0A062]/10 text-[#E7D19A]">{completion}%</Badge><Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-rose-300 hover:bg-rose-400/10 hover:text-rose-200" onClick={() => onDeleteAssignment(assignment.id)} aria-label={`Delete ${assignment.title}`}><Trash2 className="h-4 w-4" /></Button></div></div><p className="mt-3 text-sm text-slate-600 dark:text-[#A7A093]">Due {assignment.dueDate}</p><div className="mt-4 space-y-2"><Progress value={completion} className="h-2 bg-white/10" /><div className="flex justify-between text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-[#8F856F]"><span>{assignment.submitted} submitted</span><span>{assignment.totalStudents - assignment.submitted} pending</span></div></div></Card>; })}</div><Panel title="Submission Mix by Student" subtitle="On-time, late, and pending assignment counts"><Chart className="h-[360px]"><BarChart data={data}><CartesianGrid stroke="#2B2418" vertical={false} /><XAxis dataKey="name" stroke="#9D8F72" /><YAxis allowDecimals={false} stroke="#9D8F72" /><Tooltip contentStyle={tooltipStyle} /><Legend /><Bar dataKey="onTime" stackId="a" fill="#C0A062" /><Bar dataKey="late" stackId="a" fill="#8E6E2C" /><Bar dataKey="pending" stackId="a" fill="#6A3B33" /></BarChart></Chart></Panel></div>; }

function PredictionsPage({ students, selected, selectedId, onSelect }: { students: Student[]; selected: Student; selectedId: string; onSelect: (id: string) => void }) {
  const highRiskCount = students.filter((student) => student.riskLevel === "High").length;
  const useAiPredictions = () => {
    toast.success(`AI predictions applied for ${students.length} students. ${highRiskCount} intervention alerts found.`);
  };

  return <div className="space-y-6"><Section eyebrow="Forecasting" title="Predictions" description="Surface grade forecasts, momentum direction, and confidence for intervention planning." action={<Button className="rounded-full bg-[#C0A062] text-slate-100 dark:text-[#16120B] hover:bg-[#D4B370]" onClick={useAiPredictions}><BrainCircuit className="mr-2 h-4 w-4" />Use AI Predictions</Button>} /><div className="grid gap-6 xl:grid-cols-[0.82fr_1.38fr]"><Panel title="AI Forecast Table" subtitle="Predicted final outcome for each student"><div className="mb-4 rounded-2xl border border-[#C0A062]/16 bg-[#C0A062]/8 px-4 py-3 text-sm text-[#E7D19A]"><span className="font-semibold">AI ready:</span> review grades, confidence, and trends, then use the button above to apply intervention planning.</div><div className="space-y-3">{students.map((student) => <div key={student.id} className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 sm:grid-cols-[1.4fr_0.7fr_0.8fr_1fr] sm:items-center"><div><p className="font-medium text-white">{student.name}</p><p className="text-xs text-slate-400">Overall {getOverallScore(student)}%</p></div><Badge className="w-fit border border-sky-400/20 bg-sky-400/10 text-sky-200">{student.predictedGrade}</Badge><div className={cn("text-sm font-medium", trendTone[student.trend])}>{student.trend}</div><div><div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-slate-500"><span>Confidence</span><span>{student.confidence}%</span></div><Progress value={student.confidence} className="h-2 bg-white/10" /></div></div>)}</div></Panel><Panel title="3D Robot Model" subtitle="Interactive AI assistant preview"><div className="grid gap-5 2xl:grid-cols-[minmax(520px,1.55fr)_minmax(220px,0.45fr)]"><RobotModelViewer modelPath="/robot.glb" /><PredictionFormulaCard /></div><Button className="mt-4 w-full rounded-full bg-sky-400 text-slate-950 hover:bg-sky-300" onClick={useAiPredictions}><BrainCircuit className="mr-2 h-4 w-4" />Run AI Forecast</Button></Panel></div><StudentTabs students={students} selectedId={selectedId} onSelect={onSelect} /><Panel title="Trajectory Line" subtitle={`${selected.name}'s recent score movement`}><Chart><LineChart data={selected.trajectory}><CartesianGrid stroke="#1f3346" strokeDasharray="4 4" /><XAxis dataKey="month" stroke="#7f96ad" /><YAxis domain={[40, 100]} stroke="#7f96ad" /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="score" stroke="#a78bfa" strokeWidth={3} dot={{ fill: "#38bdf8", r: 4 }} /></LineChart></Chart></Panel></div>;
}

function InsightsPage({ insights, classHealth, scatter, students }: { insights: Array<{ id: string; tone: string; title: string; detail: string }>; classHealth: number; scatter: Array<{ x: number; y: number; name: string }>; students: Student[] }) {
  // ── Derived AI analytics ──────────────────────────────────────────
  // Top 3 weakest students by overall score
  const weakStudents = [...students].sort((a, b) => getOverallScore(a) - getOverallScore(b)).slice(0, 3).map((s) => {
    const weakSub = SUBJECTS.reduce((min, sub) => s.subjectScores[sub] < s.subjectScores[min] ? sub : min, SUBJECTS[0]);
    return { student: s, weakSubject: weakSub, subScore: s.subjectScores[weakSub], overall: getOverallScore(s) };
  });

  // Most difficult subject (lowest class average)
  const subjectAvgs = SUBJECTS.map((sub) => ({
    subject: sub,
    avg: students.length ? Math.round(students.reduce((sum, s) => sum + s.subjectScores[sub], 0) / students.length) : 0,
  })).sort((a, b) => a.avg - b.avg);
  const hardest = subjectAvgs[0];

  // Class trajectory drop: avg of (t[-2] - t[-1]) across all students
  const drops = students.map((s) => { const t = s.trajectory; return t.length >= 2 ? t[t.length - 2].score - t[t.length - 1].score : 0; });
  const avgDrop = Math.round(drops.reduce((a, b) => a + b, 0) / Math.max(drops.length, 1));
  const fallingCount = students.filter((s) => s.trend === "Falling").length;

  // AI Suggestions
  type Sug = { id: string; icon: string; severity: "high" | "medium" | "low"; title: string; body: string };
  const suggestions: Sug[] = [];
  if (avgDrop >= 5) suggestions.push({ id: "drop", icon: "📉", severity: "high", title: "Class performance dip detected", body: `Class performance dropped by ${avgDrop}% in the last 2 checkpoints — schedule a revision session covering ${hardest.subject} (class avg ${hardest.avg}%) and reinforce Unit fundamentals.` });
  if (hardest.avg < 70) suggestions.push({ id: "subject", icon: "📚", severity: "high", title: `Revise ${hardest.subject} across the class`, body: `${hardest.subject} is the hardest subject with a class average of only ${hardest.avg}%. Consider extra problem sets, peer study groups, or a dedicated revision week.` });
  if (fallingCount >= 2) suggestions.push({ id: "falling", icon: "⚠️", severity: "medium", title: `${fallingCount} students on a falling trajectory`, body: `${students.filter((s) => s.trend === "Falling").slice(0, 3).map((s) => s.name.split(" ")[0]).join(", ")} are declining this term. Schedule one-on-one check-ins and targeted practice.` });
  weakStudents.forEach(({ student, weakSubject, subScore, overall }) => {
    suggestions.push({ id: `weak-${student.id}`, icon: "👤", severity: overall < 60 ? "high" : "medium", title: `${student.name.split(" ")[0]} needs focused coaching`, body: `Overall score ${overall}% — weakest in ${weakSubject} (${subScore}%). Recommend extra classes, past paper practice, and parent communication.` });
  });
  if (suggestions.length === 0) suggestions.push({ id: "ok", icon: "✅", severity: "low", title: "Class is on track", body: "No critical intervention required at this time. Keep monitoring trajectory and assignment completion rates weekly." });

  const sevColor = (sev: string) => sev === "high" ? "border-rose-400/22 bg-rose-400/[0.07] text-rose-200" : sev === "medium" ? "border-amber-400/22 bg-amber-400/[0.07] text-amber-200" : "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-200";
  const sevBadge = (sev: string) => sev === "high" ? "bg-rose-400/15 text-rose-300" : sev === "medium" ? "bg-amber-400/15 text-amber-300" : "bg-emerald-400/15 text-emerald-300";

  return (
    <div className="space-y-6">
      <Section eyebrow="Intelligence" title="AI Insights" description="Automated flags across class health, intervention candidates, and performance clusters." />

      {/* Row 1: Flagged insights + Health */}
      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Panel title="Flagged Insights" subtitle="Machine-guided reading of the current class state">
          <div className="space-y-3">{insights.map((insight) => <div key={insight.id} className={cn("rounded-2xl border p-4", insight.tone === "rose" && "border-rose-400/15 bg-rose-400/8", insight.tone === "amber" && "border-amber-400/15 bg-amber-400/8", insight.tone === "emerald" && "border-emerald-400/15 bg-emerald-400/8")}><p className="font-medium text-white">{insight.title}</p><p className="mt-1 text-sm text-slate-300">{insight.detail}</p></div>)}</div>
        </Panel>
        <Panel title="Class Health Score" subtitle="Composite performance pulse">
          <Chart><PieChart><Pie data={[{ name: "Healthy", value: classHealth, color: "#34d399" }, { name: "Gap", value: 100 - classHealth, color: "#223548" }]} innerRadius={64} outerRadius={94} dataKey="value" startAngle={90} endAngle={-270}>{[{ name: "Healthy", value: classHealth, color: "#34d399" }, { name: "Gap", value: 100 - classHealth, color: "#223548" }].map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></Chart>
          <div className="-mt-8 text-center"><p className="text-5xl font-semibold text-white">{classHealth}</p><p className="text-sm uppercase tracking-[0.22em] text-slate-500">out of 100</p></div>
        </Panel>
      </div>

      {/* Row 2: Scatter */}
      <Panel title="Attendance vs Marks" subtitle="Students clustered by reliability and academic output">
        <Chart className="h-[360px]"><ScatterChart><CartesianGrid stroke="#1f3346" /><XAxis type="number" dataKey="x" name="Attendance" unit="%" stroke="#7f96ad" /><YAxis type="number" dataKey="y" name="Marks" unit="%" stroke="#7f96ad" /><Tooltip contentStyle={tooltipStyle} formatter={(value) => `${value}%`} cursor={{ strokeDasharray: "4 4" }} /><Scatter data={scatter} fill="#38bdf8" /></ScatterChart></Chart>
      </Panel>

      {/* Row 3: Weak students + Hardest subject */}
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel title="🎯 Top 3 Weak Students" subtitle="Bottom performers by overall score — ranked lowest first">
          <div className="space-y-3">
            {weakStudents.map(({ student, weakSubject, subScore, overall }, i) => (
              <div key={student.id} className="flex items-center gap-4 rounded-2xl border border-rose-400/14 bg-rose-400/[0.06] px-4 py-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-rose-400/12 text-base font-bold text-rose-300">#{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900 dark:text-[#F5F0E6]">{student.name}</p>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", overall < 60 ? "bg-rose-400/18 text-rose-300" : "bg-amber-400/15 text-amber-300")}>{overall}%</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-rose-400 transition-all" style={{ width: `${overall}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-slate-600 dark:text-[#A7A093]">Weakest in <span className="font-medium text-[#E7D19A]">{weakSubject}</span> — <span className="font-mono text-rose-300">{subScore}%</span></p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="📊 Most Difficult Subject" subtitle="Subject with the lowest class average score">
          <div className="mb-4 flex items-center gap-4 rounded-2xl border border-[#C0A062]/20 bg-[#C0A062]/8 px-4 py-4">
            <div className="text-3xl">🏆</div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-[#8F856F]">Hardest for class</p>
              <p className="mt-1 text-2xl font-bold text-rose-300">{hardest.subject}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-[#A7A093]">Class average: <span className="font-mono font-semibold text-rose-300">{hardest.avg}%</span></p>
            </div>
          </div>
          <div className="space-y-2">
            {subjectAvgs.map(({ subject, avg: sAvg }) => (
              <div key={subject} className="flex items-center gap-3">
                <p className="w-20 flex-shrink-0 text-xs text-slate-600 dark:text-[#A7A093] truncate">{shortSubject(subject)}</p>
                <div className="relative flex-1 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className={cn("absolute inset-y-0 left-0 rounded-full transition-all", sAvg < 65 ? "bg-rose-400" : sAvg < 75 ? "bg-amber-400" : "bg-emerald-400")} style={{ width: `${sAvg}%` }} />
                </div>
                <span className={cn("w-10 text-right text-xs font-mono font-semibold", sAvg < 65 ? "text-rose-300" : sAvg < 75 ? "text-amber-300" : "text-emerald-300")}>{sAvg}%</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Row 4: AI Improvement Suggestions */}
      <Card className="min-w-0 rounded-[22px] border-[#C0A062]/12 bg-white/[0.03] p-4 sm:rounded-[30px] sm:p-5 xl:p-6">
        <div className="mb-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-[#8F856F]">Generative Analysis</p>
          <h4 className="mt-1 text-xl font-semibold text-slate-900 dark:text-[#F5F0E6] sm:text-2xl">🤖 AI Improvement Suggestions</h4>
          <p className="mt-1 text-sm text-slate-600 dark:text-[#A7A093]">Rule-based recommendations derived from trajectory, subject scores, and risk signals.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {suggestions.map((s) => (
            <div key={s.id} className={cn("rounded-2xl border p-4", sevColor(s.severity))}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none">{s.icon}</span>
                  <p className="text-sm font-semibold leading-snug">{s.title}</p>
                </div>
                <span className={cn("flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]", sevBadge(s.severity))}>{s.severity}</span>
              </div>
              <p className="text-sm leading-5 opacity-85">{s.body}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Subject colour map ────────────────────────────────────────────────────
const subjectColors: Record<string, string> = {
  Mathematics: "#38bdf8",
  Science: "#34d399",
  English: "#a78bfa",
  "Social Studies": "#f59e0b",
  Computer: "#f472b6",
};

function TimetablePage({
  timetable,
  onUpdateSlot,
  subjects,
  onUpdateSubjects,
}: {
  timetable: TimetableDay[];
  onUpdateSlot: (dayIdx: number, slotId: string, status: LectureStatus) => void;
  subjects: string[];
  onUpdateSubjects: (subs: string[]) => void;
}) {
  const todayName = (["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()] ?? "Mon") as TimetableDay["day"];
  const validDays = timetable.map((d) => d.day);
  const defaultDay: TimetableDay["day"] = validDays.includes(todayName) ? todayName : (validDays[0] ?? "Mon");
  const [activeDay, setActiveDay] = useState<TimetableDay["day"]>(defaultDay);

  const dayIdx = timetable.findIndex((d) => d.day === activeDay);
  const dayData = timetable[dayIdx];

  // Syllabus coverage per subject across ALL days
  const coverage = subjects.map((sub) => {
    const allSlots = timetable.flatMap((d) => d.slots).filter((s) => s.subject === sub);
    const done = allSlots.filter((s) => s.status === "done").length;
    const total = allSlots.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { subject: sub, done, total, pct };
  });

  const [newSubject, setNewSubject] = useState("");

  const addSubject = () => {
    if (newSubject.trim() !== "" && !subjects.includes(newSubject.trim())) {
      onUpdateSubjects([...subjects, newSubject.trim()]);
      setNewSubject("");
    }
  };

  const deleteSubject = (subject: string) => {
    onUpdateSubjects(subjects.filter((s) => s !== subject));
  };

  const overallDone = timetable.flatMap((d) => d.slots).filter((s) => s.status === "done").length;
  const overallTotal = timetable.flatMap((d) => d.slots).length;
  const overallPct = overallTotal ? Math.round((overallDone / overallTotal) * 100) : 0;

  function cycleStatus(current: LectureStatus): LectureStatus {
    return current === "pending" ? "done" : current === "done" ? "skipped" : "pending";
  }

  const statusStyle: Record<LectureStatus, string> = {
    done: "border-emerald-400/30 bg-emerald-400/[0.08]",
    pending: "border-[#C0A062]/18 bg-white/[0.03]",
    skipped: "border-rose-400/20 bg-rose-400/[0.06]",
  };
  const statusBadge: Record<LectureStatus, string> = {
    done: "bg-emerald-400/15 text-emerald-300",
    pending: "bg-[#C0A062]/12 text-[#C9B07A]",
    skipped: "bg-rose-400/12 text-rose-300",
  };
  const statusLabel: Record<LectureStatus, string> = { done: "✅ Done", pending: "🕐 Pending", skipped: "⏭ Skipped" };

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-[#C0A062]/18 bg-[#0E0C0A] p-4 sm:p-5 xl:p-6">
        <h2 className="mb-3 text-xl font-semibold text-slate-900 dark:text-[#F5E8C8]">Manage Subjects</h2>
        <div className="mb-4 flex gap-2">
          <Input
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            placeholder="Enter subject"
            className="h-11 rounded-2xl border-[#C0A062]/20 bg-white/5 text-slate-900 dark:text-[#EDEDED]"
            onKeyDown={(e) => e.key === 'Enter' && addSubject()}
          />
          <Button onClick={addSubject} className="h-11 rounded-2xl bg-[#C0A062] text-slate-100 dark:text-[#16120B] hover:bg-[#D4B370]">
            Add
          </Button>
        </div>
        <div className="space-y-2">
          {subjects.map((sub, index) => (
            <div key={index} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 text-sm">
              <span className="font-medium text-slate-800 dark:text-[#E7DFC9]">{sub}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteSubject(sub)}
                className="h-8 text-rose-400 hover:bg-rose-400/10 hover:text-rose-300"
              >
                Delete ❌
              </Button>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs font-medium leading-5 text-[#C0A062]">
          ⚡ Subjects can be modified anytime by the teacher. Changes reflect instantly in timetable and tracking.
        </p>
      </div>

      <Section eyebrow="Schedule" title="Timetable & Tracking" description="View daily lectures, mark completion, and track syllabus coverage per subject." />

      {/* Coverage Summary Strip */}
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <div className="sm:col-span-3 xl:col-span-1 flex flex-col justify-center rounded-[22px] border border-[#C0A062]/14 bg-[#C0A062]/8 p-4 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-[#8F856F]">Overall</p>
          <p className="mt-2 text-4xl font-bold text-slate-900 dark:text-[#F5E8C8]">{overallPct}%</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-[#A7A093]">{overallDone}/{overallTotal} lectures</p>
        </div>
        {coverage.map(({ subject, pct, done, total }) => (
          <div key={subject} className="rounded-[22px] border border-[#C0A062]/12 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-[#8F856F] truncate">{shortSubject(subject)}</p>
            <p className="mt-2 text-2xl font-bold" style={{ color: subjectColors[subject] || "#a78bfa" }}>{pct}%</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: subjectColors[subject] || "#a78bfa" }} />
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-[#A7A093]">{done}/{total} done</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        {/* Day view */}
        <div className="space-y-4">
          {/* Day tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {timetable.map((d) => {
              const dayDone = d.slots.filter((s) => s.status === "done").length;
              const dayTotal = d.slots.length;
              return (
                <button
                  key={d.day}
                  onClick={() => setActiveDay(d.day)}
                  className={cn(
                    "flex min-w-[80px] flex-col items-center rounded-2xl border px-4 py-3 text-sm font-medium transition",
                    activeDay === d.day
                      ? "border-[#C0A062]/45 bg-[#C0A062] text-slate-100 dark:text-[#16120B]"
                      : "border-[#C0A062]/12 bg-white/[0.03] text-slate-700 dark:text-[#C9C1B0] hover:bg-white/[0.06]"
                  )}
                >
                  <span className="font-semibold">{d.day}</span>
                  <span className={cn("mt-1 text-[11px]", activeDay === d.day ? "text-slate-100 dark:text-[#16120B]/70" : "text-slate-500 dark:text-[#8F856F]")}>{dayDone}/{dayTotal}</span>
                </button>
              );
            })}
          </div>

          {/* Period cards */}
          {dayData ? (
            <div className="space-y-3">
              {dayData.slots.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => onUpdateSlot(dayIdx, slot.id, cycleStatus(slot.status))}
                  className={cn(
                    "group w-full rounded-2xl border p-4 text-left transition-all hover:scale-[1.01] hover:shadow-lg",
                    statusStyle[slot.status]
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                      {/* Period number */}
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-sm font-bold" style={{ background: `${subjectColors[slot.subject]}20`, color: subjectColors[slot.subject] }}>
                        P{slot.period}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900 dark:text-[#F5F0E6]">{slot.subject}</p>
                          <span className="h-1 w-1 rounded-full bg-[#5F584C]" />
                          <p className="text-xs text-slate-600 dark:text-[#A7A093]">{slot.startTime} – {slot.endTime}</p>
                        </div>
                        <p className="mt-1 text-sm text-slate-700 dark:text-[#C9C1B0] truncate">{slot.topic}</p>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-2">
                      <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", statusBadge[slot.status])}>
                        {statusLabel[slot.status]}
                      </span>
                      <span className="text-[11px] text-[#5F584C] opacity-0 group-hover:opacity-100 transition">Click to cycle</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#C0A062]/14 bg-white/[0.03] p-8 text-center text-slate-600 dark:text-[#A7A093]">No lectures scheduled.</div>
          )}
        </div>

        {/* Syllabus Coverage Chart */}
        <div className="space-y-4">
          <Panel title="Syllabus Coverage" subtitle="Completed lectures across all days per subject">
            <div className="space-y-4">
              {[...coverage].sort((a, b) => b.pct - a.pct).map(({ subject, pct, done, total }) => (
                <div key={subject}>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-800 dark:text-[#D7D2C7]">{subject}</p>
                    <span className="font-mono text-sm font-semibold" style={{ color: subjectColors[subject] }}>{pct}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: subjectColors[subject] }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-[#8F856F]">{done} of {total} lectures completed</p>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-[#C0A062]/10 pt-4">
              {(["done", "pending", "skipped"] as LectureStatus[]).map((s) => (
                <div key={s} className={cn("rounded-xl border p-2 text-center text-xs font-medium", statusBadge[s], s === "done" ? "border-emerald-400/20" : s === "skipped" ? "border-rose-400/18" : "border-[#C0A062]/18")}>
                  {statusLabel[s]}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

// ─── Simulated class data for HOD comparison ──────────────────────────────
type ClassSnapshot = {
  label: string;
  section: string;
  teacher: string;
  students: number;
  avgMarks: number;
  attendance: number;
  atRisk: number;
  health: number;
  subjectAvgs: Record<string, number>;
};

function buildSimulatedClasses(myClass: DataVistaState): ClassSnapshot[] {
  const base = myClass.students.length
    ? Math.round(myClass.students.reduce((s, st) => s + st.marksAverage, 0) / myClass.students.length)
    : 72;
  const baseAtt = myClass.students.length
    ? Math.round(myClass.students.reduce((s, st) => s + st.attendanceRate, 0) / myClass.students.length)
    : 80;
  const baseSubject = (delta: number) => ({
    Mathematics: Math.min(100, Math.max(40, base + delta - 2)),
    Science: Math.min(100, Math.max(40, base + delta + 3)),
    English: Math.min(100, Math.max(40, base + delta - 5)),
    "Social Studies": Math.min(100, Math.max(40, base + delta - 8)),
    Computer: Math.min(100, Math.max(40, base + delta + 6)),
  });

  const mySubjects = SUBJECTS.reduce((acc, sub) => {
    acc[sub] = myClass.students.length
      ? Math.round(myClass.students.reduce((s, st) => s + (st.subjectScores[sub] ?? 0), 0) / myClass.students.length)
      : base;
    return acc;
  }, {} as Record<string, number>);

  const myRisk = myClass.students.filter((s) => s.riskLevel === "High").length;
  const myHealth = calculateClassHealth(myClass.students);

  return [
    {
      label: `${myClass.settings.className} ${myClass.settings.section}`,
      section: myClass.settings.section,
      teacher: myClass.settings.classTeacher,
      students: myClass.students.length,
      avgMarks: base,
      attendance: baseAtt,
      atRisk: myRisk,
      health: myHealth,
      subjectAvgs: mySubjects,
    },
    {
      label: `${myClass.settings.className} B`,
      section: "B",
      teacher: "Dr. Anita Kumar",
      students: Math.max(8, myClass.students.length - 1),
      avgMarks: Math.max(40, base - 7),
      attendance: Math.max(50, baseAtt - 5),
      atRisk: myRisk + 2,
      health: Math.max(20, myHealth - 9),
      subjectAvgs: baseSubject(-7),
    },
    {
      label: `${myClass.settings.className} C`,
      section: "C",
      teacher: "Prof. Rajan Iyer",
      students: Math.max(8, myClass.students.length + 2),
      avgMarks: Math.min(100, base + 4),
      attendance: Math.min(100, baseAtt + 3),
      atRisk: Math.max(0, myRisk - 1),
      health: Math.min(100, myHealth + 5),
      subjectAvgs: baseSubject(4),
    },
    {
      label: `${myClass.settings.className} D`,
      section: "D",
      teacher: "Ms. Pooja Singh",
      students: Math.max(6, myClass.students.length - 3),
      avgMarks: Math.max(40, base - 12),
      attendance: Math.max(50, baseAtt - 9),
      atRisk: myRisk + 4,
      health: Math.max(20, myHealth - 15),
      subjectAvgs: baseSubject(-12),
    },
  ];
}

const CLASS_COLORS = ["#C0A062", "#38bdf8", "#34d399", "#a78bfa"];

function ComparePage({ myClass, role, schoolName }: { myClass: DataVistaState; role: string; schoolName: string }) {
  const classes = useMemo(() => buildSimulatedClasses(myClass), [myClass]);
  const [selected, setSelected] = useState<string[]>(classes.map((c) => c.label));

  const visible = classes.filter((c) => selected.includes(c.label));
  const winner = [...classes].sort((a, b) => b.health - a.health)[0];

  // Subject comparison chart data
  const subjectChartData = SUBJECTS.map((sub) => {
    const row: Record<string, string | number> = { subject: shortSubject(sub) };
    visible.forEach((cls) => { row[cls.label] = cls.subjectAvgs[sub] ?? 0; });
    return row;
  });

  // Weakest subject across all visible classes
  const subjectWeakness = SUBJECTS.map((sub) => {
    const avg = visible.length ? Math.round(visible.reduce((s, c) => s + (c.subjectAvgs[sub] ?? 0), 0) / visible.length) : 0;
    return { subject: sub, avg };
  }).sort((a, b) => a.avg - b.avg);

  function toggleClass(label: string) {
    setSelected((prev) => prev.includes(label) ? (prev.length > 1 ? prev.filter((l) => l !== label) : prev) : [...prev, label]);
  }

  return (
    <div className="space-y-6">
      <Section
        eyebrow={role === "dean" ? "Dean Overview" : "HOD Analytics"}
        title="Class Comparison"
        description={`Cross-section performance analysis for ${schoolName}. Compare marks, attendance, and subject strength across all divisions.`}
      />

      {/* Class toggle pills */}
      <div className="flex flex-wrap gap-2">
        {classes.map((cls, i) => (
          <button
            key={cls.label}
            onClick={() => toggleClass(cls.label)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
              selected.includes(cls.label)
                ? "border-transparent text-slate-100 dark:text-[#16120B]"
                : "border-[#C0A062]/18 bg-white/[0.03] text-slate-600 dark:text-[#A7A093] hover:border-[#C0A062]/30"
            )}
            style={selected.includes(cls.label) ? { background: CLASS_COLORS[i] } : {}}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: CLASS_COLORS[i] }} />
            {cls.label}
            {cls.label === winner.label && <span className="ml-1 text-[10px]">👑</span>}
          </button>
        ))}
      </div>

      {/* Summary metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {classes.map((cls, i) => (
          <div
            key={cls.label}
            className={cn(
              "rounded-[22px] border p-5 transition",
              cls.label === winner.label
                ? "border-[#a78bfa]/35 bg-[#a78bfa]/[0.07]"
                : "border-[#C0A062]/14 bg-white/[0.03]"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="h-3 w-3 rounded-full" style={{ background: CLASS_COLORS[i] }} />
              {cls.label === winner.label && <span className="rounded-full bg-[#a78bfa]/18 px-2 py-0.5 text-[10px] font-bold text-[#a78bfa]">WINNER 👑</span>}
            </div>
            <p className="mt-3 text-lg font-bold text-slate-900 dark:text-[#F5F0E6]">{cls.label}</p>
            <p className="text-xs text-slate-500 dark:text-[#8F856F]">{cls.teacher}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-[#8F856F]">Health</p>
                <p className={cn("mt-1 text-xl font-bold", cls.health >= 75 ? "text-emerald-300" : cls.health >= 60 ? "text-amber-300" : "text-rose-300")}>{cls.health}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-[#8F856F]">Marks</p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-[#F5E8C8]">{cls.avgMarks}%</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-[#8F856F]">Attendance</p>
                <p className={cn("mt-1 text-lg font-semibold", cls.attendance >= 75 ? "text-emerald-300" : "text-rose-300")}>{cls.attendance}%</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-[#8F856F]">At Risk</p>
                <p className={cn("mt-1 text-lg font-semibold", cls.atRisk === 0 ? "text-emerald-300" : "text-rose-300")}>{cls.atRisk}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        {/* Subject comparison bar chart */}
        <Panel title="📊 Subject-Wise Comparison" subtitle="Average subject score per section">
          <Chart className="h-[320px]">
            <BarChart data={subjectChartData}>
              <CartesianGrid stroke="#1f3346" vertical={false} />
              <XAxis dataKey="subject" stroke="#7f96ad" />
              <YAxis domain={[40, 100]} stroke="#7f96ad" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              {visible.map((cls, i) => (
                <Bar key={cls.label} dataKey={cls.label} fill={CLASS_COLORS[classes.findIndex((c) => c.label === cls.label)]} radius={[6, 6, 0, 0]} />
              ))}
            </BarChart>
          </Chart>
        </Panel>

        {/* Weakest subjects */}
        <Panel title="🔴 Weakest Subjects (All Sections)" subtitle="Ranked worst → best across visible classes">
          <div className="space-y-3">
            {subjectWeakness.map(({ subject, avg }, idx) => (
              <div key={subject} className={cn("flex items-center gap-4 rounded-2xl border p-3", idx === 0 ? "border-rose-400/22 bg-rose-400/[0.06]" : idx === 1 ? "border-amber-400/18 bg-amber-400/[0.05]" : "border-[#C0A062]/12 bg-white/[0.03]")}>
                <span className="text-lg">{idx === 0 ? "🔴" : idx === 1 ? "🟡" : "🟢"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900 dark:text-[#F5F0E6]">{subject}</p>
                    <span className={cn("font-mono text-sm font-bold", avg < 65 ? "text-rose-300" : avg < 75 ? "text-amber-300" : "text-emerald-300")}>{avg}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className={cn("h-full rounded-full transition-all", avg < 65 ? "bg-rose-400" : avg < 75 ? "bg-amber-400" : "bg-emerald-400")} style={{ width: `${avg}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Full comparison table */}
      <Panel title="📋 Head-to-Head Table" subtitle="Complete metrics across all sections">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[#C0A062]/12 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-[#8F856F]">
                <th className="pb-3 text-left">Section</th>
                <th className="pb-3 text-left">Teacher</th>
                <th className="pb-3 text-right">Students</th>
                <th className="pb-3 text-right">Health</th>
                <th className="pb-3 text-right">Avg Marks</th>
                <th className="pb-3 text-right">Attendance</th>
                <th className="pb-3 text-right">At Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#C0A062]/8">
              {classes.map((cls, i) => (
                <tr key={cls.label} className={cn("transition hover:bg-white/[0.02]", cls.label === winner.label && "bg-[#a78bfa]/[0.04]")}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: CLASS_COLORS[i] }} />
                      <span className="font-semibold text-slate-900 dark:text-[#F5F0E6]">{cls.label}</span>
                      {cls.label === winner.label && <span className="text-xs">👑</span>}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-[#A7A093]">{cls.teacher}</td>
                  <td className="py-3 pr-4 text-right text-slate-800 dark:text-[#D7D2C7]">{cls.students}</td>
                  <td className="py-3 pr-4 text-right">
                    <span className={cn("font-semibold", cls.health >= 75 ? "text-emerald-300" : cls.health >= 60 ? "text-amber-300" : "text-rose-300")}>{cls.health}</span>
                  </td>
                  <td className="py-3 pr-4 text-right text-slate-800 dark:text-[#D7D2C7]">{cls.avgMarks}%</td>
                  <td className="py-3 pr-4 text-right">
                    <span className={cn("font-semibold", cls.attendance >= 75 ? "text-emerald-300" : "text-rose-300")}>{cls.attendance}%</span>
                  </td>
                  <td className="py-3 text-right">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", cls.atRisk === 0 ? "bg-emerald-400/12 text-emerald-300" : "bg-rose-400/12 text-rose-300")}>{cls.atRisk}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function CalculatorPage() {
  const [expression, setExpression] = useState("0");
  const [preview, setPreview] = useState("");

  const push = useCallback((value: string) => {
    setExpression((current) => {
      const next = current === "0" || current === "Error" ? value : `${current}${value}`;
      return next.replace(/([+\-*/])([+\-*/])+$/g, "$2");
    });
  }, []);
  const clear = useCallback(() => { setExpression("0"); setPreview(""); }, []);
  const backspace = useCallback(() => setExpression((current) => current.length > 1 && current !== "Error" ? current.slice(0, -1) : "0"), []);
  const toggleSign = useCallback(() => setExpression((current) => current.startsWith("-") ? current.slice(1) || "0" : current === "0" ? "-0" : `-${current}`), []);
  const calculate = useCallback(() => {
    try {
      const answer = formatCalculatorNumber(evaluateCalculatorExpression(expression));
      setPreview(expression);
      setExpression(answer);
    } catch {
      setPreview(expression);
      setExpression("Error");
    }
  }, [expression]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const { code, key } = e;

      // Digits: main keyboard and numpad
      if (/^(Digit|Numpad)[0-9]$/.test(code)) {
        e.preventDefault();
        push(key === "Enter" ? "=" : /^Numpad\d$/.test(code) ? code.replace("Numpad", "") : key);
        return;
      }

      switch (code) {
        case "NumpadAdd":       e.preventDefault(); push("+"); break;
        case "NumpadSubtract":  e.preventDefault(); push("-"); break;
        case "NumpadMultiply":  e.preventDefault(); push("*"); break;
        case "NumpadDivide":    e.preventDefault(); push("/"); break;
        case "NumpadDecimal":   e.preventDefault(); push("."); break;
        case "NumpadEnter":
        case "Enter":           e.preventDefault(); calculate(); break;
        case "Backspace":       e.preventDefault(); backspace(); break;
        case "Escape":          e.preventDefault(); clear(); break;
        default:
          // Main keyboard operators and decimal
          if (key === "+" || key === "-" || key === "*" || key === "/") { e.preventDefault(); push(key); }
          else if (key === ".") { e.preventDefault(); push("."); }
          else if (key === "%" ) { e.preventDefault(); push("%"); }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [push, clear, backspace, calculate]);

  const buttons = [
    ["AC", "+/-", "%", "/"],
    ["7", "8", "9", "*"],
    ["4", "5", "6", "-"],
    ["1", "2", "3", "+"],
    ["0", ".", "DEL", "="],
  ];

  return <div className="space-y-6"><Section eyebrow="Utility" title="Calculator" description="Quick calculations for marks, averages, percentages, and class planning." /><div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]"><Panel title="Basic Calculator" subtitle="Use operators, decimals, brackets, and percentages."><div className="rounded-[28px] border border-[#C0A062]/14 bg-[#080807] p-4 shadow-[inset_0_0_34px_rgba(192,160,98,0.05)] sm:p-5"><div className="mb-4 min-h-[132px] rounded-[24px] border border-[#C0A062]/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4 text-right"><p className="min-h-6 truncate text-sm text-slate-500 dark:text-[#8F856F]">{preview}</p><p className="mt-4 break-all font-mono text-4xl font-semibold text-slate-900 dark:text-[#F5F0E6] sm:text-5xl">{expression}</p></div><div className="grid grid-cols-4 gap-2 sm:gap-3">{buttons.flat().map((label) => { const isOperator = ["/", "*", "-", "+", "="].includes(label); const isUtility = ["AC", "+/-", "%", "DEL"].includes(label); return <Button key={label} type="button" variant="outline" className={cn("h-14 rounded-2xl border-[#C0A062]/14 bg-white/[0.04] font-mono text-lg text-slate-900 dark:text-[#F5F0E6] hover:bg-white/[0.08] hover:text-slate-900 dark:text-[#F5F0E6] sm:h-16", isOperator && "border-[#C0A062]/30 bg-[#C0A062]/16 text-[#F2DEAE] hover:bg-[#C0A062]/24 hover:text-[#FFF3D1]", label === "=" && "bg-[#C0A062] text-slate-100 dark:text-[#16120B] hover:bg-[#D4B370] hover:text-slate-100 dark:text-[#16120B]", isUtility && "text-slate-700 dark:text-[#C9C1B0]")} onClick={() => { if (label === "AC") clear(); else if (label === "DEL") backspace(); else if (label === "+/-") toggleSign(); else if (label === "=") calculate(); else push(label); }}>{label === "*" ? "x" : label === "/" ? "÷" : label}</Button>; })}</div></div></Panel><Panel title="Useful Shortcuts" subtitle="Classroom-friendly examples"><div className="grid gap-3 sm:grid-cols-2"><CalculatorExample label="Average marks" expression="(78+84+91)/3" onUse={setExpression} /><CalculatorExample label="Attendance rate" expression="23/26*100" onUse={setExpression} /><CalculatorExample label="10% improvement" expression="68+68*10%" onUse={setExpression} /><CalculatorExample label="Weighted score" expression="82*0.6+91*0.4" onUse={setExpression} /></div><div className="mt-5 rounded-2xl border border-[#C0A062]/12 bg-white/[0.03] p-4 text-sm leading-6 text-slate-600 dark:text-[#A7A093]">Tip: Percent works as a postfix operator, so <span className="font-mono text-[#E7D19A]">10%</span> becomes <span className="font-mono text-[#E7D19A]">0.1</span>.</div></Panel></div></div>;
}

function CalculatorExample({ label, expression, onUse }: { label: string; expression: string; onUse: (expression: string) => void }) {
  return <button type="button" onClick={() => onUse(expression)} className="rounded-2xl border border-[#C0A062]/12 bg-white/[0.03] p-4 text-left transition hover:border-[#C0A062]/28 hover:bg-white/[0.06]"><p className="text-sm font-medium text-slate-900 dark:text-[#F5F0E6]">{label}</p><p className="mt-2 font-mono text-sm text-[#E7D19A]">{expression}</p></button>;
}

function SmartAlertsPanel({ students }: { students: Student[] }) {
  // 1. Low attendance (<75%)
  const lowAttendance = students.filter((s) => s.attendanceRate < 75);

  // 2. Sudden marks drop: last trajectory point dropped ≥8 pts vs previous
  const marksDrop = students
    .map((s) => {
      const t = s.trajectory;
      if (t.length < 2) return null;
      const drop = t[t.length - 2].score - t[t.length - 1].score;
      return drop >= 8 ? { student: s, drop } : null;
    })
    .filter(Boolean) as Array<{ student: Student; drop: number }>;

  // 3. Assignment completion below 60%
  const lowAssignment = students.filter((s) => s.assignmentCompletion < 60);

  // 4. AI suggestions: weakest subject for medium/high risk students scoring <70
  const suggestions = students
    .filter((s) => s.riskLevel !== "Low")
    .map((s) => {
      const weakest = SUBJECTS.reduce((min, sub) => (s.subjectScores[sub] < s.subjectScores[min] ? sub : min), SUBJECTS[0]);
      return { id: s.id, name: s.name.split(" ")[0], subject: weakest, score: s.subjectScores[weakest] };
    })
    .filter((x) => x.score < 70)
    .slice(0, 4);

  const totalAlerts = lowAttendance.length + marksDrop.length + lowAssignment.length;

  return (
    <Card className="min-w-0 rounded-[22px] border-[#C0A062]/12 bg-white/[0.03] p-4 sm:rounded-[30px] sm:p-5 xl:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-[#8F856F] sm:text-xs">Live Monitoring</p>
          <h4 className="mt-1 text-xl font-semibold text-slate-900 dark:text-[#F5F0E6] sm:text-2xl">Smart Alerts</h4>
          <p className="mt-1 text-sm text-slate-600 dark:text-[#A7A093]">Real-time flags and AI-driven intervention suggestions for your class.</p>
        </div>
        {totalAlerts > 0 && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-rose-400" />
            <span className="text-sm font-semibold text-rose-200">{totalAlerts} active alert{totalAlerts !== 1 ? "s" : ""}</span>
          </div>
        )}
        {totalAlerts === 0 && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/8 px-4 py-2">
            <span className="text-emerald-300">✅</span>
            <span className="text-sm font-semibold text-emerald-200">All clear</span>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── Alert columns ── */}
        <div className="space-y-3">
          {/* Low Attendance */}
          {lowAttendance.length > 0 ? (
            <div className="rounded-2xl border border-amber-400/22 bg-amber-400/[0.07] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xl leading-none">⚠️</span>
                <p className="text-sm font-semibold text-amber-200">Low Attendance Alert</p>
                <span className="ml-auto rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-medium text-amber-300">{lowAttendance.length}</span>
              </div>
              <p className="mb-3 text-xs text-amber-300/60">Students below 75% threshold</p>
              <div className="space-y-2">
                {lowAttendance.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2 text-sm">
                    <span className="text-slate-700 dark:text-[#E7DFC9]">{s.name}</span>
                    <span className="font-mono font-semibold text-amber-300">{s.attendanceRate}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-300">⚠️ <span className="ml-1 text-emerald-200">Attendance</span> — No low-attendance students.</div>
          )}

          {/* Marks Drop */}
          {marksDrop.length > 0 ? (
            <div className="rounded-2xl border border-rose-400/22 bg-rose-400/[0.07] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xl leading-none">📉</span>
                <p className="text-sm font-semibold text-rose-200">Sudden Marks Drop</p>
                <span className="ml-auto rounded-full bg-rose-400/15 px-2 py-0.5 text-xs font-medium text-rose-300">{marksDrop.length}</span>
              </div>
              <p className="mb-3 text-xs text-rose-300/60">Score dipped ≥8 pts in last checkpoint</p>
              <div className="space-y-2">
                {marksDrop.map(({ student, drop }) => (
                  <div key={student.id} className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2 text-sm">
                    <span className="text-slate-700 dark:text-[#E7DFC9]">{student.name}</span>
                    <span className="font-mono font-semibold text-rose-300">−{drop} pts</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-300">📉 <span className="ml-1 text-emerald-200">Marks</span> — No sudden drops detected.</div>
          )}

          {/* Assignment Not Submitted */}
          {lowAssignment.length > 0 ? (
            <div className="rounded-2xl border border-orange-400/22 bg-orange-400/[0.07] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xl leading-none">❗</span>
                <p className="text-sm font-semibold text-orange-200">Assignments Not Submitted</p>
                <span className="ml-auto rounded-full bg-orange-400/15 px-2 py-0.5 text-xs font-medium text-orange-300">{lowAssignment.length}</span>
              </div>
              <p className="mb-3 text-xs text-orange-300/60">Completion rate below 60%</p>
              <div className="space-y-2">
                {lowAssignment.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2 text-sm">
                    <span className="text-slate-700 dark:text-[#E7DFC9]">{s.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-orange-400" style={{ width: `${s.assignmentCompletion}%` }} />
                      </div>
                      <span className="font-mono font-semibold text-orange-300">{s.assignmentCompletion}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-300">❗ <span className="ml-1 text-emerald-200">Assignments</span> — All students meeting submission targets.</div>
          )}
        </div>

        {/* ── AI Recommendations column ── */}
        <div>
          <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-[#8F856F]">💡 AI Recommendations</p>
          {suggestions.length > 0 ? (
            <div className="space-y-3">
              {suggestions.map((s) => (
                <div key={s.id} className="rounded-2xl border border-[#C0A062]/18 bg-[linear-gradient(135deg,rgba(192,160,98,0.10),rgba(192,160,98,0.04))] p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl border border-[#C0A062]/22 bg-[#C0A062]/12 text-base">
                      📚
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-[#F5F0E6]">{s.name} needs extra support</p>
                      <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-[#A7A093]">
                        Schedule extra classes in{" "}
                        <span className="font-semibold text-[#E7D19A]">{s.subject}</span>
                        {" — current score: "}
                        <span className="font-mono font-semibold text-rose-300">{s.score}%</span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4">
              <p className="text-sm font-semibold text-emerald-200">✅ No critical subject recommendations</p>
              <p className="mt-1 text-sm text-emerald-300/70">All students are meeting subject score thresholds.</p>
            </div>
          )}

          {/* Alert summary card */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.06] p-3 text-center">
              <p className="text-2xl font-semibold text-amber-300">{lowAttendance.length}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-amber-400/70">Low Attend.</p>
            </div>
            <div className="rounded-2xl border border-rose-400/15 bg-rose-400/[0.06] p-3 text-center">
              <p className="text-2xl font-semibold text-rose-300">{marksDrop.length}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-rose-400/70">Marks Drop</p>
            </div>
            <div className="rounded-2xl border border-orange-400/15 bg-orange-400/[0.06] p-3 text-center">
              <p className="text-2xl font-semibold text-orange-300">{lowAssignment.length}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-orange-400/70">Pending</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function SettingsPage({ settingsDraft, setSettingsDraft, saveSettings, exportCsv, exportBackup, resetDemo, deleteAccount }: { settingsDraft: ClassSettings; setSettingsDraft: React.Dispatch<React.SetStateAction<ClassSettings>>; saveSettings: () => void; exportCsv: () => void; exportBackup: () => void; resetDemo: () => void; deleteAccount: () => void }) { return <div className="space-y-6"><Section eyebrow="Configuration" title="Settings" description="Tune thresholds, export your working data, or restore the saved demo setup." /><div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]"><Panel title="Class Configuration" subtitle="Core identity and teacher ownership"><div className="grid gap-4 md:grid-cols-2"><Field label="School Name"><Input value={settingsDraft.schoolName} onChange={(e) => setSettingsDraft((c) => ({ ...c, schoolName: e.target.value }))} className="h-11 rounded-2xl border-white/10 bg-slate-900/70" /></Field><Field label="Class Teacher"><Input value={settingsDraft.classTeacher} onChange={(e) => setSettingsDraft((c) => ({ ...c, classTeacher: e.target.value }))} className="h-11 rounded-2xl border-white/10 bg-slate-900/70" /></Field><Field label="Class"><Input value={settingsDraft.className} onChange={(e) => setSettingsDraft((c) => ({ ...c, className: e.target.value }))} className="h-11 rounded-2xl border-white/10 bg-slate-900/70" /></Field><Field label="Section"><Input value={settingsDraft.section} onChange={(e) => setSettingsDraft((c) => ({ ...c, section: e.target.value }))} className="h-11 rounded-2xl border-white/10 bg-slate-900/70" /></Field><Field label="Term"><Input value={settingsDraft.term} onChange={(e) => setSettingsDraft((c) => ({ ...c, term: e.target.value }))} className="h-11 rounded-2xl border-white/10 bg-slate-900/70" /></Field></div></Panel><Panel title="Thresholds & Actions" subtitle="Intervention controls and data utilities"><div className="space-y-4"><NumberField label="At-Risk Threshold" value={settingsDraft.atRiskThreshold} onChange={(value) => setSettingsDraft((c) => ({ ...c, atRiskThreshold: value }))} /><NumberField label="Attendance Threshold" value={settingsDraft.attendanceThreshold} onChange={(value) => setSettingsDraft((c) => ({ ...c, attendanceThreshold: value }))} /><NumberField label="Marks Threshold" value={settingsDraft.marksThreshold} onChange={(value) => setSettingsDraft((c) => ({ ...c, marksThreshold: value }))} /><Toggle label="Send parent alerts" checked={settingsDraft.sendAlerts} onChange={(checked) => setSettingsDraft((c) => ({ ...c, sendAlerts: checked }))} /><Toggle label="Weekly digest" checked={settingsDraft.weeklyDigest} onChange={(checked) => setSettingsDraft((c) => ({ ...c, weeklyDigest: checked }))} /><div className="grid gap-3 pt-2"><Button className="w-full rounded-full bg-sky-500 text-slate-950 hover:bg-sky-400 sm:w-auto" onClick={saveSettings}><Save className="mr-2 h-4 w-4" />Save Settings</Button><Button variant="outline" className="w-full rounded-full border-white/10 bg-transparent text-slate-200 hover:bg-white/10 sm:w-auto" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Export CSV</Button><Button variant="outline" className="w-full rounded-full border-white/10 bg-transparent text-slate-200 hover:bg-white/10 sm:w-auto" onClick={exportBackup}><FileSpreadsheet className="mr-2 h-4 w-4" />Backup JSON</Button><Button variant="outline" className="w-full rounded-full border-rose-400/20 bg-transparent text-rose-200 hover:bg-rose-400/10 sm:w-auto" onClick={resetDemo}>Reset to Saved Demo</Button><Button variant="outline" className="w-full rounded-full border-rose-500/35 bg-rose-500/10 text-rose-200 hover:bg-rose-500/18 sm:w-auto" onClick={deleteAccount}><Trash2 className="mr-2 h-4 w-4" />Delete Account</Button><p className="text-xs text-[#A79B84]">This permanently removes your login and synced class data from DataVista.</p></div></div></Panel></div></div>; }

function Hero() { return <Card className="overflow-hidden rounded-[24px] border-[#C0A062]/14 bg-[linear-gradient(135deg,rgba(192,160,98,0.12),rgba(14,12,10,0.98)_46%,rgba(192,160,98,0.16))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.4)] sm:rounded-[36px] sm:p-6 xl:p-8"><p className="text-[11px] uppercase tracking-[0.2em] text-[#C8B07A] sm:text-xs sm:tracking-[0.28em]">Command Center</p><h3 className="mt-3 max-w-2xl text-2xl font-semibold leading-tight text-[#FFF7E8] sm:text-4xl xl:text-5xl">One place to see class performance, risk signals, and next actions.</h3><p className="mt-3 max-w-2xl text-sm leading-6 text-[#B9B09E] sm:mt-4 sm:text-base">DataVista 2.0 brings dashboard analytics, attendance control, predictions, and AI insights into one artifact.</p></Card>; }
function Section({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div className="min-w-0"><p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-[#8F856F] sm:text-xs sm:tracking-[0.24em]">{eyebrow}</p><h3 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-[#F5F0E6] sm:text-3xl">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-[#A7A093]">{description}</p></div>{action}</div>; }
function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <Card className="min-w-0 rounded-[22px] border-[#C0A062]/12 bg-white/[0.03] p-4 sm:rounded-[30px] sm:p-5 xl:p-6"><div className="mb-4 sm:mb-5"><h4 className="text-lg font-semibold text-slate-900 dark:text-[#F5F0E6] sm:text-xl">{title}</h4><p className="mt-1 text-sm leading-6 text-slate-600 dark:text-[#A7A093]">{subtitle}</p></div>{children}</Card>; }
function Chart({ children, className }: { children: React.ReactNode; className?: string }) { return <div className={cn("h-[240px] w-full min-w-0 sm:h-[300px]", className)}><ResponsiveContainer width="100%" height="100%">{children as React.ReactElement}</ResponsiveContainer></div>; }
function PredictionFormulaCard() {
  return <div className="relative min-h-[420px] overflow-hidden rounded-[22px] border border-sky-300/18 bg-[#f4f2ee] dark:bg-[radial-gradient(circle_at_20%_0%,rgba(56,189,248,0.18),transparent_34%),linear-gradient(160deg,rgba(8,13,22,0.96),rgba(5,5,5,0.96))] p-4 shadow-[inset_0_0_34px_rgba(56,189,248,0.06)] sm:min-h-[620px] sm:rounded-[26px] sm:p-5"><div className="pointer-events-none absolute -right-16 top-8 h-40 w-40 rounded-full bg-[#C0A062]/10 blur-3xl" /><div className="pointer-events-none absolute bottom-12 left-4 h-32 w-32 rounded-full bg-sky-400/10 blur-3xl" /><p className="text-[11px] uppercase tracking-[0.2em] text-sky-200/70 sm:text-xs sm:tracking-[0.24em]">Prediction Math</p><h5 className="mt-3 text-xl font-semibold text-slate-900 dark:text-[#F5F0E6] sm:text-2xl">Random Forest Formula</h5><div className="mt-5 space-y-3 font-mono text-xs sm:mt-6 sm:space-y-4 sm:text-sm"><div className="rounded-2xl border border-white/10 bg-black/35 p-3 text-[#E7D19A] sm:p-4"><p>score = 0.38M + 0.22T</p><p className="mt-1">+ 0.18A + 0.12P</p><p className="mt-1">+ 0.06C - penalties</p></div><div className="rounded-2xl border border-sky-300/14 bg-sky-300/8 p-3 text-sky-100 sm:p-4"><p>grade = mode(tree_1...tree_n)</p><p className="mt-1">confidence = votes / n</p></div><div className="rounded-2xl border border-emerald-300/14 bg-emerald-300/8 p-3 text-emerald-100 sm:p-4"><p>trend = last_test - previous</p><p className="mt-1">Rising if trend &gt;= 5</p></div></div><div className="mt-5 grid grid-cols-2 gap-2 text-xs sm:mt-6 sm:gap-3"><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="text-slate-500 dark:text-[#8F856F]">M</p><p className="mt-1 font-semibold text-slate-900 dark:text-[#F5F0E6]">Marks</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="text-slate-500 dark:text-[#8F856F]">T</p><p className="mt-1 font-semibold text-slate-900 dark:text-[#F5F0E6]">Test</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="text-slate-500 dark:text-[#8F856F]">A</p><p className="mt-1 font-semibold text-slate-900 dark:text-[#F5F0E6]">Assignment</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="text-slate-500 dark:text-[#8F856F]">P</p><p className="mt-1 font-semibold text-slate-900 dark:text-[#F5F0E6]">Presence</p></div></div></div>;
}
function RobotModelViewer({ modelPath }: { modelPath: string }) {
  return <div className="relative min-h-[360px] overflow-hidden rounded-[22px] border border-[#C0A062]/12 bg-[#f4f2ee] dark:bg-[radial-gradient(circle_at_top,rgba(192,160,98,0.16),transparent_46%),linear-gradient(180deg,#090909_0%,#050505_100%)] sm:min-h-[620px] sm:rounded-[26px]"><model-viewer src={modelPath} camera-controls auto-rotate camera-orbit="0deg 74deg 24%" min-camera-orbit="auto auto 16%" max-camera-orbit="auto auto 52%" field-of-view="16deg" rotation-per-second="18deg" shadow-intensity="1.25" exposure="1.18" environment-image="neutral" interaction-prompt="auto" tone-mapping="commerce" className="block h-[360px] w-full bg-transparent sm:h-[620px]" style={{ "--progress-bar-color": "#C0A062", "--progress-bar-height": "4px" } as React.CSSProperties}><button className="rounded-full border border-[#C0A062]/20 bg-black/65 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-900 dark:text-[#F5F0E6]" slot="poster">Tap To Load Model</button></model-viewer><div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" /></div>;
}
function Metric({ label, value, hint, tone = "neutral" }: { label: string; value: string | number; hint: string; tone?: "green" | "red" | "neutral" }) {
  const valueColor = tone === "green" ? "text-emerald-400" : tone === "red" ? "text-rose-400" : "text-slate-900 dark:text-[#F5F0E6]";
  const glowClass  = tone === "green" ? "shadow-[0_0_22px_rgba(52,211,153,0.12)]" : tone === "red" ? "shadow-[0_0_22px_rgba(251,113,133,0.14)]" : "";
  const dotColor   = tone === "green" ? "bg-emerald-400" : tone === "red" ? "bg-rose-400" : "bg-[#C0A062]";
  return (
    <Card className={cn("rounded-[22px] border-[#C0A062]/12 bg-white/[0.03] p-4 sm:rounded-[28px] sm:p-5 transition-all", glowClass)}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-[#8F856F] sm:text-sm sm:tracking-[0.18em]">{label}</p>
        <span className={cn("h-2 w-2 rounded-full", dotColor)} />
      </div>
      <p className={cn("mt-1 text-3xl font-semibold sm:text-4xl", valueColor)}>{value}</p>
      <p className="mt-2 text-sm text-slate-600 dark:text-[#A7A093]">{hint}</p>
    </Card>
  );
}
function MiniStat({ label, value }: { label: string; value: string | number }) { return <div className="rounded-2xl border border-[#C0A062]/12 bg-white/[0.03] px-3 py-3"><p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-[#8F856F]">{label}</p><p className="mt-1 text-lg font-semibold text-slate-900 dark:text-[#F5F0E6]">{value}</p></div>; }
function MiniCard({ label, value }: { label: string; value: string | number }) { return <Card className="rounded-[24px] border-[#C0A062]/12 bg-white/[0.03] p-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-[#8F856F]">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-[#F5F0E6]">{value}</p></Card>; }
function StudentTabs({ students, selectedId, onSelect }: { students: Student[]; selectedId: string; onSelect: (id: string) => void }) { return <div className="flex gap-2 overflow-x-auto pb-1">{students.map((student) => <button key={student.id} onClick={() => onSelect(student.id)} className={cn("rounded-full border px-4 py-2 text-sm transition", selectedId === student.id ? "border-[#C0A062]/40 bg-[#C0A062]/12 text-[#F4E6C4]" : "border-[#C0A062]/12 bg-white/[0.03] text-slate-700 dark:text-[#C9C1B0] hover:bg-white/[0.06]")}>{student.name}</button>)}</div>; }
function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) { return <label className="space-y-2"><span className="text-sm font-medium capitalize text-slate-800 dark:text-[#D7D2C7]">{label.replace(/([A-Z])/g, " $1")}</span>{children}{error ? <span className="text-sm text-rose-300">{error}</span> : null}</label>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <Field label={label}><Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-11 rounded-2xl border-[#2A241A] bg-white dark:bg-[#121212] text-slate-800 dark:text-[#EDEDED] focus-visible:ring-[#C0A062]/35" /></Field>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="flex items-center justify-between rounded-2xl border border-[#C0A062]/12 bg-white/[0.03] px-4 py-3"><span className="text-sm text-slate-700 dark:text-[#E7DFC9]">{label}</span><button type="button" onClick={() => onChange(!checked)} className={cn("h-7 w-14 rounded-full border p-1 transition", checked ? "border-[#C0A062]/40 bg-[#C0A062]/18" : "border-[#2A241A] bg-white dark:bg-[#121212]")}><span className={cn("block h-5 w-5 rounded-full transition", checked ? "translate-x-7 bg-[#D4B370]" : "translate-x-0 bg-[#6C6457]")} /></button></label>; }
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
