import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useLanguage } from "@/i18n/LanguageContext";
import { subDays, subMonths, startOfDay, endOfDay } from "date-fns";
import { SlidersHorizontal } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";

const COLORS = [
  "hsl(0 84% 60%)",
  "hsl(160 84% 39%)",
  "hsl(25 95% 53%)",
  "hsl(45 93% 58%)",
  "hsl(270 76% 60%)",
  "hsl(240 5% 40%)",
];

const getLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function SpendingDonut() {
  const { t } = useLanguage();
  const { transactions } = useTransactions();

  const [activeFilter, setActiveFilter] = useState<"Weekly" | "Monthly" | "Yearly" | "Range">("Monthly");
  const [dateRange, setDateRange] = useState({
    from: getLocalDateString(subMonths(new Date(), 1)),
    to: getLocalDateString(endOfDay(new Date()))
  });

  const data = useMemo(() => {
    const expenses = transactions.filter((t) => t.type === "expense");
    const now = new Date();

    let dStart: Date;
    let dEnd: Date;

    if (activeFilter === "Weekly") {
      dStart = subDays(now, 7);
      dEnd = now;
    } else if (activeFilter === "Monthly") {
      dStart = subMonths(now, 1);
      dEnd = now;
    } else if (activeFilter === "Yearly") {
      dStart = subMonths(now, 12);
      dEnd = now;
    } else {
      dStart = startOfDay(new Date(dateRange.from + "T12:00:00"));
      dEnd = endOfDay(new Date(dateRange.to + "T12:00:00"));
    }

    const filtered = expenses.filter(t => {
      const d = new Date(t.date);
      return d >= dStart && d <= dEnd;
    });

    const byCategory = filtered.reduce<Record<string, { name: string; value: number }>>((acc, t) => {
      const catName = t.categories?.name || "Outros";
      if (!acc[catName]) acc[catName] = { name: catName, value: 0 };
      acc[catName].value += Number(t.amount);
      return acc;
    }, {});

    return Object.values(byCategory).sort((a, b) => b.value - a.value);
  }, [transactions, activeFilter, dateRange]);

  const total = data.reduce((s, d) => s + d.value, 0);
  const chartData = data.length > 0 ? data : [{ name: "No data", value: 1 }];

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex w-full items-center gap-2">
        <div className="flex flex-1 p-1 rounded-full glass-card overflow-x-auto custom-scrollbar">
          {(["Weekly", "Monthly", "Yearly", "Range"] as const).map((f) => {
            const labels = { Weekly: "Semanal", Monthly: "Mensal", Yearly: "Anual", Range: "Período" };
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`flex-1 min-w-[65px] px-3 py-2 rounded-full text-[11px] font-medium transition-all whitespace-nowrap ${activeFilter === f ? "pill-active" : "pill-inactive text-muted-foreground hover:text-foreground"
                  }`}
              >
                {labels[f]}
              </button>
            );
          })}
        </div>
      </div>

      {activeFilter === "Range" && (
        <div className="flex gap-2 items-center bg-glass-card rounded-xl p-2 animate-fade-in border border-glass-border">
          <div className="flex-1 flex gap-2 items-center">
            <input
              type="date"
              value={dateRange.from}
              onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="bg-transparent text-xs text-foreground focus:outline-none w-full appearance-none"
            />
            <span className="text-muted-foreground text-xs font-semibold">a</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="bg-transparent text-xs text-foreground focus:outline-none w-full appearance-none text-right"
            />
          </div>
        </div>
      )}
      <div className="flex items-center gap-5 pt-2">
        <div className="relative w-36 h-36 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={65}
                paddingAngle={data.length > 1 ? 3 : 0}
                dataKey="value"
                strokeWidth={0}
              >
                {chartData.map((_, index) => (
                  <Cell key={index} fill={data.length > 0 ? COLORS[index % COLORS.length] : "hsl(240 5% 20%)"} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">R${total.toLocaleString("pt-BR")}</p>
              <p className="text-[10px] text-muted-foreground">{t("common.total")}</p>
            </div>
          </div>
        </div>
        <div className="space-y-2.5 flex-1 min-w-0 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
          {(data.length > 0 ? data : [{ name: t("dashboard.noExpenses"), value: 0 }]).map((item, i) => (
            <div key={item.name} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-[11px] text-muted-foreground truncate">{item.name}</span>
              </div>
              {item.value > 0 && (
                <span className="text-[11px] font-medium text-foreground text-right w-16">
                  {(item.value / total * 100).toFixed(0)}%
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
