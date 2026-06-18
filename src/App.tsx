import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import Dashboard from '@/pages/Dashboard';
import InventoryReport from '@/pages/InventoryReport';
import MemberReport from '@/pages/MemberReport';
import MealReport from '@/pages/MealReport';

export default function App() {
  return (
    <Router>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/report/inventory" element={<InventoryReport />} />
          <Route path="/report/member" element={<MemberReport />} />
          <Route path="/report/meal" element={<MealReport />} />
        </Routes>
      </MainLayout>
    </Router>
  );
}
