import { Plus, ArrowUpRight } from "lucide-react";

const invoices = [
  { date: "Aug 9", due: "in 1 week", status: "Unpaid", statusColor: "bg-destructive", name: "Leonard Kim", amount: "$130.00" },
  { date: "Aug 24", due: "in 2 week", status: "Paid", statusColor: "bg-chart-green", name: "John Smith", amount: "$220.00" },
  { date: "Sep 9", due: "in 1 month", status: "Pending", statusColor: "bg-chart-yellow", name: "Anna Spirid", amount: "$2080.00" },
];

const InvoicesCard = () => {
  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Invoices</h3>
        <button className="w-7 h-7 rounded-lg glass-inner flex items-center justify-center">
          <Plus size={14} className="text-muted-foreground" />
        </button>
      </div>

      <div className="glass-inner rounded-xl p-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Payment Score</span>
        <div className="flex items-center gap-2">
          <div className="flex gap-px">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className={`w-1 h-3 rounded-sm ${i < 15 ? "bg-chart-yellow" : "bg-glass-border"}`}
              />
            ))}
          </div>
          <span className="text-xs font-bold text-foreground">76</span>
        </div>
      </div>

      <div className="space-y-1">
        {invoices.map((inv, i) => (
          <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-glass-border-highlight/50 transition-colors">
            <div className="text-left min-w-[52px]">
              <p className="text-[11px] font-medium text-foreground">{inv.date}</p>
              <p className="text-[10px] text-muted-foreground">{inv.due}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`status-dot ${inv.statusColor}`} />
              <span className="text-[10px] text-muted-foreground">{inv.status}</span>
            </div>
            <span className="text-xs text-foreground flex-1">{inv.name}</span>
            <span className="text-xs font-semibold text-foreground">{inv.amount}</span>
          </div>
        ))}
      </div>

      <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        View all invoices <ArrowUpRight size={12} />
      </button>
    </div>
  );
};

export default InvoicesCard;
