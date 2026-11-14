import { HashRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { ToastProvider } from './components/ui'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import OrderForm from './pages/OrderForm'
import OrderDetail from './pages/OrderDetail'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import CalendarPage from './pages/Calendar'
import Planning from './pages/Planning'
import Catalog from './pages/Catalog'
import Stock from './pages/Stock'
import Reports from './pages/Reports'
import SettingsPage from './pages/Settings'

export default function App() {
  return (
    <ToastProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="siparisler" element={<Orders />} />
            <Route path="siparisler/yeni" element={<OrderForm />} />
            <Route path="siparisler/:id" element={<OrderDetail />} />
            <Route path="siparisler/:id/duzenle" element={<OrderForm />} />
            <Route path="musteriler" element={<Customers />} />
            <Route path="musteriler/:id" element={<CustomerDetail />} />
            <Route path="takvim" element={<CalendarPage />} />
            <Route path="planlama" element={<Planning />} />
            <Route path="katalog" element={<Catalog />} />
            <Route path="stok" element={<Stock />} />
            <Route path="raporlar" element={<Reports />} />
            <Route path="ayarlar" element={<SettingsPage />} />
            <Route path="*" element={<Dashboard />} />
          </Route>
        </Routes>
      </HashRouter>
    </ToastProvider>
  )
}
