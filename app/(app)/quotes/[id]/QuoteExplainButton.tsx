"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

interface Props {
  quoteId: string;
}

export default function QuoteExplainButton({ quoteId }: Props) {
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState("");

  async function handleExplain() {
    setExplaining(true);
    setError("");
    try {
      const res = await fetch(`/api/quotes/${quoteId}/explain`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        explanation?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setExplanation(data.explanation ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to explain quote");
    } finally {
      setExplaining(false);
    }
  }

  if (explanation) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
            Quote Explanation
          </span>
          <button
            onClick={() => setExplanation("")}
            className="text-xs text-zinc-700 hover:text-zinc-500"
          >
            ✕
          </button>
        </div>
        <p className="text-sm leading-relaxed text-zinc-300">{explanation}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={() => void handleExplain()}
        loading={explaining}
        variant="ghost"
        size="sm"
      >
        Explain this quote
      </Button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
