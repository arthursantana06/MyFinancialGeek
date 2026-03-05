import { useState, useMemo } from "react";
import { useWallets } from "@/hooks/useWallets";
import { useTransactions } from "@/hooks/useTransactions";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useLanguage } from "@/i18n/LanguageContext";
import { CreditCard, Plus, Banknote, Smartphone, Wallet as WalletIcon, Circle } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { toast } from "sonner";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

const WalletsPage = () => {
  const { wallets, isLoading, addWallet } = useWallets();
  const { transactions, isLoading: isTxLoading } = useTransactions();
  const { paymentMethods } = usePaymentMethods();
  const { t } = useLanguage();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [creditLimit, setCreditLimit] = useState("");
  const [statementDay, setStatementDay] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [includeInBalance, setIncludeInBalance] = useState(true);

  const handleAdd = async () => {
    if (!name || !creditLimit || !statementDay || !dueDay) {
      toast.error(t("tx.fillRequired") || "Preencha todos os campos do cartão.");
      return;
    }

    try {
      await addWallet.mutateAsync({
        name,
        type: "credit_card",
        color,
        balance: 0,
        credit_limit: parseFloat(creditLimit.replace(",", ".")),
        closing_day: parseInt(statementDay),
        due_day: parseInt(dueDay)
        // Note: As the Database schema doesnt have include_in_balance for wallets yet,
        // we might store this in metadata or create a migration later if strictly necessary.
        // For now, tracking in state for future integration.
      });
      toast.success("Cartão adicionado com sucesso!");
      setDrawerOpen(false);
      setName("");
      setCreditLimit("");
      setStatementDay("");
      setDueDay("");
      setIncludeInBalance(true);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const typeLabel = (type: string) => {
    const key = `wallets.${type}` as any;
    return t(key) || type.replace("_", " ");
  };

  const { cardsStats, customMethodsStats, totalExpenses } = useMemo(() => {
    let _cardsStats: Record<string, { total: number, color: string, name: string }> = {};
    let _customMethodsStats: Record<string, { total: number, color: string, name: string, icon: string }> = {};
    let _total = 0;

    // Filter to only expenses
    const expenses = transactions.filter(t => t.type === "expense");

    expenses.forEach(tx => {
      _total += Number(tx.amount);

      // Is a custom payment method
      if (tx.payment_method_id) {
        const pm = paymentMethods.find(m => m.id === tx.payment_method_id);
        if (pm) {
          if (!_customMethodsStats[pm.id]) {
            _customMethodsStats[pm.id] = { total: 0, color: "#9ca3af", name: pm.name, icon: pm.icon || "" };
          }
          _customMethodsStats[pm.id].total += Number(tx.amount);
        }
      }
      // Is a wallet (credit card acting as pm)
      else if (tx.wallet_id) {
        // Double check if its a credit card
        const card = wallets.find(w => w.id === tx.wallet_id && w.type === "credit_card");
        if (card) {
          if (!_cardsStats[card.id]) {
            _cardsStats[card.id] = { total: 0, color: card.color, name: card.name };
          }
          _cardsStats[card.id].total += Number(tx.amount);
        }
      }
    });

    return { cardsStats: _cardsStats, customMethodsStats: _customMethodsStats, totalExpenses: _total };
  }, [transactions, wallets, paymentMethods]);

  return (
    <div className="min-h-screen bg-background p-4 pb-28">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between py-4">
          <h1 className="text-xl font-bold text-foreground">{t("wallets.title")}</h1>
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-9 h-9 rounded-xl glass-card flex items-center justify-center"
          >
            <Plus size={18} className="text-muted-foreground" />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-24 rounded-3xl bg-glass animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-8">

            {/* Distribution Graph */}
            {totalExpenses > 0 && (
              <div className="glass-card p-5 space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">Distribuição de Gastos</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Por método de pagamento no período</p>
                  </div>
                  <p className="text-sm font-bold text-foreground">
                    R$ {totalExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>

                {/* Horizontal Bar */}
                <div className="h-4 w-full bg-glass-inner rounded-full overflow-hidden flex">
                  {Object.values(cardsStats).map((stat, i) => (
                    <div
                      key={`card-${i}`}
                      style={{ width: `${(stat.total / totalExpenses) * 100}%`, backgroundColor: stat.color }}
                      className="h-full transition-all duration-500"
                      title={`${stat.name}: R$ ${stat.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    />
                  ))}
                  {Object.values(customMethodsStats).map((stat, i) => (
                    <div
                      key={`custom-${i}`}
                      style={{ width: `${(stat.total / totalExpenses) * 100}%`, backgroundColor: stat.color }}
                      className="h-full transition-all duration-500 border-l border-background/20"
                      title={`${stat.name.toUpperCase()}: R$ ${stat.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    />
                  ))}
                </div>

                {/* Subtitle Legend (Top 3) */}
                <div className="flex flex-wrap gap-2 text-[10px] font-medium text-muted-foreground">
                  {[...Object.values(cardsStats), ...Object.values(customMethodsStats)]
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 3)
                    .map((stat, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stat.color }} />
                        <span className="truncate max-w-[80px]">{stat.name.toUpperCase().substring(0, 10)}</span>
                        <span className="text-foreground">
                          {Math.round((stat.total / totalExpenses) * 100)}%
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Credit Cards List */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Cartões e Contas</h3>
              {wallets.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <CreditCard size={32} className="text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">{t("wallets.noWallets")}</p>
                </div>
              ) : (
                wallets.map((w) => {
                  const Icon = CreditCard;
                  return (
                    <div key={w.id} className="glass-card p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: w.color + "20" }}>
                          <Icon size={18} style={{ color: w.color }} strokeWidth={1.5} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-foreground">{w.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{typeLabel(w.type)}</p>
                        </div>
                        <p className="text-lg font-bold text-foreground">
                          R${Number(w.balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      {w.type === "credit_card" && w.credit_limit && (
                        <div className="glass-inner rounded-xl p-3 flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">{t("wallets.limit")}</span>
                          <span className="text-xs font-semibold text-foreground">
                            R${Number(w.credit_limit).toLocaleString("pt-BR")}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Custom Payment Methods List */}
            {Object.keys(customMethodsStats).length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Outros Métodos ({t("tx.expense")})</h3>
                {Object.values(customMethodsStats)
                  .sort((a, b) => b.total - a.total)
                  .map((stat, i) => {
                    const iconMap: Record<string, any> = {
                      "credit-card": CreditCard,
                      "banknote": Banknote,
                      "smartphone": Smartphone,
                      "wallet": WalletIcon,
                      "circle": Circle
                    };
                    const PmIcon = iconMap[stat.icon] || Circle;

                    return (
                      <div key={i} className="glass-card p-4 flex items-center justify-between group cursor-pointer hover:bg-white/5 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full glass-inner flex items-center justify-center text-muted-foreground text-xs shadow-inner">
                            <PmIcon size={14} />
                          </div>
                          <span className="text-sm font-medium text-foreground">{stat.name.toUpperCase()}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-foreground">
                            R$ {stat.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {Math.round((stat.total / totalExpenses) * 100)}% das despesas
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

          </div>
        )}
      </div>
      <BottomNav />

      {/* Add Wallet Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="bg-background border-t border-glass-border max-h-[90vh]">
          <div className="mx-auto w-full max-w-sm px-4 pb-8 overflow-y-auto" style={{ maxHeight: "80vh" }}>
            <DrawerHeader className="px-0">
              <DrawerTitle className="text-foreground">Adicionar Conta</DrawerTitle>
            </DrawerHeader>
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Nome do Cartão</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Nubank, Itaú..."
                className="w-full glass-inner rounded-xl px-4 py-3 text-sm text-foreground bg-transparent focus:outline-none"
              />
            </div>

            {/* Credit Card Fields */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Limite do Cartão</label>
              <input
                type="number"
                step="0.01"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="0,00"
                className="w-full glass-inner rounded-xl px-4 py-3 text-xl font-bold text-foreground bg-transparent focus:outline-none text-center"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <label className="text-xs text-muted-foreground">Dia do Fechamento</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={statementDay}
                  onChange={(e) => setStatementDay(e.target.value)}
                  placeholder="Ex: 5"
                  className="w-full glass-inner rounded-xl px-4 py-3 text-sm text-foreground bg-transparent focus:outline-none text-center"
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="text-xs text-muted-foreground">Dia do Vencimento</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  placeholder="Ex: 12"
                  className="w-full glass-inner rounded-xl px-4 py-3 text-sm text-foreground bg-transparent focus:outline-none text-center"
                />
              </div>
            </div>

            {/* Include in Balance Toggle */}
            <label className="flex items-center gap-3 glass-inner p-3 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={includeInBalance}
                onChange={(e) => setIncludeInBalance(e.target.checked)}
                className="w-5 h-5 rounded-md border-glass-border bg-glass-inner text-primary focus:ring-primary focus:ring-offset-background"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Incluir no Saldo Principal</p>
                <p className="text-[10px] text-muted-foreground">Os gastos deste cartão serão descontados do saldo geral</p>
              </div>
            </label>

            {/* Color */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Cor da Conta</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-all ${color === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110" : ""
                      }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={handleAdd}
              disabled={addWallet.isPending}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-blue transition-all active:scale-[0.98] disabled:opacity-50 mt-4"
            >
              {addWallet.isPending ? t("auth.loading") : t("common.add")}
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default WalletsPage;
