import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  MessageCircle, X, Send, Globe, ChevronRight, Sparkles,
  MessageSquare, LayoutDashboard, Lightbulb, Scale, Brain, Target,
  ArrowRight, Bot, User, Loader
} from 'lucide-react';

// ─── Supported Languages ──────────────────────────────────
const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'te', label: 'తెలుగు', flag: '🇮🇳' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
];

// ─── Page knowledge base for guide responses ─────────────
const PAGE_GUIDE = {
  en: {
    welcome: "👋 Hi! I'm your JARVIS Guide. I can help you navigate the app, explain features, and answer questions in your language. What would you like to know?",
    chat: {
      title: "💬 Chat",
      what: "Chat is your main conversation space with JARVIS, your AI business partner.",
      how: "Just type naturally — share learnings, decisions, or goals. JARVIS auto-captures everything.",
      when: "Use Chat when you want to brainstorm, share insights, set objectives, or get advice.",
      tips: [
        "Share a goal like 'I want to launch X by March' and JARVIS creates an action plan",
        "Learnings and decisions are auto-captured — no forms needed",
        "Check off plan subtasks right in the chat to track progress",
        "Plans sync with the Objectives page in real-time"
      ]
    },
    dashboard: {
      title: "📊 Dashboard",
      what: "Dashboard gives you a bird's-eye view of all your objectives, learnings, decisions, and reflections.",
      how: "Click 'Dashboard' in the sidebar to see your summary stats and recent activity.",
      when: "Check the Dashboard for a quick overview of your business journey and progress.",
      tips: [
        "View counts for all your captured items at a glance",
        "See your most recent objectives and their status",
        "Track your latest learnings and decisions"
      ]
    },
    learnings: {
      title: "💡 Learnings",
      what: "Learnings stores all your insights, mistakes, successes, patterns, and process improvements.",
      how: "Learnings are auto-captured from chat, or you can add them manually with the 'Capture Learning' button.",
      when: "Review your learnings to spot patterns, avoid repeating mistakes, and build on successes.",
      tips: [
        "Filter by tags using the dropdown to find specific learnings",
        "Click the Analytics button to see charts and trends",
        "Click any tag on a card to filter by that tag instantly",
        "Learnings are sorted latest-first automatically"
      ]
    },
    decisions: {
      title: "⚖️ Decisions",
      what: "Decision Log tracks every business decision you make — what, why, alternatives, and expected outcomes.",
      how: "Decisions are auto-captured from chat when you say things like 'I decided to...' or 'I'm going with...'",
      when: "Review your decision log to reflect on past choices and track whether outcomes matched expectations.",
      tips: [
        "Include 'why' when sharing decisions for better tracking",
        "Revisit old decisions to see if expected outcomes materialized",
        "Tags help you categorize decisions by area (pricing, hiring, etc.)"
      ]
    },
    reflections: {
      title: "🧠 Reflections",
      what: "Reflections are AI-generated summaries that help you think deeper about patterns and trends.",
      how: "Ask JARVIS to reflect on a topic, or trigger reflections manually.",
      when: "Use Reflections when you want to step back and understand bigger patterns in your journey.",
      tips: [
        "Ask 'help me reflect on my pricing strategy' in Chat",
        "Reflections identify patterns across your learnings and decisions",
        "Each reflection includes actionable suggestions"
      ]
    },
    objectives: {
      title: "🎯 Objectives",
      what: "Objectives are your goals with structured action plans. Each has phases and trackable steps.",
      how: "Create objectives in Chat (say 'I want to...') or manually via the 'New Objective' button.",
      when: "Use Objectives to track multi-step goals and monitor progress on each step.",
      tips: [
        "Click any plan step to mark it complete",
        "Progress syncs between Chat and Objectives in real-time",
        "Objectives are sorted by newest first",
        "The progress bar updates as you complete steps"
      ]
    },
    quickActions: [
      { label: "How do I create an objective?", action: "create_objective" },
      { label: "How does auto-capture work?", action: "auto_capture" },
      { label: "Take me to Chat", action: "nav_chat" },
      { label: "Take me to Objectives", action: "nav_objectives" },
      { label: "Take me to Learnings", action: "nav_learnings" },
      { label: "What page am I on?", action: "current_page" },
    ]
  },
  hi: {
    welcome: "👋 नमस्ते! मैं आपका JARVIS गाइड हूं। मैं ऐप नेविगेट करने, फीचर्स समझाने और आपकी भाषा में सवालों के जवाब देने में मदद कर सकता हूं। आप क्या जानना चाहेंगे?",
    chat: {
      title: "💬 चैट",
      what: "चैट JARVIS के साथ आपकी मुख्य बातचीत का स्थान है।",
      how: "बस स्वाभाविक रूप से टाइप करें — सीखें, निर्णय या लक्ष्य साझा करें। JARVIS सब कुछ ऑटो-कैप्चर करता है।",
      when: "जब आप विचार-मंथन करना, अंतर्दृष्टि साझा करना, उद्देश्य निर्धारित करना या सलाह लेना चाहते हैं।",
      tips: ["एक लक्ष्य साझा करें और JARVIS एक कार्य योजना बनाएगा", "चैट में सबटास्क पर क्लिक करके प्रगति ट्रैक करें"]
    },
    dashboard: { title: "📊 डैशबोर्ड", what: "डैशबोर्ड आपके सभी उद्देश्यों और गतिविधियों का सारांश दिखाता है।", how: "साइडबार में 'Dashboard' पर क्लिक करें।", when: "त्वरित अवलोकन के लिए।", tips: ["एक नज़र में सभी आइटम देखें"] },
    learnings: { title: "💡 सीखें", what: "सीखें आपकी सभी अंतर्दृष्टि और गलतियों को संग्रहीत करता है।", how: "चैट से ऑटो-कैप्चर या मैन्युअल रूप से जोड़ें।", when: "पैटर्न खोजने और गलतियों से बचने के लिए।", tips: ["टैग से फ़िल्टर करें", "एनालिटिक्स देखें"] },
    decisions: { title: "⚖️ निर्णय", what: "निर्णय लॉग आपके व्यापार निर्णयों को ट्रैक करता है।", how: "चैट में 'मैंने निर्णय लिया...' कहें।", when: "पिछले विकल्पों पर विचार करने के लिए।", tips: ["'क्यों' शामिल करें"] },
    reflections: { title: "🧠 चिंतन", what: "AI-जनित सारांश जो पैटर्न दिखाता है।", how: "JARVIS से किसी विषय पर चिंतन करने को कहें।", when: "बड़े पैटर्न समझने के लिए।", tips: ["सुझाव शामिल होते हैं"] },
    objectives: { title: "🎯 उद्देश्य", what: "आपके लक्ष्य कार्य योजनाओं के साथ।", how: "चैट में कहें 'मैं चाहता हूं...' या बटन दबाएं।", when: "बहु-चरण लक्ष्य ट्रैक करने के लिए।", tips: ["प्रगति रियल-टाइम में सिंक होती है"] },
    quickActions: [
      { label: "उद्देश्य कैसे बनाएं?", action: "create_objective" },
      { label: "ऑटो-कैप्चर कैसे काम करता है?", action: "auto_capture" },
      { label: "चैट पर ले जाएं", action: "nav_chat" },
      { label: "उद्देश्यों पर ले जाएं", action: "nav_objectives" },
      { label: "मैं किस पेज पर हूं?", action: "current_page" },
    ]
  },
  te: {
    welcome: "👋 నమస్కారం! నేను మీ JARVIS గైడ్‌ని. యాప్ నావిగేట్ చేయడంలో, ఫీచర్లు వివరించడంలో మీకు సహాయం చేయగలను. మీరు ఏమి తెలుసుకోవాలనుకుంటున్నారు?",
    chat: { title: "💬 చాట్", what: "చాట్ JARVIS తో మీ ప్రధాన సంభాషణ ప్రదేశం.", how: "సహజంగా టైప్ చేయండి — నేర్చుకున్నవి, నిర్ణయాలు లేదా లక్ష్యాలు షేర్ చేయండి.", when: "బ్రెయిన్‌స్టార్మ్ చేయాలనుకున్నప్పుడు ఉపయోగించండి.", tips: ["లక్ష్యం చెప్పండి, JARVIS ప్లాన్ చేస్తుంది"] },
    dashboard: { title: "📊 డ్యాష్‌బోర్డ్", what: "మీ అన్ని కార్యకలాపాల సారాంశం.", how: "సైడ్‌బార్‌లో క్లిక్ చేయండి.", when: "త్వరిత సమీక్ష కోసం.", tips: ["అన్ని ఐటమ్‌లు చూడండి"] },
    learnings: { title: "💡 నేర్చుకున్నవి", what: "మీ అంతర్దృష్టులు మరియు పొరపాట్లు.", how: "చాట్ నుండి ఆటో-క్యాప్చర్.", when: "నమూనాలు కనుగొనడానికి.", tips: ["ట్యాగ్‌ల ద్వారా ఫిల్టర్ చేయండి"] },
    decisions: { title: "⚖️ నిర్ణయాలు", what: "మీ వ్యాపార నిర్ణయాలు ట్రాక్.", how: "'నేను నిర్ణయించాను...' అని చెప్పండి.", when: "గత ఎంపికలపై ఆలోచించడానికి.", tips: ["'ఎందుకు' చేర్చండి"] },
    reflections: { title: "🧠 ప్రతిబింబాలు", what: "AI-రూపొందించిన సారాంశాలు.", how: "JARVIS ని ప్రతిబింబించమని అడగండి.", when: "పెద్ద నమూనాలు అర్థం చేసుకోవడానికి.", tips: ["సూచనలు ఉంటాయి"] },
    objectives: { title: "🎯 లక్ష్యాలు", what: "కార్య ప్రణాళికలతో మీ లక్ష్యాలు.", how: "'నేను కావాలి...' అని చెప్పండి.", when: "బహుళ-దశ లక్ష్యాలు ట్రాక్ చేయడానికి.", tips: ["ప్రగతి రియల్-టైమ్‌లో సింక్ అవుతుంది"] },
    quickActions: [
      { label: "లక్ష్యం ఎలా సృష్టించాలి?", action: "create_objective" },
      { label: "ఆటో-క్యాప్చర్ ఎలా పనిచేస్తుంది?", action: "auto_capture" },
      { label: "చాట్‌కు తీసుకెళ్ళండి", action: "nav_chat" },
      { label: "లక్ష్యాలకు తీసుకెళ్ళండి", action: "nav_objectives" },
      { label: "నేను ఏ పేజీలో ఉన్నాను?", action: "current_page" },
    ]
  },
};

// Fallback: for unsupported languages, use English
function getGuide(lang) {
  return PAGE_GUIDE[lang] || PAGE_GUIDE.en;
}

// ─── Detailed answers for actions ─────────────────────────
function getActionResponse(action, lang, currentView, dispatch) {
  const guide = getGuide(lang);
  const en = PAGE_GUIDE.en; // always have English as fallback for structure

  switch (action) {
    case 'create_objective': {
      const msgs = {
        en: "🎯 **How to create an objective:**\n\n**Option 1 — Via Chat (recommended):**\nJust say something like:\n• \"I want to launch a newsletter by March\"\n• \"I need to get 50 paying clients\"\nJARVIS will auto-detect the goal, create an objective, build an action plan, and auto-approve it!\n\n**Option 2 — Manual:**\nGo to **Objectives** → Click **New Objective** → Describe your goal → JARVIS creates a plan → Review & Approve.\n\n💡 Plans have clickable steps you can mark as done!",
        hi: "🎯 **उद्देश्य कैसे बनाएं:**\n\n**विकल्प 1 — चैट से (अनुशंसित):**\nबस कहें:\n• \"मैं मार्च तक न्यूज़लेटर लॉन्च करना चाहता हूं\"\nJARVIS ऑटो-डिटेक्ट करेगा!\n\n**विकल्प 2 — मैन्युअल:**\n**उद्देश्य** → **नया उद्देश्य** → वर्णन करें → JARVIS योजना बनाता है।",
        te: "🎯 **లక్ష్యం ఎలా సృష్టించాలి:**\n\n**ఆప్షన్ 1 — చాట్ ద్వారా (సిఫార్సు):**\nఇలా చెప్పండి:\n• \"నేను మార్చి నాటికి న్యూస్‌లెటర్ లాంచ్ చేయాలనుకుంటున్నాను\"\nJARVIS ఆటో-డిటెక్ట్ చేస్తుంది!\n\n**ఆప్షన్ 2 — మాన్యువల్:**\n**లక్ష్యాలు** → **కొత్త లక్ష్యం** → వివరించండి.",
      };
      return msgs[lang] || msgs.en;
    }
    case 'auto_capture': {
      const msgs = {
        en: "✨ **How auto-capture works:**\n\nWhen you chat with JARVIS, it automatically detects and saves:\n\n💡 **Learnings** — \"I learned that...\", \"Never do X again\"\n⚖️ **Decisions** — \"I decided to...\", \"I'm switching to...\"\n🎯 **Objectives** — \"I want to...\", \"My goal is...\"\n\nYou'll see toast notifications pop up when something is captured. No forms needed — just talk naturally!\n\nEverything gets tagged and searchable across all pages.",
        hi: "✨ **ऑटो-कैप्चर कैसे काम करता है:**\n\nजब आप JARVIS से बात करते हैं, यह ऑटो-डिटेक्ट करता है:\n\n💡 **सीखें** — \"मैंने सीखा कि...\"\n⚖️ **निर्णय** — \"मैंने निर्णय लिया...\"\n🎯 **उद्देश्य** — \"मैं चाहता हूं...\"\n\nटोस्ट नोटिफिकेशन दिखाई देगा!",
        te: "✨ **ఆటో-క్యాప్చర్ ఎలా పనిచేస్తుంది:**\n\nమీరు JARVIS తో మాట్లాడినప్పుడు, ఇది ఆటో-డిటెక్ట్ చేస్తుంది:\n\n💡 **నేర్చుకున్నవి** — \"నేను నేర్చుకున్నాను...\"\n⚖️ **నిర్ణయాలు** — \"నేను నిర్ణయించాను...\"\n🎯 **లక్ష్యాలు** — \"నేను కావాలి...\"\n\nటోస్ట్ నోటిఫికేషన్ వస్తుంది!",
      };
      return msgs[lang] || msgs.en;
    }
    case 'nav_chat':
      dispatch({ type: 'SET_VIEW', payload: 'chat' });
      return lang === 'hi' ? "✅ आपको चैट पेज पर ले जाया गया!" : lang === 'te' ? "✅ మిమ్మల్ని చాట్ పేజీకి తీసుకెళ్ళారు!" : "✅ Navigated to **Chat** page! You can now talk to JARVIS.";
    case 'nav_objectives':
      dispatch({ type: 'SET_VIEW', payload: 'objectives' });
      return lang === 'hi' ? "✅ आपको उद्देश्य पेज पर ले जाया गया!" : lang === 'te' ? "✅ మిమ్మల్ని లక్ష్యాల పేజీకి తీసుకెళ్ళారు!" : "✅ Navigated to **Objectives** page! You can see all your goals and plans here.";
    case 'nav_learnings':
      dispatch({ type: 'SET_VIEW', payload: 'learnings' });
      return lang === 'hi' ? "✅ आपको सीखें पेज पर ले जाया गया!" : lang === 'te' ? "✅ మిమ్మల్ని నేర్చుకున్నవి పేజీకి తీసుకెళ్ళారు!" : "✅ Navigated to **Learnings** page! Filter by tags or check analytics.";
    case 'nav_dashboard':
      dispatch({ type: 'SET_VIEW', payload: 'dashboard' });
      return lang === 'hi' ? "✅ डैशबोर्ड पर ले जाया गया!" : lang === 'te' ? "✅ డ్యాష్‌బోర్డ్‌కు తీసుకెళ్ళారు!" : "✅ Navigated to **Dashboard**!";
    case 'nav_decisions':
      dispatch({ type: 'SET_VIEW', payload: 'decisions' });
      return lang === 'hi' ? "✅ निर्णय पेज पर ले जाया गया!" : lang === 'te' ? "✅ నిర్ణయాల పేజీకి తీసుకెళ్ళారు!" : "✅ Navigated to **Decisions** page!";
    case 'nav_reflections':
      dispatch({ type: 'SET_VIEW', payload: 'reflections' });
      return lang === 'hi' ? "✅ चिंतन पेज पर ले जाया गया!" : lang === 'te' ? "✅ ప్రతిబింబాల పేజీకి తీసుకెళ్ళారు!" : "✅ Navigated to **Reflections** page!";
    case 'current_page': {
      const viewLabels = {
        en: { chat: 'Chat', dashboard: 'Dashboard', learnings: 'Learnings', decisions: 'Decisions', reflections: 'Reflections', objectives: 'Objectives' },
        hi: { chat: 'चैट', dashboard: 'डैशबोर्ड', learnings: 'सीखें', decisions: 'निर्णय', reflections: 'चिंतन', objectives: 'उद्देश्य' },
        te: { chat: 'చాట్', dashboard: 'డ్యాష్‌బోర్డ్', learnings: 'నేర్చుకున్నవి', decisions: 'నిర్ణయాలు', reflections: 'ప్రతిబింబాలు', objectives: 'లక్ష్యాలు' },
      };
      const labels = viewLabels[lang] || viewLabels.en;
      const pageName = labels[currentView] || currentView;
      const pageGuide = guide[currentView] || en[currentView];
      if (pageGuide) {
        return `📍 ${lang === 'hi' ? 'आप वर्तमान में' : lang === 'te' ? 'మీరు ప్రస్తుతం' : "You're currently on"} **${pageName}**\n\n**${lang === 'hi' ? 'यह क्या है' : lang === 'te' ? 'ఇది ఏమిటి' : 'What it is'}:** ${pageGuide.what}\n**${lang === 'hi' ? 'कैसे उपयोग करें' : lang === 'te' ? 'ఎలా ఉపయోగించాలి' : 'How to use'}:** ${pageGuide.how}\n**${lang === 'hi' ? 'कब उपयोग करें' : lang === 'te' ? 'ఎప్పుడు ఉపయోగించాలి' : 'When to use'}:** ${pageGuide.when}`;
      }
      return `📍 You're on the **${pageName}** page.`;
    }
    default:
      return null;
  }
}

// ─── Smart local response (no API needed) ─────────────────
function getSmartResponse(input, lang, currentView, dispatch) {
  const lower = input.toLowerCase().trim();
  const guide = getGuide(lang);

  // Navigation intents
  if (/\b(go to|take me to|open|navigate|show me)\b.*\b(chat)\b/i.test(lower) || /\bचैट\b/i.test(lower) && /\b(ले जा|खोल)\b/i.test(lower) || /\bచాట్\b/i.test(lower)) {
    return getActionResponse('nav_chat', lang, currentView, dispatch);
  }
  if (/\b(go to|take me to|open|navigate|show me)\b.*\b(objective|goal)/i.test(lower) || /\bउद्देश्य\b/i.test(lower) || /\bలక్ష్యాల\b/i.test(lower)) {
    return getActionResponse('nav_objectives', lang, currentView, dispatch);
  }
  if (/\b(go to|take me to|open|navigate|show me)\b.*\b(learning|insight)/i.test(lower) || /\bसीख\b/i.test(lower) || /\bనేర్చుకున్నవి\b/i.test(lower)) {
    return getActionResponse('nav_learnings', lang, currentView, dispatch);
  }
  if (/\b(go to|take me to|open|navigate|show me)\b.*\b(dashboard)/i.test(lower) || /\bडैशबोर्ड\b/i.test(lower) || /\bడ్యాష్‌బోర్డ్\b/i.test(lower)) {
    return getActionResponse('nav_dashboard', lang, currentView, dispatch);
  }
  if (/\b(go to|take me to|open|navigate|show me)\b.*\b(decision)/i.test(lower) || /\bनिर्णय\b/i.test(lower) || /\bనిర్ణయాల\b/i.test(lower)) {
    return getActionResponse('nav_decisions', lang, currentView, dispatch);
  }
  if (/\b(go to|take me to|open|navigate|show me)\b.*\b(reflect)/i.test(lower) || /\bचिंतन\b/i.test(lower) || /\bప్రతిబింబాల\b/i.test(lower)) {
    return getActionResponse('nav_reflections', lang, currentView, dispatch);
  }

  // Page info intents
  if (/\b(where am i|current page|which page|what page)\b/i.test(lower) || /\bकिस पेज\b/i.test(lower) || /\bఏ పేజీ\b/i.test(lower)) {
    return getActionResponse('current_page', lang, currentView, dispatch);
  }

  // Feature explanation intents
  if (/\b(create|make|add|new)\b.*\b(objective|goal)\b/i.test(lower) || /\bउद्देश्य.*बना\b/i.test(lower) || /\bలక్ష్యం.*సృష్టి\b/i.test(lower)) {
    return getActionResponse('create_objective', lang, currentView, dispatch);
  }
  if (/\b(auto.?capture|auto.?save|auto.?detect)\b/i.test(lower) || /\bऑटो/i.test(lower) || /\bఆటో/i.test(lower)) {
    return getActionResponse('auto_capture', lang, currentView, dispatch);
  }

  // About specific pages
  const pages = ['chat', 'dashboard', 'learnings', 'decisions', 'reflections', 'objectives'];
  for (const page of pages) {
    if (lower.includes(page) && (/\b(what|how|when|tell|explain|about)\b/i.test(lower))) {
      const pg = guide[page];
      if (pg) {
        return `${pg.title}\n\n**${lang === 'hi' ? 'क्या' : lang === 'te' ? 'ఏమిటి' : 'What'}:** ${pg.what}\n**${lang === 'hi' ? 'कैसे' : lang === 'te' ? 'ఎలా' : 'How'}:** ${pg.how}\n**${lang === 'hi' ? 'कब' : lang === 'te' ? 'ఎప్పుడు' : 'When'}:** ${pg.when}\n\n${lang === 'hi' ? '💡 सुझाव' : lang === 'te' ? '💡 చిట్కాలు' : '💡 Tips'}:\n${(pg.tips || []).map(t => `• ${t}`).join('\n')}`;
      }
    }
  }

  // Help / what can you do
  if (/\b(help|what can you|features|how to use|guide|what do)\b/i.test(lower) || /\bमदद\b/i.test(lower) || /\bసహాయం\b/i.test(lower)) {
    const msgs = {
      en: "🤖 **Here's what I can help with:**\n\n🧭 **Navigate** — Say \"take me to Objectives\" or \"open Learnings\"\n📍 **Current page** — Ask \"where am I?\" to get info about this page\n📖 **Explain features** — Ask \"what is the Dashboard?\" or \"how do learnings work?\"\n🎯 **Create things** — Ask \"how do I create an objective?\"\n✨ **Auto-capture** — Ask \"how does auto-capture work?\"\n🌐 **Language** — Switch language using the globe button below!\n\nJust ask me anything!",
      hi: "🤖 **मैं इसमें मदद कर सकता हूं:**\n\n🧭 **नेविगेट करें** — \"चैट पर ले जाओ\" कहें\n📍 **वर्तमान पेज** — \"मैं किस पेज पर हूं?\" पूछें\n📖 **फीचर्स समझें** — \"डैशबोर्ड क्या है?\" पूछें\n🌐 **भाषा** — नीचे ग्लोब बटन से बदलें!",
      te: "🤖 **నేను దీనిలో సహాయం చేయగలను:**\n\n🧭 **నావిగేట్** — \"చాట్‌కు తీసుకెళ్ళు\" అని చెప్పండి\n📍 **ప్రస్తుత పేజీ** — \"నేను ఏ పేజీలో ఉన్నాను?\" అని అడగండి\n📖 **ఫీచర్లు** — \"డ్యాష్‌బోర్డ్ ఏమిటి?\" అని అడగండి\n🌐 **భాష** — గ్లోబ్ బటన్‌తో మార్చండి!",
    };
    return msgs[lang] || msgs.en;
  }

  // Greeting
  if (/^(hi|hello|hey|hola|bonjour|namaste|నమస్కారం|नमस्ते)/i.test(lower)) {
    return guide.welcome;
  }

  // Default — context-aware
  const pg = guide[currentView];
  if (pg) {
    const msgs = {
      en: `I'm not sure about that, but here's what you can do on this page:\n\n${pg.title}\n${pg.what}\n\n💡 Tips:\n${(pg.tips || []).map(t => `• ${t}`).join('\n')}\n\nTry asking \"help\" to see all my capabilities!`,
      hi: `इस पेज पर आप यह कर सकते हैं:\n\n${pg.title}\n${pg.what}\n\n\"मदद\" पूछें!`,
      te: `ఈ పేజీలో మీరు చేయగలిగేది:\n\n${pg.title}\n${pg.what}\n\n\"సహాయం\" అని అడగండి!`,
    };
    return msgs[lang] || msgs.en;
  }

  return lang === 'hi' ? "क्षमा करें, मैं समझ नहीं पाया। \"मदद\" टाइप करें!" : lang === 'te' ? "క్షమించండి, నాకు అర్థం కాలేదు. \"సహాయం\" అని టైప్ చేయండి!" : "I'm not sure about that. Type **\"help\"** to see what I can do! 🤖";
}

// ─── Format bot text with simple markdown ─────────────────
function formatBotText(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
    .replace(/• /g, '&bull; ');
}

// ═══════════════════════════════════════════════════════════
// GUIDE BOT WIDGET COMPONENT
// ═══════════════════════════════════════════════════════════
export default function GuideBotWidget() {
  const { state, dispatch } = useApp();
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState('en');
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const langPickerRef = useRef(null);

  // Show welcome on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      const guide = getGuide(lang);
      setMessages([{ role: 'bot', content: guide.welcome }]);
    }
  }, [open]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  // Focus input
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Close lang picker on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (langPickerRef.current && !langPickerRef.current.contains(e.target)) {
        setShowLangPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Change language
  const switchLang = useCallback((code) => {
    setLang(code);
    setShowLangPicker(false);
    const guide = getGuide(code);
    setMessages(prev => [...prev, { role: 'bot', content: guide.welcome }]);
  }, []);

  // Handle send
  const handleSend = useCallback(() => {
    const msg = input.trim();
    if (!msg) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setTyping(true);

    // Simulate tiny delay for natural feel
    setTimeout(() => {
      const response = getSmartResponse(msg, lang, state.activeView, dispatch);
      setMessages(prev => [...prev, { role: 'bot', content: response }]);
      setTyping(false);
    }, 400 + Math.random() * 400);
  }, [input, lang, state.activeView, dispatch]);

  // Handle quick action
  const handleQuickAction = useCallback((action, label) => {
    setMessages(prev => [...prev, { role: 'user', content: label }]);
    setTyping(true);
    setTimeout(() => {
      const response = getActionResponse(action, lang, state.activeView, dispatch);
      if (response) {
        setMessages(prev => [...prev, { role: 'bot', content: response }]);
      }
      setTyping(false);
    }, 300);
  }, [lang, state.activeView, dispatch]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const guide = getGuide(lang);
  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  return (
    <>
      {/* ─── Floating Button ─── */}
      <button
        onClick={() => setOpen(!open)}
        className="guide-bot-fab"
        title="Guide Bot — Help & Navigation"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && <span className="guide-bot-fab-badge">?</span>}
      </button>

      {/* ─── Chat Window ─── */}
      {open && (
        <div className="guide-bot-window">
          {/* Header */}
          <div className="guide-bot-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="guide-bot-avatar">
                <Sparkles size={16} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'white' }}>JARVIS Guide</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 }}>
                  {lang === 'hi' ? 'बहुभाषी सहायक' : lang === 'te' ? 'బహుభాషా సహాయకుడు' : 'Multilingual Help & Navigation'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Language picker */}
              <div ref={langPickerRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowLangPicker(!showLangPicker)}
                  className="guide-bot-lang-btn"
                  title="Change language"
                >
                  <Globe size={14} />
                  <span>{currentLang.flag}</span>
                </button>
                {showLangPicker && (
                  <div className="guide-bot-lang-dropdown">
                    {LANGUAGES.map(l => (
                      <button
                        key={l.code}
                        onClick={() => switchLang(l.code)}
                        className={`guide-bot-lang-option ${lang === l.code ? 'active' : ''}`}
                      >
                        <span>{l.flag}</span>
                        <span>{l.label}</span>
                        {lang === l.code && <span style={{ marginLeft: 'auto', color: '#10b981' }}>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setOpen(false)} className="guide-bot-close-btn">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="guide-bot-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`guide-bot-msg ${msg.role}`}>
                {msg.role === 'bot' && (
                  <div className="guide-bot-msg-avatar">
                    <Bot size={12} />
                  </div>
                )}
                <div
                  className={`guide-bot-msg-bubble ${msg.role}`}
                  dangerouslySetInnerHTML={{ __html: formatBotText(msg.content) }}
                />
              </div>
            ))}
            {typing && (
              <div className="guide-bot-msg bot">
                <div className="guide-bot-msg-avatar"><Bot size={12} /></div>
                <div className="guide-bot-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          {messages.length <= 2 && (
            <div className="guide-bot-quick-actions">
              {(guide.quickActions || []).map((qa, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickAction(qa.action, qa.label)}
                  className="guide-bot-quick-btn"
                >
                  <ChevronRight size={12} />
                  {qa.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="guide-bot-input-bar">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={lang === 'hi' ? 'कुछ भी पूछें...' : lang === 'te' ? 'ఏదైనా అడగండి...' : 'Ask anything...'}
              className="guide-bot-input"
            />
            <button onClick={handleSend} disabled={!input.trim()} className="guide-bot-send">
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
