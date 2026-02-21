import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface Props {
  insight: string;
}

export default function StrategicInsightCard({ insight }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative bg-linear-to-br from-zinc-900 to-black border-l-4 border-amber-500 rounded-r-xl p-5 shadow-lg shadow-amber-900/10 overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at top right, rgba(245, 158, 11, 0.3), transparent 60%)",
        }}
      />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-[10px] font-semibold tracking-[0.1em] text-amber-500/70">
            Strategic Intelligence
          </span>
        </div>

        <p className="text-amber-400/90 text-lg italic tracking-wide leading-relaxed">
          &ldquo;{insight}&rdquo;
        </p>
      </div>
    </motion.div>
  );
}
