import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AdminApp from './admin/AdminApp';
import './theme/global.css';

const pathname = window.location.pathname;
const rawUserSession = localStorage.getItem('bilhete.user') || localStorage.getItem('bilhete.admin.user');

function loadStoredUser() {
  if (!rawUserSession) {
    return null;
  }

  try {
    return JSON.parse(rawUserSession);
  } catch {
    return null;
  }
}

function resolveRouteForRole(user) {
  if (user?.role === 'admin') {
    return '/admin';
  }

  if (user?.role === 'establishment') {
    return '/admin/establishment';
  }

  if (user?.id) {
    return '/app';
  }

  return '/';
}

const storedUser = loadStoredUser();
const targetRoute = resolveRouteForRole(storedUser);

if (pathname === '/') {
  if (targetRoute !== '/') {
    window.history.replaceState({}, '', targetRoute);
  }
}

const isAdminRoute = window.location.pathname.startsWith('/admin');
const RootComponent = isAdminRoute ? AdminApp : App;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>
);
