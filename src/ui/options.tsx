// Options page UI entry point
// This will be implemented in subsequent tasks

import React from 'react';
import { createRoot } from 'react-dom/client';

const Options: React.FC = () => {
  return (
    <div>
      <h1>Chrome Request Manager - Options</h1>
      <p>Options UI - To be implemented</p>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Options />);
}
