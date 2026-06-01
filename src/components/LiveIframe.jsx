import { useRef, useEffect, useState } from 'react';

/**
 * Flicker-free live preview iframe.
 *
 * The standard approach of binding `srcDoc` causes the browser to treat every
 * prop change as a full navigation: the iframe goes blank (white flash) then
 * re-renders from scratch. That is the "jerk / flicker" when typing.
 *
 * This component instead writes to `contentDocument` imperatively.
 * `document.open/write/close` is synchronous and in-place — no navigation
 * event fires, no white blank, zero visible flicker.
 *
 * Props
 * ─────
 * html        {string}  Full HTML document string to render.
 * className   {string}  CSS class for the <iframe> element.
 * title       {string}  Accessible title.
 * style       {object}  Inline styles (only for zoom/transform wrappers).
 * debounceMs  {number}  Delay before updating the DOM. Default 0.
 *                       Use 150 for text-input-heavy panels (e.g. the
 *                       Step 1 customizer) so we don't repaint on every
 *                       single keystroke.
 */
export default function LiveIframe({ html, className, title, style, debounceMs = 0 }) {
  const frameRef = useRef(null);

  /* Optional debounce — keeps the preview smooth during fast typing */
  const [activeHtml, setActiveHtml] = useState(html);

  useEffect(() => {
    if (debounceMs <= 0) {
      setActiveHtml(html);
      return;
    }
    const id = setTimeout(() => setActiveHtml(html), debounceMs);
    return () => clearTimeout(id);
  }, [html, debounceMs]);

  /* Write HTML in-place — no iframe reload, no white flash */
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const doc = frame.contentDocument ?? frame.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(activeHtml);
    doc.close();
  }, [activeHtml]);

  return (
    <iframe
      ref={frameRef}
      className={className}
      title={title}
      style={style}
      sandbox="allow-same-origin"
    />
  );
}
