import { Camera, Hand, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { RefObject } from "react";

type CameraGesturePanelProps = {
  title: string;
  description: string;
  videoRef: RefObject<HTMLVideoElement>;
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
  lastGestureLabel?: string | null;
  gestures: Array<{ name: string; action: string }>;
  onStop: () => void;
};

export default function CameraGesturePanel({
  title,
  description,
  videoRef,
  isActive,
  isLoading,
  error,
  lastGestureLabel,
  gestures,
  onStop,
}: CameraGesturePanelProps) {
  return (
    <Card className="overflow-hidden border-primary/15 bg-background/80 backdrop-blur">
      <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2 text-primary">
            <Hand className="h-5 w-5" />
            <p className="text-sm font-semibold uppercase tracking-[0.18em]">Camera Gesture Control</p>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {gestures.map(gesture => (
              <div key={gesture.name} className="rounded-2xl border border-border/70 bg-muted/40 p-3">
                <p className="text-sm font-semibold text-foreground">{gesture.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{gesture.action}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {isLoading ? "Starting camera..." : isActive ? "Camera live" : "Camera stopped"}
            </div>
            {lastGestureLabel ? (
              <div className="rounded-full bg-info/10 px-3 py-1 text-xs font-medium text-info">
                Last gesture: {lastGestureLabel}
              </div>
            ) : null}
            {isActive ? (
              <Button type="button" variant="outline" size="sm" onClick={onStop}>
                Stop Camera
              </Button>
            ) : null}
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <div className="relative min-h-[260px] bg-slate-950">
          <video ref={videoRef} muted playsInline className="h-full min-h-[260px] w-full object-cover [transform:scaleX(-1)]" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/15" />
          <div className="absolute left-4 top-4 rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            <span className="inline-flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5" />
              Live recognition
            </span>
          </div>
          {!isActive ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-white">
              <div>
                {isLoading ? <Loader2 className="mx-auto h-8 w-8 animate-spin" /> : <Hand className="mx-auto h-8 w-8" />}
                <p className="mt-3 text-sm font-medium">{isLoading ? "Waiting for camera permission..." : "Enable camera access to use gestures"}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
