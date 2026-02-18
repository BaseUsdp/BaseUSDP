import DashboardLayoutNew from "@/components/dashboard/DashboardLayoutNew";
import ProtectedRoute from "@/components/ProtectedRoute";

const Dashboard = () => {
  return (
    <ProtectedRoute requireAuth={true}>
      <DashboardLayoutNew />
    </ProtectedRoute>
  );
};

export default Dashboard;
