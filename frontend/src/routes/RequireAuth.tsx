import { Navigate, Outlet, useLocation } from 'react-router-dom';
import FullScreenLoader from '../components/FullScreenLoader';
import { useAuth } from '../features/auth/useAuth';
import ForbiddenPage from '../pages/ForbiddenPage';
import type { Role } from '../types/auth';

interface RequireAuthProps {
  /** If given, only these roles may see the nested routes. */
  roles?: Role[];
}

export default function RequireAuth({ roles }: RequireAuthProps) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (roles && !roles.includes(user.role)) return <ForbiddenPage />;
  return <Outlet />;
}
