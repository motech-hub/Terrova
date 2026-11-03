"use client";

import { AlertCircle, CheckCircle2, X } from "lucide-react";

export function NotificationToast({
  message,
  onClose,
  type = "success",
}: {
  message: string | null;
  onClose: () => void;
  type?: "success" | "error";
}) {
  if (!message) return null;

  const isError = type === "error";

  return (
    <div className="notification-toast-region">
      <div aria-live={isError ? "assertive" : "polite"} className={`notification-toast notification-toast-${type}`} role={isError ? "alert" : "status"}>
        {isError ? <AlertCircle aria-hidden="true" size={19} /> : <CheckCircle2 aria-hidden="true" size={19} />}
        <p>{message}</p>
        <button aria-label="Fermer la notification" className="notification-toast-close" onClick={onClose} type="button">
          <X aria-hidden="true" size={16} />
        </button>
      </div>
    </div>
  );
}
