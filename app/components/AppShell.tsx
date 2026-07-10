'use client';

import { ReactNode } from 'react';
import GlobalStyle from './GlobalStyle';
import BottomNav from './BottomNav';

/**
 * Wraps a page in the standard Bites Theory shell:
 *   [header (passed in)] [scrollable content] [optional cartbar] [bottom nav]
 */
export default function AppShell({
  header,
  children,
  footerExtra,
  overlay,
}: {
  header?: ReactNode;
  children: ReactNode;
  footerExtra?: ReactNode; // e.g. a cart bar shown above the nav
  overlay?: ReactNode; // e.g. drawer / intro / toast that floats over everything
}) {
  return (
    <>
      <GlobalStyle />
      <div className="bt-stage">
        <main className="bt-app">
          {header}
          <div className="bt-scroll">{children}</div>
          <div className="bt-footer">
            {footerExtra}
            <BottomNav />
          </div>
          {overlay}
        </main>
      </div>
    </>
  );
}
