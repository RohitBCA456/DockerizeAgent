import React, { useContext } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LogOut, Cog, BotMessageSquare } from 'lucide-react';

const Sidebar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };
  
  const navLinkClass = ({ isActive }) =>
    `flex items-center px-4 py-3 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors ${
      isActive ? 'bg-gray-700 text-white' : ''
    }`;

  return (
    <div className="flex flex-col h-full w-64 bg-gray-800 text-white p-4">
      <div className="flex items-center mb-8 px-2">
         <BotMessageSquare className="w-8 h-8 mr-3 text-indigo-400" />
         <span className="text-xl font-bold">DevOps Agent</span>
      </div>
      <nav className="flex-grow">
        <NavLink to="/devops" className={navLinkClass}>
          <Cog className="w-5 h-5 mr-4" />
          <span>Generate DevOps</span>
        </NavLink>
        <NavLink to="/extras" className={navLinkClass}>
          <BotMessageSquare className="w-5 h-5 mr-4" />
          <span>Extras</span>
        </NavLink>
      </nav>
      <div className="mt-auto">
         {user && (
            <div className="flex items-center p-2 mb-4 border-t border-gray-700 pt-4">
               <img src={user.image} alt={user.displayName} className="w-10 h-10 rounded-full mr-3" />
               <div>
                  <p className="font-semibold text-sm">{user.displayName}</p>
                  <p className="text-xs text-gray-400">{user.email}</p>
               </div>
            </div>
         )}
         <button onClick={handleLogout} className="flex items-center w-full px-4 py-3 text-gray-300 rounded-lg hover:bg-red-800/50 transition-colors">
            <LogOut className="w-5 h-5 mr-4" />
            <span>Logout</span>
         </button>
      </div>
    </div>
  );
};

const MainLayout = () => {
  return (
    <div className="flex h-screen bg-gray-900">
      <Sidebar />
      <main className="flex-1 p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;