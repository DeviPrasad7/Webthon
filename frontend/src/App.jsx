import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import DashboardView from './components/DashboardView';
import LearningsView from './components/LearningsView';
import DecisionsView from './components/DecisionsView';
import ReflectionsView from './components/ReflectionsView';
import ObjectivesView from './components/ObjectivesView';
import ToastContainer from './components/ToastContainer';
import GuideBotWidget from './components/GuideBotWidget';

function MainContent() {
  const { state } = useApp();

  const viewTitles = {
    chat: 'Chat with JARVIS',
    dashboard: 'Dashboard',
    learnings: 'Learnings',
    decisions: 'Decision Log',
    reflections: 'Reflections',
    objectives: 'Objectives',
  };

  const renderView = () => {
    switch (state.activeView) {
      case 'chat': return <ChatView />;
      case 'dashboard': return <DashboardView />;
      case 'learnings': return <LearningsView />;
      case 'decisions': return <DecisionsView />;
      case 'reflections': return <ReflectionsView />;
      case 'objectives': return <ObjectivesView />;
      default: return <ChatView />;
    }
  };

  return (
    <main className="main-content">
      {state.activeView !== 'chat' && (
        <div className="main-header">
          <h2>{viewTitles[state.activeView] || 'JARVIS'}</h2>
        </div>
      )}
      {renderView()}
    </main>
  );
}

export default function App() {
  return (
    <AppProvider>
      <div className="app-layout">
        <Sidebar />
        <MainContent />
        <ToastContainer />
        <GuideBotWidget />
      </div>
    </AppProvider>
  );
}
