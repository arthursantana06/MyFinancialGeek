import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { format, startOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTransactions } from "@/hooks/useTransactions";

const StackedTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const incomeObj = payload.find((p: any) => p.dataKey === "income");
    const expenseObj = payload.find((p: any) => p.dataKey === "expense");
    
    return (
      <div className="glass-card px-3 py-2 text-xs space-y-1">
        <p className="text-muted-foreground pb-1 border-b border-glass-border">{label}</p>
        {incomeObj && (
          <p className="text-chart-green font-semibold">
            Receitas: R${incomeObj.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        )}
        {expenseObj && (
          <p className="text-destructive font-semibold">
            Despesas: R${expenseObj.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        )}
      </div>
    );
  }
  return null;
};

const StackedMetricsChart = () => {
  const { transactions } = useTransactions();
  const [activeDateIndex, setActiveDateIndex] = useState<number | null>(null);

  const chartData = useMemo(() => {
    const incomes = transactions.filter(t => t.type === "income");
    const expenses = transactions.filter(t => t.type === "expense");
    const now = new Date();

    // Fix filter for last 6 months for a clean stacked view 
    const dStart = subMonths(now, 5);
    const dEnd = now;

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
      
      let monthName = format(cMonth, "MMM yy", { locale: ptBR });
      monthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      
      months.push({
        name: monthName,
        income: monthIncomes.reduce((acc, t) => acc + Number(t.amount), 0),
        expense: monthExpenses.reduce((acc, t) => acc + Number(t.amount), 0)
      });
      cMonth = nextMonth;
    }
    return months;

  }, [transactions]);

  return (
    <div className="h-64 pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.04)" vertical={false} />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(240 5% 45%)", fontSize: 11 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(240 5% 45%)", fontSize: 11 }}
            tickFormatter={(v) => v > 0 ? `${(v / 1000).toFixed(1)}k` : '0'}
            width={35}
          />
          <Tooltip content={<StackedTooltip />} cursor={false} />
          <Legend 
             wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} 
             formatter={(value) => <span className="text-muted-foreground ml-1">{value === "income" ? "Receitas" : "Despesas"}</span>} 
             iconType="circle"
          />
          
          <Bar
            dataKey="income"
            stackId="a"
            fill="hsl(142 71% 45%)"
            onMouseEnter={(_, index) => setActiveDateIndex(index)}
            onMouseLeave={() => setActiveDateIndex(null)}
            style={{
              transition: "all 0.3s ease",
            }}
          />
          <Bar
            dataKey="expense"
            stackId="a"
            fill="hsl(348 83% 47%)"
            radius={[4, 4, 0, 0]}
            onMouseEnter={(_, index) => setActiveDateIndex(index)}
            onMouseLeave={() => setActiveDateIndex(null)}
            style={{
              transition: "all 0.3s ease",
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StackedMetricsChart;
