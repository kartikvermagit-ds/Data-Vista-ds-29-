import { useEffect, useRef, useState, type RefObject } from "react";
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";

type GestureAction = {
  categoryName: string;
  score: number;
};

type UseCameraHandGesturesOptions = {
  enabled?: boolean;
  cooldownMs?: number;
  onGesture?: (gesture: GestureAction) => void;
};

type UseCameraHandGesturesResult = {
  videoRef: RefObject<HTMLVideoElement>;
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
  lastGesture: GestureAction | null;
  stop: () => void;
};

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task";

export function useCameraHandGestures({
  enabled = true,
  cooldownMs = 1800,
  onGesture,
}: UseCameraHandGesturesOptions = {}): UseCameraHandGesturesResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastGestureTimeRef = useRef(0);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGesture, setLastGesture] = useState<GestureAction | null>(null);
  const onGestureRef = useRef(onGesture);

  useEffect(() => {
    onGestureRef.current = onGesture;
  }, [onGesture]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!enabled || !videoRef.current) {
        return;
      }

      const hostname = window.location.hostname;
      const isLocalhost =
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1";

      if (!window.isSecureContext && !isLocalhost) {
        setError("Camera needs HTTPS or localhost. Open this app on localhost, or serve it over HTTPS to use hand gestures.");
        setIsLoading(false);
        setIsActive(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();

        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        const recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });

        if (cancelled) {
          recognizer.close();
          return;
        }

        recognizerRef.current = recognizer;
        setIsActive(true);

        const detect = () => {
          if (!videoRef.current || !recognizerRef.current) {
            return;
          }

          if (videoRef.current.readyState >= 2 && videoRef.current.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = videoRef.current.currentTime;
            const now = performance.now();
            const result = recognizerRef.current.recognizeForVideo(videoRef.current, now);
            const topGesture = result.gestures[0]?.[0];

            if (topGesture && topGesture.score >= 0.7 && now - lastGestureTimeRef.current >= cooldownMs) {
              const gesture = {
                categoryName: topGesture.categoryName,
                score: topGesture.score,
              };
              lastGestureTimeRef.current = now;
              setLastGesture(gesture);
              onGestureRef.current?.(gesture);
            }
          }

          frameRef.current = window.requestAnimationFrame(detect);
        };

        frameRef.current = window.requestAnimationFrame(detect);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Camera access failed";
        if (message.toLowerCase().includes("permission")) {
          setError("Camera permission was denied. Allow camera access in your browser settings and reload the page.");
        } else {
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    start();

    return () => {
      cancelled = true;

      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }

      recognizerRef.current?.close();
      recognizerRef.current = null;

      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }

      setIsActive(false);
    };
  }, [cooldownMs, enabled]);

  function stop() {
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    recognizerRef.current?.close();
    recognizerRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setIsActive(false);
    setIsLoading(false);
  }

  return { videoRef, isActive, isLoading, error, lastGesture, stop };
}
