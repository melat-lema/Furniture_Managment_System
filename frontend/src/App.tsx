import { Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import AccountPage from './pages/AccountPage';
import CategoriesPage from './pages/CategoriesPage';
import DashboardPage from './pages/DashboardPage';
import LocationsPage from './pages/LocationsPage';
import LoginPage from './pages/LoginPage';
import NewSalePage from './pages/NewSalePage';
import NotFoundPage from './pages/NotFoundPage';
import PaymentsPage from './pages/PaymentsPage';
import ProductsPage from './pages/ProductsPage';
import RecordProductionPage from './pages/RecordProductionPage';
import SaleDetailPage from './pages/SaleDetailPage';
import SalesPage from './pages/SalesPage';
import SalespeoplePage from './pages/SalespeoplePage';
import SettingsPage from './pages/SettingsPage';
import StockPage from './pages/StockPage';
import TransferDetailPage from './pages/TransferDetailPage';
import TransferFormPage from './pages/TransferFormPage';
import TransfersPage from './pages/TransfersPage';
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
          <Route path="transfers" element={<TransfersPage />} />
          <Route path="transfers/:id" element={<TransferDetailPage />} />

          {/* Only the workshop and the store send goods */}
          <Route element={<RequireAuth roles={['WORKSHOP_MANAGER', 'STORE_MANAGER']} />}>
            <Route path="transfers/new" element={<TransferFormPage />} />
            <Route path="transfers/:id/edit" element={<TransferFormPage />} />
          </Route>

          {/* Owner and workshop manager: they define the catalog (products, prices, categories) */}
          <Route element={<RequireAuth roles={['OWNER', 'WORKSHOP_MANAGER']} />}>
            <Route path="categories" element={<CategoriesPage />} />
          </Route>

          {/* Workshop manager only: the person in the workshop records what is produced */}
          <Route element={<RequireAuth roles={['WORKSHOP_MANAGER']} />}>
            <Route path="production" element={<RecordProductionPage />} />
          </Route>

          {/* Sales: the showroom records and sees its own, the owner sees all */}
          <Route element={<RequireAuth roles={['OWNER', 'SHOWROOM']} />}>
            <Route path="sales" element={<SalesPage />} />
            <Route path="sales/:id" element={<SaleDetailPage />} />
            <Route path="salespeople" element={<SalespeoplePage />} />
          </Route>

          {/* Only a showroom records a sale */}
          <Route element={<RequireAuth roles={['SHOWROOM']} />}>
            <Route path="sales/new" element={<NewSalePage />} />
          </Route>

          {/* Owner only */}
          <Route element={<RequireAuth roles={['OWNER']} />}>
            <Route path="locations" element={<LocationsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="payments" element={<PaymentsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
