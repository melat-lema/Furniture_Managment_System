import { Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import AccountPage from './pages/AccountPage';
import CategoriesPage from './pages/CategoriesPage';
import DashboardPage from './pages/DashboardPage';
import LocationsPage from './pages/LocationsPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import ProductsPage from './pages/ProductsPage';
import UsersPage from './pages/UsersPage';
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
          <Route path="account" element={<AccountPage />} />

          {/* Every role can browse the catalog; only the owner can change it (the page and the API both enforce this) */}
          <Route path="products" element={<ProductsPage />} />

          {/* Owner only */}
          <Route element={<RequireAuth roles={['OWNER']} />}>
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="locations" element={<LocationsPage />} />
            <Route path="users" element={<UsersPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
