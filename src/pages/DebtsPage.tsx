import { useState } from "react";
import { useDebtors } from "@/hooks/useDebtors";
import { useLanguage } from "@/i18n/LanguageContext";
import { Users, ArrowUpRight, ArrowDownLeft, Plus } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import AddDebtorDrawer from "@/components/AddDebtorDrawer";
import { DebtorDetailsDrawer } from "@/components/DebtorDetailsDrawer";

const DebtsPage = () => {
  const { debtors, isLoading } = useDebtors();
  const { t } = useLanguage();

  const [isAddDebtorOpen, setIsAddDebtorOpen] = useState(false);
  const [selectedDebtor, setSelectedDebtor] = useState<any | null>(null);

  // Global aggregate
  let totalOwedGlobal = 0;
  let totalOwingGlobal = 0;

  debtors.forEach(debtor => {
    const debts = debtor.debts || [];
    totalOwedGlobal += debts.filter((d: any) => d.type === "receivable").reduce((s: any, d: any) => s + Number(d.amount), 0);
    totalOwingGlobal += debts.filter((d: any) => d.type === "payable").reduce((s: any, d: any) => s + Number(d.amount), 0);
  });
  const netPositionGlobal = totalOwedGlobal - totalOwingGlobal;

  return (
    <div className="min-h-screen bg-background p-4 pb-28">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between py-4">
          <h1 className="text-xl font-bold text-foreground">{t("debts.title")}</h1>
          <button onClick={() => setIsAddDebtorOpen(true)} className="w-9 h-9 rounded-xl glass-card flex items-center justify-center">
            <Plus size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Global Net position */}
        <div className="glass-card p-5 space-y-3">
          <p className="text-xs text-muted-foreground">{t("debts.netPosition")}</p>
          <p className={`text-2xl font-bold ${netPositionGlobal >= 0 ? "text-chart-green" : "text-destructive"}`}>
            {netPositionGlobal >= 0 ? "+" : "-"}R${Math.abs(netPositionGlobal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <ArrowDownLeft size={14} className="text-chart-green" />
              <span className="text-xs text-muted-foreground">{t("debts.owedToMe")}</span>
              <span className="text-xs font-semibold text-foreground">R${totalOwedGlobal.toLocaleString("pt-BR")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowUpRight size={14} className="text-destructive" />
              <span className="text-xs text-muted-foreground">{t("debts.iOwe")}</span>
              <span className="text-xs font-semibold text-foreground">R${totalOwingGlobal.toLocaleString("pt-BR")}</span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-16 rounded-3xl bg-glass animate-pulse" />)}
          </div>
        ) : debtors.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <Users size={32} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t("debts.noDebts")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">Pessoas ({debtors.length})</h3>
            {debtors.map((debtor) => {
              const debts = debtor.debts || [];
              const totalOwed = debts.filter((d: any) => d.type === "receivable").reduce((s: any, d: any) => s + Number(d.amount), 0);
              const totalOwing = debts.filter((d: any) => d.type === "payable").reduce((s: any, d: any) => s + Number(d.amount), 0);
              const netPosition = totalOwed - totalOwing;

              return (
                <div
                  key={debtor.id}
                  onClick={() => setSelectedDebtor(debtor)}
                  className="glass-card p-4 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-glass border border-glass flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-foreground">{debtor.name[0]?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium text-foreground truncate">{debtor.name}</p>
                    <p className="text-[10px] text-muted-foreground pt-0.5">
                      {debts.length} {debts.length === 1 ? 'registro' : 'registros'}
                    </p>
                  </div>
                  <p className={`text-sm font-bold ${netPosition > 0 ? "text-chart-green" : netPosition < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {netPosition > 0 ? "+" : netPosition < 0 ? "-" : ""}
                    R${Math.abs(netPosition).toFixed(2)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AddDebtorDrawer open={isAddDebtorOpen} onOpenChange={setIsAddDebtorOpen} />
      <DebtorDetailsDrawer open={!!selectedDebtor} onOpenChange={(o) => !o && setSelectedDebtor(null)} debtor={selectedDebtor} />

      <BottomNav />
    </div>
  );
};

export default DebtsPage;
