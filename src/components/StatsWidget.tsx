import { BarChart3, TrendingUp } from "lucide-react";

const StatsWidget = () => {
  return (
    <div className="glass-card p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl glass-inner flex items-center justify-center flex-shrink-0">
        <BarChart3 size={18} className="text-primary" strokeWidth={1.5} />
      </div>
      <div className="flex-1">
        <p className="text-2xl font-bold text-foreground">$1,434</p>
      </div>
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-chart-green/15 text-chart-green text-[10px] font-semibold">
        <TrendingUp size={10} />
        12.4%
      </span>
    </div>
  );
};

export default StatsWidget;
