import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import Dashboard from '@/pages/Dashboard';
import DailyReport from '@/pages/DailyReport';
import InventoryReport from '@/pages/InventoryReport';
import MealOrder from '@/pages/MealOrder';
import MemberReport from '@/pages/MemberReport';
import MealReport from '@/pages/MealReport';
import OrderList from '@/pages/OrderList';

export default function App() {
  return (
    <Router>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/order" element={<MealOrder />} />
          <Route path="/orders" element={<OrderList />} />
          <Route path="/report/daily" element={<DailyReport />} />
          <Route path="/report/inventory" element={<InventoryReport />} />
          <Route path="/report/member" element={<MemberReport />} />
          <Route path="/report/meal" element={<MealReport />} />
        </Routes>
      </MainLayout>
    </Router>
  );
}
