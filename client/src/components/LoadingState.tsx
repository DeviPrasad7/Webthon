import { motion } from "framer-motion";

interface Props {
  text?: string;
  type?: "detail" | "dashboard" | "inline";
}

function ShimmerBar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-lg bg-linear-to-r from-zinc-900 via-zinc-800 to-zinc-900 animate-shimmer ${className}`}
    />
  );
}

export default function LoadingState({
  text = "Consulting the Ledger...",
  type,
}: Props) {
  if (type === "dashboard") {
    return (
      <div className="space-y-8">
        <div>
          <ShimmerBar className="h-6 w-48 mb-2" />
          <ShimmerBar className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <ShimmerBar key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <ShimmerBar className="h-4 w-32" />
              <div className="flex gap-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <ShimmerBar key={j} className="h-8 rounded-full w-24" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "detail") {
    return (
      <div className="space-y-6">
        <div className="flex justify-between">
          <ShimmerBar className="h-4 w-16" />
          <ShimmerBar className="h-5 rounded-full w-20" />
        </div>
        <ShimmerBar className="h-7 w-3/4" />
        <ShimmerBar className="h-20 rounded-xl" />
        <div className="space-y-2">
          <ShimmerBar className="h-4 w-32" />
          {Array.from({ length: 4 }).map((_, i) => (
            <ShimmerBar key={i} className="h-10" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <motion.p
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="text-sm text-amber-500/60 italic tracking-wide"
      >
        {text}
      </motion.p>
      <div className="flex gap-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <motion.span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-amber-500/40"
            animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
}
