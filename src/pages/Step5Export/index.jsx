import { useState, useMemo } from 'react';
import { generatePreviewHTML } from '../../utils/previewGenerator';
import LiveIframe from '../../components/LiveIframe';
import './Step5Export.css';

export default function Step5Export({ state, send, context }) {
  const isIdle      = state.matches('step5.idle');
  const isExporting = state.matches('step5.exporting');
  const isDone      = state.matches('step5.done');

  const [exportType, setExportType] = useState(null);

  const configName = context.promptConfig?.name ?? 'Report';

  const previewHTML = useMemo(() =>
    generatePreviewHTML(context, 'step5', {}),
    [context]
  );

  function handleExport(type) {
    setExportType(type);
    send({ type: 'EXPORT_START' });
    setTimeout(() => send({ type: 'EXPORT_SUCCESS' }), 2200);
  }

  function exportLabel(type) {
    if (type === 'report') return '.report';
    if (type === 'xlsx')   return '.xlsx';
    return '.pdf';
  }

  return (
    <>
      {/* ── Ribbon ────────────────────────────────────── */}
      <div className="ribbon">
        <button
          className="ribbon-btn"
          onClick={() => send({ type: 'BACK' })}
          disabled={isExporting}
        >
          &larr; Back
        </button>

        <div className="ribbon-sep" />

        <div className="ribbon-field">
          <span className="ribbon-field__label">Template</span>
          <span className="s5-ribbon-config">{configName}</span>
        </div>

        <div className="ribbon-sep" />

        <div className="ribbon-field">
          <span className="ribbon-field__label">Quick Export</span>
          <div className="s5-ribbon-btns">
            <button
              className={'ribbon-btn s5-ribbon-export-btn s5-ribbon-export-btn--report' + (isExporting && exportType === 'report' ? ' ribbon-btn--active' : '')}
              onClick={() => handleExport('report')}
              disabled={isExporting || isDone}
            >
              {isExporting && exportType === 'report'
                ? <><span className="ribbon-spinner" />Exporting…</>
                : '.report'}
            </button>
            <button
              className={'ribbon-btn s5-ribbon-export-btn s5-ribbon-export-btn--xlsx' + (isExporting && exportType === 'xlsx' ? ' ribbon-btn--active' : '')}
              onClick={() => handleExport('xlsx')}
              disabled={isExporting || isDone}
            >
              {isExporting && exportType === 'xlsx'
                ? <><span className="ribbon-spinner" />Exporting…</>
                : '.xlsx'}
            </button>
            <button
              className={'ribbon-btn s5-ribbon-export-btn s5-ribbon-export-btn--pdf' + (isExporting && exportType === 'pdf' ? ' ribbon-btn--active' : '')}
              onClick={() => handleExport('pdf')}
              disabled={isExporting || isDone}
            >
              {isExporting && exportType === 'pdf'
                ? <><span className="ribbon-spinner" />Exporting…</>
                : '.pdf'}
            </button>
          </div>
        </div>

        <div className="ribbon-spacer" />

        {isExporting && (
          <span className="ribbon-status ribbon-status--info">
            <span className="ribbon-spinner s4-spinner-dark" />
            Generating {exportLabel(exportType)} file…
          </span>
        )}
        {isDone && (
          <span className="s5-ribbon-done">
            Export complete — {exportLabel(exportType)} saved
          </span>
        )}
      </div>

      {/* ── Workspace ─────────────────────────────────── */}
      <div className="workspace workspace--split s5-workspace">

        {/* Left — export panel */}
        <div className="s5-panel">
          <div className="s5-panel__header">
            <span className="s5-panel__title">Export Report</span>
          </div>

          {isDone ? (
            /* Success state */
            <div className="s5-success">
              <div className="s5-success__icon">&#10003;</div>
              <div className="s5-success__title">Export Complete</div>
              <p className="s5-success__desc">
                Your report was exported as{' '}
                <strong>{exportLabel(exportType)}</strong> successfully.
              </p>
              <button
                className="s5-success__new-btn"
                onClick={() => send({ type: 'RESET' })}
              >
                Start New Report
              </button>
            </div>
          ) : (
            <div className="s5-options">

              {/* ── .report option ───────────────────── */}
              <div className={'s5-option' + (isExporting && exportType === 'report' ? ' s5-option--active' : '')}>
                <div className="s5-option__icon s5-option__icon--report">R</div>
                <div className="s5-option__body">
                  <div className="s5-option__name">.report Format</div>
                  <p className="s5-option__desc">
                    Native Electron format. Opens directly in Bank Report Builder for viewing and re-export.
                  </p>
                  <ul className="s5-feature-list">
                    <li>Full layout fidelity</li>
                    <li>Re-editable in this tool</li>
                    <li>Includes raw data snapshot</li>
                  </ul>
                  <div className="s5-option__note">Via Electron file dialog</div>
                </div>
                <button
                  className="s5-export-btn s5-export-btn--report"
                  onClick={() => handleExport('report')}
                  disabled={isExporting}
                >
                  {isExporting && exportType === 'report'
                    ? <><span className="s5__spinner" />Exporting…</>
                    : 'Export .report'}
                </button>
              </div>

              <div className="s5-options__divider">or</div>

              {/* ── .xlsx option ──────────────────────── */}
              <div className={'s5-option' + (isExporting && exportType === 'xlsx' ? ' s5-option--active' : '')}>
                <div className="s5-option__icon s5-option__icon--xlsx">X</div>
                <div className="s5-option__body">
                  <div className="s5-option__name">Excel (.xlsx)</div>
                  <p className="s5-option__desc">
                    Standard workbook. Shareable with stakeholders who don&apos;t have Bank Report Builder.
                  </p>
                  <ul className="s5-feature-list">
                    <li>Formatted worksheets</li>
                    <li>Pivot-ready data tabs</li>
                    <li>Excel &amp; Google Sheets compatible</li>
                  </ul>
                  <div className="s5-option__note">Via http://localhost:8000/export/xlsx</div>
                </div>
                <button
                  className="s5-export-btn s5-export-btn--xlsx"
                  onClick={() => handleExport('xlsx')}
                  disabled={isExporting}
                >
                  {isExporting && exportType === 'xlsx'
                    ? <><span className="s5__spinner" />Exporting…</>
                    : 'Export .xlsx'}
                </button>
              </div>

              <div className="s5-options__divider">or</div>

              {/* ── .pdf option ───────────────────────── */}
              <div className={'s5-option' + (isExporting && exportType === 'pdf' ? ' s5-option--active' : '')}>
                <div className="s5-option__icon s5-option__icon--pdf">P</div>
                <div className="s5-option__body">
                  <div className="s5-option__name">PDF Document (.pdf)</div>
                  <p className="s5-option__desc">
                    Print-ready PDF. Share directly via email or print for official physical records.
                  </p>
                  <ul className="s5-feature-list">
                    <li>Full page layout preserved</li>
                    <li>Print-ready A4 format</li>
                    <li>No special software required</li>
                  </ul>
                  <div className="s5-option__note">Via http://localhost:8000/export/pdf</div>
                </div>
                <button
                  className="s5-export-btn s5-export-btn--pdf"
                  onClick={() => handleExport('pdf')}
                  disabled={isExporting}
                >
                  {isExporting && exportType === 'pdf'
                    ? <><span className="s5__spinner" />Exporting…</>
                    : 'Export .pdf'}
                </button>
              </div>

            </div>
          )}
        </div>

        {/* Right — live preview */}
        <div className="live-preview">
          <div className="live-preview__label">Final Report Preview</div>
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
