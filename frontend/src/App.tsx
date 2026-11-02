import { Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import GuestOnly from './routes/GuestOnly';
import RequireAuth from './routes/RequireAuth';

export default function App() {
  return (
    <Routes>
      {/* Public: only for people who are NOT signed in */}
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Private: everything below needs a login */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />

          {/* Day 4+: pages limited to certain roles, for example:
              <Route element={<RequireAuth roles={['OWNER']} />}>
                <Route path="products" element={<ProductsPage />} />
              </Route> */}

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
