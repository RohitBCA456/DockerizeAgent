import React, { useContext, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';

// Import all view components
import Login from './components/Login';
import MainLayout from './components/MainLayout';
import DevOpsView from './components/DevOpsView';
import Spinner from './components/ui/Spinner';

function App() {
  const { user, loading, checkUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // This effect now runs only once on initial mount to check auth status.
    // Subsequent updates are handled by the user state changing.
    checkUser();
  }, [checkUser]); // The checkUser function should be stable (wrapped in useCallback in your context)


  useEffect(() => {
    // This effect handles redirection logic when loading is finished.
    if (!loading) {
      if (!user && location.pathname !== '/login') {
        // If there's no user and we are NOT on the login page, redirect to login.
        navigate('/login');
      } else if (user && location.pathname === '/login') {
        // If there IS a user and we ARE on the login page, redirect to the dashboard.
        navigate('/');
      }
    }
  }, [user, loading, location.pathname, navigate]);


  // Display a full-screen loader while the initial user check is in progress.
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      {/* Protect the main layout. If there's no user, it will be redirected. */}
      {user && (
         <Route path="/*" element={<MainLayout />}>
            <Route index element={<DevOpsView />} />
            <Route path="devops" element={<DevOpsView />} />
        </Route>
      )}
    </Routes>
  );
}

export default App;