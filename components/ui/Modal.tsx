"use client";

import { useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizes = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-2xl" };

export default function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={`relative mx-4 w-full rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl ${sizes[size]} slide-in`}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
            <h2 className="text-sm font-semibold tracking-wide text-zinc-100">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-zinc-500 transition-colors hover:text-zinc-200"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
