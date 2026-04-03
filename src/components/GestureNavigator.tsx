import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Hand, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";

const routes = [
  { path: "/", label: "Dashboard" },
  { path: "/add", label: "Add Student" },
  { path: "/students", label: "Students" },
  { path: "/analysis", label: "Analysis" },
];

const SWIPE_THRESHOLD = 90;
const STORAGE_KEY = "datavista-gesture-navigation";

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest("button, a, input, textarea, select, [role='switch']"));
}

export default function GestureNavigator() {
  const navigate = useNavigate();
  const location = useLocation();
  const [gestureEnabled, setGestureEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === null ? true : saved === "true";
  });
  const [swipeMessage, setSwipeMessage] = useState<string | null>(null);

  const currentIndex = routes.findIndex(route => route.path === location.pathname);

  const routeContext = useMemo(() => {
    if (currentIndex === -1) {
      return null;
    }

    return {
      previous: routes[(currentIndex - 1 + routes.length) % routes.length],
      next: routes[(currentIndex + 1) % routes.length],
    };
  }, [currentIndex]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(gestureEnabled));
  }, [gestureEnabled]);

  useEffect(() => {
    if (!gestureEnabled) {
      return;
    }

    let startX = 0;
    let startY = 0;
    let active = false;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || isInteractiveTarget(event.target)) {
        active = false;
        return;
      }

      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      active = true;
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!active || !routeContext) {
        return;
      }

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY)) {
        return;
      }

      const destination = deltaX < 0 ? routeContext.next : routeContext.previous;
      setSwipeMessage(`${deltaX < 0 ? "Left" : "Right"} swipe: ${destination.label}`);
      navigate(destination.path);
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [gestureEnabled, navigate, routeContext]);

  useEffect(() => {
    if (!swipeMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setSwipeMessage(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [swipeMessage]);

  if (!routeContext) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 max-w-xs rounded-2xl border border-border/60 bg-background/90 p-3 shadow-xl backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary">
            <Hand className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Gesture Navigation</p>
                <p className="text-xs text-muted-foreground">Swipe between app pages</p>
              </div>
              <Switch checked={gestureEnabled} onCheckedChange={setGestureEnabled} aria-label="Toggle gesture navigation" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="rounded-xl bg-muted/50 px-2.5 py-2">
                <div className="mb-1 flex items-center gap-1 text-foreground">
                  <ChevronRight className="h-3.5 w-3.5" />
                  Swipe left
                </div>
                <p>{routeContext.next.label}</p>
              </div>
              <div className="rounded-xl bg-muted/50 px-2.5 py-2">
                <div className="mb-1 flex items-center gap-1 text-foreground">
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Swipe right
                </div>
                <p>{routeContext.previous.label}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {swipeMessage ? (
          <motion.div
            key={swipeMessage}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full border border-primary/20 bg-background/95 px-4 py-2 text-sm font-medium text-foreground shadow-lg backdrop-blur"
          >
            {swipeMessage}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
