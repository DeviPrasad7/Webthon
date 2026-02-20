import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  MessageSquare, LayoutDashboard, Lightbulb, Scale, Brain,
  Target, Plus, Trash2, MessagesSquare,
} from 'lucide-react';

const navItems = [
  { key: 'chat', label: 'Chat', icon: MessageSquare },
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'learnings', label: 'Learnings', icon: Lightbulb },
  { key: 'decisions', label: 'Decisions', icon: Scale },
  { key: 'reflections', label: 'Reflections', icon: Brain },
  { key: 'objectives', label: 'Objectives', icon: Target },
];

export default function Sidebar() {
  const {
    state, dispatch, startNewChat, loadChatSessions, loadChatHistory, deleteChatSession,
  } = useApp();

  useEffect(() => {
    loadChatSessions();
  }, [loadChatSessions]);

  const setView = (view) => {
    dispatch({ type: 'SET_VIEW', payload: view });
  };

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">⚡</div>
          <div>
            <h1>JARVIS</h1>
            <span>AI Business Partner</span>
          </div>
        </div>
        <button className="new-chat-btn" onClick={startNewChat}>
          <Plus size={16} />
          New Conversation
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`nav-item ${state.activeView === key ? 'active' : ''}`}
            onClick={() => setView(key)}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>

      {/* Chat sessions */}
      <div className="sidebar-sessions">
        <div className="sessions-label">Recent Chats</div>
        {state.chatSessions.length === 0 ? (
          <div style={{ padding: '12px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            No conversations yet
          </div>
        ) : (
          state.chatSessions.map((s) => (
            <button
              key={s.id}
              className={`session-item ${state.chatSessionId === s.id ? 'active' : ''}`}
              onClick={() => {
                loadChatHistory(s.id);
                setView('chat');
              }}
            >
              <MessagesSquare size={14} />
              <span className="session-item-text">{s.title}</span>
              <span
                className="session-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteChatSession(s.id);
                }}
              >
                <Trash2 size={13} />
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
