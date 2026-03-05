import { TrendingUp, TrendingDown } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDashboard } from "@/hooks/useDashboard";

const BalanceCard = () => {
  const { totalBalance, monthlyIncome, monthlyExpenses, cashFlow } = useDashboard();
  const { t } = useLanguage();
  const isPositive = cashFlow >= 0;

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          R${fmt(totalBalance)}
        </h2>
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${isPositive ? "bg-chart-green/15 text-chart-green" : "bg-destructive/15 text-destructive"
          }`}>
          {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {isPositive ? "+" : ""}R${fmt(Math.abs(cashFlow))}
        </span>
      </div>
      <div className="flex gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-chart-green" />
          <span className="text-xs text-muted-foreground">{t("dashboard.income")}</span>
          <span className="text-xs font-semibold text-foreground">R${fmt(monthlyIncome)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-destructive" />
          <span className="text-xs text-muted-foreground">{t("dashboard.expenses")}</span>
          <span className="text-xs font-semibold text-foreground">R${fmt(monthlyExpenses)}</span>
        </div>
      </div>
    </div>
  );
};

export default BalanceCard;
