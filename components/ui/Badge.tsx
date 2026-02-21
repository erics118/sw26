interface BadgeProps {
  children: React.ReactNode;
  variant?: "amber" | "green" | "red" | "yellow" | "blue" | "zinc";
  size?: "sm" | "md";
}

const variants: Record<string, string> = {
  amber: "bg-amber-400/10 text-amber-400 border-amber-400/20",
  green: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  red: "bg-red-400/10 text-red-400 border-red-400/20",
  yellow: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20",
  blue: "bg-sky-400/10 text-sky-400 border-sky-400/20",
  zinc: "bg-zinc-700/50 text-zinc-400 border-zinc-600/40",
};

export function statusVariant(status: string): string {
  const map: Record<string, string> = {
    new: "zinc",
    pricing: "yellow",
    sent: "blue",
    negotiating: "amber",
    confirmed: "green",
    lost: "red",
    completed: "green",
  };
  return map[status] ?? "zinc";
}

export default function Badge({
  children,
  variant = "zinc",
  size = "sm",
}: BadgeProps) {
  const sizeClass =
    size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";
  return (
    <span
      className={`inline-flex items-center rounded border font-medium tracking-wide uppercase ${sizeClass} ${variants[variant] ?? variants.zinc}`}
    >
      {children}
    </span>
  );
}
