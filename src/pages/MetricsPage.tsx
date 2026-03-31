import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import StackedMetricsChart from "@/components/StackedMetricsChart";

const MetricsPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 pb-28 max-w-md mx-auto space-y-4">
        {/* Header with back button */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            to="/"
            className="w-10 h-10 rounded-full glass-card flex items-center justify-center hover:bg-glass-highlight transition-colors"
          >
            <ArrowLeft className="text-foreground" size={20} />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Análises e Métricas</h1>
        </div>

        {/* Stacked Chart Card */}
        <div className="glass-card p-6 space-y-4 animate-fade-in">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">Receitas vs Despesas</h2>
            <p className="text-xs text-muted-foreground">Comparativo de fluxo de caixa empilhado</p>
          </div>
          <StackedMetricsChart />
        </div>

      </div>

      <BottomNav />
    </div>
  );
};

export default MetricsPage;
