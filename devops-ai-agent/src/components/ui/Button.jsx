import React from 'react';

const Button = ({ children, onClick, className = '', variant = 'primary', disabled = false, ...props }) => {
  const baseClasses = 'px-4 py-2 rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-500 focus:ring-indigo-500',
    secondary: 'bg-gray-700 text-gray-200 hover:bg-gray-600 focus:ring-gray-500',
    outline: 'bg-transparent border border-gray-700 text-gray-200 hover:bg-gray-800',
    premium: 'bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-500 text-white shadow-lg hover:from-purple-500 hover:to-blue-400',
    ghost: 'bg-transparent text-gray-200 hover:bg-gray-800',
  };

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;