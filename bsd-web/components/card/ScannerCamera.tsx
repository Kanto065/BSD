"use client";

import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";
import { MERCHANT_LABELS as T } from "@/lib/card-labels";

// Live camera for the till. getUserMedia plus jsQR (small, no UI of its own). Reads about six frames a second, which is
// plenty for a QR on a phone screen and keeps cheap tills cool. `paused` keeps the stream but stops reading.

export type CameraProblem = "denied" | "missing";

export default function ScannerCamera({ paused, onRead, onProblem }: { paused: boolean; onRead: (text: string) => void; onProblem: (p: CameraProblem) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<MediaStreamTrack | null>(null);
  const pausedRef = useRef(paused);
  const readRef = useRef(onRead);
  const [torch, setTorch] = useState<boolean | null>(null); // null means the phone has no torch
  pausedRef.current = paused;
  readRef.current = onRead;

  useEffect(() => {
    let stop = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    function tick() {
      const v = video.current;
      if (!stop && v && ctx && !pausedRef.current && v.readyState >= 2 && v.videoWidth) {
        const scale = Math.min(1, 640 / v.videoWidth);
        canvas.width = Math.round(v.videoWidth * scale);
        canvas.height = Math.round(v.videoHeight * scale);
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (hit?.data) readRef.current(hit.data);
      }
      if (!stop) timer = setTimeout(tick, 160);
    }

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return onProblem("missing");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch (e) {
        return onProblem(e instanceof DOMException && (e.name === "NotFoundError" || e.name === "OverconstrainedError") ? "missing" : "denied");
      }
      if (stop) return stream.getTracks().forEach((t) => t.stop());
      const t = stream.getVideoTracks()[0];
      track.current = t ?? null;
      const caps = (t?.getCapabilities?.() ?? {}) as { torch?: boolean };
      setTorch(caps.torch ? false : null);
      if (video.current) {
        video.current.srcObject = stream;
        await video.current.play().catch(() => undefined);
      }
      tick();
    })();

    return () => {
      stop = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function flip() {
    const next = !torch;
    try {
      await track.current?.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorch(next);
    } catch {
      setTorch(null);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <video ref={video} playsInline muted className="aspect-square w-full object-cover" aria-label="Camera view" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-white/70" />
      {torch !== null && (
        <button type="button" onClick={() => void flip()} aria-pressed={torch} className="absolute bottom-3 right-3 inline-flex min-h-[44px] items-center rounded-full bg-black/60 px-4 text-sm font-semibold text-white ring-1 ring-white/40">
          {T.torch}
        </button>
      )}
    </div>
  );
}
