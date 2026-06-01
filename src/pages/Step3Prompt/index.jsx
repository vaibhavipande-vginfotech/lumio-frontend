import { useState, useRef, useEffect, useMemo } from 'react';
import { generatePreviewHTML } from '../../utils/previewGenerator';
import LiveIframe from '../../components/LiveIframe';
import './Step3Prompt.css';

/* ── Template configs ────────────────────────────────────── */
const ALL_CONFIGS = [
  {
    id: 'tabular',
    name: 'Tabular Report',
    format: 'Tabular',
    match: 96,
    description: 'Clean row-by-row transaction table. Ideal for audit and reconciliation.',
    tags: ['tabular', 'detailed', 'audit'],
  },
  {
    id: 'hierarchical',
    name: 'Hierarchical Report',
    format: 'Hierarchical',
    match: 89,
    description: 'Transactions grouped by time period with sub-totals and running balance.',
    tags: ['hierarchical', 'grouped', 'sub-total'],
  },
  {
    id: 'group-by',
    name: 'Group By Report',
    format: 'Group By',
    match: 83,
    description: 'Transactions separated into Credit and Debit sections with individual totals.',
    tags: ['group-by', 'credits', 'debits'],
  },
  {
    id: 'drill-down',
    name: 'Drill Down Report',
    format: 'Drill Down',
    match: 77,
    description: 'KPI summary cards at top followed by top transactions by value.',
    tags: ['drill-down', 'kpi', 'top-5'],
  },
  {
    id: 'comparative',
    name: 'Comparative Report',
    format: 'Comparative',
    match: 71,
    description: 'Side-by-side month-over-month comparison table with all key metrics.',
    tags: ['comparative', 'monthly', 'trend'],
  },
  {
    id: 'monthly-summary',
    name: 'Monthly Summary',
    format: 'Tabular',
    match: 65,
    description: 'Standard monthly bank statement with opening/closing balance.',
    tags: ['monthly', 'summary', 'standard'],
  },
  {
    id: 'executive-summary',
    name: 'Executive Summary',
    format: 'Drill Down',
    match: 60,
    description: 'Executive-level overview with gold confidential theme and signature block.',
    tags: ['executive', 'kpi', 'signature', 'gold'],
  },
  {
    id: 'branch-activity',
    name: 'Branch Activity',
    format: 'Group By',
    match: 54,
    description: 'Branch-specific activity grouped by type with blue accent theme.',
    tags: ['branch', 'activity', 'running-total'],
  },
];

const QUICK_PROMPTS = [
  'Monthly credit debit summary',
  'Executive report with KPIs',
  'Group transactions by type',
  'Comparative monthly analysis',
  'Hierarchical with period totals',
];

const FOLLOW_UPS = [
  'Show executive format',
  'Group by credit / debit',
  'Compare months side by side',
  'Show hierarchical breakdown',
];

const INITIAL_MESSAGES = [
  {
    role: 'system',
    text: 'Hello! Describe the report you need in plain language and I will match it to the best available template.',
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  },
];

export default function Step3Prompt({ context, send }) {
  const [messages,       setMessages]       = useState(INITIAL_MESSAGES);
  const [input,          setInput]          = useState('');
  const [configs,        setConfigs]        = useState([]);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [showFollowUp,   setShowFollowUp]   = useState(false);
  const [activeTab,      setActiveTab]      = useState('chat');

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const previewHTML = useMemo(() =>
    generatePreviewHTML(
      { importedData: null, edaResult: context.edaResult, promptConfig: null },
      'step3',
      { pendingConfig: selectedConfig }
    ),
    [context.edaResult, selectedConfig]
  );

  function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { role: 'user', text: trimmed, time }]);
    setInput('');
    setConfigs([]);
    setSelectedConfig(null);
    setShowFollowUp(false);
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      const ranked = [...ALL_CONFIGS].sort(() => Math.random() * 0.4 - 0.1);
      setConfigs(ranked);
      setShowFollowUp(true);
      const top = ranked[0];
      setMessages(prev => [...prev, {
        role: 'system',
        text: `Found ${ranked.length} matching templates for "${trimmed}". Top match: "${top.name}" (${top.match}% relevance). Switch to the Templates tab to browse and select.`,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      }]);
      setActiveTab('templates');
    }, 1400);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <>
      {/* ── Simplified Ribbon ─────────────────────────── */}
      <div className="ribbon">
        <div className="ribbon-field">
          <span className="ribbon-field__label">AI Service</span>
          <code className="s3-endpoint">http://localhost:8001/parse-prompt</code>
        </div>

        <div className="ribbon-sep" />

        <div className="ribbon-field">
          <span className="ribbon-field__label">Status</span>
          <span className={'s3-ai-status' + (loading ? ' s3-ai-status--busy' : '')}>
            {loading ? 'Analysing prompt…' : 'Online — Ready'}
          </span>
        </div>

        {selectedConfig && (
          <>
            <div className="ribbon-sep" />
            <div className="ribbon-field">
              <span className="ribbon-field__label">Selected Template</span>
              <span className="s3-selected-name">{selectedConfig.name}</span>
            </div>
          </>
        )}

        <div className="ribbon-spacer" />

        {selectedConfig && (
          <button
            className="ribbon-primary"
            onClick={() => send({ type: 'PROMPT_MATCH_CONFIRMED', config: selectedConfig })}
          >
            Use &ldquo;{selectedConfig.name}&rdquo; &rarr;
          </button>
        )}
      </div>

      {/* ── Workspace ─────────────────────────────────── */}
      <div className="workspace workspace--split s3-workspace">

        {/* ── Left panel ────────────────────────────────── */}
        <div className="s3-left-panel">

          {/* Tab switcher */}
          <div className="s3-tabs">
            <button
              className={'s3-tab' + (activeTab === 'chat' ? ' s3-tab--active' : '')}
              onClick={() => setActiveTab('chat')}
            >
              Chat
              {loading && <span className="s3-tab__dot" />}
            </button>
            <button
              className={'s3-tab' + (activeTab === 'templates' ? ' s3-tab--active' : '')}
              onClick={() => setActiveTab('templates')}
            >
              Templates
              {configs.length > 0 && <span className="s3-tab__badge">{configs.length}</span>}
            </button>
          </div>

          {/* ═══ CHAT TAB ════════════════════════════════ */}
          {activeTab === 'chat' && (
            <div className="s3-chat-pane">
              {/* Chat header */}
              <div className="s3-chat-header">
                <div className="s3-chat-header__avatar">AI</div>
                <div>
                  <div className="s3-chat-header__name">Report Assistant</div>
                  <div className="s3-chat-header__status">
                    {loading ? 'Analysing prompt…' : 'Online'}
                  </div>
                </div>
              </div>

              {/* Messages scroll area */}
              <div className="s3-messages">
                {messages.map((m, i) => (
                  <div key={i} className={'s3-msg s3-msg--' + m.role}>
                    {m.role === 'system' && <div className="s3-msg__avatar">AI</div>}
                    <div className="s3-msg__wrap">
                      <div className="s3-msg__bubble">{m.text}</div>
                      {m.time && <div className="s3-msg__time">{m.time}</div>}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {loading && (
                  <div className="s3-msg s3-msg--system">
                    <div className="s3-msg__avatar">AI</div>
                    <div className="s3-msg__wrap">
                      <div className="s3-msg__bubble s3-msg__bubble--typing">
                        <span className="s3-dot" /><span className="s3-dot" /><span className="s3-dot" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Follow-up chips */}
                {showFollowUp && !loading && (
                  <div className="s3-follow-ups">
                    <span className="s3-follow-ups__label">Try:</span>
                    {FOLLOW_UPS.map(f => (
                      <button
                        key={f}
                        className="s3-follow-up-chip"
                        onClick={() => { sendMessage(f); setActiveTab('chat'); }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                )}

                {/* Quick prompt chips — shown only before first message */}
                {messages.length <= 1 && !loading && (
                  <div className="s3-quick-prompts">
                    <div className="s3-quick-prompts__label">Quick prompts</div>
                    <div className="s3-quick-prompts__chips">
                      {QUICK_PROMPTS.map(q => (
                        <button
                          key={q}
                          className="s3-quick-chip"
                          onClick={() => { setInput(q); inputRef.current?.focus(); }}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* ── Bottom input bar (WhatsApp / Slack style) ── */}
              <div className="s3-chat-input-bar">
                <input
                  ref={inputRef}
                  className="s3-chat-input-box"
                  type="text"
                  placeholder="Describe the report you need…"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                />
                <button
                  className="s3-chat-send-btn"
                  onClick={() => sendMessage(input)}
                  disabled={loading || !input.trim()}
                  title="Send"
                >
                  {loading ? <span className="s3-send-spinner" /> : <span className="s3-send-arrow">&#10148;</span>}
                </button>
              </div>
            </div>
          )}

          {/* ═══ TEMPLATES TAB ═══════════════════════════ */}
          {activeTab === 'templates' && (
            <div className="s3-configs-pane">
              <div className="s3-pane-header">
                <span className="s3-pane-title">Matched Templates</span>
                {configs.length > 0 && (
                  <span className="s3-configs-count">{configs.length} found</span>
                )}
              </div>

              {configs.length === 0 ? (
                <div className="s3-configs-empty">
                  <div className="s3-empty-icon">&#9993;</div>
                  <p>Go to the Chat tab and send a prompt to match templates.</p>
                  <button
                    className="s3-go-chat-btn"
                    onClick={() => setActiveTab('chat')}
                  >
                    Go to Chat
                  </button>
                </div>
              ) : (
                <div className="s3-configs-grid">
                  {configs.map(cfg => (
                    <div
                      key={cfg.id}
                      className={'s3-config-card' + (selectedConfig?.id === cfg.id ? ' s3-config-card--selected' : '')}
                      onClick={() => setSelectedConfig(cfg)}
                    >
                      {selectedConfig?.id === cfg.id && (
                        <div className="s3-config-card__check">&#10003;</div>
                      )}
                      <div className="s3-config-card__header">
                        <span className="s3-config-card__name">{cfg.name}</span>
                        <span
                          className={
                            's3-config-card__match' +
                            (cfg.match >= 90 ? ' s3-match--high' :
                             cfg.match >= 75 ? ' s3-match--mid'  : ' s3-match--low')
                          }
                        >
                          {cfg.match}%
                        </span>
                      </div>
                      <span className="s3-config-card__format">{cfg.format}</span>
                      <p className="s3-config-card__desc">{cfg.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {selectedConfig && (
                <div className="s3-configs-footer">
                  <button
                    className="s3-use-template-btn"
                    onClick={() => send({ type: 'PROMPT_MATCH_CONFIRMED', config: selectedConfig })}
                  >
                    Use &ldquo;{selectedConfig.name}&rdquo; &rarr;
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: live preview ────────────────────────── */}
        <div className="live-preview">
          <div className="live-preview__label">
            {selectedConfig
              ? `Live Preview — ${selectedConfig.name} (${selectedConfig.format})`
              : 'Live Preview — click a template to see its layout and style'}
          </div>
          <LiveIframe
            html={previewHTML}
            className="live-iframe"
            title="Report Preview"
          />
        </div>

      </div>
    </>
  );
}
