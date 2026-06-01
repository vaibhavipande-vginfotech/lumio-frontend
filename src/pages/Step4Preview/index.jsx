import { useState, useEffect, useMemo } from 'react';
import { generatePreviewHTML } from '../../utils/previewGenerator';
import LiveIframe from '../../components/LiveIframe';
import './Step4Preview.css';

export default function Step4Preview({ state, send, context }) {
  const [loading, setLoading] = useState(true);
  const [zoom,    setZoom]    = useState(100);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(false);
      send({ type: 'PREVIEW_READY' });
    }, 2200);
    return () => clearTimeout(t);
  }, [send]);

  /* Generate preview from the confirmed config + data */
  const previewHTML = useMemo(() =>
    generatePreviewHTML(context, 'step4', {}),
    [context]
  );

  const configName = context.promptConfig?.name ?? 'Report';

  return (
    <>
      {/* ── Ribbon ────────────────────────────────────── */}
      <div className="ribbon">

        <button className="ribbon-btn" onClick={() => send({ type: 'BACK' })}>
          ← Back
        </button>

        <div className="ribbon-sep" />

        <div className="ribbon-field">
          <span className="ribbon-field__label">View</span>
          <div className="s4-zoom-group">
            <button
              className="ribbon-btn"
              onClick={() => setZoom(z => Math.min(z + 10, 150))}
              disabled={!context.previewReady}
            >
              + Zoom In
            </button>
            <span className="s4-zoom-label">{zoom}%</span>
            <button
              className="ribbon-btn"
              onClick={() => setZoom(z => Math.max(z - 10, 60))}
              disabled={!context.previewReady}
            >
              − Zoom Out
            </button>
            <button
              className="ribbon-btn"
              onClick={() => setZoom(100)}
              disabled={!context.previewReady || zoom === 100}
            >
              Fit
            </button>
          </div>
        </div>

        <div className="ribbon-sep" />

        <div className="ribbon-field">
          <span className="ribbon-field__label">Template</span>
          <span className="s4-template-name">{configName}</span>
        </div>

        <div className="ribbon-spacer" />

        {loading && (
          <span className="ribbon-status ribbon-status--info">
            <span className="ribbon-spinner s4-spinner-dark" />
            Rendering via AI engine…
          </span>
        )}

        <button
          className={'ribbon-primary ribbon-primary--success' + (!context.previewReady ? ' ribbon-primary--wait' : '')}
          onClick={() => send({ type: 'NEXT' })}
          disabled={!context.previewReady}
        >
          {context.previewReady ? 'Proceed to Export →' : 'Loading Preview…'}
        </button>
      </div>

      {/* ── Workspace — full-screen zoomable preview ──── */}
      <div className="workspace workspace--iframe s4-workspace">
        {loading && (
          <div className="s4-loading">
            <div className="s4-loading__spinner" />
            <p className="s4-loading__text">Rendering report via AI layout engine…</p>
            <code className="s4-loading__endpoint">POST http://localhost:8001/render</code>
          </div>
        )}
        <div
          className={'s4-frame-container' + (loading ? ' s4-frame-container--hidden' : '')}
          style={{ zoom: zoom / 100 }}
        >
          <LiveIframe
            html={previewHTML}
            className="s4-iframe"
            title="Report Preview"
          />
        </div>
      </div>
    </>
  );
}
