import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { api } from '../api';

const AppContext = createContext(null);

const initialState = {
  // Navigation
  activeView: 'chat', // 'chat' | 'dashboard' | 'learnings' | 'decisions' | 'reflections' | 'objectives'

  // Chat
  chatSessionId: null,
  chatMessages: [],
  chatSessions: [],
  chatLoading: false,

  // Dashboard
  dashboard: null,

  // Learnings
  learnings: [],

  // Decisions
  decisions: [],

  // Reflections
  reflections: [],

  // Objectives
  objectives: [],

  // Modal
  modal: null, // { type: 'learning' | 'decision' | 'reflection' | 'objective', data?: any }

  // Toast notifications for auto-captures
  toasts: [],
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, activeView: action.payload };
    case 'SET_CHAT_SESSION':
      return { ...state, chatSessionId: action.payload };
    case 'SET_CHAT_MESSAGES':
      return { ...state, chatMessages: action.payload };
    case 'ADD_CHAT_MESSAGE':
      return { ...state, chatMessages: [...state.chatMessages, action.payload] };
    case 'SET_CHAT_SESSIONS':
      return { ...state, chatSessions: action.payload };
    case 'SET_CHAT_LOADING':
      return { ...state, chatLoading: action.payload };
    case 'SET_DASHBOARD':
      return { ...state, dashboard: action.payload };
    case 'SET_LEARNINGS':
      return { ...state, learnings: action.payload };
    case 'SET_DECISIONS':
      return { ...state, decisions: action.payload };
    case 'SET_REFLECTIONS':
      return { ...state, reflections: action.payload };
    case 'SET_OBJECTIVES':
      return { ...state, objectives: action.payload };
    case 'SET_MODAL':
      return { ...state, modal: action.payload };
    case 'CLEAR_MODAL':
      return { ...state, modal: null };
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.payload] };
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.payload) };
    case 'MARK_OBJECTIVE_STEP_DONE': {
      // Reverse-sync: when a step is marked done in Objectives, update any linked chat message
      const { objectiveId, stepNumber } = action.payload;
      const updatedMessages = state.chatMessages.map((msg) => {
        if (msg.linkedObjectiveId === objectiveId && msg.role === 'assistant') {
          return { ...msg, _stepCompletions: { ...(msg._stepCompletions || {}), [stepNumber]: true } };
        }
        return msg;
      });
      return { ...state, chatMessages: updatedMessages };
    }
    default:
      return state;
  }
}

// Generate a simple unique ID for new chat sessions
function generateSessionId() {
  return 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // ─── Chat actions ─────────────────────────────────────
  const sendMessage = useCallback(async (message) => {
    let sessionId = state.chatSessionId;
    if (!sessionId) {
      sessionId = generateSessionId();
      dispatch({ type: 'SET_CHAT_SESSION', payload: sessionId });
    }

    // Add user message immediately
    dispatch({
      type: 'ADD_CHAT_MESSAGE',
      payload: { role: 'user', content: message, timestamp: new Date().toISOString() },
    });
    dispatch({ type: 'SET_CHAT_LOADING', payload: true });

    try {
      const result = await api.chat(message, sessionId);

      // Track objective IDs created during auto-capture
      let linkedObjectiveId = null;

      // Show toast notifications for auto-captured items
      if (result.auto_captured && result.auto_captured.length > 0) {
        for (const item of result.auto_captured) {
          const toastId = 'toast-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
          let toastMessage = '';
          let toastIcon = '✨';
          if (item.type === 'learning') {
            toastIcon = '💡';
            toastMessage = `Learning captured: "${item.content?.substring(0, 60)}…"`;
          } else if (item.type === 'decision') {
            toastIcon = '⚖️';
            toastMessage = `Decision logged: "${item.decision?.substring(0, 60)}…"`;
          } else if (item.type === 'objective_suggestion') {
            toastIcon = '🎯';
            // Actually create the objective via the ingest API and auto-approve it
            const objText = item.text || '';
            if (objText.trim()) {
              try {
                const ingestResult = await api.ingestText(objText);
                const objId = ingestResult.objective_id;
                linkedObjectiveId = objId;
                toastMessage = `Objective created: "${objText.substring(0, 60)}…"`;
                // Auto-approve after the plan is drafted (poll for readiness)
                if (objId) {
                  const autoApprove = async () => {
                    let attempts = 0;
                    const maxAttempts = 20;
                    const poll = async () => {
                      attempts++;
                      try {
                        const status = await api.getStatus(objId);
                        if (status.plan_draft || status.status === 'planning' || status.status === 'staging') {
                          try {
                            await api.confirmPlan(objId, true);
                            console.log('[JARVIS] Auto-approved objective:', objId);
                            // Refresh objectives so they appear on the Objectives page
                            loadObjectives();
                          } catch (confirmErr) {
                            console.warn('[JARVIS] Auto-approve failed:', confirmErr);
                          }
                          return;
                        }
                        if (status.status === 'approved' || status.status === 'in_progress') {
                          loadObjectives();
                          return;
                        }
                        if (attempts < maxAttempts) {
                          setTimeout(poll, 2000);
                        }
                      } catch {
                        if (attempts < maxAttempts) {
                          setTimeout(poll, 2000);
                        }
                      }
                    };
                    setTimeout(poll, 3000); // Wait 3s before first poll to let backend process
                  };
                  autoApprove();
                }
              } catch (objErr) {
                console.error('Failed to auto-create objective:', objErr);
                toastMessage = `Objective detected but failed to save: "${objText.substring(0, 50)}…"`;
              }
            } else {
              toastMessage = `Objective detected — check Objectives to create it!`;
            }
          }
          dispatch({
            type: 'ADD_TOAST',
            payload: { id: toastId, icon: toastIcon, message: toastMessage, itemType: item.type },
          });
          // Auto-remove after 6 seconds
          setTimeout(() => {
            dispatch({ type: 'REMOVE_TOAST', payload: toastId });
          }, 6000);
        }
      }

      // Add assistant message with linked objective ID
      dispatch({
        type: 'ADD_CHAT_MESSAGE',
        payload: {
          role: 'assistant',
          content: result.reply,
          sources: result.sources || [],
          context_used: result.context_used || 0,
          auto_captured: result.auto_captured || [],
          linkedObjectiveId: linkedObjectiveId,
          timestamp: new Date().toISOString(),
        },
      });

      // Refresh sessions list
      loadChatSessions();
    } catch (err) {
      dispatch({
        type: 'ADD_CHAT_MESSAGE',
        payload: {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${err.message}. Please try again.`,
          timestamp: new Date().toISOString(),
        },
      });
    } finally {
      dispatch({ type: 'SET_CHAT_LOADING', payload: false });
    }
  }, [state.chatSessionId]);

  const loadChatSessions = useCallback(async () => {
    try {
      const sessions = await api.listChatSessions();
      dispatch({ type: 'SET_CHAT_SESSIONS', payload: sessions });
    } catch (err) {
      console.error('Failed to load chat sessions:', err);
    }
  }, []);

  const loadChatHistory = useCallback(async (sessionId) => {
    try {
      dispatch({ type: 'SET_CHAT_SESSION', payload: sessionId });
      const history = await api.getChatHistory(sessionId);
      const messages = (history.messages || []).map((m) => ({
        role: m.role,
        content: m.content,
        sources: m.sources || [],
        context_used: m.context_used || 0,
        timestamp: m.created_at,
      }));
      dispatch({ type: 'SET_CHAT_MESSAGES', payload: messages });
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  }, []);

  const startNewChat = useCallback(() => {
    dispatch({ type: 'SET_CHAT_SESSION', payload: null });
    dispatch({ type: 'SET_CHAT_MESSAGES', payload: [] });
    dispatch({ type: 'SET_VIEW', payload: 'chat' });
  }, []);

  const deleteChatSession = useCallback(async (sessionId) => {
    try {
      await api.deleteChatSession(sessionId);
      if (state.chatSessionId === sessionId) {
        startNewChat();
      }
      loadChatSessions();
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  }, [state.chatSessionId, startNewChat, loadChatSessions]);

  // ─── Data loading ─────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    try {
      const data = await api.dashboard();
      dispatch({ type: 'SET_DASHBOARD', payload: data });
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
  }, []);

  const loadLearnings = useCallback(async () => {
    try {
      const data = await api.listLearnings(50);
      dispatch({ type: 'SET_LEARNINGS', payload: data });
    } catch (err) {
      console.error('Failed to load learnings:', err);
    }
  }, []);

  const loadDecisions = useCallback(async () => {
    try {
      const data = await api.listDecisions(50);
      dispatch({ type: 'SET_DECISIONS', payload: data });
    } catch (err) {
      console.error('Failed to load decisions:', err);
    }
  }, []);

  const loadReflections = useCallback(async () => {
    try {
      const data = await api.listReflections(50);
      dispatch({ type: 'SET_REFLECTIONS', payload: data });
    } catch (err) {
      console.error('Failed to load reflections:', err);
    }
  }, []);

  const loadObjectives = useCallback(async () => {
    try {
      const data = await api.listObjectives(50);
      dispatch({ type: 'SET_OBJECTIVES', payload: data });
    } catch (err) {
      console.error('Failed to load objectives:', err);
    }
  }, []);

  // ─── CRUD actions ─────────────────────────────────────
  const captureLearning = useCallback(async (content, category, tags) => {
    await api.captureLearning(content, category, tags);
    loadLearnings();
  }, [loadLearnings]);

  const logDecision = useCallback(async (data) => {
    await api.logDecision(data);
    loadDecisions();
  }, [loadDecisions]);

  const triggerReflection = useCallback(async (trigger) => {
    const result = await api.reflect(trigger);
    loadReflections();
    return result;
  }, [loadReflections]);

  const createObjective = useCallback(async (text) => {
    await api.ingestText(text);
    loadObjectives();
  }, [loadObjectives]);

  const value = {
    state,
    dispatch,
    // Chat
    sendMessage,
    loadChatSessions,
    loadChatHistory,
    startNewChat,
    deleteChatSession,
    // Data
    loadDashboard,
    loadLearnings,
    loadDecisions,
    loadReflections,
    loadObjectives,
    // CRUD
    captureLearning,
    logDecision,
    triggerReflection,
    createObjective,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
