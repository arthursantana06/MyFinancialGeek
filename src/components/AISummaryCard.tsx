import { Sparkles, ArrowUpRight, TrendingUp, Users } from "lucide-react";

const AISummaryCard = () => {
  return (
    <div className="glass-card p-5 space-y-4 flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-chart-purple" />
          <h3 className="text-sm font-semibold text-foreground">How can I help you?</h3>
        </div>
        <button className="w-7 h-7 rounded-lg glass-inner flex items-center justify-center">
          <ArrowUpRight size={14} className="text-muted-foreground" />
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground">AI Summary</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Your financial activity this period remains stable. Revenue shows expected seasonal variation, spending is balanced across key categories. No unusual patterns det...
          <span className="text-primary cursor-pointer">Read more</span>
        </p>
      </div>

      <div className="flex gap-3 mt-auto">
        <div className="flex-1 glass-inner p-3 space-y-1.5">
          <p className="text-[10px] text-muted-foreground">Spending Trends</p>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-foreground">7</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-chart-green/15 text-chart-green">Stable</span>
          </div>
        </div>
        <div className="flex-1 glass-inner p-3 space-y-1.5">
          <p className="text-[10px] text-muted-foreground">Customer Payments</p>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-foreground">25</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-primary/15 text-primary">Processed</span>
          </div>
        </div>
      </div>

      <div className="glass-inner rounded-xl p-3 flex items-center gap-2">
        <span className="text-xs text-muted-foreground flex-1">Ask me anything...</span>
        <button className="w-7 h-7 rounded-lg bg-glass-border-highlight flex items-center justify-center">
          <ArrowUpRight size={12} className="text-muted-foreground rotate-45" />
        </button>
      </div>
    </div>
  );
};

export default AISummaryCard;
