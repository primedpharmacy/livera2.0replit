import { Skeleton } from "@/components/ui/skeleton";

function Table() {
  return (
    <div className="space-y-0">
      <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
        <div className="bg-page-bg border-b border-bdr px-4 py-3 flex gap-4">
          {[2, 1, 1.5, 1, 1].map((w, i) => (
            <Skeleton key={i} className="h-3 rounded" style={{ flex: w }} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-4 py-3.5 border-b border-bdr last:border-0 flex gap-4 items-center">
            <Skeleton className="w-7 h-7 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-32 rounded" />
              <Skeleton className="h-2.5 w-20 rounded" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3 w-12 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Detail() {
  return (
    <div className="space-y-4 px-6 py-6">
      <div className="flex items-center gap-4 pb-4 border-b border-bdr">
        <Skeleton className="w-14 h-14 rounded-xl shrink-0" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-48 rounded" />
          <Skeleton className="h-3.5 w-72 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface border border-bdr rounded-lg p-4 space-y-3">
            <Skeleton className="h-3.5 w-24 rounded" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex justify-between items-center">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-3 w-24 rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function List() {
  return (
    <div className="space-y-2 px-4 py-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-surface border border-bdr rounded-lg px-4 py-3 flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-40 rounded" />
            <Skeleton className="h-2.5 w-28 rounded" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export const LoadingState = { Table, Detail, List };
