// Service Worker entry point for Chrome Request Manager
// This will be implemented in subsequent tasks

console.log('Chrome Request Manager service worker initialized');

// Lifecycle events
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Extension started');
});
