"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";

interface Props {
  clientId: string;
}

export default function ClientActionCard({ clientId }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    summary: string;
    next_action: string;
  } | null>(null);
  const [error, setError] = useState("");

  async function handleGetAction() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/clients/${clientId}/action`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        summary?: string;
        next_action?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setResult({
        summary: data.summary ?? "",
        next_action: data.next_action ?? "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Intelligence</CardTitle>
      </CardHeader>
      {result ? (
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-zinc-600">Summary</p>
            <p className="mt-0.5 text-zinc-300">{result.summary}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-600">Recommended Action</p>
            <p className="mt-0.5 text-amber-400">{result.next_action}</p>
          </div>
          <button
            onClick={() => setResult(null)}
            className="text-xs text-zinc-700 hover:text-zinc-500"
          >
            Reset
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <Button
            onClick={() => void handleGetAction()}
            loading={loading}
            variant="secondary"
            size="sm"
            className="w-full justify-center"
          >
            Get next action
          </Button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
    </Card>
  );
}
