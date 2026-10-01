"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "./Button";
import { cn } from "./cn";

type Tone = "success" | "danger" | "neutral";
type ToastItem = { id: number; message: string; tone: Tone };
type ShowToast = (message: string, tone?: Tone) => void;

const ToastContext = createContext<ShowToast>(() => {});

/** Shows a short confirmation ("Accepted A4's order."). Needs a ToastProvider above it. */
export function useToast(): ShowToast {
  return useContext(ToastContext);
}

const tones: Record<Tone, string> = {
  success: "border-success",
  danger: "border-danger",
  neutral: "border-border",
};

function ToastView({
  toast,
  duration,
  onDismiss,
}: {
  toast: ToastItem;
  duration: number;
  onDismiss: (id: number) => void;
}) {
  // Hovering or focusing a toast holds it, so nobody has to read against the clock.
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (held) return;
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [held, toast.id, duration, onDismiss]);

  return (
    <div
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      className={cn(
        "pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-card border-2 bg-surface-raised py-2 pr-2 pl-4 text-text shadow-lg",
        "animate-[toast-in_200ms_ease-out] motion-reduce:animate-none",
        tones[toast.tone],
      )}
    >
      <p>{toast.message}</p>
      <Button variant="ghost" onClick={() => onDismiss(toast.id)}>
        Dismiss
      </Button>
    </div>
  );
}

/**
 * Toasts for the staff portal: one polite live region (role="status"), newest at the
 * bottom, at most three, each gone after `duration` ms unless held. The entrance slide is
 * skipped under prefers-reduced-motion.
 */
export function ToastProvider({
  children,
  duration = 5_000,
}: {
  children: ReactNode;
  duration?: number;
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const show = useCallback<ShowToast>((message, tone = "success") => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
  }, []);
  const dismiss = useCallback(
    (id: number) => setToasts((current) => current.filter((t) => t.id !== id)),
    [],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 print:hidden"
      >
        {toasts.map((toast) => (
          <ToastView key={toast.id} toast={toast} duration={duration} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
