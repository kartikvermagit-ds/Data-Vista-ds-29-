import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import App from "./App.tsx";
import LoginPage from "./LoginPage.tsx";
import type { Teacher } from "./lib/auth";
import { teacherFromAuthUser } from "./lib/auth";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import "./index.css";
import { Toaster } from "./components/ui/sonner";

const AUTH_STORAGE_KEY = "datavista_active_teacher";

function loadActiveTeacher() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Teacher) : null;
  } catch {
    return null;
  }
}

function Root() {
  const [teacher, setTeacher] = useState<Teacher | null>(() => (isSupabaseConfigured ? null : loadActiveTeacher()));
  const [pendingTeacher, setPendingTeacher] = useState<Teacher | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data }) => {
        setTeacher(data.session?.user ? teacherFromAuthUser(data.session.user) : null);
        setAuthReady(true);
      });

      const { data } = supabase.auth.onAuthStateChange((_, session) => {
        setTeacher(session?.user ? teacherFromAuthUser(session.user) : null);
        setAuthReady(true);
      });

      return () => {
        data.subscription.unsubscribe();
      };
    }
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    if (typeof window === "undefined") return;

    if (teacher) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(teacher));
      return;
    }

    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }, [teacher]);

  if (!authReady) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm uppercase tracking-[0.3em] text-slate-300">Loading Session</div>;
  }

  if (!teacher && !pendingTeacher) {
    return (
      <LoginPage
        onLogin={(nextTeacher, options) => {
          if (options?.showIntro) {
            setPendingTeacher(nextTeacher);
            return;
          }

          setTeacher(nextTeacher);
        }}
      />
    );
  }

  if (pendingTeacher) {
    return (
      <SignupIntroScreen
        onComplete={() => {
          setTeacher(pendingTeacher);
          setPendingTeacher(null);
        }}
      />
    );
  }

  return (
    <>
      <App
        teacher={teacher}
        onLogout={() => {
          if (isSupabaseConfigured && supabase) {
            void supabase.auth.signOut();
          }
          setTeacher(null);
          setPendingTeacher(null);
        }}
      />
      <Toaster richColors position="top-right" />
    </>
  );
}

function SignupIntroScreen({ onComplete }: { onComplete: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    videoRef.current?.play().catch(() => {});
  }, []);

  async function handleToggleMute() {
    const video = videoRef.current;
    if (!video) return;

    const nextMuted = !isMuted;
    video.muted = nextMuted;
    if (!nextMuted) {
      video.volume = 1;
      await video.play().catch(() => {});
    }
    setIsMuted(nextMuted);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950">
      <video
        ref={videoRef}
        className="h-screen w-screen object-cover"
        src="/signup-intro.mp4"
        autoPlay
        muted={isMuted}
        playsInline
        onEnded={onComplete}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-slate-950/30" />
      <button
        type="button"
        onClick={handleToggleMute}
        className="absolute bottom-8 left-8 flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/75 px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white backdrop-blur transition-all duration-300 ease-in-out hover:bg-slate-900"
      >
        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        {isMuted ? "Unmute" : "Mute"}
      </button>
      <button
        type="button"
        onClick={onComplete}
        className="absolute bottom-8 right-8 rounded-full border border-white/15 bg-slate-950/75 px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white backdrop-blur transition hover:bg-slate-900"
      >
        Skip
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
