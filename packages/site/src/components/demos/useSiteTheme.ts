import { useState, useEffect } from 'react';
import { lightTheme, darkTheme } from '@witqq/spreadsheet';
import type { SpreadsheetTheme } from '@witqq/spreadsheet';

/**
 * Detect site theme from Starlight's data-theme attribute or landing context.
 * Landing page = always dark (no data-theme).
 * Docs pages = Starlight manages data-theme on <html>.
 */
export function useSiteTheme(): { witTheme: SpreadsheetTheme; isDark: boolean } {
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === 'undefined') return true;
    const dt = document.documentElement.getAttribute('data-theme');
    // No data-theme = landing page (dark-only); 'dark' = Starlight dark
    return dt !== 'light';
  });

  useEffect(() => {
    const html = document.documentElement;
    const update = () => {
      const dt = html.getAttribute('data-theme');
      setIsDark(dt !== 'light');
    };

    const observer = new MutationObserver(update);
    observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
    update();
    return () => observer.disconnect();
  }, []);

  return { witTheme: isDark ? darkTheme : lightTheme, isDark };
}
