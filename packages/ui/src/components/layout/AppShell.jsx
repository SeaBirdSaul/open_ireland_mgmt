// AppShell component for layout structure
// Includes sidebar and header, and renders main content area
// Accepts props: children (main content), sidebar (sidebar component), header (header component)
import React from 'react';

export default function AppShell({ children, sidebar, header }) {
  return (
    <div className="app-shell h-screen flex flex-col">
      {header}
      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
        {sidebar}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          {children}
        </main>
      </div>
    </div>
  );
}

