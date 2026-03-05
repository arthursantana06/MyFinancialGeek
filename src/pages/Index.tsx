import DashboardHeader from "@/components/DashboardHeader";
import BalanceCard from "@/components/BalanceCard";
import RevenueChart from "@/components/RevenueChart";
import SpendingDonut from "@/components/SpendingDonut";
import TransactionList from "@/components/TransactionList";
import DailyTip from "@/components/DailyTip";
import BottomNav from "@/components/BottomNav";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 pb-28 max-w-md mx-auto space-y-4">
        <DashboardHeader />

        {/* Balance */}
        <div className="glass-card p-6 space-y-2 animate-fade-in">
          <BalanceCard />
          <RevenueChart />
        </div>

        {/* Daily Tip */}
        <div className="animate-fade-in" style={{ animationDelay: "50ms" }}>
          <DailyTip />
        </div>

        {/* Spending */}
        <div className="animate-fade-in" style={{ animationDelay: "100ms" }}>
          <SpendingDonut />
        </div>

        {/* Transactions */}
        <div className="animate-fade-in" style={{ animationDelay: "200ms" }}>
          <TransactionList />
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Index;
