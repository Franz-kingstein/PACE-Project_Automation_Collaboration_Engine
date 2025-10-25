import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Home from './components/Home';
import TaskBoard from './components/TaskBoard';
import BugReporter from './components/BugReporter';
import Chat from './components/Chat';
import ProjectView from './components/ProjectView';
import UserProfile from './components/UserProfile';
import Navbar from './components/Navbar';
import AIChatbot from './components/AIChatbot';
import './App.css';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  return user ? children : <Navigate to="/" />;
};

const PrivateLayout = () => (
  <>
    <Navbar />
  <main className="route-fade with-sidebar">
      <Outlet />
    </main>
  </>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Public */}
            <Route path="/" element={<Login />} />

            {/* Authenticated layout */}
            <Route element={<PrivateRoute><PrivateLayout /></PrivateRoute>}>
              <Route path="/home" element={<Home />} />
              <Route path="/project/:projectId" element={<ProjectView />} />
              <Route path="/tasks" element={<TaskBoard />} />
              <Route path="/bugs" element={<BugReporter />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/profile" element={<UserProfile />} />
            </Route>

            {/* Redirects and 404 */}
            <Route path="/dashboard" element={<Navigate to="/home" replace />} />
            <Route path="*" element={<div style={{ padding: 24 }}>404 - Page not found</div>} />
          </Routes>
          <AIChatbot />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
