import { useState, useMemo, useEffect } from 'react';
import { generatePreviewHTML, DEFAULT_COLUMNS } from '../../utils/previewGenerator';
import LiveIframe from '../../components/LiveIframe';
import './Step2EDA.css';

/* ── Mock Issues ─────────────────────────────────────────── */
const MOCK_ISSUES = [
  {
    id: 1, field: 'narration', severity: 'warning',
    description: 'Missing narration in 3 records',
    suggestion: 'Fill with "Unclassified Transaction"',
    affectedRows: [12, 28, 35],
    accepted: null,
  },
  {
    id: 2, field: 'balance', severity: 'error',
    description: 'Negative balance detected on 14 Feb 2025',
    suggestion: 'Flag record for manual review',
    affectedRows: [23],
    accepted: null,
  },
  {
    id: 3, field: 'amount', severity: 'warning',
    description: 'Possible duplicate — same amount & date (Rs.85,000 on 03 Feb)',
    suggestion: 'Remove duplicate row #38',
    affectedRows: [37, 38],
    accepted: null,
  },
  {
    id: 4, field: 'date', severity: 'info',
    description: 'Date format inconsistency in 5 records (MM/DD/YYYY detected)',
    suggestion: 'Normalize all dates to DD-MMM-YYYY',
    affectedRows: [4, 9, 16, 21, 42],
    accepted: null,
  },
];

/* ── Mock Records ────────────────────────────────────────── */
const MOCK_RECORDS = [
  { id: 1,  date: '01 Jan 2025', narration: 'Opening Balance',            type: 'Credit', amount: 50000,  balance: 50000  },
  { id: 2,  date: '03 Jan 2025', narration: 'NEFT – Salary January 2025', type: 'Credit', amount: 85000,  balance: 135000 },
  { id: 3,  date: '05 Jan 2025', narration: 'ATM Cash Withdrawal',        type: 'Debit',  amount: 10000,  balance: 125000 },
  { id: 4,  date: '07 Jan 2025', narration: 'Electricity Bill – MSEB',    type: 'Debit',  amount: 3240,   balance: 121760 },
  { id: 5,  date: '10 Jan 2025', narration: 'Transfer to SB A/c 4521',    type: 'Debit',  amount: 20000,  balance: 101760 },
  { id: 6,  date: '14 Jan 2025', narration: 'UPI – Amazon Purchase',      type: 'Debit',  amount: 5499,   balance: 96261  },
  { id: 7,  date: '15 Jan 2025', narration: 'Loan EMI Deduction (Auto)',  type: 'Debit',  amount: 12000,  balance: 84261  },
  { id: 8,  date: '18 Jan 2025', narration: 'Quarterly Interest Credit',  type: 'Credit', amount: 1250,   balance: 85511  },
  { id: 9,  date: '20 Jan 2025', narration: 'Cheque Deposit – Rent',      type: 'Credit', amount: 25000,  balance: 110511 },
  { id: 10, date: '22 Jan 2025', narration: 'Mobile Recharge – Jio',      type: 'Debit',  amount: 599,    balance: 109912 },
  { id: 11, date: '25 Jan 2025', narration: 'LIC Premium – Auto Debit',   type: 'Debit',  amount: 8500,   balance: 101412 },
  { id: 12, date: '28 Jan 2025', narration: 'RTGS – Client Payment',      type: 'Credit', amount: 45000,  balance: 146412 },
];

const SEVERITY_FILTERS = ['all', 'error', 'warning', 'info'];
const FORMATS          = ['text', 'date', 'number', 'currency', 'badge'];

function fmtINR(n)     { return new Intl.NumberFormat('en-IN').format(Math.abs(Number(n))); }
function fmtDisplay(n) { return 'Rs.' + Number(n).toLocaleString('en-IN'); }

export default function Step2EDA({ context, send }) {
  const data = context.importedData;

  /* ── Issues ──────────────────────────────────────────── */
  const [issues,      setIssues]      = useState(MOCK_ISSUES);
  const [filter,      setFilter]      = useState('all');
  const [issueSearch, setIssueSearch] = useState('');

  /* ── Data (records) ──────────────────────────────────── */
  const [records,     setRecords]     = useState(MOCK_RECORDS.map(r => ({ ...r })));
  const [editingCell, setEditingCell] = useState(null);
  const [editValue,   setEditValue]   = useState('');
  const [dataSearch,  setDataSearch]  = useState('');
  const [typeFilter,  setTypeFilter]  = useState('all');

  /* ── Columns ─────────────────────────────────────────── */
  const [columns, setColumns] = useState(
    context.columnConfig ? [...context.columnConfig] : DEFAULT_COLUMNS.map(c => ({ ...c }))
  );

  /* ── Modal ───────────────────────────────────────────── */
  const [showEditModal, setShowEditModal] = useState(false);
  const [modalTab,      setModalTab]      = useState('data'); // 'data' | 'columns'

  /* Close modal on Escape key */
  useEffect(() => {
    if (!showEditModal) return;
    function onKey(e) { if (e.key === 'Escape') setShowEditModal(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showEditModal]);

  /* Lock body scroll when modal is open */
  useEffect(() => {
    document.body.style.overflow = showEditModal ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showEditModal]);

  /* ── Issue helpers ───────────────────────────────────── */
  function decide(id, accepted) {
    setIssues(prev => prev.map(i => i.id === id ? { ...i, accepted } : i));
  }
  function acceptAll() {
    setIssues(prev => prev.map(i => i.accepted === null ? { ...i, accepted: true } : i));
  }

  /* ── Data helpers ────────────────────────────────────── */
  function startEdit(rowId, colId, currentValue) {
    setEditingCell({ rowId, colId });
    setEditValue(String(currentValue ?? ''));
  }
  function commitEdit() {
    if (!editingCell) return;
    const { rowId, colId } = editingCell;
    const val = colId === 'amount' || colId === 'balance'
      ? (Number(editValue) || 0)
      : editValue;
    setRecords(prev => prev.map(r => r.id === rowId ? { ...r, [colId]: val } : r));
    setEditingCell(null);
  }
  function cancelEdit() { setEditingCell(null); }

  function deleteRow(rowId) {
    setRecords(prev => prev.filter(r => r.id !== rowId));
  }
  function addRow() {
    const maxId   = Math.max(...records.map(r => r.id), 0);
    const lastBal = records.length > 0 ? records[records.length - 1].balance : 0;
    const today   = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    setRecords(prev => [...prev, {
      id: maxId + 1, date: today,
      narration: 'New Transaction',
      type: 'Credit', amount: 0, balance: lastBal,
    }]);
  }

  /* ── Column helpers ──────────────────────────────────── */
  function toggleCol(id) {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
  }
  function updateCol(id, field, value) {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  }
  function moveCol(idx, dir) {
    setColumns(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const ni = idx + dir;
      if (ni < 0 || ni >= sorted.length) return prev;
      const tmp = sorted[ni].order;
      return prev.map(c => {
        if (c.id === sorted[idx].id) return { ...c, order: tmp };
        if (c.id === sorted[ni].id)  return { ...c, order: sorted[idx].order };
        return c;
      });
    });
  }
  function resetCols() { setColumns(DEFAULT_COLUMNS.map(c => ({ ...c }))); }

  /* ── Derived ─────────────────────────────────────────── */
  const sortedCols  = [...columns].sort((a, b) => a.order - b.order);
  const pending     = issues.filter(i => i.accepted === null).length;
  const allDecided  = pending === 0;
  const visibleCols = columns.filter(c => c.visible).length;

  const visibleIssues = useMemo(() => {
    let list = filter === 'all' ? issues : issues.filter(i => i.severity === filter);
    if (issueSearch.trim()) {
      const q = issueSearch.toLowerCase();
      list = list.filter(i =>
        i.description.toLowerCase().includes(q) ||
        i.field.toLowerCase().includes(q) ||
        i.suggestion.toLowerCase().includes(q)
      );
    }
    return list;
  }, [issues, filter, issueSearch]);

  const filteredRecords = useMemo(() => records.filter(r => {
    const matchSearch = !dataSearch.trim() ||
      r.narration.toLowerCase().includes(dataSearch.toLowerCase());
    const matchType = typeFilter === 'all' || r.type === typeFilter;
    return matchSearch && matchType;
  }), [records, dataSearch, typeFilter]);

  const totalCr = records.filter(r => r.type === 'Credit').reduce((s, r) => s + r.amount, 0);
  const totalDr = records.filter(r => r.type === 'Debit').reduce((s, r) => s + r.amount, 0);

  /* ── Live preview ────────────────────────────────────── */
  const previewHTML = useMemo(() =>
    generatePreviewHTML(
      { importedData: data, edaResult: null, promptConfig: null },
      'step2',
      { issues, liveColumns: columns, liveRecords: records }
    ),
    [data, issues, columns, records]
  );

  function isEditing(rowId, colId) {
    return editingCell?.rowId === rowId && editingCell?.colId === colId;
  }

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── Ribbon ──────────────────────────────────────── */}
      <div className="ribbon">

        <div className="ribbon-field">
          <span className="ribbon-field__label">Actions</span>
          <button className="ribbon-btn" onClick={acceptAll} disabled={pending === 0}>
            Accept All ({pending})
          </button>
        </div>

        <div className="ribbon-sep" />

        <div className="ribbon-field">
          <span className="ribbon-field__label">Filter Issues</span>
          <div className="s2-ribbon-filters">
            {SEVERITY_FILTERS.map(f => (
              <button
                key={f}
                className={'ribbon-btn' + (filter === f ? ' ribbon-btn--active' : '')}
                onClick={() => setFilter(f)}
              >
                {f === 'all'     ? `All (${issues.length})`
                 : f === 'error'   ? `Errors (${issues.filter(i => i.severity === 'error').length})`
                 : f === 'warning' ? `Warns (${issues.filter(i => i.severity === 'warning').length})`
                 :                   `Info (${issues.filter(i => i.severity === 'info').length})`}
              </button>
            ))}
          </div>
        </div>

        <div className="ribbon-sep" />

        <div className="ribbon-field">
          <span className="ribbon-field__label">Summary</span>
          <div className="s2-ribbon-stats">
            <span className="s2-stat s2-stat--total">{records.length} records</span>
            <span className="s2-stat s2-stat--credit">Cr {fmtDisplay(totalCr)}</span>
            <span className="s2-stat s2-stat--debit">Dr {fmtDisplay(totalDr)}</span>
          </div>
        </div>

        <div className="ribbon-sep" />

        {/* ── Edit / Modify button ─────────────────────── */}
        <div className="ribbon-field">
          <span className="ribbon-field__label">Data &amp; Columns</span>
          <button
            className="s2-edit-modal-btn"
            onClick={() => { setModalTab('data'); setShowEditModal(true); }}
          >
            <span className="s2-edit-modal-btn__icon">&#9998;</span>
            Edit / Modify
          </button>
        </div>

        <div className="ribbon-spacer" />

        {allDecided
          ? <span className="ribbon-status ribbon-status--info">All {issues.length} issues resolved</span>
          : <span className="ribbon-status ribbon-status--error">{pending} issue{pending !== 1 ? 's' : ''} pending</span>
        }

        <button
          className="ribbon-primary"
          disabled={!allDecided}
          onClick={() => send({
            type: 'EDA_CONFIRM',
            data: { ...data, records, issuesResolved: issues },
            columnConfig: columns,
          })}
        >
          Confirm &amp; Continue &rarr;
        </button>
      </div>

      {/* ── Workspace ───────────────────────────────────── */}
      <div className="workspace workspace--split s2-workspace">

        {/* ── Left panel — Issues only ─────────────────── */}
        <div className="s2-left-panel">

          <div className="s2-issues-topbar">
            <div className="s2-issues-topbar__left">
              <span className="s2-issues-topbar__title">Detected Issues</span>
              <span className="s2-issues-topbar__count">{visibleIssues.length} shown</span>
            </div>
            <button
              className="s2-issues-topbar__edit-btn"
              onClick={() => { setModalTab('data'); setShowEditModal(true); }}
              title="Open Data &amp; Columns editor"
            >
              &#9998; Edit Data
            </button>
          </div>

          <div className="s2-search-bar">
            <input
              className="s2-search-input"
              type="text"
              placeholder="Search issues by description, field…"
              value={issueSearch}
              onChange={e => setIssueSearch(e.target.value)}
            />
            {issueSearch && (
              <button className="s2-search-clear" onClick={() => setIssueSearch('')}>&#215;</button>
            )}
          </div>

          <div className="s2-issues-list">
            {visibleIssues.length === 0 ? (
              <div className="s2-empty-state">
                <div className="s2-empty-state__icon">&#10003;</div>
                <p className="s2-empty-state__text">No issues match your search.</p>
              </div>
            ) : visibleIssues.map(issue => (
              <div
                key={issue.id}
                className={
                  's2-issue' +
                  (issue.accepted === true  ? ' s2-issue--accepted' : '') +
                  (issue.accepted === false ? ' s2-issue--rejected' : '')
                }
              >
                <div className="s2-issue__head">
                  <span className={'s2-sev s2-sev--' + issue.severity}>{issue.severity}</span>
                  <code className="s2-issue__field">{issue.field}</code>
                </div>
                <p className="s2-issue__desc">{issue.description}</p>
                <p className="s2-issue__suggestion"><strong>Fix:</strong> {issue.suggestion}</p>
                <p className="s2-issue__rows">Affected rows: {issue.affectedRows.join(', ')}</p>
                {issue.accepted === null ? (
                  <div className="s2-issue__actions">
                    <button className="s2-btn-accept" onClick={() => decide(issue.id, true)}>Accept</button>
                    <button className="s2-btn-reject" onClick={() => decide(issue.id, false)}>Reject</button>
                  </div>
                ) : (
                  <div className={'s2-issue__decision s2-issue__decision--' + (issue.accepted ? 'accepted' : 'rejected')}>
                    <span>{issue.accepted ? 'Accepted' : 'Rejected'}</span>
                    <button
                      className="s2-btn-undo"
                      onClick={() => setIssues(prev =>
                        prev.map(i => i.id === issue.id ? { ...i, accepted: null } : i)
                      )}
                    >Undo</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: live preview ────────────────────────── */}
        <div className="live-preview">
          <div className="live-preview__label">
            Live Preview — accept or reject issues to see changes
          </div>
          <LiveIframe
            html={previewHTML}
            className="live-iframe"
            title="Report Preview"
            debounceMs={200}
          />
        </div>

      </div>

      {/* ══════════════════════════════════════════════════
          EDIT MODAL
      ══════════════════════════════════════════════════ */}
      {showEditModal && (
        <div
          className="s2-modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) setShowEditModal(false); }}
        >
          <div className="s2-modal">

            {/* Modal header */}
            <div className="s2-modal__header">
              <div className="s2-modal__header-left">
                <span className="s2-modal__title">Edit Data &amp; Columns</span>
                <span className="s2-modal__subtitle">
                  {records.length} records &nbsp;&middot;&nbsp;
                  {visibleCols}/{columns.length} columns visible
                </span>
              </div>
              <button
                className="s2-modal__close"
                onClick={() => setShowEditModal(false)}
                title="Close"
              >
                &#215;
              </button>
            </div>

            {/* Modal tab switcher */}
            <div className="s2-modal__tabs">
              <button
                className={'s2-modal__tab' + (modalTab === 'data' ? ' s2-modal__tab--active' : '')}
                onClick={() => setModalTab('data')}
              >
                Data
                <span className="s2-modal__tab-count">{records.length}</span>
              </button>
              <button
                className={'s2-modal__tab' + (modalTab === 'columns' ? ' s2-modal__tab--active' : '')}
                onClick={() => setModalTab('columns')}
              >
                Columns
                <span className="s2-modal__tab-count">{visibleCols}/{columns.length}</span>
              </button>
            </div>

            {/* ── DATA TAB ────────────────────────────────── */}
            {modalTab === 'data' && (
              <div className="s2-modal__body">

                {/* Filter bar */}
                <div className="s2-modal-filter-bar">
                  <div className="s2-data-search-wrap">
                    <input
                      className="s2-data-search-input"
                      type="text"
                      placeholder="Search by narration…"
                      value={dataSearch}
                      onChange={e => setDataSearch(e.target.value)}
                    />
                    {dataSearch && (
                      <button className="s2-data-search-clear" onClick={() => setDataSearch('')}>&#215;</button>
                    )}
                  </div>
                  <div className="s2-type-filter-btns">
                    <button
                      className={'s2-type-btn' + (typeFilter === 'all' ? ' s2-type-btn--active' : '')}
                      onClick={() => setTypeFilter('all')}
                    >All ({records.length})</button>
                    <button
                      className={'s2-type-btn s2-type-btn--credit' + (typeFilter === 'Credit' ? ' s2-type-btn--active' : '')}
                      onClick={() => setTypeFilter('Credit')}
                    >Credit ({records.filter(r => r.type === 'Credit').length})</button>
                    <button
                      className={'s2-type-btn s2-type-btn--debit' + (typeFilter === 'Debit' ? ' s2-type-btn--active' : '')}
                      onClick={() => setTypeFilter('Debit')}
                    >Debit ({records.filter(r => r.type === 'Debit').length})</button>
                  </div>
                  <div className="s2-modal-filter-bar__spacer" />
                  <span className="s2-modal-filter-bar__hint">
                    Click any cell to edit &nbsp;&middot;&nbsp; Enter to save &nbsp;&middot;&nbsp; Esc to cancel
                  </span>
                </div>

                {/* Editable table */}
                <div className="s2-modal-table-wrap">
                  <table className="s2-data-table s2-modal-table">
                    <thead>
                      <tr>
                        <th className="s2-th s2-th--seq">#</th>
                        <th className="s2-th s2-th--date">Date</th>
                        <th className="s2-th s2-th--narration">Narration</th>
                        <th className="s2-th s2-th--type">Type</th>
                        <th className="s2-th s2-th--num">Amount (INR)</th>
                        <th className="s2-th s2-th--num">Balance (INR)</th>
                        <th className="s2-th s2-th--del"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((r, idx) => (
                        <tr key={r.id} className={'s2-tr' + (idx % 2 === 1 ? ' s2-tr--alt' : '')}>

                          <td className="s2-td s2-td--seq">{idx + 1}</td>

                          {/* Date */}
                          <td className="s2-td">
                            {isEditing(r.id, 'date') ? (
                              <input
                                className="s2-cell-input"
                                value={editValue} autoFocus
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={commitEdit}
                                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
                              />
                            ) : (
                              <span className="s2-cell-text s2-cell-text--date" onClick={() => startEdit(r.id, 'date', r.date)}>
                                {r.date}
                              </span>
                            )}
                          </td>

                          {/* Narration */}
                          <td className="s2-td s2-td--narration">
                            {isEditing(r.id, 'narration') ? (
                              <input
                                className="s2-cell-input s2-cell-input--wide"
                                value={editValue} autoFocus
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={commitEdit}
                                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
                              />
                            ) : (
                              <span className="s2-cell-text" onClick={() => startEdit(r.id, 'narration', r.narration)}>
                                {r.narration}
                              </span>
                            )}
                          </td>

                          {/* Type */}
                          <td className="s2-td">
                            {isEditing(r.id, 'type') ? (
                              <select
                                className="s2-cell-select"
                                value={editValue} autoFocus
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={commitEdit}
                              >
                                <option>Credit</option>
                                <option>Debit</option>
                              </select>
                            ) : (
                              <span
                                className={'s2-type-badge s2-type-badge--' + r.type.toLowerCase()}
                                onClick={() => startEdit(r.id, 'type', r.type)}
                              >{r.type}</span>
                            )}
                          </td>

                          {/* Amount */}
                          <td className="s2-td s2-td--num">
                            {isEditing(r.id, 'amount') ? (
                              <input
                                className="s2-cell-input s2-cell-input--num"
                                type="number" value={editValue} autoFocus
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={commitEdit}
                                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
                              />
                            ) : (
                              <span
                                className={'s2-cell-text s2-cell-amount s2-cell-amount--' + r.type.toLowerCase()}
                                onClick={() => startEdit(r.id, 'amount', r.amount)}
                              >
                                {fmtINR(r.amount)}
                              </span>
                            )}
                          </td>

                          {/* Balance */}
                          <td className="s2-td s2-td--num">
                            {isEditing(r.id, 'balance') ? (
                              <input
                                className="s2-cell-input s2-cell-input--num"
                                type="number" value={editValue} autoFocus
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={commitEdit}
                                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
                              />
                            ) : (
                              <span
                                className="s2-cell-text s2-cell-balance"
                                onClick={() => startEdit(r.id, 'balance', r.balance)}
                              >
                                {fmtINR(r.balance)}
                              </span>
                            )}
                          </td>

                          {/* Delete */}
                          <td className="s2-td s2-td--del">
                            <button
                              className="s2-delete-btn"
                              onClick={() => deleteRow(r.id)}
                              title="Delete row"
                            >&#215;</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredRecords.length === 0 && (
                    <div className="s2-data-empty">No records match the current filter.</div>
                  )}
                </div>

                {/* Add row bar */}
                <div className="s2-modal-add-row-bar">
                  <button className="s2-add-row-btn" onClick={addRow}>
                    + Add Row
                  </button>
                  <span className="s2-modal-add-row-bar__hint">
                    {filteredRecords.length} of {records.length} records shown
                    {typeFilter !== 'all' || dataSearch ? ' (filtered)' : ''}
                  </span>
                </div>

              </div>
            )}

            {/* ── COLUMNS TAB ─────────────────────────────── */}
            {modalTab === 'columns' && (
              <div className="s2-modal__body">
                <div className="s2-modal-col-header">
                  <span className="s2-modal-col-header__hint">
                    Toggle visibility &nbsp;&middot;&nbsp; rename headers &nbsp;&middot;&nbsp; change format &nbsp;&middot;&nbsp; reorder with arrows
                  </span>
                  <button className="s2-col-reset" onClick={resetCols}>Reset to defaults</button>
                </div>
                <div className="s2-modal-col-grid">
                  {sortedCols.map((col, idx) => (
                    <div
                      key={col.id}
                      className={'s2-modal-col-card' + (!col.visible ? ' s2-modal-col-card--hidden' : '')}
                    >
                      {/* Reorder */}
                      <div className="s2-col-card__order">
                        <button
                          className="s2-col-arrow"
                          onClick={() => moveCol(idx, -1)}
                          disabled={idx === 0}
                          title="Move up"
                        >&#8593;</button>
                        <button
                          className="s2-col-arrow"
                          onClick={() => moveCol(idx, 1)}
                          disabled={idx === sortedCols.length - 1}
                          title="Move down"
                        >&#8595;</button>
                      </div>

                      {/* Toggle */}
                      <label className="s2-toggle" title={col.visible ? 'Hide column' : 'Show column'}>
                        <input
                          type="checkbox"
                          checked={col.visible}
                          onChange={() => toggleCol(col.id)}
                        />
                        <span className="s2-toggle-track" />
                      </label>

                      {/* Info */}
                      <div className="s2-col-card__info">
                        <span className="s2-col-card__id">{col.id}</span>
                        <input
                          type="text"
                          className="s2-col-label-input"
                          value={col.label}
                          onChange={e => updateCol(col.id, 'label', e.target.value)}
                          title="Edit column header label"
                        />
                      </div>

                      {/* Format badge-select */}
                      <select
                        className={'s2-col-format-badge s2-col-format-badge--' + col.format}
                        value={col.format}
                        onChange={e => updateCol(col.id, 'format', e.target.value)}
                      >
                        {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal footer */}
            <div className="s2-modal__footer">
              <div className="s2-modal__footer-summary">
                <span className="s2-stat s2-stat--total">{records.length} rows</span>
                <span className="s2-stat s2-stat--credit">Cr {fmtDisplay(totalCr)}</span>
                <span className="s2-stat s2-stat--debit">Dr {fmtDisplay(totalDr)}</span>
                <span className="s2-modal__footer-cols">{visibleCols} of {columns.length} columns visible</span>
              </div>
              <button
                className="s2-modal__done-btn"
                onClick={() => setShowEditModal(false)}
              >
                Done — Apply Changes
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
