import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <p>Loading security context...</p>
      </div>
    );
  }

  if (!user) {
    toast.warn('Please log in to access this page.');
    return <Navigate to={requireAdmin ? '/admin/login' : '/login'} replace />;
  }

  if (requireAdmin && user.role !== 'admin') {
    toast.error('⛔ Access Denied: Administrator role required.');
    return <Navigate to="/admin/login" replace />;
  }

  return children;
};

export default ProtectedRoute;

