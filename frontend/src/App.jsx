import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import DashboardPage from './pages/DashboardPage';
import AIAssistantPage from './pages/AIAssistantPage';
import ConnectionsPage from './pages/ConnectionsPage';
import ClientsPage from './pages/ClientsPage';
import DocumentsPage from './pages/DocumentsPage';
import ReportsPage from './pages/ReportsPage';
import DashboardsPage from './pages/DashboardsPage';
import SyncPage from './pages/SyncPage';
import SettingsPage from './pages/SettingsPage';
import LogsPage from './pages/LogsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="ai" element={<AIAssistantPage />} />
          <Route path="connections" element={<ConnectionsPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="dashboards" element={<DashboardsPage />} />
          <Route path="sync" element={<SyncPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
