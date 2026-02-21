const STEPS = ["new", "pricing", "sent", "negotiating", "confirmed"] as const;
const LABELS: Record<string, string> = {
  new: "New",
  pricing: "Pricing",
  sent: "Sent",
  negotiating: "Negotiating",
  confirmed: "Confirmed",
};

interface StatusStepperProps {
  status: string;
}

export default function StatusStepper({ status }: StatusStepperProps) {
  if (status === "lost" || status === "completed") {
    const color = status === "completed" ? "text-emerald-400" : "text-red-400";
    return (
      <div className={`text-sm font-medium ${color} tracking-wider uppercase`}>
        {status}
      </div>
    );
  }

  const currentIdx = STEPS.indexOf(status as (typeof STEPS)[number]);

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                  active
                    ? "border-amber-400 bg-amber-400 text-zinc-950"
                    : done
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                      : "border-zinc-700 bg-zinc-800 text-zinc-600"
                }`}
              >
                {done ? "✓" : idx + 1}
              </div>
              <span
                className={`mt-1 text-xs whitespace-nowrap ${
                  active
                    ? "text-amber-400"
                    : done
                      ? "text-emerald-500"
                      : "text-zinc-600"
                }`}
              >
                {LABELS[step]}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`mx-1 mb-4 h-px w-12 ${
                  done ? "bg-emerald-500" : "bg-zinc-700"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
