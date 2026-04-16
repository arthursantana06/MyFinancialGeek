import { useState, useMemo } from "react";
import { useWallets } from "@/hooks/useWallets";
import { useTransactions } from "@/hooks/useTransactions";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useCategories } from "@/hooks/useCategories";
import { useLanguage } from "@/i18n/LanguageContext";
import { CreditCard, Plus, Banknote, Smartphone, Wallet as WalletIcon, Circle, Pencil, Trash2, Link2 } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

const WalletsPage = () => {
  const walletsHelper = useWallets();
  const { wallets, isLoading, addWallet } = walletsHelper;
  const { transactions, isLoading: isTxLoading } = useTransactions();
  const { paymentMethods } = usePaymentMethods();
  const { categories } = useCategories();
  const { t } = useLanguage();
  const { user } = useAuth();

  // Fetch wallets that have Open Finance connections
  const { data: linkedWalletIds } = useQuery({
    queryKey: ['pluggy_linked_wallets', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pluggy_connections')
        .select('wallet_id')
        .eq('user_id', user!.id)
        .not('wallet_id', 'is', null);
      if (error) throw error;
      return new Set((data ?? []).map(d => d.wallet_id).filter(Boolean));
    },
    enabled: !!user,
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [walletType, setWalletType] = useState<"checking" | "credit_card">("checking");
  const [color, setColor] = useState(COLORS[0]);
  const [institutionName, setInstitutionName] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [statementDay, setStatementDay] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [includeInBalance, setIncludeInBalance] = useState(true);

  const openAddDrawer = () => {
    setEditingWalletId(null);
    setName("");
    setInstitutionName("");
    setWalletType("checking");
    setColor(COLORS[0]);
    setCreditLimit("");
    setStatementDay("");
    setDueDay("");
    setIncludeInBalance(true);
    setDrawerOpen(true);
  };

  const openEditDrawer = (w: any) => {
    setEditingWalletId(w.id);
    setName(w.name);
    setInstitutionName(w.institution_name || "");
    setWalletType(w.type === "credit_card" ? "credit_card" : "checking");
    setColor(w.color);
    setCreditLimit(w.credit_limit ? w.credit_limit.toString() : "");
    setStatementDay(w.closing_day ? w.closing_day.toString() : "");
    setDueDay(w.due_day ? w.due_day.toString() : "");
    setIncludeInBalance(w.include_in_total ?? true);
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!name) {
      toast.error("O nome da conta é obrigatório.");
      return;
    }

    if (walletType === "credit_card" && (!creditLimit || !statementDay || !dueDay)) {
      toast.error(t("tx.fillRequired") || "Preencha todos os campos do cartão.");
      return;
    }

    try {
      const payload = {
        name,
        institution_name: institutionName.trim() || "Diversos",
        type: walletType,
        color,
        balance: 0,
        include_in_total: includeInBalance,
        credit_limit: walletType === "credit_card" ? parseFloat(creditLimit.replace(",", ".")) : null,
        closing_day: walletType === "credit_card" ? parseInt(statementDay) : null,
        due_day: walletType === "credit_card" ? parseInt(dueDay) : null
      };

      if (editingWalletId) {
        await walletsHelper.updateWallet.mutateAsync({ id: editingWalletId, ...payload } as any);
        toast.success("Conta atualizada!");
      } else {
        await addWallet.mutateAsync(payload as any);
        toast.success("Conta adicionada com sucesso!");
      }
      setDrawerOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja apagar a conta '${name}'?`)) return;
    try {
      await walletsHelper.deleteWallet.mutateAsync(id);
      toast.success("Conta excluída!");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const typeLabel = (type: string) => {
    const key = `wallets.${type}` as any;
    return t(key) || type.replace("_", " ");
  };

  const { cardsStats, customMethodsStats, totalExpenses, cardsCategoriesStats } = useMemo(() => {
    let _cardsStats: Record<string, { total: number, color: string, name: string }> = {};
    let _customMethodsStats: Record<string, { total: number, color: string, name: string, icon: string }> = {};
    // { walletId: { categoryId: { total: number, color: string, name: string } } }
    let _cardsCategoriesStats: Record<string, Record<string, { total: number, color: string, name: string }>> = {};
    let _total = 0;

    const now = new Date();
    const currentDay = now.getDate();

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Filter to only expenses
    const expenses = transactions.filter(t => t.type === "expense");

    expenses.forEach(tx => {
      _total += Number(tx.amount);

      // Category tracking helper
      const trackCategory = (walletId: string, amount: number) => {
        if (!tx.category_id) return;
        const cat = categories.find(c => c.id === tx.category_id);
        if (!cat) return;

        if (!_cardsCategoriesStats[walletId]) _cardsCategoriesStats[walletId] = {};
        if (!_cardsCategoriesStats[walletId][cat.id]) {
          _cardsCategoriesStats[walletId][cat.id] = { total: 0, color: cat.color, name: cat.name };
        }
        _cardsCategoriesStats[walletId][cat.id].total += amount;
      };

      // 1. Resolve Wallet Stats (Checking or Credit Card)
      if (tx.wallet_id) {
        const card = wallets.find(w => w.id === tx.wallet_id);
        if (card) {
          const txDate = new Date(tx.date);
          let shouldCount = true;

          if (card.type === "checking") {
            if (txDate < currentMonthStart) shouldCount = false;
          }
          else if (card.type === "credit_card" && card.closing_day) {
            let invoiceStart: Date;
            if (currentDay > card.closing_day) {
              invoiceStart = new Date(now.getFullYear(), now.getMonth(), card.closing_day + 1);
            } else {
              invoiceStart = new Date(now.getFullYear(), now.getMonth() - 1, card.closing_day + 1);
            }
            if (txDate < invoiceStart) shouldCount = false;
          }

          if (shouldCount) {
            if (!_cardsStats[card.id]) {
              _cardsStats[card.id] = { total: 0, color: card.color, name: card.name };
            }
            _cardsStats[card.id].total += Number(tx.amount);
            trackCategory(card.id, Number(tx.amount));
          }
        }
      }

      // 2. Resolve Payment Method Stats (For the distribution chart)
      if (tx.payment_method_id) {
        const pm = paymentMethods.find(m => m.id === tx.payment_method_id);
        if (pm) {
          if (!_customMethodsStats[pm.id]) {
            _customMethodsStats[pm.id] = { total: 0, color: "#9ca3af", name: pm.name, icon: pm.icon || "" };
          }
          _customMethodsStats[pm.id].total += Number(tx.amount);
        }
      } else if (tx.wallet_id) {
        // If no specifically selected payment method, we treat the wallet as the method (e.g. standard debit/credit)
        const wallet = wallets.find(w => w.id === tx.wallet_id);
        if (wallet && wallet.type === "credit_card") {
           // We don't duplicate credit card stats in customMethodsStats if they are already in cardsStats?
           // Actually, the chart shows both. Let's keep consistency.
        }
      }
    });

    return { cardsStats: _cardsStats, customMethodsStats: _customMethodsStats, totalExpenses: _total, cardsCategoriesStats: _cardsCategoriesStats };
  }, [transactions, wallets, paymentMethods, categories]);

  return (
    <div className="min-h-screen bg-background p-4 pb-28">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between py-4">
          <h1 className="text-xl font-bold text-foreground">{t("wallets.title")}</h1>
          <button
            onClick={openAddDrawer}
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

            {/* Credit Cards List / Wallets grouped by Institution */}
            <div className="space-y-6">
              {wallets.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <CreditCard size={32} className="text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">{t("wallets.noWallets")}</p>
                </div>
              ) : (
                Object.entries(
                  wallets.reduce((acc, w) => {
                    const inst = w.institution_name || 'Diversos';
                    if (!acc[inst]) acc[inst] = [];
                    acc[inst].push(w);
                    return acc;
                  }, {} as Record<string, typeof wallets>)
                ).map(([institution, instWallets]) => (
                  <div key={institution} className="space-y-4">
                    <div className="flex items-center gap-3 px-2">
                      <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                      <h3 className="text-sm font-bold text-white uppercase tracking-[0.15em]">
                        {institution}
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 gap-3 pl-4 border-l border-white/5">
                      {instWallets.map((w) => {
                        const Icon = w.type === "checking" ? Banknote : CreditCard;
                        const cardStats = cardsStats[w.id];
                        const catsStats = cardsCategoriesStats[w.id] ? Object.values(cardsCategoriesStats[w.id]).sort((a, b) => b.total - a.total).slice(0, 3) : [];

                        const displayExpense = cardStats?.total || 0;
                        const availableLimit = w.type === "credit_card" && (w.credit_limit || w.credit_limit === 0) ? w.credit_limit - displayExpense : 0;

                        return (
                          <div key={w.id} className="group relative glass-card p-4 transition-all hover:bg-white/[0.03] hover:translate-x-1">
                            {/* Accent line */}
                            <div className="absolute top-0 left-0 w-1 h-full opacity-40 group-hover:opacity-100 transition-opacity rounded-l-3xl" style={{ backgroundColor: w.color }} />
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 border border-white/5 shadow-inner">
                                  <Icon size={16} style={{ color: w.color }} strokeWidth={2} />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-white/90 leading-tight">{w.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-md">
                                      {typeLabel(w.type)}
                                    </span>
                                    {linkedWalletIds?.has(w.id) && (
                                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[7px] font-black uppercase tracking-tighter border border-primary/20">
                                        <Zap size={8} fill="currentColor" />
                                        SYNC
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button onClick={() => openEditDrawer(w)} className="p-2 text-muted-foreground hover:text-white transition-colors">
                                  <Pencil size={14} />
                                </button>
                                <button onClick={() => handleDelete(w.id, w.name)} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/[0.03]">
                              <div>
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.1em] mb-1">
                                  {w.type === "credit_card" ? "Fatura Atual" : "Gastos no Mês"}
                                </p>
                                <p className="text-base font-black text-white tabular-nums">
                                  R${Number(displayExpense).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                              {w.type === "credit_card" && (w.credit_limit || w.credit_limit === 0) ? (
                                <div className="text-right">
                                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.1em] mb-1">Limite Livre</p>
                                  <p className="text-base font-black text-emerald-400 tabular-nums">
                                    R${Number(availableLimit).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  </p>
                                </div>
                              ) : w.type === "credit_card" ? (
                                <div className="text-right flex flex-col justify-end">
                                  <p className="text-[9px] text-muted-foreground/60 italic font-medium">Limite não extraído</p>
                                </div>
                              ) : null}
                            </div>

                            {w.type === "credit_card" && (w.closing_day || w.due_day) && (
                              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.03]">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/40" />
                                  <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Fechamento</span>
                                  <span className="text-[10px] font-black text-white/70">Dia {w.closing_day || '--'}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500/40" />
                                  <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Vencimento</span>
                                  <span className="text-[10px] font-black text-white/70">Dia {w.due_day || '--'}</span>
                                </div>
                              </div>
                            )}

                            {catsStats.length > 0 && (
                              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-white/[0.03]">
                                {catsStats.map((cstat, i) => (
                                  <div key={i} className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cstat.color }} />
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">{cstat.name}</span>
                                    <span className="text-[9px] font-black text-white/60 tabular-nums">R${cstat.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ))
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
              <DrawerTitle className="text-foreground">{editingWalletId ? "Editar Conta" : "Adicionar Conta"}</DrawerTitle>
            </DrawerHeader>

            <div className="space-y-4">
              <div className="flex gap-1 p-1 rounded-full glass-card">
                <button
                  onClick={() => setWalletType("checking")}
                  className={`flex-1 flex gap-2 justify-center items-center py-2 rounded-full text-xs font-medium transition-all ${walletType === "checking" ? "pill-active" : "pill-inactive"}`}
                >
                  <Banknote size={14} /> Débito/Conta
                </button>
                <button
                  onClick={() => setWalletType("credit_card")}
                  className={`flex-1 flex gap-2 justify-center items-center py-2 rounded-full text-xs font-medium transition-all ${walletType === "credit_card" ? "pill-active" : "pill-inactive"}`}
                >
                  <CreditCard size={14} /> Cartão
                </button>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Nome da Conta / Cartão</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Nubank, Itaú..."
                  className="w-full glass-inner rounded-xl px-4 py-3 text-base md:text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all"
                />
              </div>
              
              {/* Institution */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Instituição (Banco)</label>
                <input
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="Ex: Nubank, Itaú, Inter..."
                  className="w-full glass-inner rounded-xl px-4 py-2 text-xs text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                />
              </div>

              {/* Credit Card Fields */}
              {walletType === "credit_card" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Limite do Cartão</label>
                    <input
                      type="number"
                      step="0.01"
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(e.target.value)}
                      placeholder="0,00"
                      className="w-full glass-inner rounded-xl px-4 py-3 text-2xl font-bold text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all text-center"
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
                        className="w-full glass-inner rounded-xl px-4 py-3 text-base md:text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all text-center"
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
                        className="w-full glass-inner rounded-xl px-4 py-3 text-base md:text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all text-center"
                      />
                    </div>
                  </div>
                </>
              )}

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
                onClick={handleSave}
                disabled={walletsHelper.addWallet.isPending || walletsHelper.updateWallet.isPending}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-blue transition-all active:scale-[0.98] disabled:opacity-50 mt-4"
              >
                {walletsHelper.addWallet.isPending || walletsHelper.updateWallet.isPending ? t("auth.loading") : t("common.save")}
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default WalletsPage;
