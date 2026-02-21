import { useState, useCallback } from "react";
import { createObjective } from "../api";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { Mic, ArrowRight } from "lucide-react";

interface Props {
  onCreated: (id: string) => void;
}

export default function BrainDumpForm({ onCreated }: Props) {
  const [rawInput, setRawInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isVoice, setIsVoice] = useState(false);

  const handleTranscript = useCallback((text: string) => {
    setRawInput(text);
    setIsVoice(true);
  }, []);

  const { isListening, isSupported, voiceError, toggleListening } =
    useVoiceInput(handleTranscript);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rawInput.trim()) return;
    setError("");
    setLoading(true);
    try {
      const result = await createObjective({
        raw_input: rawInput.trim(),
        is_voice: isVoice,
      });
      setRawInput("");
      setIsVoice(false);
      onCreated(result.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[60vh] flex flex-col justify-center">
      <div className="mb-8">
        <h1 className="text-zinc-400 text-sm font-medium tracking-widest mb-2">
          Brain Dump
        </h1>
        <p className="text-zinc-500 text-sm">
          Speak or type your decision freely. JARVIS will parse, analyze, and
          plan.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <textarea
            value={rawInput}
            onChange={(e) => {
              setRawInput(e.target.value);
              setIsVoice(false);
            }}
            placeholder="What's on your mind..."
            className="w-full bg-transparent border-none outline-none resize-none text-2xl md:text-3xl text-zinc-100 placeholder:text-zinc-600 leading-relaxed min-h-50 font-light tracking-tight"
            rows={6}
          />

          {isSupported && (
            <button
              type="button"
              onClick={toggleListening}
              className={`absolute bottom-4 right-4 p-3 rounded-full transition-all duration-200 ease-in-out ${
                isListening
                  ? "animate-pulse text-rose-500 bg-rose-500/10"
                  : "text-zinc-500 hover:text-zinc-100 hover:bg-white/5"
              }`}
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="h-px bg-white/10 my-4" />

        {isListening && (
          <p className="text-rose-400 text-sm animate-pulse mb-3">
            Listening — speak freely...
          </p>
        )}

        {voiceError && (
          <p className="text-rose-400 text-sm mb-3">{voiceError}</p>
        )}

        {error && <p className="text-rose-400 text-sm mb-3">{error}</p>}

        <div
          className={`flex justify-end transition-all duration-200 ease-in-out ${
            rawInput.trim()
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-2 pointer-events-none"
          }`}
        >
          <button
            type="submit"
            disabled={loading || !rawInput.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-medium rounded-lg transition-all duration-200 ease-in-out border border-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-zinc-500 border-t-zinc-100 rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              <>
                Engage JARVIS
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
