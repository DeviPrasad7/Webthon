import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import {
  Send, Bot, User, Sparkles, CheckCircle, Circle, Clock, Loader,
  ListChecks, ChevronDown, ChevronRight
} from 'lucide-react';

const suggestions = [
  { text: "I just realized cold outreach doesn't work — warm intros convert 10x better", icon: "💡", type: "learning" },
  { text: "I decided to raise my rates to $150/hr starting next month", icon: "⚖️", type: "decision" },
  { text: "I want to launch a newsletter by end of March", icon: "🎯", type: "objective" },
  { text: "I learned that batching content creation saves me 5 hours a week", icon: "📚", type: "learning" },
  { text: "I messed up by not setting clear deadlines with my last client", icon: "⚠️", type: "mistake" },
  { text: "Help me think through whether I should hire a VA", icon: "🧠", type: "reflect" },
];

// ─── Plan/Phase Parser ────────────────────────────────────
// Detects structured plans in JARVIS's replies and extracts phases
function parsePlanPhases(text) {
  if (!text) return null;

  let phases = [];

  // Pattern 1: "Phase 1: Title" or "**Phase 1: Title**" or "**Phase 1:** Title"
  const regex1 = /(?:^|\n)\s*\*{0,2}Phase\s+(\d+)[:\s]*\*{0,2}\s*[:\-—]?\s*\*{0,2}([^\n*]+?)\*{0,2}\s*\n([\s\S]*?)(?=\n\s*\*{0,2}Phase\s+\d+|$)/gi;
  let m;
  while ((m = regex1.exec(text)) !== null) {
    const num = parseInt(m[1]);
    const title = m[2].trim().replace(/\*+/g, '').replace(/^[:\-—\s]+/, '').trim();
    const body = m[3].trim();
    const subtasks = extractSubtasks(body);
    phases.push({ num, title, subtasks, status: guessPhaseStatus(body, subtasks) });
  }

  // Pattern 2: "Step 1: Title" or "Stage 1: Title"
  if (phases.length < 2) {
    phases = [];
    const regex2 = /(?:^|\n)\s*\*{0,2}(?:Step|Stage)\s+(\d+)[:\s]*\*{0,2}\s*[:\-—]?\s*\*{0,2}([^\n*]+?)\*{0,2}\s*\n([\s\S]*?)(?=\n\s*\*{0,2}(?:Step|Stage)\s+\d+|$)/gi;
    while ((m = regex2.exec(text)) !== null) {
      const num = parseInt(m[1]);
      const title = m[2].trim().replace(/\*+/g, '').replace(/^[:\-—\s]+/, '').trim();
      const body = m[3].trim();
      const subtasks = extractSubtasks(body);
      phases.push({ num, title, subtasks, status: guessPhaseStatus(body, subtasks) });
    }
  }

  // Pattern 3: "1. **Title**" style numbered list (at least 3 items)
  if (phases.length < 2) {
    phases = [];
    const regex3 = /(?:^|\n)\s*(\d+)\.\s*\*{0,2}([^\n*]+?)\*{0,2}\s*[:\-—]?\s*\n([\s\S]*?)(?=\n\s*\d+\.\s*\*{0,2}|$)/g;
    while ((m = regex3.exec(text)) !== null) {
      const num = parseInt(m[1]);
      const title = m[2].trim().replace(/\*+/g, '').replace(/^[:\-—\s]+/, '').trim();
      const body = m[3].trim();
      const subtasks = extractSubtasks(body);
      phases.push({ num, title, subtasks, status: guessPhaseStatus(body, subtasks) });
    }
  }

  // Pattern 4: "Week 1:" or "Week 1 (description):" patterns
  if (phases.length < 2) {
    phases = [];
    const regex4 = /(?:^|\n)\s*\*{0,2}Week\s+(\d+)\s*(?:\([^)]*\))?[:\s]*\*{0,2}\s*[:\-—]?\s*\*{0,2}([^\n]*?)\*{0,2}\s*\n([\s\S]*?)(?=\n\s*\*{0,2}Week\s+\d+|$)/gi;
    while ((m = regex4.exec(text)) !== null) {
      const num = parseInt(m[1]);
      let title = m[2].trim().replace(/\*+/g, '').replace(/^[:\-—\s]+/, '').trim();
      if (!title) title = `Week ${num}`;
      const body = m[3].trim();
      const subtasks = extractSubtasks(body);
      phases.push({ num, title, subtasks, status: guessPhaseStatus(body, subtasks) });
    }
  }

  if (phases.length < 2) return null; // Need at least 2 phases to render a plan

  const doneCount = phases.filter(p => p.status === 'done').length;
  const progress = Math.round((doneCount / phases.length) * 100);

  return { phases, progress };
}

function extractSubtasks(body) {
  const lines = body.split('\n');
  const tasks = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Match bullet points or sub-items: "- text", "* text", "• text"
    const bulletMatch = trimmed.match(/^[\-\*•]\s+(.*)/);
    if (bulletMatch) {
      const raw = bulletMatch[1].replace(/\*+/g, '').trim();
      const isDone = /^✅|✓|done|completed|finished/i.test(raw);
      const isInProgress = /^🔄/i.test(raw);
      const text = raw.replace(/^[✅✓🔄]\s*/, '').trim();
      tasks.push({ text, done: isDone, inProgress: isInProgress });
    }
  }
  return tasks;
}

function guessPhaseStatus(body, subtasks) {
  const lower = body.toLowerCase();
  if (/✅|completed|done|finished|achieved/i.test(lower)) return 'done';
  if (/🔄|in\s*progress|ongoing|working|current/i.test(lower)) return 'in-progress';
  if (subtasks.length > 0 && subtasks.every(t => t.done)) return 'done';
  if (subtasks.length > 0 && subtasks.some(t => t.done)) return 'in-progress';
  return 'pending';
}

// ─── Plan Phases UI Component ─────────────────────────────
function PlanPhasesDisplay({ plan, objectiveId, onStepComplete, externalCompletions }) {
  const [expandedPhases, setExpandedPhases] = useState(new Set(plan.phases.map(p => p.num)));
  const [checkedTasks, setCheckedTasks] = useState(() => {
    const initial = {};
    plan.phases.forEach(phase => {
      phase.subtasks.forEach((task, i) => {
        initial[`${phase.num}-${i}`] = task.done;
      });
    });
    return initial;
  });
  const [syncing, setSyncing] = useState(null);

  // Reverse-sync: when externalCompletions changes (from Objectives page), update local checked state
  useEffect(() => {
    if (!externalCompletions || !objectiveId) return;
    setCheckedTasks(prev => {
      const next = { ...prev };
      let globalStep = 0;
      for (const phase of plan.phases) {
        for (let i = 0; i < phase.subtasks.length; i++) {
          globalStep++;
          if (externalCompletions[globalStep]) {
            next[`${phase.num}-${i}`] = true;
          }
        }
      }
      return next;
    });
  }, [externalCompletions, objectiveId, plan.phases]);

  const togglePhase = (num) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  const toggleTask = async (phaseNum, taskIdx) => {
    const key = `${phaseNum}-${taskIdx}`;
    const newChecked = !checkedTasks[key];
    setCheckedTasks(prev => ({ ...prev, [key]: newChecked }));

    // Calculate the global step number (1-based) across all phases
    if (objectiveId && newChecked) {
      let globalStep = 0;
      for (const phase of plan.phases) {
        for (let i = 0; i < phase.subtasks.length; i++) {
          globalStep++;
          if (phase.num === phaseNum && i === taskIdx) break;
        }
        if (phase.num === phaseNum) break;
      }
      setSyncing(key);
      try {
        await api.updateProgress(objectiveId, globalStep);
        if (onStepComplete) onStepComplete();
      } catch (err) {
        console.warn('[JARVIS] Failed to sync step to objective:', err);
      } finally {
        setSyncing(null);
      }
    }
  };

  // Recompute phase statuses and progress based on checked state
  const computedPhases = plan.phases.map(phase => {
    const subtaskStates = phase.subtasks.map((task, i) => ({
      ...task,
      done: !!checkedTasks[`${phase.num}-${i}`],
    }));
    const allDone = subtaskStates.length > 0 && subtaskStates.every(t => t.done);
    const someDone = subtaskStates.some(t => t.done);
    const status = allDone ? 'done' : someDone ? 'in-progress' : 'pending';
    return { ...phase, subtasks: subtaskStates, status };
  });

  const totalTasks = Object.keys(checkedTasks).length;
  const doneTasks = Object.values(checkedTasks).filter(Boolean).length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="plan-phases-container">
      <div className="plan-phases-header">
        <ListChecks size={16} />
        Implementation Plan
        <span style={{
          marginLeft: 'auto', fontSize: 11, fontWeight: 600,
          background: progress === 100 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.2)',
          color: progress === 100 ? '#34d399' : 'inherit',
          padding: '2px 8px',
          borderRadius: 'var(--radius-full)',
          transition: 'all 0.3s',
        }}>
          {progress === 100 ? '✓ ' : ''}{progress}% complete
        </span>
      </div>

      {/* Progress bar */}
      <div className="plan-progress-bar">
        <div className="plan-progress-fill" style={{
          width: `${progress}%`,
          background: progress === 100
            ? 'linear-gradient(90deg, #10b981, #34d399)'
            : undefined,
          transition: 'width 0.4s ease, background 0.3s',
        }} />
      </div>

      {computedPhases.map((phase) => {
        const isExpanded = expandedPhases.has(phase.num);
        return (
          <div key={phase.num} className="plan-phase">
            <div
              className="plan-phase-header"
              onClick={() => phase.subtasks.length > 0 && togglePhase(phase.num)}
              style={{ cursor: phase.subtasks.length > 0 ? 'pointer' : 'default' }}
            >
              <span className={`plan-phase-number ${phase.status}`}>
                {phase.status === 'done' ? '✓' : phase.num}
              </span>
              <span className="plan-phase-title">{phase.title}</span>
              <span className={`plan-phase-status ${phase.status}`}>
                {phase.status === 'done' ? 'Done' : phase.status === 'in-progress' ? 'In Progress' : 'Pending'}
              </span>
              {phase.subtasks.length > 0 && (
                isExpanded
                  ? <ChevronDown size={14} color="var(--color-text-muted)" />
                  : <ChevronRight size={14} color="var(--color-text-muted)" />
              )}
            </div>
            {isExpanded && phase.subtasks.length > 0 && (
              <div className="plan-phase-details" style={{ animation: 'accordionOpen 0.25s ease-out' }}>
                <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                  {phase.subtasks.map((task, i) => {
                    const isChecked = !!checkedTasks[`${phase.num}-${i}`];
                    const isSyncing = syncing === `${phase.num}-${i}`;
                    return (
                      <li
                        key={i}
                        onClick={() => toggleTask(phase.num, i)}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 4px',
                          marginBottom: 2, borderRadius: 6, cursor: 'pointer',
                          transition: 'all 0.2s',
                          background: isChecked ? 'rgba(16, 185, 129, 0.06)' : 'transparent',
                        }}
                        onMouseEnter={e => { if (!isChecked) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = isChecked ? 'rgba(16, 185, 129, 0.06)' : 'transparent'; }}
                      >
                        <span style={{
                          width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
                          border: isChecked ? '2px solid #10b981' : '2px solid #555770',
                          background: isChecked ? '#10b981' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.2s',
                        }}>
                          {isSyncing ? (
                            <Loader size={10} color={isChecked ? 'white' : '#6366f1'} style={{ animation: 'spin 1s linear infinite' }} />
                          ) : isChecked ? (
                            <CheckCircle size={12} color="white" style={{ strokeWidth: 3 }} />
                          ) : null}
                        </span>
                        <span style={{
                          color: isChecked ? '#34d399' : 'var(--color-text-secondary)',
                          textDecoration: isChecked ? 'line-through' : 'none',
                          opacity: isChecked ? 0.7 : 1,
                          transition: 'all 0.2s',
                          fontSize: 13, lineHeight: 1.5,
                        }}>
                          {task.text}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Format regular message text ──────────────────────────
function formatMessage(text) {
  if (!text) return '';
  return text
    .split('\n')
    .map((line, i) => {
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      if (line.match(/^[\-\*•]\s/)) {
        return `<li key="${i}">${line.replace(/^[\-\*•]\s/, '')}</li>`;
      }
      if (line.match(/^\d+\.\s/)) {
        return `<li key="${i}">${line.replace(/^\d+\.\s/, '')}</li>`;
      }
      if (line.trim() === '') return '<br/>';
      return `<p>${line}</p>`;
    })
    .join('');
}

// ─── Remove plan text from message for clean display ──────
function stripPlanText(text, plan) {
  if (!plan || !text) return text;
  // Try to find where the plan starts and remove it so it's rendered as the visual component instead
  const planStartPatterns = [
    /(?:^|\n)((?:\s*\*{0,2}Phase\s+1[:\s])[\s\S]*)/i,
    /(?:^|\n)((?:\s*\*{0,2}(?:Step|Stage)\s+1[:\s])[\s\S]*)/i,
    /(?:^|\n)((?:\s*1\.\s*\*{0,2})[\s\S]*)/i,
    /(?:^|\n)((?:\s*\*{0,2}Week\s+1[:\s])[\s\S]*)/i,
  ];
  for (const pat of planStartPatterns) {
    const match = text.match(pat);
    if (match && match[1]) {
      const before = text.slice(0, text.indexOf(match[1])).trim();
      return before;
    }
  }
  return text;
}

export default function ChatView() {
  const { state, sendMessage, loadObjectives } = useApp();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.chatMessages, state.chatLoading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [state.chatSessionId]);

  const handleSend = () => {
    const msg = input.trim();
    if (!msg || state.chatLoading) return;
    setInput('');
    sendMessage(msg);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (text) => {
    setInput('');
    sendMessage(text);
  };

  return (
    <div className="chat-container">
      {/* Messages area */}
      <div className="chat-messages">
        {state.chatMessages.length === 0 ? (
          <div className="chat-welcome">
            <div className="chat-welcome-icon">
              <Sparkles size={32} color="white" />
            </div>
            <h2>Hey! I'm JARVIS</h2>
            <p>
              Your AI business partner with perfect memory. Just talk naturally — 
              I'll automatically capture your learnings, decisions, and goals. No forms needed.
            </p>
            <div className="chat-suggestions">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  className="chat-suggestion-btn"
                  onClick={() => handleSuggestion(s.text)}
                >
                  <span style={{ marginRight: 6 }}>{s.icon}</span>
                  {s.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="message-group">
            {state.chatMessages.map((msg, i) => {
              const plan = msg.role === 'assistant' ? parsePlanPhases(msg.content) : null;
              const displayText = plan ? stripPlanText(msg.content, plan) : msg.content;

              return (
                <div key={i} className={`message ${msg.role}`}>
                  <div className="message-avatar">
                    {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
                  </div>
                  <div style={{ maxWidth: '70%' }}>
                    {/* Regular text content */}
                    {displayText && (
                      <div
                        className="message-content"
                        style={{ maxWidth: '100%' }}
                        dangerouslySetInnerHTML={{ __html: formatMessage(displayText) }}
                      />
                    )}

                    {/* Plan phases visual */}
                    {plan && (
                      <PlanPhasesDisplay
                        plan={plan}
                        objectiveId={msg.linkedObjectiveId || null}
                        onStepComplete={loadObjectives}
                        externalCompletions={msg._stepCompletions || null}
                      />
                    )}

                    {/* Sources */}
                    {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                      <div className="message-sources">
                        {msg.sources.map((s, j) => (
                          <span key={j} className="source-tag">
                            {s.type} ({(s.score * 100).toFixed(0)}%)
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Auto-captured items */}
                    {msg.role === 'assistant' && msg.auto_captured && msg.auto_captured.length > 0 && (
                      <div className="message-auto-captured">
                        {msg.auto_captured.map((item, j) => (
                          <span key={j} className={`auto-capture-tag capture-${item.type}`}>
                            {item.type === 'learning' ? '💡 ' : item.type === 'decision' ? '⚖️ ' : '🎯 '}
                            Auto-saved {item.type}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {state.chatLoading && (
              <div className="message assistant">
                <div className="message-avatar">
                  <Bot size={16} />
                </div>
                <div className="typing-indicator">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="chat-input-bar">
        <div className="chat-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            placeholder="Talk to JARVIS — share learnings, decisions, goals..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={state.chatLoading}
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || state.chatLoading}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
