import { Navigate, Outlet, useLocation } from 'react-router-dom';
import FullScreenLoader from '../components/FullScreenLoader';
import { useAuth } from '../features/auth/useAuth';

/** Wraps the login page: people who are already signed in are sent on to the app. */
export default function GuestOnly() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'authenticated') {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';
    return <Navigate to={from} replace />;
  }
  return <Outlet />;
}
