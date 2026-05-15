import Dashboard from "../../components/Dashboard";

export const metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <Dashboard />
      </div>
    </main>
  );
}
