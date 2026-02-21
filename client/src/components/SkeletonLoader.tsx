interface Props {
  type: "detail" | "dashboard";
}

export default function SkeletonLoader({ type }: Props) {
  if (type === "dashboard") {
    return (
      <div className="space-y-8 animate-pulse">
        <div>
          <div className="h-6 bg-zinc-800 rounded w-48 mb-2" />
          <div className="h-4 bg-zinc-800 rounded w-64" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-zinc-800 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="h-4 bg-zinc-800 rounded w-32" />
            <div className="flex gap-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-8 bg-zinc-800 rounded-full w-24" />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-4 bg-zinc-800 rounded w-32" />
            <div className="flex gap-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-8 bg-zinc-800 rounded-full w-24" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between">
        <div className="h-4 bg-zinc-800 rounded w-16" />
        <div className="h-5 bg-zinc-800 rounded-full w-20" />
      </div>
      <div className="h-7 bg-zinc-800 rounded w-3/4" />
      <div className="h-20 bg-zinc-800 rounded-xl" />
      <div className="space-y-2">
        <div className="h-4 bg-zinc-800 rounded w-32" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 bg-zinc-800 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
