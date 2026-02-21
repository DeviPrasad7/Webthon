import { Zap } from "lucide-react";

interface Props {
  insight: string;
}

export default function JarvisInsight({ insight }: Props) {
  return (
    <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl p-4 shadow-[0_0_15px_rgba(245,158,11,0.05)]">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-4 h-4 text-amber-400" />
        <span className="text-[10px] font-semibold tracking-widest text-amber-400">
          Jarvis Insight
        </span>
      </div>
      <p className="text-amber-200 text-lg font-medium leading-relaxed">
        {insight}
      </p>
    </div>
  );
}
