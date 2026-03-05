import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, getDay, addMonths, subMonths } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, TrendingUp, TrendingDown, Scale } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { useLanguage } from "@/i18n/LanguageContext";
import BottomNav from "@/components/BottomNav";
import AddTransactionDrawer from "@/components/AddTransactionDrawer";

const DAYS_PT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PlanningPage = () => {
  const { t, language } = useLanguage();
  const locale = language === "pt-BR" ? ptBR : enUS;
  const dayLabels = language === "pt-BR" ? DAYS_PT : DAYS_EN;

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [drawerOpen, setDrawerOpen] = useState(false);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const { transactions, isLoading } = useTransactions({
    dateFrom: monthStart.toISOString(),
    dateTo: monthEnd.toISOString(),
  });

  // Build calendar grid
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);
  const offset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  // Transactions by date
  const txByDate = useMemo(() => {
    const map: Record<string, typeof transactions> = {};
    transactions.forEach((tx) => {
      const key = format(new Date(tx.date), "yyyy-MM-dd");
      (map[key] ??= []).push(tx);
    });
    return map;
  }, [transactions]);

  const selectedKey = format(selectedDate, "yyyy-MM-dd");
  const selectedTxs = txByDate[selectedKey] ?? [];

  // Monthly projections
  const projectedIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const projectedExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="min-h-screen bg-background p-4 pb-28">
      <div className="max-w-md mx-auto space-y-4">
        <div className="py-4">
          <h1 className="text-xl font-bold text-foreground">{t("planning.title")}</h1>
          <p className="text-xs text-muted-foreground">{t("planning.subtitle")}</p>
        </div>

        {/* Projection Summary */}
        <div className="glass-card p-4 space-y-3">
          <p className="text-xs text-muted-foreground font-medium">{t("planning.projected")}</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-inner rounded-xl p-3 text-center">
              <TrendingUp size={16} className="text-chart-green mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">{t("planning.projectedIncome")}</p>
              <p className="text-sm font-bold text-chart-green">
                R${projectedIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="glass-inner rounded-xl p-3 text-center">
              <TrendingDown size={16} className="text-destructive mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">{t("planning.projectedExpenses")}</p>
              <p className="text-sm font-bold text-destructive">
                R${projectedExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="glass-inner rounded-xl p-3 text-center">
              <Scale size={16} className="text-primary mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">{t("planning.projectedBalance")}</p>
              <p className={`text-sm font-bold ${projectedIncome - projectedExpenses >= 0 ? "text-chart-green" : "text-destructive"}`}>
                R${(projectedIncome - projectedExpenses).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground capitalize">
              {format(currentMonth, "MMMM yyyy", { locale })}
            </h3>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="w-8 h-8 rounded-xl glass-inner flex items-center justify-center hover:bg-glass-highlight transition-colors"
              >
                <ChevronLeft size={16} className="text-muted-foreground" />
              </button>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="w-8 h-8 rounded-xl glass-inner flex items-center justify-center hover:bg-glass-highlight transition-colors"
              >
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {dayLabels.map((d) => (
              <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
            ))}
            {Array.from({ length: offset }).map((_, i) => (
              <div key={`empty-${i}`} className="w-full aspect-square" />
            ))}
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const hasTx = !!txByDate[key]?.length;
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, new Date());
              const hasIncome = txByDate[key]?.some((t) => t.type === "income");
              const hasExpense = txByDate[key]?.some((t) => t.type === "expense");

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(day)}
                  className={`w-full aspect-square rounded-xl text-xs font-medium flex flex-col items-center justify-center gap-0.5 transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground glow-blue"
                      : isToday
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground/80 hover:bg-glass-highlight"
                  }`}
                >
                  {day.getDate()}
                  {hasTx && !isSelected && (
                    <div className="flex gap-0.5">
                      {hasIncome && <div className="w-1 h-1 rounded-full bg-chart-green" />}
                      {hasExpense && <div className="w-1 h-1 rounded-full bg-destructive" />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day events */}
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {format(selectedDate, "d 'de' MMMM", { locale })}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {selectedTxs.length > 0
                  ? `${selectedTxs.length} ${language === "pt-BR" ? "evento(s)" : "event(s)"}`
                  : t("planning.noEvents")}
              </p>
            </div>
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-8 h-8 rounded-xl glass-inner flex items-center justify-center hover:bg-glass-highlight transition-colors"
            >
              <Plus size={16} className="text-muted-foreground" />
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-14 rounded-2xl bg-glass animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {selectedTxs.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 p-3 rounded-2xl glass-inner">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      tx.type === "income" ? "bg-chart-green" : "bg-destructive"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {tx.status === "pending" ? t("tx.status.pending") : t("tx.status.paid")}
                    </p>
                  </div>
                  <p className={`text-sm font-semibold ${tx.type === "income" ? "text-chart-green" : "text-foreground"}`}>
                    {tx.type === "income" ? "+" : "-"}R${Number(tx.amount).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <BottomNav />
      <AddTransactionDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
};

export default PlanningPage;
