import { useState, useMemo } from 'react';
import { generatePreviewHTML, DEFAULT_HEADER_CONFIG } from '../../utils/previewGenerator';
import LiveIframe from '../../components/LiveIframe';
import './Step1Import.css';

const MOCK_DATA = {
  branch:  'Mumbai Main Branch',
  records: [
    { id: 1,  date: '05 Jan 2025', narration: 'NEFT Cr — ACME Corp Ltd',        type: 'Credit', amount: 150000,  balance: 750000  },
    { id: 2,  date: '08 Jan 2025', narration: 'Utility Pmt — MSEB Q1',           type: 'Debit',  amount: 45000,   balance: 705000  },
    { id: 3,  date: '12 Jan 2025', narration: 'RTGS Cr — Tata Consultancy',      type: 'Credit', amount: 280000,  balance: 985000  },
    { id: 4,  date: '15 Jan 2025', narration: 'ATM Withdrawal — Branch',         type: 'Debit',  amount: 20000,   balance: 965000  },
    { id: 5,  date: '22 Jan 2025', narration: 'IMPS — Payroll Disbursement',     type: 'Debit',  amount: 125000,  balance: 840000  },
    { id: 6,  date: '28 Jan 2025', narration: 'FD Maturity Credit',              type: 'Credit', amount: 500000,  balance: 1340000 },
    { id: 7,  date: '03 Feb 2025', narration: 'Loan EMI Deduction',              type: 'Debit',  amount: 85000,   balance: 1255000 },
    { id: 8,  date: '14 Feb 2025', narration: 'NEFT Cr — Infosys Ltd',           type: 'Credit', amount: 320000,  balance: 1575000 },
    { id: 9,  date: '20 Feb 2025', narration: 'Insurance Premium — LIC',         type: 'Debit',  amount: 28000,   balance: 1547000 },
    { id: 10, date: '05 Mar 2025', narration: 'RTGS Cr — Government Grant',      type: 'Credit', amount: 100000,  balance: 1647000 },
  ],
  summary: { totalRecords: 47, totalCredits: 1250000, totalDebits: 380000, closingBalance: 870000 },
};

const PROCEDURES = [
  'GetBankStatement',
  'GetTransactionReport',
  'GetAuditLog',
  'GetLoanPortfolio',
  'GetNPAReport',
];

const PROCEDURE_PARAMS = {
  GetBankStatement: [
    { key: 'accountNo',   label: 'Account No.',      type: 'text',   placeholder: 'e.g. ACC-004821', required: true  },
    { key: 'dateFrom',    label: 'From Date',         type: 'date',   required: true  },
    { key: 'dateTo',      label: 'To Date',           type: 'date',   required: true  },
    { key: 'transType',   label: 'Transaction Type',  type: 'select', options: ['All', 'Credit', 'Debit'], required: false },
  ],
  GetTransactionReport: [
    { key: 'accountNo',   label: 'Account No.',      type: 'text',   placeholder: 'e.g. ACC-004821', required: true  },
    { key: 'dateFrom',    label: 'From Date',         type: 'date',   required: true  },
    { key: 'dateTo',      label: 'To Date',           type: 'date',   required: true  },
    { key: 'transType',   label: 'Transaction Type',  type: 'select', options: ['All', 'Credit', 'Debit'], required: false },
    { key: 'minAmount',   label: 'Min Amount (₹)',   type: 'number', placeholder: '0', required: false },
    { key: 'maxAmount',   label: 'Max Amount (₹)',   type: 'number', placeholder: 'No limit', required: false },
  ],
  GetAuditLog: [
    { key: 'userId',      label: 'User ID',          type: 'text',   placeholder: 'e.g. USR-001', required: true  },
    { key: 'dateFrom',    label: 'From Date',         type: 'date',   required: true  },
    { key: 'dateTo',      label: 'To Date',           type: 'date',   required: true  },
    { key: 'action',      label: 'Action Filter',     type: 'select', options: ['All', 'LOGIN', 'EDIT', 'VIEW', 'DELETE'], required: false },
    { key: 'module',      label: 'Module',            type: 'select', options: ['All', 'Accounts', 'Loans', 'Reports'], required: false },
  ],
  GetLoanPortfolio: [
    { key: 'branchId',    label: 'Branch ID',        type: 'text',   placeholder: 'e.g. BR-001', required: true  },
    { key: 'dateFrom',    label: 'From Date',         type: 'date',   required: true  },
    { key: 'dateTo',      label: 'To Date',           type: 'date',   required: true  },
    { key: 'loanType',    label: 'Loan Type',         type: 'select', options: ['All', 'Home', 'Personal', 'Vehicle', 'Business'], required: false },
    { key: 'status',      label: 'Status',            type: 'select', options: ['All', 'Active', 'Closed', 'NPA'], required: false },
  ],
  GetNPAReport: [
    { key: 'branchId',    label: 'Branch ID',        type: 'text',   placeholder: 'e.g. BR-001', required: true  },
    { key: 'asOfDate',    label: 'As of Date',        type: 'date',   required: true  },
    { key: 'category',    label: 'NPA Category',      type: 'select', options: ['All', 'Substandard', 'Doubtful', 'Loss'], required: false },
    { key: 'minAmount',   label: 'Min Amount (₹)',   type: 'number', placeholder: '0', required: false },
  ],
};

const ACCOUNT_TYPES = ['Savings Account', 'Current Account', 'OD Account', 'CC Account', 'NRE Account', 'NRO Account'];

export default function Step1Import({ send }) {
  /* ── Form state ─────────────────────────────────────── */
  const [procedure,       setProcedure]       = useState('GetBankStatement');
  const [params,          setParams]          = useState({});
  const [loading,         setLoading]         = useState(false);
  const [validationError, setValidationError] = useState('');

  function setParam(key, val) { setParams(prev => ({ ...prev, [key]: val })); }

  /* ── Header / footer customizer ─────────────────────── */
  const [hc, setHC] = useState({ ...DEFAULT_HEADER_CONFIG });
  function upd(field, value) { setHC(prev => ({ ...prev, [field]: value })); }

  /* ── Logo upload ─────────────────────────────────────── */
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
      {
        liveFormData:     { account: params.accountNo || '', procedure, dateFrom: params.dateFrom || '', dateTo: params.dateTo || '' },
        liveHeaderConfig: hc,
      }
    ),
    [params, procedure, hc]
  );

  /* ── Validation & run ───────────────────────────────── */
  function validate() {
    const currentParams = PROCEDURE_PARAMS[procedure] || [];
    for (const p of currentParams) {
      if (p.required && !params[p.key]?.toString().trim()) {
        return `"${p.label}" is required.`;
      }
    }
    if (params.dateFrom && params.dateTo && params.dateFrom > params.dateTo) {
      return '"From Date" must be before "To Date".';
    }
    return '';
  }

  function handleRun() {
    const err = validate();
    if (err) { setValidationError(err); return; }
    setValidationError('');
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      send({
        type: 'IMPORT_SUCCESS',
        data: {
          ...MOCK_DATA,
          procedure,
          account: params.accountNo || 'ACC-000000',
          period: { from: params.dateFrom || '', to: params.dateTo || '' },
        },
        headerConfig: hc,
      });
    }, 1600);
  }

  /* ── Render ─────────────────────────────────────────── */
  return (
    <>
      {/* ── Main Ribbon ──────────────────────────────────────── */}
      <div className="ribbon">
        <div className="ribbon-field">
          <span className="ribbon-field__label">Stored Procedure</span>
          <select className="ribbon-field__select s1-select" value={procedure}
            onChange={e => { setProcedure(e.target.value); setParams({}); }} disabled={loading}>
            {PROCEDURES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>

        <div className="ribbon-sep" />

        <div className="ribbon-field">
          <span className="ribbon-field__label">DB Endpoint</span>
          <code className="s3-endpoint">http://localhost:8000/api/procedure/run</code>
        </div>

        <div className="ribbon-spacer" />

        {validationError && (
          <span className="ribbon-status ribbon-status--error">{validationError}</span>
        )}

        <button className="ribbon-primary" onClick={handleRun} disabled={loading}>
          {loading ? <><span className="ribbon-spinner" />Executing…</> : '▶ Run Procedure'}
        </button>
      </div>

      {/* ── Procedure Params Bar ─────────────────────────── */}
      <div className="s1-params-bar">
        <span className="s1-params-bar__label">{procedure} — IN Parameters</span>
        <div className="s1-params-bar__fields">
          {(PROCEDURE_PARAMS[procedure] || []).map(p => (
            <div key={p.key} className="s1-param-field">
              <label className="s1-param-field__label">
                {p.label}
                {p.required && <span className="s1-param-required">*</span>}
              </label>
              {p.type === 'select' ? (
                <select
                  className="s1-param-input"
                  value={params[p.key] || ''}
                  onChange={e => setParam(p.key, e.target.value)}
                  disabled={loading}
                >
                  {p.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  className="s1-param-input"
                  type={p.type}
                  placeholder={p.placeholder || ''}
                  value={params[p.key] || ''}
                  onChange={e => setParam(p.key, e.target.value)}
                  disabled={loading}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Workspace ───────────────────────────────────────── */}
      <div className="workspace workspace--split s1-workspace">

        {/* ── Left: Customizer ──────────────────────────── */}
        <div className="s1-customizer">

          <div className="s1-custom__topbar">
            <span className="s1-custom__topbar-title">Report Customizer</span>
            <button className="s1-custom__reset-btn" onClick={() => setHC({ ...DEFAULT_HEADER_CONFIG })}>
              Reset
            </button>
          </div>

          {/* ── Bank Identity ── */}
          <div className="s1-custom-section">
            <div className="s1-custom-section__title">Bank Identity</div>

            {/* Logo upload */}
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

          {/* ── Customer Information ── */}
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

          {/* ── Document Settings ── */}
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

          {/* ── Footer — Signatory ── */}
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

          {/* ── Powered By ── */}
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
              <p className="s1-loading__text">Executing <strong>{procedure}</strong>…</p>
              <code className="s1-loading__endpoint">POST http://localhost:8000/api/procedure/run</code>
            </div>
          ) : (
            <LiveIframe html={previewHTML} className="live-iframe" title="Report Preview" debounceMs={150} />
          )}
        </div>

      </div>
    </>
  );
}
