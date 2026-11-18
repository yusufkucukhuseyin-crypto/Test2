import { HashRouter, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ConfirmHost } from './components/confirm'
import { UpdateBanner } from './components/AppInstall'
import Layout from './components/Layout'
import { ToastProvider } from './components/ui'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import OrderForm from './pages/OrderForm'
import OrderDetail from './pages/OrderDetail'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import CalendarPage from './pages/Calendar'
import PriceList from './pages/PriceList'
import SpecialDays from './pages/SpecialDays'
import PrintOrder from './pages/PrintOrder'
import PrintOrders from './pages/PrintOrders'
import Catalog from './pages/Catalog'
import Stock from './pages/Stock'
import Reports from './pages/Reports'
import SettingsPage from './pages/Settings'

// Gömülü önizleme sürümünde adres çubuğu kullanılmaz
const Router = import.meta.env.VITE_EMBED ? MemoryRouter : HashRouter

/** Adres (ör. ?tarih=, ?kaynak=) değişince sipariş formu sıfırdan açılsın */
function OrderFormPage() {
  const loc = useLocation()
  return <OrderForm key={loc.pathname + loc.search} />
}

export default function App() {
  return (
    <ToastProvider>
      <ConfirmHost />
      <UpdateBanner />
      <Router>
        <Routes>
          <Route path="siparisler/yazdir" element={<PrintOrders />} />
          <Route path="siparisler/:id/yazdir" element={<PrintOrder />} />
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="siparisler" element={<Orders />} />
            <Route path="siparisler/yeni" element={<OrderFormPage />} />
            <Route path="siparisler/:id" element={<OrderDetail />} />
            <Route path="siparisler/:id/duzenle" element={<OrderFormPage />} />
            <Route path="musteriler" element={<Customers />} />
            <Route path="musteriler/:id" element={<CustomerDetail />} />
            <Route path="takvim" element={<CalendarPage />} />
            <Route path="fiyat-listesi" element={<PriceList />} />
            <Route path="ozel-gunler" element={<SpecialDays />} />
            <Route path="katalog" element={<Catalog />} />
            <Route path="stok" element={<Stock />} />
            <Route path="raporlar" element={<Reports />} />
            <Route path="ayarlar" element={<SettingsPage />} />
            <Route path="*" element={<Dashboard />} />
          </Route>
        </Routes>
      </Router>
    </ToastProvider>
  )
}
