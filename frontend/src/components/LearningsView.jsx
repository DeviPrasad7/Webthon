import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  Lightbulb, Plus, X, AlertTriangle, CheckCircle, Zap, Wrench,
  Repeat, Eye, Tag, Hash, Clock, Filter, ChevronDown, Search,
  BarChart3, PieChart as PieChartIcon, TrendingUp, Activity
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';

const categoryConfig = {
  mistake: { icon: AlertTriangle, color: 'tag-danger', emoji: '⚠️', label: 'Mistakes', gradient: 'linear-gradient(135deg, #ef4444, #f97316)', chartColor: '#ef4444' },
  insight: { icon: Zap, color: 'tag-info', emoji: '💡', label: 'Insights', gradient: 'linear-gradient(135deg, #3b82f6, #6366f1)', chartColor: '#6366f1' },
  success: { icon: CheckCircle, color: 'tag-success', emoji: '✅', label: 'Successes', gradient: 'linear-gradient(135deg, #10b981, #06b6d4)', chartColor: '#10b981' },
  pattern: { icon: Repeat, color: 'tag-warning', emoji: '🔄', label: 'Patterns', gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)', chartColor: '#f59e0b' },
  tool: { icon: Wrench, color: 'tag-primary', emoji: '🔧', label: 'Tools', gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)', chartColor: '#8b5cf6' },
  process: { icon: Eye, color: 'tag-primary', emoji: '📋', label: 'Process', gradient: 'linear-gradient(135deg, #8b5cf6, #a78bfa)', chartColor: '#a78bfa' },
};

const categoryOrder = ['mistake', 'insight', 'success', 'pattern', 'tool', 'process'];

const tagColors = [
  { gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)', bg: 'rgba(99, 102, 241, 0.1)', border: 'rgba(99, 102, 241, 0.2)', text: '#818cf8', chart: '#6366f1' },
  { gradient: 'linear-gradient(135deg, #10b981, #06b6d4)', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.2)', text: '#34d399', chart: '#10b981' },
  { gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.2)', text: '#fbbf24', chart: '#f59e0b' },
  { gradient: 'linear-gradient(135deg, #ef4444, #f97316)', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.2)', text: '#f87171', chart: '#ef4444' },
  { gradient: 'linear-gradient(135deg, #3b82f6, #6366f1)', bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.2)', text: '#60a5fa', chart: '#3b82f6' },
  { gradient: 'linear-gradient(135deg, #8b5cf6, #a78bfa)', bg: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.2)', text: '#a78bfa', chart: '#8b5cf6' },
  { gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)', bg: 'rgba(6, 182, 212, 0.1)', border: 'rgba(6, 182, 212, 0.2)', text: '#22d3ee', chart: '#06b6d4' },
  { gradient: 'linear-gradient(135deg, #ec4899, #f43f5e)', bg: 'rgba(236, 72, 153, 0.1)', border: 'rgba(236, 72, 153, 0.2)', text: '#f472b6', chart: '#ec4899' },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(18, 18, 28, 0.95)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10, padding: '10px 14px', backdropFilter: 'blur(12px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <p style={{ color: '#eef0f6', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill, fontSize: 12 }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

function timeAgo(dateStr) {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now - d;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function LearningsView() {
  const { state, loadLearnings, captureLearning } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('insight');
  const [tagsInput, setTagsInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTag, setActiveTag] = useState('all');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => { loadLearnings(); }, [loadLearnings]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
        setTagSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ─── All learnings sorted by latest ───────────────────
  const sortedLearnings = useMemo(() =>
    [...state.learnings].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [state.learnings]
  );

  // ─── All unique tags with counts, sorted by frequency ─
  const tagList = useMemo(() => {
    const map = {};
    for (const l of state.learnings) {
      for (const t of (l.tags || [])) {
        const key = t.toLowerCase().trim();
        if (!map[key]) map[key] = { tag: t, count: 0 };
        map[key].count++;
      }
    }
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [state.learnings]);

  // ─── Build tag color lookup ───────────────────────────
  const tagColorMap = useMemo(() => {
    const m = {};
    tagList.forEach((t, i) => { m[t.tag.toLowerCase().trim()] = tagColors[i % tagColors.length]; });
    return m;
  }, [tagList]);

  // ─── Filtered learnings ───────────────────────────────
  const filteredLearnings = useMemo(() => {
    if (activeTag === 'all') return sortedLearnings;
    const key = activeTag.toLowerCase().trim();
    return sortedLearnings.filter(l =>
      (l.tags || []).some(t => t.toLowerCase().trim() === key)
    );
  }, [activeTag, sortedLearnings]);

  // ─── Category groups (for charts) ─────────────────────
  const groupedByCategory = useMemo(() => {
    const groups = {};
    for (const cat of categoryOrder) groups[cat] = [];
    for (const l of state.learnings) {
      const cat = l.category || 'insight';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(l);
    }
    return groups;
  }, [state.learnings]);

  // ─── Analytics Data ───────────────────────────────────
  const categoryChartData = useMemo(() =>
    categoryOrder.map(cat => ({
      name: categoryConfig[cat].label,
      count: groupedByCategory[cat]?.length || 0,
      fill: categoryConfig[cat].chartColor,
    })).filter(d => d.count > 0),
    [groupedByCategory]
  );

  const tagChartData = useMemo(() =>
    tagList.slice(0, 8).map((t, i) => ({
      name: t.tag,
      count: t.count,
      fill: tagColors[i % tagColors.length].chart,
    })),
    [tagList]
  );

  const timelineData = useMemo(() => {
    const byWeek = {};
    for (const l of state.learnings) {
      const d = new Date(l.created_at);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      if (!byWeek[key]) byWeek[key] = { date: key, total: 0, mistakes: 0, insights: 0, successes: 0 };
      byWeek[key].total++;
      if (l.category === 'mistake') byWeek[key].mistakes++;
      else if (l.category === 'insight') byWeek[key].insights++;
      else if (l.category === 'success') byWeek[key].successes++;
    }
    return Object.values(byWeek).sort((a, b) => a.date.localeCompare(b.date)).slice(-12);
  }, [state.learnings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    try {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      await captureLearning(content, category, tags);
      setContent(''); setCategory('insight'); setTagsInput(''); setShowForm(false);
    } catch (err) {
      alert('Failed to save learning: ' + err.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="page-content">
      <div className="page-grid">
        {/* ═══ Header ═══ */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div className="section-title" style={{ margin: 0 }}>
            <Lightbulb size={18} /> Learnings
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 6 }}>
              ({state.learnings.length})
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={`btn ${showAnalytics ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowAnalytics(!showAnalytics)}
              style={{ padding: '8px 14px' }}
            >
              <Activity size={15} /> Analytics
            </button>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <Plus size={15} /> Capture Learning
            </button>
          </div>
        </div>

        {/* ═══ ANALYTICS PANEL ═══ */}
        {showAnalytics && (
          <div style={{
            marginBottom: 28, animation: 'fadeInUp 0.4s ease-out',
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16,
          }}>
            {/* Category Distribution — Bar Chart */}
            <div style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)', padding: 20, position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--gradient-primary)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <BarChart3 size={16} color="var(--color-primary)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>By Category</span>
              </div>
              {categoryChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={categoryChartData} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" tick={{ fill: '#8b8fa3', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#8b8fa3', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Learnings" radius={[6, 6, 0, 0]}>
                      {categoryChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>No data yet</div>
              )}
            </div>

            {/* Tag Distribution — Pie Chart */}
            <div style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)', padding: 20, position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--gradient-accent)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <PieChartIcon size={16} color="var(--color-cyan)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>By Tag</span>
              </div>
              {tagChartData.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={tagChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        dataKey="count"
                        nameKey="name"
                        paddingAngle={3}
                        strokeWidth={0}
                        label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                          if (percent < 0.05) return null;
                          const RADIAN = Math.PI / 180;
                          const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                          const x = cx + radius * Math.cos(-midAngle * RADIAN);
                          const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          return (
                            <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700}>
                              {`${Math.round(percent * 100)}%`}
                            </text>
                          );
                        }}
                        labelLine={false}
                      >
                        {tagChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Custom legend below the chart */}
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 14px',
                    padding: '4px 8px', maxWidth: '100%',
                  }}>
                    {tagChartData.map((entry, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#8b8fa3' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.fill, flexShrink: 0 }} />
                        <span style={{ whiteSpace: 'nowrap' }}>{entry.name} ({entry.count})</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>No data yet</div>
              )}
            </div>

            {/* Timeline — Area Chart */}
            <div style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)', padding: 20, gridColumn: '1 / -1', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--gradient-success)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <TrendingUp size={16} color="var(--color-success)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>Learning Timeline (Weekly)</span>
              </div>
              {timelineData.length > 1 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={timelineData}>
                    <defs>
                      <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradMistakes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradInsights" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fill: '#8b8fa3', fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                    <YAxis tick={{ fill: '#8b8fa3', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="total" name="Total" stroke="#6366f1" fill="url(#gradTotal)" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} />
                    <Area type="monotone" dataKey="mistakes" name="Mistakes" stroke="#ef4444" fill="url(#gradMistakes)" strokeWidth={1.5} dot={false} />
                    <Area type="monotone" dataKey="insights" name="Insights" stroke="#3b82f6" fill="url(#gradInsights)" strokeWidth={1.5} dot={false} />
                    <Legend iconType="circle" iconSize={8} formatter={(val) => <span style={{ color: '#8b8fa3', fontSize: 11 }}>{val}</span>} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>Need more data points for timeline</div>
              )}
            </div>
          </div>
        )}

        {/* ═══ TAG FILTER DROPDOWN ═══ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          {/* Dropdown */}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => { setDropdownOpen(!dropdownOpen); setTagSearch(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 16px', borderRadius: 'var(--radius-md)',
                background: activeTag !== 'all' ? 'var(--gradient-primary)' : 'var(--color-surface)',
                border: `1px solid ${activeTag !== 'all' ? 'transparent' : 'var(--color-border)'}`,
                color: activeTag !== 'all' ? 'white' : 'var(--color-text-secondary)',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
                transition: 'all 0.2s', minWidth: 180,
                boxShadow: activeTag !== 'all' ? 'var(--shadow-glow)' : 'none',
              }}
            >
              <Filter size={14} />
              <span style={{ flex: 1, textAlign: 'left' }}>
                {activeTag === 'all' ? 'Filter by tag' : `#${activeTag}`}
              </span>
              {activeTag !== 'all' && (
                <span style={{
                  background: 'rgba(255,255,255,0.2)', padding: '1px 7px',
                  borderRadius: 'var(--radius-full)', fontSize: 11, fontWeight: 700,
                }}>
                  {filteredLearnings.length}
                </span>
              )}
              <ChevronDown size={14} style={{
                transition: 'transform 0.2s',
                transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0)',
              }} />
            </button>

            {/* Dropdown panel */}
            {dropdownOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
                minWidth: 260, maxHeight: 360, overflow: 'hidden',
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                animation: 'fadeInUp 0.2s ease-out',
                display: 'flex', flexDirection: 'column',
              }}>
                {/* Search box */}
                <div style={{
                  padding: '10px 12px', borderBottom: '1px solid var(--color-border)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <Search size={14} color="var(--color-text-muted)" />
                  <input
                    autoFocus
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    placeholder="Search tags..."
                    style={{
                      flex: 1, background: 'transparent', border: 'none', outline: 'none',
                      color: 'var(--color-text)', fontSize: 13, fontFamily: 'inherit',
                    }}
                  />
                </div>

                {/* Tag list */}
                <div style={{ overflowY: 'auto', maxHeight: 300, padding: '6px' }}>
                  {/* "All" option */}
                  <button
                    onClick={() => { setActiveTag('all'); setDropdownOpen(false); setTagSearch(''); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '9px 12px', borderRadius: 'var(--radius-sm)',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      fontSize: 13, fontWeight: activeTag === 'all' ? 700 : 500,
                      background: activeTag === 'all' ? 'var(--color-primary-light)' : 'transparent',
                      color: activeTag === 'all' ? 'var(--color-primary-hover)' : 'var(--color-text)',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => { if (activeTag !== 'all') e.target.style.background = 'var(--color-surface-hover)'; }}
                    onMouseLeave={(e) => { if (activeTag !== 'all') e.target.style.background = 'transparent'; }}
                  >
                    <Clock size={14} />
                    <span style={{ flex: 1 }}>All Learnings</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)',
                      background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 'var(--radius-full)',
                    }}>
                      {state.learnings.length}
                    </span>
                  </button>

                  {/* Divider */}
                  <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />

                  {/* Filtered tags */}
                  {tagList
                    .filter(t => !tagSearch || t.tag.toLowerCase().includes(tagSearch.toLowerCase()))
                    .map((t, idx) => {
                      const key = t.tag.toLowerCase().trim();
                      const isActive = activeTag.toLowerCase().trim() === key;
                      const tc = tagColors[idx % tagColors.length];
                      return (
                        <button
                          key={key}
                          onClick={() => { setActiveTag(t.tag); setDropdownOpen(false); setTagSearch(''); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                            padding: '9px 12px', borderRadius: 'var(--radius-sm)',
                            border: 'none', cursor: 'pointer', textAlign: 'left',
                            fontSize: 13, fontWeight: isActive ? 700 : 500,
                            background: isActive ? tc.bg : 'transparent',
                            color: isActive ? tc.text : 'var(--color-text)',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => { if (!isActive) e.target.style.background = 'var(--color-surface-hover)'; }}
                          onMouseLeave={(e) => { if (!isActive) e.target.style.background = 'transparent'; }}
                        >
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: tc.gradient, flexShrink: 0,
                          }} />
                          <span style={{ flex: 1 }}>{t.tag}</span>
                          <span style={{
                            fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)',
                            background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 'var(--radius-full)',
                          }}>
                            {t.count}
                          </span>
                        </button>
                      );
                    })}

                  {tagList.filter(t => !tagSearch || t.tag.toLowerCase().includes(tagSearch.toLowerCase())).length === 0 && (
                    <div style={{
                      padding: '16px 12px', textAlign: 'center',
                      color: 'var(--color-text-muted)', fontSize: 12,
                    }}>
                      No tags matching "{tagSearch}"
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Active tag badge + clear */}
          {activeTag !== 'all' && (
            <>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '6px 14px', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 700,
                background: (tagColorMap[activeTag.toLowerCase().trim()] || tagColors[0]).bg,
                color: (tagColorMap[activeTag.toLowerCase().trim()] || tagColors[0]).text,
                border: `1px solid ${(tagColorMap[activeTag.toLowerCase().trim()] || tagColors[0]).border}`,
              }}>
                <Hash size={11} /> {activeTag}
                <span style={{
                  marginLeft: 2, cursor: 'pointer', opacity: 0.7,
                  display: 'inline-flex', alignItems: 'center',
                }}
                  onClick={() => setActiveTag('all')}
                >
                  <X size={12} />
                </span>
              </span>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {filteredLearnings.length} result{filteredLearnings.length !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>

        {/* ═══ FORM MODAL ═══ */}
        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>💡 Capture a Learning</h3>
                <button className="modal-close" onClick={() => setShowForm(false)}><X size={18} /></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">What did you learn?</label>
                    <textarea className="form-textarea" value={content} onChange={(e) => setContent(e.target.value)}
                      placeholder="Describe your learning, insight, or mistake..." rows={4} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                      <option value="insight">💡 Insight</option>
                      <option value="mistake">⚠️ Mistake</option>
                      <option value="success">✅ Success</option>
                      <option value="pattern">🔄 Pattern</option>
                      <option value="tool">🔧 Tool</option>
                      <option value="process">📋 Process</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tags (comma-separated)</label>
                    <input className="form-input" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)}
                      placeholder="e.g. client-work, pricing, workflow" />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving || !content.trim()}>
                    {saving ? 'Saving...' : 'Save Learning'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ═══ LEARNINGS LIST ═══ */}
        {filteredLearnings.length === 0 ? (
          <div className="empty-state">
            <Lightbulb size={48} />
            <p>
              {activeTag === 'all'
                ? 'No learnings captured yet. Start documenting your insights!'
                : `No learnings tagged with "${activeTag}".`}
            </p>
          </div>
        ) : (
          <div className="card-list">
            {filteredLearnings.map((l) => {
              const cat = l.category || 'insight';
              const cfg = categoryConfig[cat] || categoryConfig.insight;
              const Icon = cfg.icon;
              return (
                <div key={l.id} className="card" style={{ padding: 18 }}>
                  <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: cfg.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, flexShrink: 0,
                      }}>
                        {cfg.emoji}
                      </span>
                      <span className={`tag ${cfg.color}`}>
                        <Icon size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                        {cfg.label}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} />
                      {timeAgo(l.created_at)}
                    </span>
                  </div>
                  <div className="card-body" style={{ marginTop: 4 }}>{l.content}</div>
                  {(l.tags || []).length > 0 && (
                    <div className="card-tags">
                      {l.tags.map((t, i) => {
                        const key = t.toLowerCase().trim();
                        const tc = tagColorMap[key] || tagColors[0];
                        const isActiveTag = activeTag.toLowerCase().trim() === key;
                        return (
                          <span
                            key={i}
                            onClick={() => setActiveTag(isActiveTag ? 'all' : t)}
                            className="tag"
                            style={{
                              cursor: 'pointer',
                              background: isActiveTag ? tc.bg : 'var(--color-primary-light)',
                              color: isActiveTag ? tc.text : 'var(--color-primary-hover)',
                              border: `1px solid ${isActiveTag ? tc.border : 'rgba(99, 102, 241, 0.15)'}`,
                              transition: 'all 0.2s',
                            }}
                          >
                            {t}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
