import { useRef, useEffect, useState } from 'react';

/**
 * Flicker-free live preview iframe.
 *
 * Uses srcDoc with a keyed remount trick:
 * - Only `allow-scripts` is needed (no allow-same-origin → no sandbox escape warning)
 * - A debounce prevents repainting on every keystroke
 */
export default function LiveIframe({ html, className, title, style, debounceMs = 0 }) {
  const [activeHtml, setActiveHtml] = useState(html);
  const [key, setKey] = useState(0);
  const prevHtml = useRef(html);

  useEffect(() => {
    if (debounceMs <= 0) {
      if (html !== prevHtml.current) {
        prevHtml.current = html;
        setActiveHtml(html);
        setKey(k => k + 1);
      }
      return;
    }
    const id = setTimeout(() => {
      if (html !== prevHtml.current) {
        prevHtml.current = html;
        setActiveHtml(html);
        setKey(k => k + 1);
      }
    }, debounceMs);
    return () => clearTimeout(id);
  }, [html, debounceMs]);

  return (
    <iframe
      key={key}
      srcDoc={activeHtml}
      className={className}
      title={title}
      style={style}
      sandbox="allow-scripts"
    />
  );
}
