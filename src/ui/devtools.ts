// DevTools page script - creates the panel
chrome.devtools.panels.create(
  'Request Manager',
  '', // No icon for now
  'panel.html',
  (panel) => {
    // Panel created successfully
    console.log('Request Manager DevTools panel created');
  }
);
