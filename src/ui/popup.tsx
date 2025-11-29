// Popup UI entry point
// This will be implemented in subsequent tasks

import React from 'react';
import { createRoot } from 'react-dom/client';

const Popup: React.FC = () => {
  return (
    <div>
      <h1>Chrome Request Manager</h1>
      <p>Popup UI - To be implemented</p>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}
