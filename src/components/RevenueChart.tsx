import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { format, differenceInDays, startOfDay, addDays, startOfWeek, addWeeks, startOfMonth, addMonths, subDays, subMonths, startOfYear, endOfYear, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SlidersHorizontal } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card px-3 py-2 text-xs">
        <p className="text-muted-foreground">{label}</p>
        <p className="text-foreground font-semibold">R${payload[0].value.toLocaleString("pt-BR")}</p>
      </div>
    );
  }
  return null;
};

const getLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const RevenueChart = () => {
  const [activeFilter, setActiveFilter] = useState<"Weekly" | "Monthly" | "Yearly" | "Range">("Yearly");
  const [activeBar, setActiveBar] = useState<number | null>(null);

  const [dateRange, setDateRange] = useState({
    from: getLocalDateString(startOfMonth(new Date())),
    to: getLocalDateString(endOfDay(new Date()))
  });

  const { transactions } = useTransactions();

  const chartData = useMemo(() => {
    const incomes = transactions.filter(t => t.type === "income");
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

    const span = differenceInDays(dEnd, dStart);

    if (span <= 14) {
      // Group by Day
      const days = [];
      let cDay = startOfDay(dStart);
      while (cDay <= dEnd) {
        const dStartMs = cDay.getTime();
        const dayTxs = incomes.filter(t => startOfDay(new Date(t.date)).getTime() === dStartMs);
        days.push({
          name: format(cDay, "dd MMM", { locale: ptBR }),
          value: dayTxs.reduce((acc, t) => acc + Number(t.amount), 0)
        });
        cDay = addDays(cDay, 1);
      }
      return days;
    }

    if (span <= 90) {
      // Group by Week
      const weeks = [];
      let cWeek = startOfWeek(dStart, { weekStartsOn: 0 }); // Sunday
      while (cWeek <= dEnd) {
        const nextWeek = addWeeks(cWeek, 1);
        const weekTxs = incomes.filter(t => {
          const d = new Date(t.date);
          return d >= cWeek && d < nextWeek;
        });
        weeks.push({
          name: format(cWeek, "dd MMM", { locale: ptBR }), // start of week
          value: weekTxs.reduce((acc, t) => acc + Number(t.amount), 0)
        });
        cWeek = nextWeek;
      }
      return weeks;
    }

    // Group by Month
    const months = [];
    let cMonth = startOfMonth(dStart);
    while (cMonth <= dEnd) {
      const nextMonth = addMonths(cMonth, 1);
      const monthTxs = incomes.filter(t => {
        const d = new Date(t.date);
        return d >= cMonth && d < nextMonth;
      });
      months.push({
        name: format(cMonth, "MMM yyyy", { locale: ptBR }),
        value: monthTxs.reduce((acc, t) => acc + Number(t.amount), 0)
      });
      cMonth = nextMonth;
    }
    return months;

  }, [transactions, activeFilter, dateRange]);

  return (
    <div className="space-y-4">
      {/* Filters Header Row */}
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

      <div className="h-56 lg:h-64 pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.04)" vertical={false} />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(240 5% 45%)", fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(240 5% 45%)", fontSize: 11 }}
              tickFormatter={(v) => v > 0 ? `${(v / 1000).toFixed(1)}k` : '0'}
              width={35}
            />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <Bar
              dataKey="value"
              radius={[6, 6, 6, 6]}
              onMouseEnter={(_, index) => setActiveBar(index)}
              onMouseLeave={() => setActiveBar(null)}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    activeBar === index || (activeBar === null && index === chartData.length - 1)
                      ? "hsl(217 91% 60%)"
                      : "hsl(0 0% 100% / 0.06)"
                  }
                  style={{
                    filter: (activeBar === index || (activeBar === null && index === chartData.length - 1)) ? "drop-shadow(0 0 10px hsl(217 91% 60% / 0.5))" : "none",
                    transition: "all 0.3s ease",
                  }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RevenueChart;
