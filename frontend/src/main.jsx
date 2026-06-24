import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AdminApp from './admin/AdminApp';
import './theme/global.css';

const pathname = window.location.pathname;
const hasAdminSession = Boolean(localStorage.getItem('bilhete.admin.token'));
const hasUserSession = Boolean(localStorage.getItem('bilhete.token'));

if (pathname === '/') {
  if (hasAdminSession) {
    window.history.replaceState({}, '', '/admin');
  } else if (hasUserSession) {
    window.history.replaceState({}, '', '/app');
  }
}

const isAdminRoute = window.location.pathname.startsWith('/admin');
const RootComponent = isAdminRoute ? AdminApp : App;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>
);
