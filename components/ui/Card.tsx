interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export default function Card({
  children,
  className = "",
  padding = true,
}: CardProps) {
  return (
    <div
      className={`rounded-lg border border-zinc-800 bg-zinc-900 ${padding ? "p-5" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-4 flex items-center justify-between ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
      {children}
    </h3>
  );
}
