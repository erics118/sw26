interface ConfidenceChipProps {
  score?: number;
  label?: boolean;
}

export default function ConfidenceChip({
  score,
  label = false,
}: ConfidenceChipProps) {
  if (score === undefined) return null;

  const dots = score >= 0.85 ? 3 : score >= 0.6 ? 2 : 1;
  const color =
    score >= 0.85
      ? "text-emerald-400"
      : score >= 0.6
        ? "text-amber-400"
        : "text-red-400";
  const bgColor =
    score >= 0.85
      ? "bg-emerald-400"
      : score >= 0.6
        ? "bg-amber-400"
        : "bg-red-400";
  const title = `${Math.round(score * 100)}% confidence`;

  return (
    <span className={`inline-flex items-center gap-0.5 ${color}`} title={title}>
      {[1, 2, 3].map((d) => (
        <span
          key={d}
          className={`h-1.5 w-1.5 rounded-full ${d <= dots ? bgColor : "bg-zinc-700"}`}
        />
      ))}
      {label && (
        <span className="ml-1 font-mono text-xs">
          {Math.round(score * 100)}%
        </span>
      )}
    </span>
  );
}
