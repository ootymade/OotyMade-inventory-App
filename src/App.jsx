import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { TeamMemberProvider, useTeamMember } from './context/TeamMemberContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import BottomNav from './components/BottomNav.jsx'
import Login from './screens/onboarding/Login.jsx'
import Dashboard from './screens/Dashboard.jsx'
import ProductList from './screens/products/ProductList.jsx'
import ProductDetail from './screens/products/ProductDetail.jsx'
import ProductForm from './screens/products/ProductForm.jsx'
import StockMove from './screens/stock/StockMove.jsx'
import Scan from './screens/scan/Scan.jsx'
import POList from './screens/po/POList.jsx'
import PODetail from './screens/po/PODetail.jsx'
import POForm from './screens/po/POForm.jsx'
import SupplierList from './screens/suppliers/SupplierList.jsx'
import SupplierDetail from './screens/suppliers/SupplierDetail.jsx'
import SupplierForm from './screens/suppliers/SupplierForm.jsx'
import DataSync from './screens/settings/DataSync.jsx'
import ChangePassword from './screens/settings/ChangePassword.jsx'
import DirectOrderList from './screens/orders/DirectOrderList.jsx'
import DirectOrderForm from './screens/orders/DirectOrderForm.jsx'
import DirectOrderDetail from './screens/orders/DirectOrderDetail.jsx'
import OrdersHub from './screens/orders/OrdersHub.jsx'
import DailyOrders from './screens/daily/DailyOrders.jsx'
import ShopifyOrderList from './screens/shopify/ShopifyOrderList.jsx'
import ShopifyOrderDetail from './screens/shopify/ShopifyOrderDetail.jsx'
import ShopifySkuMapping from './screens/shopify/ShopifySkuMapping.jsx'
import CourierSettings from './screens/settings/CourierSettings.jsx'
import TeamNoticeBoard from './screens/notices/TeamNoticeBoard.jsx'
import InventoryHub from './screens/stock/InventoryHub.jsx'
import MovementHistory from './screens/stock/MovementHistory.jsx'
import TrackingBoard from './screens/tracking/TrackingBoard.jsx'
import More from './screens/more/More.jsx'
import ComponentGallery from './screens/dev/ComponentGallery.jsx'
import { Spinner } from './components/ui.jsx'

function AppShell() {
  const { member } = useTeamMember()
  const { signOut } = useAuth()

  if (member === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner className="h-6 w-6 text-brand-600" />
      </div>
    )
  }

  if (member === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
        <p className="text-sm text-slate-500">
          Your account isn't set up yet. Ask an admin to add you to team_members.
        </p>
        <button onClick={signOut} className="text-sm font-semibold text-brand-600">
          Sign out
        </button>
      </div>
    )
  }

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <div className="min-h-screen bg-slate-50 pb-[var(--nav-footprint)]">
        <div className="mx-auto max-w-2xl lg:max-w-4xl">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders" element={<OrdersHub />} />
            <Route path="/tracking" element={<TrackingBoard />} />
            <Route path="/inventory" element={<InventoryHub />} />
            <Route path="/movements" element={<MovementHistory />} />
            <Route path="/more" element={<More />} />
            <Route path="/products" element={<ProductList />} />
            <Route path="/products/new" element={<ProductForm />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/products/:id/edit" element={<ProductForm />} />
            <Route path="/stock-move" element={<StockMove />} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/purchase-orders" element={<POList />} />
            <Route path="/purchase-orders/new" element={<POForm />} />
            <Route path="/purchase-orders/:id" element={<PODetail />} />
            <Route path="/suppliers" element={<SupplierList />} />
            <Route path="/suppliers/new" element={<SupplierForm />} />
            <Route path="/suppliers/:id" element={<SupplierDetail />} />
            <Route path="/suppliers/:id/edit" element={<SupplierForm />} />
            <Route path="/data-sync" element={<DataSync />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/direct-orders" element={<DirectOrderList />} />
            <Route path="/direct-orders/new" element={<DirectOrderForm />} />
            <Route path="/direct-orders/:id" element={<DirectOrderDetail />} />
            <Route path="/daily-orders" element={<DailyOrders />} />
            <Route path="/shopify-orders" element={<ShopifyOrderList />} />
            <Route path="/shopify-orders/:id" element={<ShopifyOrderDetail />} />
            <Route path="/shopify-sku-mapping" element={<ShopifySkuMapping />} />
            <Route path="/courier-settings" element={<CourierSettings />} />
            <Route path="/team-board" element={<TeamNoticeBoard />} />
            <Route path="/component-gallery" element={<ComponentGallery />} />
          </Routes>
        </div>
      </div>
      <BottomNav />
    </BrowserRouter>
  )
}

function Gate() {
  const { session } = useAuth()

  if (session === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner className="h-6 w-6 text-brand-600" />
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <TeamMemberProvider session={session}>
      <AppShell />
    </TeamMemberProvider>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ToastProvider>
  )
}
