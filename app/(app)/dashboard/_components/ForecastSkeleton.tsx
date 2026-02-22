import { KPISkeleton } from "./KPICard";

export function ForecastKPISkeleton() {
  return (
    <>
      <KPISkeleton />
      <KPISkeleton />
      <KPISkeleton />
    </>
  );
}

function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 h-4 w-28 rounded bg-zinc-800" />
      <div className="space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-3 w-20 rounded bg-zinc-800" />
            <div className="h-3 w-10 rounded bg-zinc-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ForecastSideCardsSkeleton() {
  return (
    <>
      <CardSkeleton lines={3} />
      <CardSkeleton lines={4} />
    </>
  );
}

export function TopActionsSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 h-4 w-24 rounded bg-zinc-800" />
      <div className="space-y-2.5">
        <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-2.5">
          <div className="h-3 w-16 rounded bg-zinc-800" />
          <div className="mt-1.5 h-3 w-24 rounded bg-zinc-800" />
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-2.5">
          <div className="h-3 w-16 rounded bg-zinc-800" />
          <div className="mt-1.5 h-3 w-24 rounded bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}
