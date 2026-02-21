import ConfidenceChip from "@/components/ui/ConfidenceChip";

export default function FieldInput({
  label,
  value,
  onChange,
  confidence,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  confidence?: number;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
          {label}
        </label>
        <ConfidenceChip score={confidence} label />
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "—"}
        className="amber-glow w-full rounded border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 transition-colors focus:border-amber-400"
      />
    </div>
  );
}
