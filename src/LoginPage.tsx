import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import type { Teacher } from "./lib/auth";
import { teacherFromAuthUser } from "./lib/auth";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

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
  "h-12 w-full rounded-lg border border-[#222222] bg-[#111111]/90 px-4 text-sm text-[#EDEDED] placeholder:text-[#555555] caret-[#C0A062] outline-none transition-[border-color,box-shadow,background-color,color] [transition-duration:250ms] ease-in-out hover:border-[#C0A062] hover:bg-[#15120B] hover:shadow-[0_0_0_1px_rgba(192,160,98,0.28),0_0_18px_rgba(192,160,98,0.1)] focus:border-[#C0A062] focus:bg-[#15120B] focus:shadow-[0_0_0_1px_rgba(192,160,98,0.42),0_0_16px_rgba(192,160,98,0.12)]";

const actionButtonClass =
  "mt-2 flex h-12 w-full transform-gpu items-center justify-center gap-2 rounded-lg bg-[#EDEDED] text-[11px] font-semibold uppercase tracking-[0.3em] text-black shadow-[0_0_0_rgba(192,160,98,0)] transition-all duration-300 ease-in-out hover:scale-[1.02] hover:bg-[#D7C39A] hover:shadow-[0_8px_24px_rgba(192,160,98,0.16)]";

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
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [signUp, setSignUp] = useState({
    name: "",
    email: "",
    phone: "",
    position: "",
    password: "",
    confirmPassword: "",
    otp: "",
  });

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError("");
    setStatus("");
    setShowPass(false);
    setOtpSent(false);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const p = password.trim();
    setSubmitting(true);
    setError("");

    if (isSupabaseConfigured && supabase) {
      const nextIdentifier = identifier.trim();

      if (!nextIdentifier || !p) {
        setError("Email or phone and password are required.");
        setSubmitting(false);
        return;
      }

      const nextPhone = normalizePhone(nextIdentifier);
      const credentials = nextPhone ? { phone: nextPhone, password: p } : { email: nextIdentifier.toLowerCase(), password: p };
      const { data, error: signInError } = await supabase.auth.signInWithPassword(credentials);

      if (signInError || !data.user) {
        setError(signInError?.message ?? "Unable to sign in.");
        setSubmitting(false);
        return;
      }

      onLogin(teacherFromAuthUser(data.user), { showIntro: true });
      setSubmitting(false);
      return;
    }

    const u = identifier.trim().toLowerCase();
    const latestAccounts = loadTeacherAccounts();
    setAccounts(latestAccounts);
    const match = latestAccounts.find((teacher) => (teacher.username.toLowerCase() === u || teacher.email?.toLowerCase() === u) && teacher.password === p);

    if (!match) {
      setError("Invalid credentials.");
      setSubmitting(false);
      return;
    }

    onLogin(
      { name: match.name, username: match.username, position: match.position },
      { showIntro: true },
    );
    setSubmitting(false);
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();

    const nextName = signUp.name.trim();
    const nextEmail = signUp.email.trim().toLowerCase();
    const nextPhone = normalizePhone(signUp.phone);
    const nextPosition = signUp.position.trim();
    const nextPassword = signUp.password.trim();
    const confirmPassword = signUp.confirmPassword.trim();
    const otp = signUp.otp.trim();
    setSubmitting(true);
    setError("");
    setStatus("");

    if (!nextName || !nextPosition || !nextPassword || !confirmPassword || !nextPhone || (isSupabaseConfigured && !nextEmail)) {
      setError("All sign up fields are required.");
      setSubmitting(false);
      return;
    }

    if (nextPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      setSubmitting(false);
      return;
    }

    if (nextPassword !== confirmPassword) {
      setError("Passwords do not match.");
      setSubmitting(false);
      return;
    }

    if (isSupabaseConfigured && !/^\S+@\S+\.\S+$/.test(nextEmail)) {
      setError("Enter a valid email address.");
      setSubmitting(false);
      return;
    }

    if (!nextPhone) {
      setError("Enter a valid phone number.");
      setSubmitting(false);
      return;
    }

    if (isSupabaseConfigured && supabase) {
      if (!otpSent) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: nextEmail,
          password: nextPassword,
          options: {
            data: {
              name: nextName,
              username: nextEmail.split("@")[0],
              phone: nextPhone,
              position: nextPosition,
            },
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          setSubmitting(false);
          return;
        }

        if (!signUpData.user || !signUpData.session) {
          setError("Disable email confirmation in Supabase or confirm email first before phone verification.");
          setSubmitting(false);
          return;
        }

        const { error: phoneUpdateError } = await supabase.auth.updateUser({
          phone: nextPhone,
          data: {
            name: nextName,
            username: nextEmail.split("@")[0],
            phone: nextPhone,
            position: nextPosition,
          },
        });

        if (phoneUpdateError) {
          setError(phoneUpdateError.message);
          setSubmitting(false);
          return;
        }

        setOtpSent(true);
        setStatus(`Verification code sent to ${nextPhone}. Enter the 6-digit OTP to finish sign up.`);
        setSubmitting(false);
        return;
      }

      if (!otp || otp.length !== 6) {
        setError("Enter the 6-digit OTP.");
        setSubmitting(false);
        return;
      }

      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        phone: nextPhone,
        token: otp,
        type: "phone_change",
      });

      if (verifyError || !verifyData.user) {
        setError(verifyError?.message ?? "Unable to verify phone number.");
        setSubmitting(false);
        return;
      }

      setIdentifier(nextEmail);
      setPassword(nextPassword);
      setSignUp({ name: "", email: "", phone: "", position: "", password: "", confirmPassword: "", otp: "" });
      setOtpSent(false);
      onLogin(teacherFromAuthUser(verifyData.user), { showIntro: true });
      setSubmitting(false);
      return;
    }

    const newTeacher: TeacherAccount = {
      name: nextName,
      username: nextPhone,
      position: nextPosition,
      email: nextEmail || nextPhone,
      password: nextPassword,
    };

    const nextAccounts = [...accounts, newTeacher];
    setAccounts(nextAccounts);
    saveTeacherAccounts(nextAccounts);
    setIdentifier(nextEmail || nextPhone);
    setPassword(nextPassword);
    setSignUp({ name: "", email: "", phone: "", position: "", password: "", confirmPassword: "", otp: "" });
    setMode("signin");
    onLogin(
      { name: newTeacher.name, username: newTeacher.username, position: newTeacher.position },
      { showIntro: true },
    );
    setSubmitting(false);
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
              className="obsidian-title cursor-pointer font-['Playfair_Display'] text-[2rem] font-semibold uppercase tracking-[0.42em] transition-all duration-300 hover:scale-[1.035] hover:text-[#F7E7B0] sm:text-[2.2rem]"
              style={{ textShadow: "0 0 18px rgba(192,160,98,0.18)" }}
            >
              <span className="obsidian-title__text text-[#D8C28B] transition-all duration-300 hover:text-[#FFE08A] hover:[text-shadow:0_0_18px_rgba(255,224,138,0.75),0_0_36px_rgba(232,186,73,0.52),0_0_60px_rgba(255,214,102,0.28)]">DATA VISTA</span>
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
              className={`${modeButtonClass} ${mode === "signin" ? "bg-[#EDEDED] text-black hover:scale-[1.02] hover:bg-[#EDEDED]" : "text-[#EDEDED]/48 hover:scale-[1.02] hover:bg-white/[0.04] hover:text-[#EDEDED]"}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className={`${modeButtonClass} ${mode === "signup" ? "bg-[#EDEDED] text-black hover:scale-[1.02] hover:bg-[#EDEDED]" : "text-[#EDEDED]/48 hover:scale-[1.02] hover:bg-white/[0.04] hover:text-[#EDEDED]"}`}
            >
              Sign Up
            </button>
          </div>

          {mode === "signin" ? (
            <form onSubmit={handleLogin} className="space-y-5">
              {isSupabaseConfigured ? (
                <AuthField label="Email or Phone">
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter email or +91 phone"
                    className={inputClass}
                  />
                </AuthField>
              ) : (
                <AuthField label="Username or Phone">
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter username or phone"
                    className={inputClass}
                  />
                </AuthField>
              )}

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

              {status ? (
                <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-center text-sm text-[#9bbf9a]">
                  {status}
                </motion.p>
              ) : null}

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                type="submit"
                transition={{ duration: 0.3, ease: "easeInOut" }}
                disabled={submitting}
                className={actionButtonClass}
              >
                <LogIn className="h-4 w-4" strokeWidth={1.8} />
                {submitting ? "Please Wait" : "Sign In"}
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
                {isSupabaseConfigured ? (
                  <AuthField label="Email">
                    <input
                      type="email"
                      value={signUp.email}
                      onChange={(e) => setSignUp((current) => ({ ...current, email: e.target.value }))}
                      placeholder="Enter email"
                      className={inputClass}
                    />
                  </AuthField>
                ) : null}

                <AuthField label="Phone Number">
                  <input
                    type="tel"
                    value={signUp.phone}
                    onChange={(e) => setSignUp((current) => ({ ...current, phone: e.target.value }))}
                    placeholder="Enter +91 phone number"
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

              {otpSent ? (
                <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
                  <AuthField label="Phone OTP">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={signUp.otp}
                      onChange={(e) => setSignUp((current) => ({ ...current, otp: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                      placeholder="Enter 6-digit OTP"
                      className={inputClass}
                    />
                  </AuthField>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    disabled={submitting}
                    onClick={() => {
                      setOtpSent(false);
                      setStatus("");
                      setSignUp((current) => ({ ...current, otp: "" }));
                    }}
                    className="h-12 rounded-lg border border-white/10 px-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#EDEDED]/80 transition-colors hover:bg-white/[0.04]"
                  >
                    Resend OTP
                  </motion.button>
                </div>
              ) : null}

              {error ? (
                <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-center text-sm text-[#d08c8c]">
                  {error}
                </motion.p>
              ) : null}

              {status ? (
                <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-center text-sm text-[#9bbf9a]">
                  {status}
                </motion.p>
              ) : null}

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                type="submit"
                transition={{ duration: 0.3, ease: "easeInOut" }}
                disabled={submitting}
                className={actionButtonClass}
              >
                <UserPlus className="h-4 w-4" strokeWidth={1.8} />
                {submitting ? "Please Wait" : otpSent ? "Verify Phone" : "Create Account"}
              </motion.button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function normalizePhone(value: string) {
  const compact = value.replace(/[^\d+]/g, "");

  if (/^\+\d{10,15}$/.test(compact)) {
    return compact;
  }

  const digits = compact.replace(/\D/g, "");

  if (/^\d{10}$/.test(digits)) {
    return `+91${digits}`;
  }

  if (/^91\d{10}$/.test(digits)) {
    return `+${digits}`;
  }

  return "";
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
