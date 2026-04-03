import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, LogIn, UserPlus } from "lucide-react";

export type Teacher = { name: string; username: string; position: string };

type TeacherAccount = Teacher & { password: string };
type Props = { onLogin: (teacher: Teacher, options?: { showIntro?: boolean }) => void };
type Mode = "signin" | "signup";

const STORAGE_KEY = "datavista_teacher_accounts";

const DEFAULT_TEACHERS: TeacherAccount[] = [
  { name: "Ananya Sen", username: "dean", password: "dean123", position: "Dean" },
  { name: "Rahul Sharma", username: "hod", password: "hod123", position: "HOD" },
  { name: "Priya Verma", username: "coordinator", password: "coordinator123", position: "Class Coordinator" },
];

const inputClass =
  "h-12 w-full rounded-lg border border-[#222222] bg-[#111111]/90 px-4 text-sm text-[#EDEDED] placeholder:text-[#555555] outline-none transition-[border-color,box-shadow] [transition-duration:250ms] ease-in-out hover:border-[#333333] focus:border-[#C0A062] focus:shadow-[0_0_0_1px_rgba(192,160,98,0.42),0_0_16px_rgba(192,160,98,0.12)]";

const actionButtonClass =
  "mt-2 flex h-12 w-full transform-gpu items-center justify-center gap-2 rounded-lg bg-[#EDEDED] text-[11px] font-semibold uppercase tracking-[0.3em] text-black shadow-[0_0_0_rgba(192,160,98,0)] transition-all duration-300 ease-in-out hover:scale-[1.03] hover:bg-[#C0A062] hover:shadow-[0_0_12px_rgba(192,160,98,0.4)]";

const modeButtonClass =
  "rounded-lg px-4 py-3 text-[11px] font-medium uppercase tracking-[0.28em] transition-all duration-300 ease-in-out";

function loadTeacherAccounts() {
  if (typeof window === "undefined") return DEFAULT_TEACHERS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as TeacherAccount[]) : [];
    const merged = [...DEFAULT_TEACHERS];

    for (const teacher of Array.isArray(saved) ? saved : []) {
      if (!teacher?.username || !teacher?.password || !teacher?.name || !teacher?.position) continue;
      if (!merged.some((item) => item.username === teacher.username)) {
        merged.push(teacher);
      }
    }

    return merged;
  } catch {
    return DEFAULT_TEACHERS;
  }
}

function saveTeacherAccounts(accounts: TeacherAccount[]) {
  if (typeof window === "undefined") return;
  const custom = accounts.filter((account) => !DEFAULT_TEACHERS.some((teacher) => teacher.username === account.username));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
}

export default function LoginPage({ onLogin }: Props) {
  const [mode, setMode] = useState<Mode>("signin");
  const [accounts, setAccounts] = useState<TeacherAccount[]>(() => loadTeacherAccounts());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [signUp, setSignUp] = useState({
    name: "",
    username: "",
    position: "",
    password: "",
    confirmPassword: "",
  });

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError("");
    setShowPass(false);
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const u = username.trim().toLowerCase();
    const p = password.trim();
    const latestAccounts = loadTeacherAccounts();
    setAccounts(latestAccounts);
    const match = latestAccounts.find((teacher) => teacher.username.toLowerCase() === u && teacher.password === p);

    if (!match) {
      setError("Invalid username or password.");
      return;
    }

    setError("");
    onLogin(
      { name: match.name, username: match.username, position: match.position },
      { showIntro: false },
    );
  }

  function handleSignUp(e: React.FormEvent) {
    e.preventDefault();

    const nextName = signUp.name.trim();
    const nextUsername = signUp.username.trim().toLowerCase();
    const nextPosition = signUp.position.trim();
    const nextPassword = signUp.password.trim();
    const confirmPassword = signUp.confirmPassword.trim();

    if (!nextName || !nextUsername || !nextPosition || !nextPassword || !confirmPassword) {
      setError("All sign up fields are required.");
      return;
    }

    if (nextPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (nextPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (accounts.some((teacher) => teacher.username.toLowerCase() === nextUsername)) {
      setError("That username is already in use.");
      return;
    }

    const newTeacher: TeacherAccount = {
      name: nextName,
      username: nextUsername,
      position: nextPosition,
      password: nextPassword,
    };

    const nextAccounts = [...accounts, newTeacher];
    setAccounts(nextAccounts);
    saveTeacherAccounts(nextAccounts);
    setError("");
    setUsername(nextUsername);
    setPassword(nextPassword);
    setSignUp({ name: "", username: "", position: "", password: "", confirmPassword: "" });
    setMode("signin");
    onLogin(
      { name: newTeacher.name, username: newTeacher.username, position: newTeacher.position },
      { showIntro: true },
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0A0A0A] px-6 py-12 text-[#EDEDED]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(192,160,98,0.12),transparent_28%),radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.03),transparent_42%),linear-gradient(180deg,#050505_0%,#0A0A0A_42%,#070707_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_42%,rgba(0,0,0,0.62)_100%)]" />
      <div
        className="absolute inset-0 opacity-[0.045] mix-blend-soft-light"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[28rem]"
      >
        <div className="rounded-[28px] border border-white/8 bg-[rgba(12,12,12,0.82)] px-7 py-8 shadow-[0_40px_120px_rgba(0,0,0,0.72)] backdrop-blur-xl sm:px-9 sm:py-10">
          <div className="mb-10 flex flex-col items-center text-center">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.45 }}
              className="mb-4 flex h-[68px] w-[68px] items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.03] shadow-[0_20px_40px_rgba(0,0,0,0.45)]"
            >
              <img src="/logo.png" alt="DataVista logo" className="h-11 w-11 object-contain opacity-90" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.45 }}
              className="obsidian-title font-['Playfair_Display'] text-[2rem] font-semibold uppercase tracking-[0.42em] sm:text-[2.2rem]"
            >
              <span className="obsidian-title__text">DATA VISTA</span>
              <span aria-hidden="true" className="obsidian-title__shimmer">
                DATA VISTA
              </span>
            </motion.h1>
            <div className="mt-4 h-px w-24 bg-gradient-to-r from-transparent via-[#C0A062] to-transparent opacity-80" />
            <p className="mt-4 text-[11px] uppercase tracking-[0.35em] text-[#EDEDED]/48">Class Performance Analyzer</p>
          </div>

          <div className="mb-8 grid grid-cols-2 rounded-xl border border-white/8 bg-white/[0.025] p-1">
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className={`${modeButtonClass} ${mode === "signin" ? "bg-[#EDEDED] text-black shadow-[0_0_0_rgba(192,160,98,0)] hover:scale-[1.03] hover:bg-[#C0A062] hover:shadow-[0_0_12px_rgba(192,160,98,0.4)]" : "text-[#EDEDED]/48 hover:scale-[1.03] hover:bg-white/[0.04] hover:text-[#EDEDED]"}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className={`${modeButtonClass} ${mode === "signup" ? "bg-[#EDEDED] text-black shadow-[0_0_0_rgba(192,160,98,0)] hover:scale-[1.03] hover:bg-[#C0A062] hover:shadow-[0_0_12px_rgba(192,160,98,0.4)]" : "text-[#EDEDED]/48 hover:scale-[1.03] hover:bg-white/[0.04] hover:text-[#EDEDED]"}`}
            >
              Sign Up
            </button>
          </div>

          {mode === "signin" ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <AuthField label="Username">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className={inputClass}
                />
              </AuthField>

              <AuthField label="Password">
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className={`${inputClass} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((value) => !value)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 transform-gpu text-[#EDEDED]/42 transition-all duration-300 ease-in-out hover:scale-110 hover:text-[#C0A062] hover:brightness-125"
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <EyeOff className="h-[17px] w-[17px]" strokeWidth={1.6} /> : <Eye className="h-[17px] w-[17px]" strokeWidth={1.6} />}
                  </button>
                </div>
              </AuthField>

              {error ? (
                <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-center text-sm text-[#d08c8c]">
                  {error}
                </motion.p>
              ) : null}

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                type="submit"
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className={actionButtonClass}
              >
                <LogIn className="h-4 w-4" strokeWidth={1.8} />
                Sign In
              </motion.button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-5">
              <AuthField label="Full Name">
                <input
                  type="text"
                  value={signUp.name}
                  onChange={(e) => setSignUp((current) => ({ ...current, name: e.target.value }))}
                  placeholder="Enter full name"
                  className={inputClass}
                />
              </AuthField>

              <div className="grid gap-5 md:grid-cols-2">
                <AuthField label="Username">
                  <input
                    type="text"
                    value={signUp.username}
                    onChange={(e) => setSignUp((current) => ({ ...current, username: e.target.value }))}
                    placeholder="Choose username"
                    className={inputClass}
                  />
                </AuthField>

                <AuthField label="Position">
                  <input
                    type="text"
                    value={signUp.position}
                    onChange={(e) => setSignUp((current) => ({ ...current, position: e.target.value }))}
                    placeholder="e.g. Subject Teacher"
                    className={inputClass}
                  />
                </AuthField>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <AuthField label="Password">
                  <input
                    type="password"
                    value={signUp.password}
                    onChange={(e) => setSignUp((current) => ({ ...current, password: e.target.value }))}
                    placeholder="Create password"
                    className={inputClass}
                  />
                </AuthField>

                <AuthField label="Confirm Password">
                  <input
                    type="password"
                    value={signUp.confirmPassword}
                    onChange={(e) => setSignUp((current) => ({ ...current, confirmPassword: e.target.value }))}
                    placeholder="Confirm password"
                    className={inputClass}
                  />
                </AuthField>
              </div>

              {error ? (
                <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-center text-sm text-[#d08c8c]">
                  {error}
                </motion.p>
              ) : null}

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                type="submit"
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className={actionButtonClass}
              >
                <UserPlus className="h-4 w-4" strokeWidth={1.8} />
                Create Account
              </motion.button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function AuthField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="group">
      <label className="mb-2.5 block text-[11px] font-medium uppercase tracking-[0.24em] text-[#EDEDED]/60 transition-opacity duration-300 ease-in-out group-hover:opacity-100">
        {label}
      </label>
      {children}
    </div>
  );
}
