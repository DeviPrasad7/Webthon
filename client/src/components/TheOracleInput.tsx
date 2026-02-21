import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, ArrowUpRight, Sparkles } from "lucide-react";
import { createObjective } from "../api";
import { useVoiceInput } from "../hooks/useVoiceInput";

interface Props {
  onCreated: (id: string) => void;
}

export default function TheOracleInput({ onCreated }: Props) {
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const hasInput = rawInput.trim().length > 0;

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-2xl"
      >
        <div className="text-center mb-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 mb-4"
          >
            <Sparkles className="w-4 h-4 text-amber-500/60" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-500/50">
              The Oracle
            </span>
          </motion.div>
          <h1 className="font-serif text-3xl md:text-4xl text-amber-50/90 tracking-tight mb-3">
            What decision weighs on you?
          </h1>
          <p className="text-sm text-zinc-600 max-w-md mx-auto">
            Speak or type freely. JARVIS will parse, recall, and strategize.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative rounded-2xl border border-amber-500/10 bg-black/40 backdrop-blur-xl p-6 shadow-2xl shadow-amber-900/5"
        >
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <textarea
                value={rawInput}
                onChange={(e) => {
                  setRawInput(e.target.value);
                  setIsVoice(false);
                }}
                placeholder="I'm considering..."
                className="w-full bg-transparent border-none outline-none resize-none text-xl md:text-2xl text-amber-50 placeholder:text-zinc-700 leading-relaxed min-h-35 font-serif tracking-tight"
                rows={5}
              />

              {isSupported && (
                <div className="absolute bottom-2 right-2">
                  <motion.button
                    type="button"
                    onClick={toggleListening}
                    whileTap={{ scale: 0.9 }}
                    className={`relative p-3 rounded-full transition-all duration-300 ${
                      isListening
                        ? "text-amber-400 bg-amber-500/10"
                        : "text-zinc-600 hover:text-amber-400 hover:bg-amber-500/5"
                    }`}
                  >
                    {isListening && (
                      <motion.span
                        className="absolute inset-0 rounded-full bg-amber-500/20"
                        animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                      />
                    )}
                    <Mic className="w-5 h-5 relative z-10" />
                  </motion.button>
                </div>
              )}
            </div>

            <div className="h-px bg-linear-to-r from-transparent via-amber-500/20 to-transparent my-4" />

            <AnimatePresence>
              {isListening && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-amber-500/70 text-sm font-medium mb-3 flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Listening — speak freely...
                </motion.p>
              )}
            </AnimatePresence>

            {voiceError && (
              <p className="text-rose-400/80 text-sm mb-3">{voiceError}</p>
            )}

            {error && (
              <p className="text-rose-400/80 text-sm mb-3">{error}</p>
            )}

            <AnimatePresence>
              {hasInput && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="flex justify-end"
                >
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-medium bg-linear-to-r from-amber-500 to-yellow-500 text-black shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-shadow duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <motion.span
                          className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                        />
                        Engaging...
                      </span>
                    ) : (
                      <>
                        Engage JARVIS
                        <ArrowUpRight className="w-4 h-4" />
                      </>
                    )}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </motion.div>
      </motion.div>
    </div>
  );
}
