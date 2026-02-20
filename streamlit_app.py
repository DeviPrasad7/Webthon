"""
JARVIS — Personal Business Assistant
Streamlit UI: Chat interface + Dashboard
Clean, white bg, black text, covers all features.
"""
import os
import json
import time
import streamlit as st
import requests

API = os.environ.get("API_BASE", "http://localhost:8000/api/v1")

# ─── Page Config ────────────────────────────────────────────────────
st.set_page_config(
    page_title="JARVIS — Personal Business Assistant",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─── Clean CSS: white bg, black text, readable everywhere ──────────
st.markdown("""
<style>
    /* Force light theme */
    .stApp { background-color: #ffffff; color: #1a1a1a; }
    section[data-testid="stSidebar"] { background-color: #f5f5f5; }

    /* Cards */
    .jarvis-card {
        background: #ffffff; color: #1a1a1a;
        border: 1px solid #e0e0e0; border-radius: 10px;
        padding: 1rem 1.2rem; margin-bottom: 0.8rem;
        border-left: 4px solid #4a6cf7;
    }
    .jarvis-card h4 { margin: 0 0 0.4rem 0; color: #1a1a1a; }
    .jarvis-card p  { margin: 0.2rem 0; color: #333; font-size: 0.92rem; }
    .jarvis-card small { color: #888; }

    /* Chat bubbles */
    .chat-user {
        background: #4a6cf7; color: #fff; border-radius: 16px 16px 4px 16px;
        padding: 0.8rem 1.2rem; margin: 0.4rem 0; max-width: 80%;
        margin-left: auto; text-align: right;
    }
    .chat-jarvis {
        background: #f0f2f6; color: #1a1a1a; border-radius: 16px 16px 16px 4px;
        padding: 0.8rem 1.2rem; margin: 0.4rem 0; max-width: 85%;
    }
    .chat-jarvis h4 { margin: 0 0 0.3rem 0; font-size: 1rem; }
    .chat-jarvis ul { margin: 0.3rem 0; padding-left: 1.2rem; }
    .chat-jarvis li { margin: 0.15rem 0; }

    /* Tags */
    .tag {
        display: inline-block; background: #e8eaf6; color: #3949ab;
        padding: 2px 10px; border-radius: 12px; font-size: 0.78rem; margin: 2px;
    }

    /* Metrics */
    div[data-testid="stMetric"] { background: #f8f9fa; border-radius: 10px; padding: 10px; }
    div[data-testid="stMetric"] label { color: #555 !important; }
    div[data-testid="stMetric"] div[data-testid="stMetricValue"] { color: #1a1a1a !important; }

    /* Remove Streamlit branding */
    #MainMenu, footer, header { visibility: hidden; }
</style>
""", unsafe_allow_html=True)


# ═══════════════════════════════════════════════════════════════════
# API helpers (simple, no classes needed)
# ═══════════════════════════════════════════════════════════════════
def api_get(path, params=None):
    try:
        r = requests.get(f"{API}{path}", params=params, timeout=30)
        r.raise_for_status()
        return r.json()
    except requests.ConnectionError:
        st.error("⚠️ Cannot connect to JARVIS backend. Is it running?")
        return None
    except requests.HTTPError as e:
        if e.response.status_code == 404:
            return None
        st.error(f"API Error: {e.response.text}")
        return None


def api_post(path, json_data=None, files=None):
    try:
        r = requests.post(f"{API}{path}", json=json_data, files=files, timeout=120)
        r.raise_for_status()
        return r.json()
    except requests.ConnectionError:
        st.error("⚠️ Cannot connect to JARVIS backend. Is it running?")
        return None
    except requests.HTTPError as e:
        st.error(f"API Error: {e.response.text}")
        return None


# ═══════════════════════════════════════════════════════════════════
# Chat state
# ═══════════════════════════════════════════════════════════════════
if "messages" not in st.session_state:
    st.session_state.messages = [
        {"role": "jarvis", "content": (
            "👋 Hi! I'm <b>JARVIS</b>, your personal business assistant.<br><br>"
            "I can help you:<br>"
            "• 📝 <b>Capture objectives</b> — tell me what you're working on<br>"
            "• 💡 <b>Record learnings</b> — what did you learn?<br>"
            "• ⚖️ <b>Log decisions</b> — document your choices<br>"
            "• 🪞 <b>Reflect</b> — ask me to find patterns in your thinking<br>"
            "• 🔍 <b>Search</b> — search all your knowledge by meaning<br><br>"
            "Just type naturally! Or use the quick actions in the sidebar."
        )}
    ]


# ═══════════════════════════════════════════════════════════════════
# Sidebar: Dashboard + Quick Actions
# ═══════════════════════════════════════════════════════════════════
with st.sidebar:
    st.markdown("## 🤖 JARVIS")
    st.caption("Personal Business Assistant")
    st.divider()

    # ── Dashboard metrics ──
    st.markdown("### 📊 Dashboard")
    objectives = api_get("/objectives", {"limit": 100}) or []
    learnings_list = api_get("/learnings", {"limit": 100}) or []
    decisions_list = api_get("/decisions", {"limit": 100}) or []
    reflections_list = api_get("/reflections", {"limit": 100}) or []

    c1, c2 = st.columns(2)
    c1.metric("📋 Objectives", len(objectives))
    c2.metric("💡 Learnings", len(learnings_list))
    c3, c4 = st.columns(2)
    c3.metric("⚖️ Decisions", len(decisions_list))
    c4.metric("🪞 Reflections", len(reflections_list))

    # Active objectives
    active = [o for o in objectives if o["status"] in ("approved", "in_progress")]
    if active:
        st.markdown("#### 🔄 Active")
        for o in active[:5]:
            pct = o.get("workdone", 0)
            st.progress(pct / 100, text=f"{o['what'][:40]}… {pct}%")

    st.divider()

    # ── Quick actions ──
    st.markdown("### ⚡ Quick Actions")
    action = st.selectbox(
        "Choose action",
        ["💬 Chat (default)", "📝 New Objective", "💡 Add Learning",
         "⚖️ Log Decision", "🪞 Reflect", "🔍 Search Knowledge",
         "📋 Browse Objectives", "📜 Browse History"],
        label_visibility="collapsed",
    )

    st.divider()
    st.caption("FastAPI • Redis • Postgres • Qdrant • Groq")


# ═══════════════════════════════════════════════════════════════════
# Helper: render chat message
# ═══════════════════════════════════════════════════════════════════
def render_msg(role, content):
    if role == "user":
        st.markdown(f'<div class="chat-user">{content}</div>', unsafe_allow_html=True)
    else:
        st.markdown(f'<div class="chat-jarvis">{content}</div>', unsafe_allow_html=True)


def add_msg(role, content):
    st.session_state.messages.append({"role": role, "content": content})


STATUS_EMOJI = {
    "staging": "🟡", "planning": "🔵", "awaiting_approval": "🟠",
    "approved": "🟢", "in_progress": "🔄", "completed": "✅", "failed": "❌",
}
CAT_EMOJI = {
    "insight": "💡", "mistake": "⚠️", "success": "🏆",
    "pattern": "🔄", "tool": "🛠️", "process": "📐",
}


# ═══════════════════════════════════════════════════════════════════
# Main area rendering based on action
# ═══════════════════════════════════════════════════════════════════

# ── CHAT (default) ──────────────────────────────────────────────────
if action == "💬 Chat (default)":
    st.markdown("## 💬 Chat with JARVIS")

    # Render history
    for msg in st.session_state.messages:
        render_msg(msg["role"], msg["content"])

    # Input
    user_input = st.chat_input("Tell JARVIS what's on your mind…")
    if user_input:
        add_msg("user", user_input)
        render_msg("user", user_input)

        lower = user_input.lower().strip()

        # Simple intent routing
        if any(kw in lower for kw in ["search", "find", "look for", "what do i know about"]):
            with st.spinner("Searching your knowledge…"):
                results = api_post("/search", {"query": user_input, "limit": 5})
            if results:
                lines = [f"<h4>🔍 Found {len(results)} results</h4>"]
                for r in results:
                    p = r.get("payload", {})
                    t = p.get("_type", "unknown")
                    s = r.get("score", 0)
                    text = p.get("what", p.get("content", p.get("decision", p.get("trigger", ""))))
                    lines.append(f"• <b>[{t}]</b> (score {s:.2f}) — {text[:120]}")
                reply = "<br>".join(lines)
            else:
                reply = "No results found. Try a different query?"
            add_msg("jarvis", reply)

        elif any(kw in lower for kw in ["reflect", "pattern", "what do you see", "analyze"]):
            with st.spinner("JARVIS is reflecting…"):
                result = api_post("/reflect", {"trigger": user_input})
            if result:
                parts = [f"<h4>🪞 Reflection</h4><p>{result['summary']}</p>"]
                if result.get("patterns_identified"):
                    parts.append("<b>Patterns:</b><ul>" + "".join(f"<li>{p}</li>" for p in result["patterns_identified"]) + "</ul>")
                if result.get("suggestions"):
                    parts.append("<b>Suggestions:</b><ul>" + "".join(f"<li>{s}</li>" for s in result["suggestions"]) + "</ul>")
                reply = "".join(parts)
            else:
                reply = "I couldn't generate a reflection right now. Please try again."
            add_msg("jarvis", reply)

        elif any(kw in lower for kw in ["learned", "learning", "lesson", "takeaway"]):
            with st.spinner("Capturing learning…"):
                result = api_post("/learnings", {"content": user_input, "category": "insight", "tags": []})
            if result:
                reply = f"💡 <b>Learning captured!</b><br>{result['content']}<br><small>ID: {result['id']}</small>"
            else:
                reply = "Couldn't save that learning. Please try again."
            add_msg("jarvis", reply)

        elif any(kw in lower for kw in ["decided", "decision", "chose", "going with"]):
            with st.spinner("Logging decision…"):
                result = api_post("/decisions", {
                    "decision": user_input, "why": "Captured from chat",
                    "context": "Chat conversation", "expected_outcome": "", "tags": []
                })
            if result:
                reply = f"⚖️ <b>Decision logged!</b><br>{result['decision']}<br><small>ID: {result['id']}</small>"
            else:
                reply = "Couldn't log that decision. Please try again."
            add_msg("jarvis", reply)

        else:
            # Default: treat as objective input
            with st.spinner("Processing your input…"):
                result = api_post("/ingest/text", {"text": user_input})
            if result:
                oid = result["objective_id"]
                reply = (
                    f"📝 <b>Got it!</b> I'm structuring your input and drafting a plan.<br>"
                    f"<small>Objective ID: {oid}</small><br><br>⏳ Working on it…"
                )
                add_msg("jarvis", reply)

                # Poll for plan
                plan_found = False
                for _ in range(20):
                    time.sleep(2)
                    status = api_get(f"/objectives/{oid}/status")
                    if status and status.get("plan_draft"):
                        plan = status["plan_draft"]
                        steps_html = "".join(
                            f"<li><b>Step {s['step_number']}</b> (weight {s['weight']}): {s['description']}</li>"
                            for s in plan.get("steps", [])
                        )
                        plan_reply = (
                            f"<h4>📋 Proposed Plan</h4><ul>{steps_html}</ul>"
                            f"<p><small>Use 'Browse Objectives' to approve/reject.</small></p>"
                        )
                        add_msg("jarvis", plan_reply)
                        plan_found = True
                        break
                    elif status and status.get("status") not in ("staging", "not_found"):
                        break

                if not plan_found:
                    add_msg("jarvis", "Still processing — check 'Browse Objectives' in a moment.")
            else:
                add_msg("jarvis", "Something went wrong. Please try again.")

        st.rerun()


# ── NEW OBJECTIVE ──────────────────────────────────────────────────
elif action == "📝 New Objective":
    st.markdown("## 📝 Capture New Objective")
    st.markdown("Tell JARVIS what you're working on, thinking about, or planning.")

    tab_text, tab_file = st.tabs(["✍️ Text Input", "📎 File Upload"])

    with tab_text:
        text = st.text_area(
            "What's on your mind?", height=180,
            placeholder="I need to decide whether to hire a freelance designer or learn Figma myself…",
        )
        if st.button("🚀 Send to JARVIS", type="primary", disabled=not text, key="obj_text"):
            with st.spinner("Processing…"):
                result = api_post("/ingest/text", {"text": text})
            if result:
                st.success(f"✅ Captured! Objective ID: `{result['objective_id']}`")
                st.info("⏳ JARVIS is drafting a plan… check Browse Objectives in ~30s.")

    with tab_file:
        uploaded = st.file_uploader(
            "Upload .txt / .pdf / .docx / .wav / .mp3",
            type=["txt", "pdf", "docx", "wav", "mp3"],
        )
        if uploaded and st.button("🚀 Process File", type="primary", key="obj_file"):
            with st.spinner("Extracting & processing…"):
                result = api_post(
                    "/ingest/file",
                    files={"file": (uploaded.name, uploaded.getvalue(), uploaded.type)},
                )
            if result:
                st.success(f"✅ Captured! Objective ID: `{result['objective_id']}`")


# ── ADD LEARNING ───────────────────────────────────────────────────
elif action == "💡 Add Learning":
    st.markdown("## 💡 Capture a Learning")
    st.markdown("Record what you've learned — from successes, mistakes, and patterns.")

    with st.form("learning_form"):
        content = st.text_area("What did you learn?", height=120)
        c1, c2 = st.columns(2)
        with c1:
            category = st.selectbox(
                "Category", ["insight", "mistake", "success", "pattern", "tool", "process"],
            )
        with c2:
            tags_str = st.text_input("Tags (comma-separated)", placeholder="pricing, clients")
        submitted = st.form_submit_button("💡 Capture Learning", type="primary")

    if submitted and content:
        tags = [t.strip() for t in tags_str.split(",") if t.strip()] if tags_str else []
        result = api_post("/learnings", {"content": content, "category": category, "tags": tags})
        if result:
            st.success(f"✅ Learning captured! ID: `{result['id']}`")

    # Recent
    st.divider()
    st.markdown("### Recent Learnings")
    for l in (api_get("/learnings", {"limit": 15}) or []):
        emoji = CAT_EMOJI.get(l["category"], "💡")
        tags_html = " ".join(f'<span class="tag">{t}</span>' for t in l.get("tags", []))
        st.markdown(
            f'<div class="jarvis-card"><h4>{emoji} [{l["category"]}]</h4>'
            f'<p>{l["content"]}</p>'
            f'<small>Confidence: {l["confidence"]:.0%} {tags_html}</small></div>',
            unsafe_allow_html=True,
        )


# ── LOG DECISION ───────────────────────────────────────────────────
elif action == "⚖️ Log Decision":
    st.markdown("## ⚖️ Log a Decision")
    st.markdown("Record your decisions and reasoning — future you will thank you.")

    with st.form("decision_form"):
        decision = st.text_input("What did you decide?")
        why = st.text_area("Why?", height=80)
        context = st.text_area("Context / situation", height=80)
        alternatives = st.text_input(
            "Alternatives considered (comma-separated)", placeholder="Option A, Option B",
        )
        expected_outcome = st.text_input("Expected outcome")
        tags_str = st.text_input("Tags (comma-separated)")
        submitted = st.form_submit_button("⚖️ Log Decision", type="primary")

    if submitted and decision and why:
        tags = [t.strip() for t in tags_str.split(",") if t.strip()] if tags_str else []
        alts = [a.strip() for a in alternatives.split(",") if a.strip()] if alternatives else []
        result = api_post("/decisions", {
            "decision": decision, "why": why, "context": context,
            "alternatives_considered": alts, "expected_outcome": expected_outcome, "tags": tags,
        })
        if result:
            st.success(f"✅ Decision logged! ID: `{result['id']}`")

    st.divider()
    st.markdown("### Recent Decisions")
    for d in (api_get("/decisions", {"limit": 10}) or []):
        tags_html = " ".join(f'<span class="tag">{t}</span>' for t in d.get("tags", []))
        st.markdown(
            f'<div class="jarvis-card"><h4>⚖️ {d["decision"]}</h4>'
            f'<p><b>Why:</b> {d["why"]}</p>'
            f'<p><b>Context:</b> {d["context"]}</p>'
            f'<p><b>Expected:</b> {d["expected_outcome"]}</p>'
            f'<small>{tags_html}</small></div>',
            unsafe_allow_html=True,
        )


# ── REFLECT ────────────────────────────────────────────────────────
elif action == "🪞 Reflect":
    st.markdown("## 🪞 Reflect with JARVIS")
    st.markdown("Ask JARVIS to analyze patterns in your objectives, learnings, and decisions.")

    trigger = st.text_area(
        "What would you like to reflect on?", height=120,
        placeholder="Am I spending too much time on low-value clients?",
    )
    if st.button("🪞 Reflect", type="primary", disabled=not trigger):
        with st.spinner("JARVIS is thinking deeply…"):
            result = api_post("/reflect", {"trigger": trigger})
        if result:
            st.markdown(
                f'<div class="jarvis-card"><h4>💭 Reflection</h4><p>{result["summary"]}</p></div>',
                unsafe_allow_html=True,
            )
            if result.get("patterns_identified"):
                st.markdown("#### 🔄 Patterns Identified")
                for p in result["patterns_identified"]:
                    st.markdown(f"- {p}")
            if result.get("suggestions"):
                st.markdown("#### 💡 Suggestions")
                for s in result["suggestions"]:
                    st.markdown(f"- {s}")

    st.divider()
    st.markdown("### Past Reflections")
    for r in (api_get("/reflections", {"limit": 10}) or []):
        with st.expander(f"🪞 {r['trigger'][:80]}…"):
            st.markdown(r["summary"])
            if r.get("patterns_identified"):
                st.markdown("**Patterns:** " + " • ".join(r["patterns_identified"]))
            if r.get("suggestions"):
                st.markdown("**Suggestions:** " + " • ".join(r["suggestions"]))


# ── SEARCH KNOWLEDGE ──────────────────────────────────────────────
elif action == "🔍 Search Knowledge":
    st.markdown("## 🔍 Search Your Knowledge")
    st.markdown("Search across objectives, learnings, decisions, and reflections by meaning.")

    query = st.text_input("Search query", placeholder="pricing strategy for premium clients")
    limit = st.slider("Max results", 1, 20, 5)

    if st.button("🔍 Search", type="primary", disabled=not query):
        with st.spinner("Searching…"):
            results = api_post("/search", {"query": query, "limit": limit})
        if results:
            st.success(f"Found {len(results)} results")
            for r in results:
                p = r.get("payload", {})
                t = p.get("_type", "objective")
                emoji = {"objective": "📋", "learning": "💡", "decision": "⚖️", "reflection": "🪞"}.get(t, "📄")
                score = r.get("score", 0)
                text = p.get("what", p.get("content", p.get("decision", p.get("trigger", "N/A"))))
                st.markdown(
                    f'<div class="jarvis-card">'
                    f'<h4>{emoji} [{t}] — Score: {score:.3f}</h4>'
                    f'<p>{text}</p></div>',
                    unsafe_allow_html=True,
                )
        else:
            st.info("No results found.")


# ── BROWSE OBJECTIVES ─────────────────────────────────────────────
elif action == "📋 Browse Objectives":
    st.markdown("## 📋 My Objectives")

    all_obj = api_get("/objectives", {"limit": 50}) or []
    if not all_obj:
        st.info("No objectives yet. Create one from 'New Objective' or just chat!")
    else:
        for obj in all_obj:
            emoji = STATUS_EMOJI.get(obj["status"], "⚪")
            with st.expander(f"{emoji} {obj['what']} — {obj['workdone']}%"):
                st.markdown(f"**Why:** {obj.get('why') or 'N/A'}")
                st.markdown(f"**Context:** {obj['context']}")
                st.markdown(f"**Expected Output:** {obj['expected_output']}")
                st.markdown(f"**Status:** `{obj['status']}` | **Progress:** {obj['workdone']}%")
                if obj.get("tags"):
                    st.markdown("**Tags:** " + " ".join(f"`{t}`" for t in obj["tags"]))

                # Plan steps
                if obj.get("plan"):
                    st.markdown("---")
                    st.markdown("**Plan Steps:**")
                    for step in obj["plan"]:
                        done = "✅" if step["status"] == "completed" else "⬜"
                        st.markdown(
                            f"{done} **Step {step['step_number']}** "
                            f"(w={step['weight']}): {step['description']}",
                        )

                    pending = [s for s in obj["plan"] if s["status"] != "completed"]
                    if pending:
                        step_num = st.selectbox(
                            "Mark step completed",
                            [s["step_number"] for s in pending],
                            key=f"s_{obj['id']}",
                        )
                        if st.button("✅ Complete Step", key=f"c_{obj['id']}"):
                            r = api_post(
                                f"/objectives/{obj['id']}/progress",
                                {"completed_step": step_num},
                            )
                            if r:
                                st.success(
                                    f"Progress: {r['workdone']}% "
                                    f"({r['completed_steps']}/{r['total_steps']})",
                                )
                                st.rerun()

                # Approve / Reject (if awaiting_approval or staging)
                if obj["status"] in ("staging", "awaiting_approval"):
                    ca, cb = st.columns(2)
                    with ca:
                        if st.button("✅ Approve", key=f"ap_{obj['id']}"):
                            r = api_post(
                                f"/objectives/{obj['id']}/confirm", {"approved": True},
                            )
                            if r:
                                st.success("Plan approved!")
                                st.rerun()
                    with cb:
                        if st.button("❌ Reject", key=f"rj_{obj['id']}"):
                            r = api_post(
                                f"/objectives/{obj['id']}/confirm", {"approved": False},
                            )
                            if r:
                                st.warning("Plan rejected.")
                                st.rerun()

                # Extract learnings
                if obj["status"] in ("completed", "in_progress"):
                    if st.button("💡 Extract Learnings", key=f"el_{obj['id']}"):
                        with st.spinner("AI analyzing…"):
                            extracted = api_post(
                                f"/objectives/{obj['id']}/extract-learnings",
                            )
                        if extracted:
                            st.success(f"Extracted {len(extracted)} learnings!")
                            for l in extracted:
                                st.markdown(f"- **[{l['category']}]** {l['content']}")


# ── BROWSE HISTORY ─────────────────────────────────────────────────
elif action == "📜 Browse History":
    st.markdown("## 📜 Full History")

    tab_l, tab_d, tab_r = st.tabs(["💡 Learnings", "⚖️ Decisions", "🪞 Reflections"])

    with tab_l:
        for l in (api_get("/learnings", {"limit": 30}) or []):
            emoji = CAT_EMOJI.get(l["category"], "💡")
            tags_html = " ".join(f'<span class="tag">{t}</span>' for t in l.get("tags", []))
            st.markdown(
                f'<div class="jarvis-card"><h4>{emoji} [{l["category"]}]</h4>'
                f'<p>{l["content"]}</p>'
                f'<small>Confidence: {l["confidence"]:.0%} | '
                f'{l["created_at"][:10]} {tags_html}</small></div>',
                unsafe_allow_html=True,
            )

    with tab_d:
        for d in (api_get("/decisions", {"limit": 30}) or []):
            tags_html = " ".join(f'<span class="tag">{t}</span>' for t in d.get("tags", []))
            st.markdown(
                f'<div class="jarvis-card"><h4>⚖️ {d["decision"]}</h4>'
                f'<p><b>Why:</b> {d["why"]}</p>'
                f'<p><b>Context:</b> {d["context"]}</p>'
                f'<small>{d["created_at"][:10]} {tags_html}</small></div>',
                unsafe_allow_html=True,
            )

    with tab_r:
        for r in (api_get("/reflections", {"limit": 20}) or []):
            st.markdown(
                f'<div class="jarvis-card"><h4>🪞 {r["trigger"][:80]}</h4>'
                f'<p>{r["summary"]}</p>'
                f'<small>{r["created_at"][:10]}</small></div>',
                unsafe_allow_html=True,
            )
