import { useState, useMemo, useEffect } from 'react';
import { generatePreviewHTML, DEFAULT_HEADER_CONFIG } from '../../utils/previewGenerator';
import LiveIframe from '../../components/LiveIframe';
import { testConnection, getProcedures, getParameters, fetchRecords, transformApiResponse } from '../../services/api';
import './Step1Import.css';

const ACCOUNT_TYPES = ['Savings Account', 'Current Account', 'OD Account', 'CC Account', 'NRE Account', 'NRO Account'];
const EMPTY_CONN    = { host: '', port: '1521', service: '', user: '', password: '' };

/* ── Hardcoded procedure list ────────────────────────────── */
const KNOWN_PROCEDURES = [
  {
    name: 'PR_STATEMENT_IV',
    label: 'pr_statement_iv',
    params: [
      { name: 'PI_OPBRMSTID',  label: 'Branch Master ID',  type: 'NUMBER',   position: 1, direction: 'IN', placeholder: 'e.g. 2'          },
      { name: 'PI_TRANDATE',   label: 'Transaction Date',   type: 'DATE',     position: 2, direction: 'IN', placeholder: 'DD/MM/YYYY'       },
      { name: 'PI_ASONDATE',   label: 'As On Date',         type: 'DATE',     position: 3, direction: 'IN', placeholder: 'DD/MM/YYYY'       },
      { name: 'PI_USERID',     label: 'User ID',            type: 'NUMBER',   position: 4, direction: 'IN', placeholder: 'e.g. 9999'        },
      { name: 'PI_FIG',        label: 'Figure (in ₹)',     type: 'NUMBER',   position: 5, direction: 'IN', placeholder: 'e.g. 100000'      },
      { name: 'PI_REPFORMAT',  label: 'Report Format',      type: 'VARCHAR2', position: 6, direction: 'IN', placeholder: 'optional'         },
    ],
  },
];

/* ══════════════════════════════════════════════════════════
   CONNECT TO DATABASE MODAL
══════════════════════════════════════════════════════════ */
function ConnectModal({ onClose, onConnected, initialConn }) {
  const [conn,       setConn]       = useState(initialConn || EMPTY_CONN);
  const [status,     setStatus]     = useState(null);   // null | 'testing' | 'ok' | 'error'
  const [statusMsg,  setStatusMsg]  = useState('');
  const [fetching,   setFetching]   = useState(false);

  function setField(k, v) { setConn(prev => ({ ...prev, [k]: v })); }

  /* close on Escape */
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleTest() {
    setStatus('testing'); setStatusMsg('');
    try {
      const r = await testConnection(conn);
      setStatus('ok');
      setStatusMsg(r.message || 'Connection successful!');
    } catch (e) {
      setStatus('error');
      setStatusMsg(e.message);
    }
  }

  async function handleConnect() {
    setFetching(true);
    try {
      const r = await getProcedures(conn);
      onConnected(conn, r.procedures || []);
    } catch {
      onConnected(conn, []);
    } finally {
      setFetching(false);
    }
    onClose();
  }

  const isFormFilled = conn.host && conn.port && conn.service && conn.user && conn.password;

  return (
    <div className="db-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="db-modal">

        {/* Header */}
        <div className="db-modal__header">
          <div className="db-modal__header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
          </div>
          <div>
            <div className="db-modal__title">Connect to Database</div>
            <div className="db-modal__subtitle">Oracle Database — enter your connection details</div>
          </div>
          <button className="db-modal__close" onClick={onClose}>&#x2715;</button>
        </div>

        {/* Body */}
        <div className="db-modal__body">

          {/* Row 1: Host + Port */}
          <div className="db-modal__row">
            <div className="db-modal__field db-modal__field--grow">
              <label className="db-modal__label">Host <span className="db-modal__required">*</span></label>
              <input className="db-modal__input" value={conn.host}
                onChange={e => setField('host', e.target.value)}
                placeholder="e.g. 192.168.1.10" />
            </div>
            <div className="db-modal__field db-modal__field--port">
              <label className="db-modal__label">Port <span className="db-modal__required">*</span></label>
              <input className="db-modal__input" value={conn.port}
                onChange={e => setField('port', e.target.value)}
                placeholder="1521" />
            </div>
          </div>

          {/* Row 2: Service */}
          <div className="db-modal__field">
            <label className="db-modal__label">Service Name <span className="db-modal__required">*</span></label>
            <input className="db-modal__input" value={conn.service}
              onChange={e => setField('service', e.target.value)}
              placeholder="e.g. ORCL or XE" />
          </div>

          <div className="db-modal__divider" />

          {/* Row 3: User + Password */}
          <div className="db-modal__row">
            <div className="db-modal__field db-modal__field--grow">
              <label className="db-modal__label">Username <span className="db-modal__required">*</span></label>
              <input className="db-modal__input" value={conn.user}
                onChange={e => setField('user', e.target.value)}
                placeholder="DB username" autoComplete="username" />
            </div>
            <div className="db-modal__field db-modal__field--grow">
              <label className="db-modal__label">Password <span className="db-modal__required">*</span></label>
              <input className="db-modal__input" type="password" value={conn.password}
                onChange={e => setField('password', e.target.value)}
                placeholder="DB password" autoComplete="current-password" />
            </div>
          </div>

          {/* Status bar */}
          {status && (
            <div className={`db-modal__status db-modal__status--${status}`}>
              {status === 'testing' && <span className="db-modal__status-spinner" />}
              {status === 'ok'      && <span className="db-modal__status-icon">✓</span>}
              {status === 'error'   && <span className="db-modal__status-icon">✗</span>}
              <span>{statusMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="db-modal__footer">
          <button className="db-modal__btn db-modal__btn--ghost" onClick={onClose}>Cancel</button>
          <button className="db-modal__btn db-modal__btn--outline"
            onClick={handleTest}
            disabled={!isFormFilled || status === 'testing'}>
            {status === 'testing' ? 'Testing…' : 'Test Connection'}
          </button>
          <button className="db-modal__btn db-modal__btn--primary"
            onClick={handleConnect}
            disabled={status !== 'ok' || fetching}>
            {fetching ? 'Connecting…' : 'Connect'}
          </button>
        </div>

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PARAMETERS PANEL  — IN params only, editable inputs
══════════════════════════════════════════════════════════ */
function ParamsPanel({ params, paramValues, onParamChange, procedureName }) {
  const inParams = params.filter(p => p.direction === 'IN' || p.direction === 'IN/OUT');

  if (inParams.length === 0) {
    return (
      <div className="s1-params-panel">
        <div className="s1-params-panel__header">
          <span className="s1-params-panel__proc">{procedureName.toUpperCase()}</span>
          <span className="s1-params-panel__count">No IN parameters — procedure runs without input</span>
        </div>
      </div>
    );
  }

  return (
    <div className="s1-params-panel">
      <div className="s1-params-panel__header">
        <span className="s1-params-panel__proc">{procedureName.toUpperCase()}</span>
        <span className="s1-params-panel__count">
          {inParams.length} IN parameter{inParams.length !== 1 ? 's' : ''} — fill values below
        </span>
      </div>

      <div className="s1-params-panel__inputs">
        {inParams.map(p => (
          <div className="s1-params-input-field" key={p.position}>
            <label className="s1-params-input-label">
              {p.label || p.name}
              <span className="s1-params-input-type">{p.type}</span>
            </label>
            <input
              className="s1-params-input"
              placeholder={p.placeholder || `Enter ${p.name}…`}
              value={paramValues[p.name] || ''}
              onChange={e => onParamChange(p.name, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   STEP 1 — MAIN COMPONENT
══════════════════════════════════════════════════════════ */
export default function Step1Import({ send }) {

  /* ── DB Connection (persisted to localStorage) ──────── */
  const [savedConn,     setSavedConn]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('brb_conn') || 'null'); } catch { return null; }
  });
  const [showConnModal, setShowConnModal] = useState(false);
  const [procedureList, setProcedureList] = useState(() => {
    try { return JSON.parse(localStorage.getItem('brb_proc_list') || '[]'); } catch { return []; }
  });

  /* ── Procedure ───────────────────────────────────────── */
  const [procedure,     setProcedure]     = useState('');
  const [procParams,    setProcParams]    = useState(null);
  const [paramValues,   setParamValues]   = useState({});
  const [paramsLoading, setParamsLoading] = useState(false);
  const [paramsError,   setParamsError]   = useState('');
  const [loading,       setLoading]       = useState(false);
  const [runError,      setRunError]      = useState('');

  function handleParamChange(name, value) {
    setParamValues(prev => ({ ...prev, [name]: value }));
  }

  function handleProcedureSelect(name) {
    setProcedure(name);
    setParamValues({});
    setParamsError('');
    if (!name) { setProcParams(null); return; }
    const found = KNOWN_PROCEDURES.find(p => p.name === name);
    setProcParams(found ? found.params : null);
  }

  async function handleLoadParams() {
    if (!procedure.trim()) return;
    setParamsLoading(true);
    setParamsError('');
    setProcParams(null);
    setParamValues({});
    try {
      const r = await getParameters(savedConn, procedure.trim());
      setProcParams(r.parameters || []);
    } catch (e) {
      setParamsError(e.message);
    } finally {
      setParamsLoading(false);
    }
  }

  async function handleRun() {
    if (!procedure.trim()) { setRunError('Enter a procedure name.'); return; }
    if (!savedConn)        { setRunError('Connect to a database first.'); return; }
    setRunError('');
    setLoading(true);
    try {
      const inParams = procParams
        ? procParams
            .filter(p => p.direction === 'IN' || p.direction === 'IN/OUT')
            .map(p => ({ name: p.name, value: paramValues[p.name] || '', position: p.position }))
        : [];
      const r = await fetchRecords(savedConn, procedure.trim(), inParams);

      // Show PO_ERROR from Oracle if present
      if (r.po_error) {
        setRunError(`Oracle: ${r.po_error}`);
        setLoading(false);
        return;
      }

      if (!r.total_rows || r.total_rows === 0) {
        setRunError('Procedure returned 0 rows. Check your parameter values.');
        setLoading(false);
        return;
      }

      const { records, columns } = transformApiResponse(r);
      send({
        type: 'IMPORT_SUCCESS',
        data: { procedure: r.procedure, columns, records, totalRows: r.total_rows },
        headerConfig: hc,
      });
    } catch (e) {
      setRunError(e.message);
      send({ type: 'IMPORT_ERROR', message: e.message });
    } finally {
      setLoading(false);
    }
  }

  /* ── Header / footer customizer ─────────────────────── */
  const [hc, setHC] = useState({ ...DEFAULT_HEADER_CONFIG });
  function upd(field, value) { setHC(prev => ({ ...prev, [field]: value })); }
  function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => upd('logoImage', ev.target.result);
    reader.readAsDataURL(file);
  }

  /* ── Live preview ────────────────────────────────────── */
  const previewHTML = useMemo(() =>
    generatePreviewHTML(
      { importedData: null, edaResult: null, promptConfig: null },
      'step1',
      { liveFormData: { account: '', procedure, dateFrom: '', dateTo: '' }, liveHeaderConfig: hc }
    ),
    [procedure, hc]
  );

  /* ── Render ─────────────────────────────────────────── */
  return (
    <>
      {/* ── Connect to Database Modal ────────────────────── */}
      {showConnModal && (
        <ConnectModal
          initialConn={savedConn}
          onClose={() => setShowConnModal(false)}
          onConnected={(conn, procs) => {
            setSavedConn(conn);
            setProcedureList(procs);
            setProcedure('');
            setProcParams(null);
            setParamsError('');
            localStorage.setItem('brb_conn', JSON.stringify(conn));
            localStorage.setItem('brb_proc_list', JSON.stringify(procs));
          }}
        />
      )}

      {/* ── Main Ribbon ──────────────────────────────────── */}
      <div className="ribbon">

        {/* Connection button / status */}
        {savedConn ? (
          <div className="s1-conn-badge">
            <span className="s1-conn-badge__dot" />
            <span className="s1-conn-badge__label">
              {savedConn.host}:{savedConn.port} / {savedConn.service}
            </span>
            <button className="s1-conn-badge__change" onClick={() => setShowConnModal(true)}>
              Change
            </button>
            <button className="s1-conn-badge__change s1-conn-badge__clear" onClick={() => {
              setSavedConn(null); setProcedureList([]); setProcParams(null); setProcedure('');
              localStorage.removeItem('brb_conn'); localStorage.removeItem('brb_proc_list');
            }}>
              ✕
            </button>
          </div>
        ) : (
          <button className="s1-connect-btn" onClick={() => setShowConnModal(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
            Connect to Database
          </button>
        )}

        <div className="ribbon-sep" />

        {/* Procedure dropdown — hardcoded list */}
        <div className="ribbon-field">
          <span className="ribbon-field__label">Stored Procedure</span>
          <select
            className="ribbon-field__select s1-proc-select"
            value={procedure}
            onChange={e => handleProcedureSelect(e.target.value)}
            disabled={loading || !savedConn}>
            <option value="">— Select a procedure —</option>
            {KNOWN_PROCEDURES.map(p => (
              <option key={p.name} value={p.name}>{p.label}</option>
            ))}
          </select>
        </div>

        {paramsError && <span className="ribbon-status ribbon-status--error">{paramsError}</span>}

        <div className="ribbon-spacer" />

        {runError && <span className="ribbon-status ribbon-status--error">{runError}</span>}

        <button className="ribbon-primary" onClick={handleRun} disabled={loading || !savedConn}>
          {loading ? <><span className="ribbon-spinner" />Executing…</> : '▶ Run Procedure'}
        </button>
      </div>

      {/* ── Parameters Panel ─────────────────────────────── */}
      {procParams && (
        <ParamsPanel
          params={procParams}
          paramValues={paramValues}
          onParamChange={handleParamChange}
          procedureName={procedure}
        />
      )}

      {/* ── Workspace ───────────────────────────────────────── */}
      <div className="workspace workspace--split s1-workspace">

        {/* ── Left: Customizer ──────────────────────────── */}
        <div className="s1-customizer">

          <div className="s1-custom__topbar">
            <span className="s1-custom__topbar-title">Report Customizer</span>
            <button className="s1-custom__reset-btn" onClick={() => setHC({ ...DEFAULT_HEADER_CONFIG })}>Reset</button>
          </div>

          {/* Bank Identity */}
          <div className="s1-custom-section">
            <div className="s1-custom-section__title">Bank Identity</div>
            <div className="s1-cfield">
              <label className="s1-clabel">Bank Logo</label>
              {hc.logoImage ? (
                <div className="s1-logo-preview">
                  <img src={hc.logoImage} alt="Logo" className="s1-logo-img" />
                  <button className="s1-logo-remove" onClick={() => upd('logoImage', null)}>&#x2715; Remove</button>
                </div>
              ) : (
                <label className="s1-logo-upload-btn">
                  <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                  <span>Upload Logo Image</span>
                </label>
              )}
            </div>
            <div className="s1-cfield">
              <label className="s1-clabel">Bank Name</label>
              <input className="s1-cinput" value={hc.bankName} onChange={e => upd('bankName', e.target.value)} />
            </div>
            <div className="s1-cfield s1-cfield--row">
              <div className="s1-cfield">
                <label className="s1-clabel">Abbreviation</label>
                <input className="s1-cinput s1-cinput--short" maxLength={4}
                  value={hc.bankAbbr} onChange={e => upd('bankAbbr', e.target.value)} />
              </div>
              <div className="s1-cfield">
                <label className="s1-clabel">Branch</label>
                <input className="s1-cinput" value={hc.branchName} onChange={e => upd('branchName', e.target.value)} />
              </div>
            </div>
            <div className="s1-cfield s1-cfield--row">
              <div className="s1-cfield">
                <label className="s1-clabel">IFSC Code</label>
                <input className="s1-cinput" value={hc.ifscCode} onChange={e => upd('ifscCode', e.target.value)} />
              </div>
              <div className="s1-cfield">
                <label className="s1-clabel">MICR Code</label>
                <input className="s1-cinput" value={hc.micrCode} onChange={e => upd('micrCode', e.target.value)} />
              </div>
            </div>
            <label className="s1-ctoggle">
              <input type="checkbox" checked={hc.showIFSC} onChange={e => upd('showIFSC', e.target.checked)} />
              Show IFSC / MICR in report header
            </label>
          </div>

          {/* Customer Information */}
          <div className="s1-custom-section">
            <div className="s1-custom-section__title">Customer Information</div>
            <label className="s1-ctoggle">
              <input type="checkbox" checked={hc.showCustomerInfo}
                onChange={e => upd('showCustomerInfo', e.target.checked)} />
              Show customer info on report
            </label>
            <div className="s1-cfield">
              <label className="s1-clabel">Customer Name</label>
              <input className="s1-cinput" placeholder="e.g. Rajesh Kumar"
                value={hc.customerName} onChange={e => upd('customerName', e.target.value)} />
            </div>
            <div className="s1-cfield s1-cfield--row">
              <div className="s1-cfield">
                <label className="s1-clabel">Customer ID / CIF</label>
                <input className="s1-cinput" placeholder="e.g. CIF-001234"
                  value={hc.customerId} onChange={e => upd('customerId', e.target.value)} />
              </div>
              <div className="s1-cfield">
                <label className="s1-clabel">Account Type</label>
                <select className="s1-cinput s1-cselect" value={hc.accountType}
                  onChange={e => upd('accountType', e.target.value)}>
                  {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="s1-cfield">
              <label className="s1-clabel">Contact Number</label>
              <input className="s1-cinput" placeholder="e.g. +91 98765 43210"
                value={hc.customerContact} onChange={e => upd('customerContact', e.target.value)} />
            </div>
            <div className="s1-cfield">
              <label className="s1-clabel">Email Address</label>
              <input className="s1-cinput" type="email" placeholder="e.g. customer@email.com"
                value={hc.customerEmail} onChange={e => upd('customerEmail', e.target.value)} />
            </div>
            <div className="s1-cfield">
              <label className="s1-clabel">Address (optional)</label>
              <textarea className="s1-ctextarea" rows={2} placeholder="Customer mailing address…"
                value={hc.customerAddress} onChange={e => upd('customerAddress', e.target.value)} />
            </div>
          </div>

          {/* Document Settings */}
          <div className="s1-custom-section">
            <div className="s1-custom-section__title">Document Settings</div>
            <label className="s1-ctoggle">
              <input type="checkbox" checked={hc.showDate} onChange={e => upd('showDate', e.target.checked)} />
              Show generation date
            </label>
            <label className="s1-ctoggle">
              <input type="checkbox" checked={hc.showWatermark} onChange={e => upd('showWatermark', e.target.checked)} />
              Enable watermark
            </label>
            {hc.showWatermark && (
              <div className="s1-cfield">
                <label className="s1-clabel">Watermark Text</label>
                <input className="s1-cinput" value={hc.watermarkText} onChange={e => upd('watermarkText', e.target.value)} />
              </div>
            )}
          </div>

          {/* Footer Signatory */}
          <div className="s1-custom-section">
            <div className="s1-custom-section__title">Footer — Signatory</div>
            <div className="s1-cfield">
              <label className="s1-clabel">Officer Name</label>
              <input className="s1-cinput" placeholder="e.g. Priya Sharma"
                value={hc.officerName} onChange={e => upd('officerName', e.target.value)} />
            </div>
            <div className="s1-cfield">
              <label className="s1-clabel">Designation</label>
              <input className="s1-cinput" value={hc.officerDesignation}
                onChange={e => upd('officerDesignation', e.target.value)} />
            </div>
            <label className="s1-ctoggle">
              <input type="checkbox" checked={hc.showTimestamp} onChange={e => upd('showTimestamp', e.target.checked)} />
              Show generation timestamp
            </label>
            <label className="s1-ctoggle">
              <input type="checkbox" checked={hc.showIP} onChange={e => upd('showIP', e.target.checked)} />
              Show terminal IP address
            </label>
            {hc.showIP && (
              <div className="s1-cfield">
                <label className="s1-clabel">IP Address</label>
                <input className="s1-cinput" placeholder="192.168.x.x"
                  value={hc.ipAddress} onChange={e => upd('ipAddress', e.target.value)} />
              </div>
            )}
            <div className="s1-cfield">
              <label className="s1-clabel">Footer Note</label>
              <textarea className="s1-ctextarea" rows={2} value={hc.footerNote}
                onChange={e => upd('footerNote', e.target.value)} />
            </div>
          </div>

          {/* Powered By */}
          <div className="s1-custom-section s1-custom-section--powered">
            <div className="s1-custom-section__title">External Footer</div>
            <input className="s1-cinput" value={hc.poweredBy} onChange={e => upd('poweredBy', e.target.value)} />
            <p className="s1-cpowered-note">Always printed at the bottom of every report page.</p>
          </div>

        </div>

        {/* ── Right: Live Preview ───────────────────────── */}
        <div className="live-preview s1-preview-area">
          <div className="live-preview__label">Live Preview — changes reflect instantly</div>
          {loading ? (
            <div className="s1-loading-card">
              <div className="s1-loading__spinner" />
              <p className="s1-loading__text">Executing <strong>{procedure.toUpperCase()}</strong>…</p>
              <code className="s1-loading__endpoint">POST http://localhost:8000/fetch-records</code>
            </div>
          ) : (
            <LiveIframe html={previewHTML} className="live-iframe" title="Report Preview" debounceMs={150} />
          )}
        </div>

      </div>
    </>
  );
}
