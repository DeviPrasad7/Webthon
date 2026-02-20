import { useState, useCallback } from "react";
import { createObjective } from "../api";
import { useVoiceInput } from "../hooks/useVoiceInput";

interface Props {
  onCreated: (id: string) => void;
}

export default function CreateObjectiveForm({ onCreated }: Props) {
  const [rawInput, setRawInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isVoice, setIsVoice] = useState(false);

  const handleTranscript = useCallback((text: string) => {
    setRawInput(text);
    setIsVoice(true);
  }, []);

  const { isListening, isSupported, voiceError, toggleListening } = useVoiceInput(handleTranscript);

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
    <form onSubmit={handleSubmit} className="card brain-dump-card">
      <h2>What's on your mind?</h2>
      <p className="brain-dump-hint">
        Brain-dump your decision, question, or idea. JARVIS will parse it, find relevant past decisions, and give you an actionable plan with insights.
      </p>

      <div className="brain-dump-container">
        <textarea
          className="brain-dump-textarea"
          value={rawInput}
          onChange={(e) => { setRawInput(e.target.value); setIsVoice(false); }}
          placeholder="e.g., I'm thinking about switching from Stripe to LemonSqueezy for payments because Stripe's fees are killing us on the $9 plan, but I'm worried about migration complexity and losing subscribers..."
          rows={8}
        />
        {isSupported && (
          <button
            type="button"
            className={`voice-btn ${isListening ? "active" : ""}`}
            onClick={toggleListening}
            title={isListening ? "Stop listening" : "Start voice input"}
          >
            🎙
          </button>
        )}
      </div>

      {isListening && (
        <p className="voice-status">Listening... speak freely, JARVIS is capturing your thoughts.</p>
      )}

      {voiceError && <p className="error">{voiceError}</p>}

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={loading || !rawInput.trim()}>
        {loading ? "Sending to JARVIS..." : "Ask JARVIS"}
      </button>
    </form>
  );
}
