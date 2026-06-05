import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated, hasPermission } from '../../utils/auth';

export default function ProtectedRoute({ children, permission }) {
  const location = useLocation();
  const authenticated = isAuthenticated();

  if (!authenticated) {
    // Redirect to login page but save the location they were trying to access
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Optional permission gate — redirect users without access back to the dashboard
  if (permission && !hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
