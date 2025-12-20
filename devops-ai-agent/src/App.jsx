import React, { useContext, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';

import Login from './components/Login';
import MainLayout from './components/MainLayout';
import DevOpsView from './components/DevOpsView';
import ExtrasView from './components/ExtrasView';
import Spinner from './components/ui/Spinner';

function App() {
  const { user, loading, checkUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    checkUser();
  }, [checkUser]);


  useEffect(() => {
    if (!loading) {
      if (!user && location.pathname !== '/login') {
        navigate('/login');
      } else if (user && location.pathname === '/login') {
        navigate('/');
      }
    }
  }, [user, loading, location.pathname, navigate]);

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
      
      {user && (
     <Route path="/*" element={<MainLayout />}>
      <Route index element={<DevOpsView />} />
      <Route path="devops" element={<DevOpsView />} />
      <Route path="extras" element={<ExtrasView />} />
    </Route>
      )}
    </Routes>
  );
}

export default App;