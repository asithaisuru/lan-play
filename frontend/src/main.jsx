import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AuthCallbackPage from './pages/AuthCallbackPage';
import DashboardPage from './pages/DashboardPage';
import GuestJoinPage from './pages/GuestJoinPage';
import HostPage from './pages/HostPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import PlayerPage from './pages/PlayerPage';
import PlaylistDetailPage from './pages/PlaylistDetailPage';
import PlaylistsPage from './pages/PlaylistsPage';
import PricingPage from './pages/PricingPage';
import QueuePage from './pages/QueuePage';
import MyPlaylistsPage from './pages/MyPlaylistsPage';
import RoomSettingsPage from './pages/RoomSettingsPage';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/playlists" element={<PlaylistsPage />} />
            <Route path="/playlists/:id" element={<PlaylistDetailPage />} />
            <Route
              path="/dashboard"
              element={(
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/dashboard/playlists"
              element={(
                <ProtectedRoute>
                  <MyPlaylistsPage />
                </ProtectedRoute>
              )}
            />
            <Route path="/room/:code" element={<GuestJoinPage />} />
            <Route path="/room/:code/host" element={<HostPage />} />
            <Route path="/room/:code/player" element={<PlayerPage />} />
            <Route path="/room/:code/queue" element={<QueuePage />} />
            <Route
              path="/room/:code/settings"
              element={(
                <ProtectedRoute>
                  <RoomSettingsPage />
                </ProtectedRoute>
              )}
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
);
