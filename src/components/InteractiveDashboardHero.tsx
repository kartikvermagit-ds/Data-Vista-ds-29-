import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import { ArrowRight, Sparkles, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

type InteractiveDashboardHeroProps = {
  studentsCount: number;
  averageScore: number;
  improvingCount: number;
  weakCount: number;
};

const floatingCards = [
  { label: "Live Trend", value: "Performance pulse", className: "top-5 right-5" },
  { label: "Focus Area", value: "Attendance + assignments", className: "bottom-6 left-5" },
];

export default function InteractiveDashboardHero({
  studentsCount,
  averageScore,
  improvingCount,
  weakCount,
}: InteractiveDashboardHeroProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const rotateX = useSpring(0, { stiffness: 180, damping: 18 });
  const rotateY = useSpring(0, { stiffness: 180, damping: 18 });
  const glowX = useMotionValue(50);
  const glowY = useMotionValue(50);

  const background = useMotionTemplate`
    radial-gradient(circle at ${glowX}% ${glowY}%, hsl(var(--gradient-accent) / 0.22), transparent 28%),
    linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--info) / 0.08), hsl(var(--background)))
  `;

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const bounds = cardRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const relativeX = (event.clientX - bounds.left) / bounds.width;
    const relativeY = (event.clientY - bounds.top) / bounds.height;

    glowX.set(relativeX * 100);
    glowY.set(relativeY * 100);
    rotateY.set((relativeX - 0.5) * 10);
    rotateX.set((0.5 - relativeY) * 10);
  }

  function handlePointerLeave() {
    rotateX.set(0);
    rotateY.set(0);
    glowX.set(50);
    glowY.set(50);
  }

  return (
    <motion.section
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ rotateX, rotateY, background }}
      className="relative overflow-hidden rounded-[2rem] border border-white/40 p-6 shadow-[0_30px_80px_-40px_hsl(var(--primary)/0.45)] [transform-style:preserve-3d] md:p-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,hsl(var(--primary)/0.08)_35%,transparent_65%)]" />
      <div className="absolute -left-12 top-10 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-48 w-48 rounded-full bg-info/15 blur-3xl" />

      {floatingCards.map((item, index) => (
        <motion.div
          key={item.label}
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4 + index, repeat: Infinity, ease: "easeInOut" }}
          className={`pointer-events-none absolute hidden rounded-2xl border border-white/50 bg-white/55 px-4 py-3 shadow-lg backdrop-blur md:block ${item.className}`}
        >
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{item.label}</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{item.value}</p>
        </motion.div>
      ))}

      <div className="relative z-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/70 px-3 py-1 text-xs font-medium text-primary backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Interactive class snapshot
          </div>

          <div className="space-y-3">
            <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight text-foreground md:text-5xl">
              Your classroom data now reacts to every move.
            </h1>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
              Hover across this panel to reveal the live spotlight, then jump straight into analysis or add more student data to keep the dashboard moving.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/analysis">
              <Button className="gap-2 gradient-primary border-0 text-primary-foreground shadow-lg shadow-primary/25">
                Explore Analysis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/add">
              <Button variant="outline" className="gap-2 bg-background/70">
                <UserPlus className="h-4 w-4" />
                Add Another Student
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {[
            { label: "Students tracked", value: studentsCount, accent: "from-primary/25 to-primary/5" },
            { label: "Average score", value: `${averageScore}%`, accent: "from-info/25 to-info/5" },
            { label: "Improving", value: improvingCount, accent: "from-success/25 to-success/5" },
            { label: "Need support", value: weakCount, accent: "from-destructive/25 to-destructive/5" },
          ].map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * index, duration: 0.4 }}
              className={`rounded-2xl border border-white/45 bg-gradient-to-br ${item.accent} p-4 backdrop-blur`}
            >
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight">{item.value}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
