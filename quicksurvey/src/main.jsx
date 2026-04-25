import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Hide splash as soon as React mounts
function hideSplash() {
  const s = document.getElementById('splash');
  if (s) {
    s.classList.add('gone');
    setTimeout(() => s.remove(), 250);
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App onReady={hideSplash} />);
