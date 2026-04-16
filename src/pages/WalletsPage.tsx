import { useState, useMemo } from "react";
import { useWallets } from "@/hooks/useWallets";
import { useBanks, Bank } from "@/hooks/useBanks";
import { useTransactions } from "@/hooks/useTransactions";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useCategories } from "@/hooks/useCategories";
import { useLanguage } from "@/i18n/LanguageContext";
import { ArrowLeft, CreditCard, Plus, Banknote, Smartphone, Wallet as WalletIcon, Circle, Pencil, Trash2, Link2, Zap, ArrowRight, Wallet } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { useNavigate } from "react-router-dom";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

const WalletsPage = () => {
  const walletsHelper = useWallets();
  const banksHelper = useBanks();
  const { wallets, isLoading: isWalletsLoading } = walletsHelper;
  const { banks, isLoading: isBanksLoading, addBank, deleteBank } = banksHelper;
  const { transactions } = useTransactions();
  const { paymentMethods } = usePaymentMethods();
  const { categories } = useCategories();
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const isLoading = isWalletsLoading || isBanksLoading;

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
  const [bankDrawerOpen, setBankDrawerOpen] = useState(false);
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);

  // Bank creation state
  const [targetBank, setTargetBank] = useState<Bank | null>(null);
  
  // Account/Wallet state
  const [name, setName] = useState("");
  const [walletType, setWalletType] = useState<"checking" | "credit_card">("checking");
  const [color, setColor] = useState(COLORS[0]);
  const [institutionName, setInstitutionName] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [statementDay, setStatementDay] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [includeInBalance, setIncludeInBalance] = useState(true);

  const openAddBankDrawer = () => {
    setInstitutionName("");
    setColor(COLORS[0]);
    setBankDrawerOpen(true);
  };

  const openAddAccountDrawer = (bank: Bank) => {
    setTargetBank(bank);
    setEditingWalletId(null);
    setName("");
    setWalletType("checking");
    setCreditLimit("");
    setStatementDay("");
    setDueDay("");
    setIncludeInBalance(true);
    setDrawerOpen(true);
  };

  const openEditDrawer = (w: any) => {
    const bank = banks.find(b => b.id === w.bank_id);
    setTargetBank(bank || null);
    setEditingWalletId(w.id);
    setName(w.name);
    setWalletType(w.type === "credit_card" ? "credit_card" : "checking");
    setColor(w.color);
    setCreditLimit(w.credit_limit ? w.credit_limit.toString() : "");
    setStatementDay(w.closing_day ? w.closing_day.toString() : "");
    setDueDay(w.due_day ? w.due_day.toString() : "");
    setIncludeInBalance(w.include_in_total ?? true);
    setDrawerOpen(true);
  };

  const handleSaveBank = async () => {
    if (!institutionName) {
      toast.error("O nome do banco é obrigatório.");
      return;
    }
    try {
      const newBank = await addBank.mutateAsync({ name: institutionName, color });
      setBankDrawerOpen(false);
      openAddAccountDrawer(newBank as Bank);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSave = async () => {
    if (!name || !targetBank) {
      toast.error("O nome da conta é obrigatório.");
      return;
    }

    if (walletType === "credit_card" && (!creditLimit || !statementDay || !dueDay)) {
      toast.error("Preencha todos os campos do cartão.");
      return;
    }

    try {
      const payload = {
        name,
        bank_id: targetBank.id,
        institution_name: targetBank.name, // Keep for legacy if needed
        type: walletType,
        color: targetBank.color, // Wallets inherit bank color
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
        await walletsHelper.addWallet.mutateAsync(payload as any);
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

  const handleDeleteBank = async (id: string, name: string) => {
    if (!window.confirm(`Apagar o banco '${name}' removerá TODAS as contas associadas. Prosseguir?`)) return;
    try {
      await deleteBank.mutateAsync(id);
      toast.success("Banco e contas removidoss!");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const typeLabel = (type: string) => {
    const key = `wallets.${type}` as any;
    return t(key) || type.replace("_", " ");
  };

  const { cardsStats, totalExpenses, cardsCategoriesStats } = useMemo(() => {
    let _cardsStats: Record<string, { total: number, color: string, name: string }> = {};
    let _cardsCategoriesStats: Record<string, Record<string, { total: number, color: string, name: string }>> = {};
    let _total = 0;

    const now = new Date();
    const currentDay = now.getDate();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const expenses = transactions.filter(t => t.type === "expense");

    expenses.forEach(tx => {
      _total += Number(tx.amount);

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

      if (tx.wallet_id) {
        const card = wallets.find(w => w.id === tx.wallet_id);
        if (card) {
          const txDate = new Date(tx.date);
          let shouldCount = true;
          if (card.type === "checking") {
            if (txDate < currentMonthStart) shouldCount = false;
          } else if (card.type === "credit_card" && card.closing_day) {
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
    });

    return { cardsStats: _cardsStats, totalExpenses: _total, cardsCategoriesStats: _cardsCategoriesStats };
  }, [transactions, wallets, categories]);

  // Grouped wallets by Bank ID
  const groupedBanks = useMemo(() => {
    return banks.map(bank => ({
      ...bank,
      wallets: wallets.filter(w => w.bank_id === bank.id)
    }));
  }, [banks, wallets]);

  return (
    <div className="min-h-screen bg-background p-4 pb-28 selection:bg-primary/20">
      <div className="max-w-md mx-auto space-y-4">
        <header className="flex items-center gap-4 py-4">
          <button 
            onClick={() => navigate("/")}
            className="w-10 h-10 rounded-xl glass-inner flex items-center justify-center text-muted-foreground hover:text-white transition-all active:scale-90 border-[0.5px] border-white/5"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none">{t("wallets.title")}</h1>
            <p className="text-[9px] font-bold text-primary uppercase tracking-[0.2em] mt-1 opacity-40">Sincronização de Ativos</p>
          </div>
          <div className="flex-1" />
          <div className="flex gap-2">
             <button
              onClick={openAddBankDrawer}
              className="w-10 h-10 rounded-2xl glass-card flex items-center justify-center border-[0.5px] border-white/10 shadow-lg hover:bg-white/10 transition-all active:scale-95 group"
            >
              <Plus size={20} className="text-primary group-hover:rotate-90 transition-transform duration-300" />
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => <div key={i} className="h-48 rounded-[2rem] glass-card animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-10 pb-4">
            {/* Gastos Global Summary - Premium Visual */}
            {totalExpenses > 0 && (
              <div className="glass-card-elevated p-6 space-y-6 border-none relative overflow-hidden group">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
                
                <div className="relative z-10 flex justify-between items-start">
                  <div>
                    <h3 className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-1 leading-none opacity-50">Distribuição Regional</h3>
                    <p className="text-xl font-bold text-white tabular-nums tracking-tighter">
                      R$ {totalExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                    <Zap size={16} fill="currentColor" className="animate-pulse" />
                  </div>
                </div>

                <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden flex gap-0.5">
                  {Object.values(cardsStats).map((stat, i) => (
                    <div
                      key={`card-${i}`}
                      style={{ width: `${(stat.total / totalExpenses) * 100}%`, backgroundColor: stat.color }}
                      className="h-full transition-all duration-1000 ease-out hover:opacity-80"
                    />
                  ))}
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-3 text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest">
                  {groupedBanks.map((bank) => {
                    const bankTotal = bank.wallets.reduce((sum, w) => sum + (cardsStats[w.id]?.total || 0), 0);
                    if (bankTotal <= 0) return null;
                    return (
                      <div key={bank.id} className="flex items-center gap-2 group/bank">
                        <div className="w-2 h-2 rounded-full transition-transform group-hover/bank:scale-125 shadow-[0_0_10px_var(--color)]" style={{ backgroundColor: bank.color, ['--color' as any]: bank.color }} />
                        <span className="group-hover/bank:text-white transition-colors">{bank.name}</span>
                        <span className="text-white/30 tabular-nums">{Math.round((bankTotal / totalExpenses) * 100)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* List of Banks */}
            <div className="space-y-12">
              {banks.length === 0 ? (
                <div className="glass-card p-16 text-center border-none flex flex-col items-center">
                  <div className="w-20 h-20 rounded-[2.5rem] bg-glass flex items-center justify-center mb-6 shadow-2xl">
                    <Wallet size={32} className="text-muted-foreground/40" />
                  </div>
                  <h3 className="text-lg font-black text-white tracking-tight mb-2">Seu ecossistema está vazio</h3>
                  <p className="text-sm font-medium text-muted-foreground max-w-[200px]">Crie um banco para começar a gerenciar suas contas.</p>
                  <button onClick={openAddBankDrawer} className="mt-8 px-8 py-3 rounded-full bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">
                    Iniciar Agora
                  </button>
                </div>
              ) : (
                groupedBanks.map((bank) => (
                  <div key={bank.id} className="space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700 fill-mode-both">
                    <div className="flex items-center justify-between px-3">
                      <div className="flex items-center gap-5">
                        <div className="w-1 h-4 rounded-full" style={{ backgroundColor: bank.color, boxShadow: `0 0 10px ${bank.color}40` }} />
                        <div>
                          <h3 className="text-sm font-bold text-white tracking-tight leading-none uppercase">
                            {bank.name}
                          </h3>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => openAddAccountDrawer(bank)}
                          className="w-10 h-10 flex items-center justify-center rounded-xl glass-inner hover:bg-primary/20 text-primary transition-all active:scale-90"
                          title="Nova Conta"
                        >
                          <Plus size={18} strokeWidth={3} />
                        </button>
                        <button
                          onClick={() => handleDeleteBank(bank.id, bank.name)}
                          className="w-10 h-10 flex items-center justify-center rounded-xl glass-inner hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all active:scale-90"
                          title="Remover Banco"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {bank.wallets.length === 0 ? (
                        <div 
                          onClick={() => openAddAccountDrawer(bank)}
                          className="glass-card p-6 border-dashed border-white/10 border flex items-center justify-center gap-3 text-muted-foreground cursor-pointer hover:bg-white/5 transition-all group"
                        >
                          <div className="p-2 rounded-lg bg-white/5 group-hover:bg-primary/20 transition-all">
                            <Plus size={14} className="group-hover:text-primary" />
                          </div>
                          <span className="text-xs font-black uppercase tracking-widest">Vincular Primeira Conta</span>
                        </div>
                      ) : (
                        bank.wallets.map((w) => {
                          const Icon = w.type === "checking" ? Banknote : CreditCard;
                          const cardStats = cardsStats[w.id];
                          const catsStats = cardsCategoriesStats[w.id] ? Object.values(cardsCategoriesStats[w.id]).sort((a, b) => b.total - a.total).slice(0, 3) : [];
                          const displayExpense = cardStats?.total || 0;
                          const availableLimit = w.type === "credit_card" && (w.credit_limit || w.credit_limit === 0) ? w.credit_limit - displayExpense : 0;

                          return (
                            <div key={w.id} className="group relative glass-card p-7 border-none shadow-2xl transition-all hover:bg-white/[0.03] active:scale-[0.99] overflow-hidden rounded-[2rem]">
                              <div className="absolute top-0 right-0 p-6 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity rotate-12 group-hover:rotate-6 transition-all duration-700">
                                <Icon size={120} strokeWidth={1} style={{ color: bank.color }} />
                              </div>
                              
                              <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-4">
                                  <div className="w-11 h-11 rounded-[1rem] flex items-center justify-center glass-inner border border-white/5 transition-all group-hover:scale-105">
                                    <Icon size={18} style={{ color: bank.color }} strokeWidth={1.5} />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-bold text-white leading-tight truncate tracking-tight">{w.name}</p>
                                      {linkedWalletIds?.has(w.id) && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                      )}
                                    </div>
                                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5 opacity-40">
                                      {typeLabel(w.type)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 duration-300">
                                  <button onClick={() => openEditDrawer(w)} className="p-3 text-muted-foreground hover:text-white transition-colors glass-inner rounded-2xl">
                                    <Pencil size={18} />
                                  </button>
                                  <button onClick={() => handleDelete(w.id, w.name)} className="p-3 text-muted-foreground hover:text-destructive transition-colors glass-inner rounded-2xl">
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </div>

                              <div className="flex justify-between items-end mt-10 pt-8 border-t border-white/5 relative z-10">
                                <div className="space-y-1">
                                  <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest leading-none opacity-40">
                                    {w.type === "credit_card" ? "Fatura Atual" : "Fluxo Mensal"}
                                  </p>
                                  <p className="text-lg font-bold text-white tabular-nums tracking-tighter">
                                    R$ {Number(displayExpense).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  </p>
                                </div>
                                {w.type === "credit_card" && (
                                  <div className="text-right space-y-1">
                                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest leading-none opacity-40">Disponível</p>
                                    <p className={`text-lg font-bold tabular-nums tracking-tighter ${availableLimit < 500 ? 'text-orange-400' : 'text-emerald-400'}`}>
                                      R$ {Number(availableLimit).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* Dates & Categories are now part of a cleaner sub-layout */}
                              {( (w.type === "credit_card" && (w.closing_day || w.due_day)) || catsStats.length > 0) && (
                                <div className="flex flex-col gap-4 mt-8 pt-8 border-t border-white/5 relative z-10">
                                  {w.type === "credit_card" && (w.closing_day || w.due_day) && (
                                    <div className="flex items-center gap-2">
                                      <div className="glass-inner px-4 py-2 rounded-xl flex items-center gap-3 group/tag">
                                        <div className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover/tag:bg-white/50 transition-colors" />
                                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">Corte</span>
                                        <span className="text-xs font-black text-white italic">D{w.closing_day}</span>
                                      </div>
                                      <div className="glass-inner px-4 py-2 rounded-xl flex items-center gap-3 group/tag">
                                        <div className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover/tag:bg-white/50 transition-colors" />
                                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">Venc</span>
                                        <span className="text-xs font-black text-white italic">D{w.due_day}</span>
                                      </div>
                                    </div>
                                  )}

                                  {catsStats.length > 0 && (
                                    <div className="flex flex-wrap gap-4">
                                      {catsStats.map((cstat, i) => (
                                        <div key={i} className="flex items-center gap-2.5 group/cat glass-inner px-3 py-1.5 rounded-full border border-white/5">
                                          <div className="w-1.5 h-1.5 rounded-full shadow-[0_0_8px_var(--color)]" style={{ backgroundColor: cstat.color, ['--color' as any]: cstat.color }} />
                                          <span className="text-[10px] font-black text-white/50 uppercase truncate max-w-[100px]">{cstat.name}</span>
                                          <span className="text-[10px] font-black text-white tracking-tighter">R$ {cstat.total.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* DRAWER: BANK CREATION */}
      <Drawer open={bankDrawerOpen} onOpenChange={setBankDrawerOpen}>
        <DrawerContent className="bg-background border-t border-glass-border">
          <div className="mx-auto w-full max-w-sm px-6 pb-12">
            <div className="w-12 h-1.5 rounded-full bg-white/10 mx-auto mt-4 mb-8" />
            <DrawerHeader className="px-0 pb-10 text-center">
               <div className="w-20 h-20 rounded-[2rem] bg-primary/10 flex items-center justify-center mx-auto mb-6 shadow-2xl relative">
                  <WalletIcon size={32} className="text-primary" />
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white border-4 border-background">
                    <Plus size={16} strokeWidth={3} />
                  </div>
               </div>
               <DrawerTitle className="text-3xl font-black text-white tracking-tighter">Novo Ecossistema</DrawerTitle>
               <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-2 opacity-60">Primeiro, escolha a instituição.</p>
            </DrawerHeader>

            <div className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] ml-2">Identificação</label>
                <input
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="Nome do Banco (Ex: Nu, Inter, XP...)"
                  className="w-full h-16 glass-inner rounded-[1.5rem] px-6 text-lg font-black text-white bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border-none placeholder:text-white/10"
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] ml-2">Assinatura Visual</label>
                <div className="grid grid-cols-4 gap-4 p-4 glass-inner rounded-[2rem]">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`h-14 rounded-2xl transition-all relative group flex items-center justify-center`}
                      style={{ backgroundColor: c }}
                    >
                      {color === c ? (
                        <div className="w-8 h-8 rounded-full bg-white/30 backdrop-blur-md border border-white/40 flex items-center justify-center scale-110 shadow-xl">
                          <Circle size={10} fill="white" className="text-white" />
                        </div>
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-black/20 group-hover:scale-150 transition-transform" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSaveBank}
                disabled={addBank.isPending}
                className="w-full h-18 py-5 rounded-[1.75rem] bg-white text-black font-black text-sm uppercase tracking-[0.2em] shadow-[0_20px_40px_-10px_rgba(255,255,255,0.2)] hover:bg-primary hover:text-white active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {addBank.isPending ? "Criando..." : <>Continuar <ArrowRight size={18} /></>}
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* DRAWER: ACCOUNT/WALLET CREATION */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="bg-background border-t border-glass-border">
          <div className="mx-auto w-full max-w-sm px-6 pb-12 overflow-y-auto max-h-[90vh]">
            <div className="w-12 h-1.5 rounded-full bg-white/10 mx-auto mt-4 mb-8" />
            <DrawerHeader className="px-0 pb-8 text-center">
              <div className="inline-flex items-center gap-4 bg-white/5 px-6 py-2.5 rounded-2xl border border-white/5 mb-6">
                 <div className="w-2 h-2 rounded-full" style={{ backgroundColor: targetBank?.color }} />
                 <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{targetBank?.name}</span>
              </div>
              <DrawerTitle className="text-2xl font-black text-white tracking-tighter">
                {editingWalletId ? "Editar Detalhes" : `Vincular Nova Conta`}
              </DrawerTitle>
            </DrawerHeader>

            <div className="space-y-6">
              <div className="flex gap-2 p-2 rounded-[1.5rem] glass-inner">
                <button
                  onClick={() => setWalletType("checking")}
                  className={`flex-1 flex gap-2 justify-center items-center py-4 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all ${walletType === "checking" ? "bg-white text-black shadow-lg" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}
                >
                  <Banknote size={16} strokeWidth={2.5} /> Débito/PIX
                </button>
                <button
                  onClick={() => setWalletType("credit_card")}
                  className={`flex-1 flex gap-2 justify-center items-center py-4 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all ${walletType === "credit_card" ? "bg-white text-black shadow-lg" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}
                >
                  <CreditCard size={16} strokeWidth={2.5} /> Cartão
                </button>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] ml-2">Apelido da Conta</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Minha Conta, Visa Platinum..."
                  className="w-full h-16 glass-inner rounded-[1.5rem] px-6 text-base font-black text-white bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border-none placeholder:text-white/10"
                />
              </div>

              {walletType === "credit_card" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] ml-2 text-center block">Corte</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={statementDay}
                        onChange={(e) => setStatementDay(e.target.value)}
                        placeholder="Dia"
                        className="w-full h-16 glass-inner rounded-[1.5rem] text-center text-xl font-black text-white focus:outline-none transition-all border-none"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] ml-2 text-center block">Venc</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={dueDay}
                        onChange={(e) => setDueDay(e.target.value)}
                        placeholder="Dia"
                        className="w-full h-16 glass-inner rounded-[1.5rem] text-center text-xl font-black text-white focus:outline-none transition-all border-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] ml-2">Limite Definido</label>
                    <div className="relative">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground font-black text-sm">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={creditLimit}
                        onChange={(e) => setCreditLimit(e.target.value)}
                        placeholder="0,00"
                        className="w-full h-20 glass-inner rounded-[1.5rem] pl-16 pr-8 text-3xl font-black text-white bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border-none text-right placeholder:opacity-10"
                      />
                    </div>
                  </div>
                </div>
              )}

              <label className="flex items-center gap-5 glass-inner p-5 rounded-[1.75rem] cursor-pointer group transition-all border border-transparent hover:border-white/10">
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={includeInBalance}
                    onChange={(e) => setIncludeInBalance(e.target.checked)}
                    className="w-7 h-7 rounded-xl border-none bg-white/10 text-primary focus:ring-0 transition-transform group-active:scale-90"
                  />
                  {includeInBalance && <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-white"><div className="w-2 h-2 rounded-full bg-white" /></div>}
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-black text-white uppercase tracking-[0.2em] leading-none mb-1.5">Impactar Balanço Geral</p>
                  <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight opacity-50 italic">Contabilizar nos totais do mês</p>
                </div>
              </label>

              <div className="pt-6 flex gap-4">
                 <button
                  onClick={() => setDrawerOpen(false)}
                  className="flex-1 h-16 rounded-[1.5rem] bg-white/5 text-white font-black text-[10px] uppercase tracking-widest border border-white/5 hover:bg-white/10"
                >
                  Descartar
                </button>
                <button
                  onClick={handleSave}
                  disabled={walletsHelper.addWallet.isPending || walletsHelper.updateWallet.isPending}
                  className="flex-[2] h-16 rounded-[1.5rem] bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-widest shadow-2xl hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
                 >
                  {walletsHelper.addWallet.isPending || walletsHelper.updateWallet.isPending ? t("auth.loading") : t("common.save")}
                </button>
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
      <BottomNav />
    </div>
  );
};

export default WalletsPage;
