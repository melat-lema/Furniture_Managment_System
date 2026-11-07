import { Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import AccountPage from './pages/AccountPage';
import CategoriesPage from './pages/CategoriesPage';
import DashboardPage from './pages/DashboardPage';
import LocationsPage from './pages/LocationsPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import ProductsPage from './pages/ProductsPage';
import RecordProductionPage from './pages/RecordProductionPage';
import StockPage from './pages/StockPage';
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

          {/* Every role: the catalog (read-only except for the owner and workshop manager) and its own stock */}
          <Route path="products" element={<ProductsPage />} />
          <Route path="stock" element={<StockPage />} />

          {/* Owner and workshop manager: they define the catalog (products, prices, categories) */}
          <Route element={<RequireAuth roles={['OWNER', 'WORKSHOP_MANAGER']} />}>
            <Route path="categories" element={<CategoriesPage />} />
          </Route>

          {/* Workshop manager only: the person in the workshop records what is produced */}
          <Route element={<RequireAuth roles={['WORKSHOP_MANAGER']} />}>
            <Route path="production" element={<RecordProductionPage />} />
          </Route>

          {/* Owner only */}
          <Route element={<RequireAuth roles={['OWNER']} />}>
            <Route path="locations" element={<LocationsPage />} />
            <Route path="users" element={<UsersPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
