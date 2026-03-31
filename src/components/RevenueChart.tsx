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
import { format, differenceInDays, startOfDay, addDays, startOfWeek, addWeeks, startOfMonth, addMonths, subDays, subMonths, startOfYear, endOfYear, endOfDay, subYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SlidersHorizontal } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const expenseObj = payload.find((p: any) => p.dataKey === "expense");
    
    return (
      <div className="glass-card px-3 py-2 text-xs space-y-1">
        <p className="text-muted-foreground pb-1 border-b border-glass-border">{label}</p>
        {expenseObj && (
          <p className="text-destructive font-semibold">
            Gastos: R${expenseObj.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        )}
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

import { TrendingUp, TrendingDown } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Link } from "react-router-dom";

const RevenueChart = () => {
  const { t } = useLanguage();
  const [activeFilter, setActiveFilter] = useState<"Weekly" | "Monthly" | "Yearly" | "Range">("Yearly");
  const [activeDateIndex, setActiveDateIndex] = useState<number | null>(null);

  const [dateRange, setDateRange] = useState({
    from: getLocalDateString(startOfMonth(new Date())),
    to: getLocalDateString(endOfDay(new Date()))
  });

  const { transactions } = useTransactions();

  const chartData = useMemo(() => {
    const incomes = transactions.filter(t => t.type === "income");
    const expenses = transactions.filter(t => t.type === "expense");
    const now = new Date();

    let dStart: Date;
    let dEnd: Date = now;

    if (activeFilter === "Weekly") {
      dStart = subMonths(now, 3);
    } else if (activeFilter === "Monthly") {
      dStart = subMonths(now, 12);
    } else if (activeFilter === "Yearly") {
      dStart = subYears(now, 5);
    } else {
      dStart = startOfDay(new Date(dateRange.from + "T12:00:00"));
      dEnd = endOfDay(new Date(dateRange.to + "T12:00:00"));
    }

    const span = differenceInDays(dEnd, dStart);

    // DAILY GROUPING (Only for Range <= 14 days)
    if (activeFilter === "Range" && span <= 14) {
      const days = [];
      let cDay = startOfDay(dStart);
      while (cDay <= dEnd) {
        const dStartMs = cDay.getTime();
        const dayIncomes = incomes.filter(t => startOfDay(new Date(t.date)).getTime() === dStartMs);
        const dayExpenses = expenses.filter(t => startOfDay(new Date(t.date)).getTime() === dStartMs);
        days.push({
          name: format(cDay, "dd MMM", { locale: ptBR }),
          income: dayIncomes.reduce((acc, t) => acc + Number(t.amount), 0),
          expense: dayExpenses.reduce((acc, t) => acc + Number(t.amount), 0)
        });
        cDay = addDays(cDay, 1);
      }
      return days;
    }

    // WEEKLY GROUPING
    if (activeFilter === "Weekly" || (activeFilter === "Range" && span <= 90)) {
      const weeks = [];
      let cWeek = startOfWeek(dStart, { weekStartsOn: 0 }); // Sunday
      while (cWeek <= dEnd) {
        const nextWeek = addWeeks(cWeek, 1);
        const weekFilter = (t: any) => {
          const d = new Date(t.date);
          return d >= cWeek && d < nextWeek;
        };
        const weekIncomes = incomes.filter(weekFilter);
        const weekExpenses = expenses.filter(weekFilter);
        
        let label = `${format(cWeek, "dd/MM")} - ${format(subDays(nextWeek, 1), "dd/MM")}`;
        weeks.push({
          name: label,
          income: weekIncomes.reduce((acc, t) => acc + Number(t.amount), 0),
          expense: weekExpenses.reduce((acc, t) => acc + Number(t.amount), 0)
        });
        cWeek = nextWeek;
      }
      return weeks;
    }

    // YEARLY GROUPING
    if (activeFilter === "Yearly" || (activeFilter === "Range" && span > 730)) {
      const years = [];
      let cYear = startOfYear(dStart);
      while (cYear <= dEnd) {
        const nextYear = startOfYear(addMonths(cYear, 12));
        const yearFilter = (t: any) => {
          const d = new Date(t.date);
          return d >= cYear && d < nextYear;
        };
        const yearIncomes = incomes.filter(yearFilter);
        const yearExpenses = expenses.filter(yearFilter);

        years.push({
          name: format(cYear, "yyyy"),
          income: yearIncomes.reduce((acc, t) => acc + Number(t.amount), 0),
          expense: yearExpenses.reduce((acc, t) => acc + Number(t.amount), 0)
        });
        cYear = nextYear;
      }
      return years;
    }

    // MONTHLY GROUPING (Default for Monthly or Range > 90 and <= 730)
    const months = [];
    let cMonth = startOfMonth(dStart);
    while (cMonth <= dEnd) {
      const nextMonth = addMonths(cMonth, 1);
      const monthFilter = (t: any) => {
        const d = new Date(t.date);
        return d >= cMonth && d < nextMonth;
      };
      const monthIncomes = incomes.filter(monthFilter);
      const monthExpenses = expenses.filter(monthFilter);
      
      let monthName = format(cMonth, "MMMM", { locale: ptBR });
      monthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      
      let label = activeFilter === "Monthly" ? monthName : format(cMonth, "MMM yyyy", { locale: ptBR });
      
      months.push({
        name: label,
        income: monthIncomes.reduce((acc, t) => acc + Number(t.amount), 0),
        expense: monthExpenses.reduce((acc, t) => acc + Number(t.amount), 0)
      });
      cMonth = nextMonth;
    }
    return months;

  }, [transactions, activeFilter, dateRange]);

  const totalExpense = chartData.reduce((acc, curr) => acc + curr.expense, 0);
  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      {/* Totals Header inside Graph Div */}
      <div className="space-y-3 pb-2 border-b border-glass-border">
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            R${fmt(totalExpense)}
          </h2>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-destructive/15 text-destructive">
             <TrendingDown size={12} />
             Gastos do Período
          </span>
        </div>
      </div>

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
              dataKey="expense"
              fill="hsl(348 83% 47%)"
              radius={[4, 4, 4, 4]}
              onMouseEnter={(_, index) => setActiveDateIndex(index)}
              onMouseLeave={() => setActiveDateIndex(null)}
              style={{
                transition: "all 0.3s ease",
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <Link 
        to="/metrics" 
        className="w-full mt-2 flex justify-center items-center py-2.5 rounded-xl border border-glass-border text-sm font-semibold text-foreground hover:bg-glass-highlight transition-all"
      >
        Acessar mais métricas
      </Link>
    </div>
  );
};

export default RevenueChart;
