import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import App from "./App.tsx";
import LoginPage from "./LoginPage.tsx";
import type { Teacher } from "./LoginPage.tsx";
import "./index.css";
import { Toaster } from "./components/ui/sonner";

function Root() {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [pendingTeacher, setPendingTeacher] = useState<Teacher | null>(null);

  if (!teacher && !pendingTeacher) {
    return <LoginPage onLogin={(t) => setPendingTeacher(t)} />;
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
      <App teacher={teacher} onLogout={() => setTeacher(null)} />
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
