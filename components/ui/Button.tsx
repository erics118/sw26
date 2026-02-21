"use client";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const variants = {
  primary:
    "bg-amber-400 text-zinc-950 hover:bg-amber-300 font-semibold shadow-sm shadow-amber-400/20",
  secondary:
    "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700",
  ghost: "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800",
  danger:
    "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled ?? loading}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-md transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
