"use client";

import { AlertCircle, Lock } from "lucide-react";

export const CAMERA_PERMISSION_DENIED_MESSAGE =
  "Please click the Lock icon in your browser address bar and Enable Camera.";

export function cameraErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError") {
      return CAMERA_PERMISSION_DENIED_MESSAGE;
    }
    if (err.name === "NotFoundError") {
      return "No camera found on this device.";
    }
    if (err.name === "NotReadableError") {
      return "Camera is in use by another application.";
    }
    if (err.name === "SecurityError") {
      return "Camera requires HTTPS. Open ForgeGuard over a secure connection.";
    }
  }
  return "Could not access camera. Check permissions and try again.";
}

export function isCameraPermissionDenied(err: unknown): boolean {
  return err instanceof DOMException && err.name === "NotAllowedError";
}

export function CameraPermissionOverlay({
  message,
  compact = false,
}: {
  message?: string;
  compact?: boolean;
}) {
  const text = message ?? CAMERA_PERMISSION_DENIED_MESSAGE;

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-center ${
        compact ? "px-4 py-3" : "px-6 py-4"
      }`}
      style={{
        background: "rgba(5,5,5,0.85)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div className="flex items-center gap-2">
        <Lock size={compact ? 14 : 16} className="text-amber-400/90" strokeWidth={1.5} />
        <AlertCircle size={compact ? 14 : 16} className="text-red-400/80" strokeWidth={1.5} />
      </div>
      <p
        className={`font-mono uppercase tracking-[0.12em] text-amber-300/90 ${
          compact ? "text-[9px] leading-relaxed" : "text-[10px] leading-relaxed"
        }`}
      >
        {text}
      </p>
    </div>
  );
}
