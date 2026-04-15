import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStagedTransactions } from "@/hooks/useStagedTransactions";
import { useAutomationRules } from "@/hooks/useAutomationRules";
import { useCategories } from "@/hooks/useCategories";
import { useWallets } from "@/hooks/useWallets";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Sparkles,
  Check,
  X,
  ChevronDown,
  Wallet,
  Wand2,
  Inbox,
  Loader2,
  Tag,
  Trash2,
  Plus,
  ArrowLeft,
  Calendar,
  Filter,
  XCircle,
  RefreshCw,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";

const TransactionLimbo = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    stagedTransactions, 
    isLoading, 
    approveTransaction, 
    rejectTransaction, 
    deletePermanently,
    rejectAllPending, 
    resetRejectedTransactions,
    forceSync 
  } = useStagedTransactions();
  const { rules, addRule, deleteRule, findSuggestedCategory } = useAutomationRules();
  const { categories } = useCategories();
  const { wallets } = useWallets();

  // Fetch connections to map account names/institutions
  const { data: connections } = useQuery({
    queryKey: ["pluggy_connections", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("pluggy_connections").select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // State for tabs
  const [activeBankId, setActiveBankId] = useState<string>("all");

  // Filters
  const [walletFilter, setWalletFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Selected transaction for action drawer
  const [selected, setSelected] = useState<(typeof stagedTransactions)[number] | null>(null);
  const [editedDescription, setEditedDescription] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedWalletId, setSelectedWalletId] = useState<string>("");

  // Create rule mini-form
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleKeyword, setRuleKeyword] = useState("");
  const [ruleCategoryId, setRuleCategoryId] = useState("");

  // Show rules panel
  const [showRulesPanel, setShowRulesPanel] = useState(false);

  // Success animation state
  const [successId, setSuccessId] = useState<string | null>(null);

  // Unique Institutions derived from data
  const banks = useMemo(() => {
    const map = new Map<string, { name: string; itemId: string | null }>();
    stagedTransactions.forEach((tx) => {
      const conn = connections?.find((c) => c.pluggy_account_id === tx.pluggy_account_id);
      const name = conn?.pluggy_account_name || conn?.institution_name || "Geral";
      const id = tx.pluggy_account_id || "geral";
      if (!map.has(id)) {
        map.set(id, { name, itemId: conn?.pluggy_item_id || null });
      }
    });
    return Array.from(map.entries()).map(([id, info]) => ({ id, ...info }));
  }, [stagedTransactions, connections]);

  // Unique wallets present in staged
  const uniqueWalletIds = useMemo(() => {
    const ids = new Set(stagedTransactions.map((t) => t.wallet_id));
    return wallets.filter((w) => ids.has(w.id));
  }, [stagedTransactions, wallets]);

  const hasUnlinked = useMemo(
    () => stagedTransactions.some((t) => !t.wallet_id),
    [stagedTransactions]
  );

  // Filtered list with Tab support
  const filtered = useMemo(() => {
    let list = stagedTransactions;
    
    // Bank Tab filter
    if (activeBankId !== "all") {
      list = list.filter((t) => (t.pluggy_account_id || "geral") === activeBankId);
    }

    if (walletFilter === "__none__") {
      list = list.filter((t) => !t.wallet_id);
    } else if (walletFilter !== "all") {
      list = list.filter((t) => t.wallet_id === walletFilter);
    }
    if (dateFrom) {
      list = list.filter((t) => t.date >= dateFrom);
    }
    if (dateTo) {
      const toEnd = dateTo + "T23:59:59";
      list = list.filter((t) => t.date <= toEnd);
    }
    return list;
  }, [stagedTransactions, walletFilter, dateFrom, dateTo, activeBankId]);

  const openDetail = (tx: (typeof stagedTransactions)[number]) => {
    setSelected(tx);
    setEditedDescription(tx.description);
    const suggested = findSuggestedCategory(tx.description) ?? tx.suggested_category_id;
    setSelectedCategoryId(suggested ?? "");
    setSelectedWalletId(tx.wallet_id ?? "");
    setShowRuleForm(false);
    setRuleKeyword("");
    setRuleCategoryId("");
  };

  const closeDetail = () => setSelected(null);

  const handleApprove = async () => {
    if (!selected) return;
    if (!selectedCategoryId) {
      toast.error("Selecione uma categoria antes de confirmar.");
      return;
    }

    setSuccessId(selected.id);

    try {
      await approveTransaction.mutateAsync({
        stagedId: selected.id,
        description: editedDescription.trim() || selected.description,
        category_id: selectedCategoryId,
        wallet_id: selectedWalletId || null,
        amount: selected.amount,
        type: selected.type,
        date: selected.date,
      });
      toast.success("Transação consolidada com sucesso!");
      closeDetail();
    } catch {
      toast.error("Erro ao consolidar transação.");
    } finally {
      setTimeout(() => setSuccessId(null), 600);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    try {
      await rejectTransaction.mutateAsync(selected.id);
      toast.success("Transação descartada.");
      closeDetail();
    } catch {
      toast.error("Erro ao descartar transação.");
    }
  };

  const handleCreateRule = async () => {
    if (!ruleKeyword.trim() || !ruleCategoryId) {
      toast.error("Preencha a palavra-chave e a categoria.");
      return;
    }
    try {
      await addRule.mutateAsync({ keyword: ruleKeyword, category_id: ruleCategoryId });
      toast.success("Regra de automação criada!");
      setShowRuleForm(false);
      setRuleKeyword("");
      setRuleCategoryId("");
    } catch {
      toast.error("Erro ao criar regra.");
    }
  };

  const walletName = (walletId: string | null) => {
    if (!walletId) return "Sem carteira";
    return wallets.find((w) => w.id === walletId)?.name ?? "Conta";
  };

  const walletColor = (walletId: string | null) => {
    if (!walletId) return "#64748b"; // slate-500
    return wallets.find((w) => w.id === walletId)?.color ?? "#3b82f6";
  };

  const getCategory = (catId: string | null) => {
    if (!catId) return null;
    return categories.find((c) => c.id === catId) ?? null;
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Dynamic Background elements for "Liquid" feel */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20 z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-chart-purple/10 blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 p-4 pb-28 max-w-md mx-auto space-y-6">
        {/* Modern Header */}
        <header className="flex items-center justify-between py-2">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/transactions")}
              className="w-10 h-10 rounded-2xl glass-card-elevated flex items-center justify-center hover:bg-glass-border/20 transition-all active:scale-90"
            >
              <ArrowLeft size={20} className="text-foreground/80" />
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Consolidar</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
                  {filtered.length} Atividade{filtered.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (window.confirm('Desfazer todos os "Ignorar"? Isso trará de volta as transações que você removeu da lista.')) {
                  resetRejectedTransactions.mutate(undefined, {
                    onSuccess: () => toast.success('Transações restauradas com sucesso!'),
                    onError: (err: any) => toast.error('Erro ao restaurar: ' + err.message),
                  });
                }
              }}
              disabled={resetRejectedTransactions.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl glass-card text-xs font-medium text-primary hover:bg-primary/10 transition-all active:scale-95 disabled:opacity-50"
              title="Recuperar transações ignoradas"
            >
              {resetRejectedTransactions.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              Sincronizar
            </button>

            {filtered.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm(`Tem certeza que deseja ignorar todas as ${filtered.length} transações pendentes?`)) {
                    rejectAllPending.mutate(undefined, {
                      onSuccess: () => toast.success('Todas as transações pendentes foram ignoradas.'),
                      onError: (err: any) => toast.error('Erro: ' + err.message),
                    });
                  }
                }}
                disabled={rejectAllPending.isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl glass-card text-xs font-medium text-destructive hover:bg-destructive/10 transition-all active:scale-95 disabled:opacity-50"
              >
                {rejectAllPending.isPending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <XCircle size={14} />
                )}
                Ignorar Todas
              </button>
            )}
            <button
              onClick={() => setShowRulesPanel(!showRulesPanel)}
              className={`w-10 h-10 rounded-2xl glass-card flex items-center justify-center transition-all active:scale-90 ${showRulesPanel ? "bg-primary text-white border-primary" : "text-muted-foreground"}`}
            >
              <Wand2 size={20} />
            </button>
          </div>
        </header>

        {/* Bank Tabs */}
        {!isLoading && banks.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            <button
              onClick={() => setActiveBankId("all")}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeBankId === "all" ? "bg-primary text-white shadow-lg glow-blue" : "glass-card text-muted-foreground"
              }`}
            >
              Todos
            </button>
            {banks.map((bank) => (
              <div key={bank.id} className="flex gap-1">
                <button
                  onClick={() => setActiveBankId(bank.id)}
                  className={`px-4 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all ${
                    activeBankId === bank.id ? "bg-white/10 text-white border border-white/20 shadow-md" : "glass-card text-muted-foreground"
                  }`}
                >
                  {bank.name}
                </button>
                {bank.itemId && activeBankId === bank.id && (
                  <button
                    onClick={() => {
                      if (window.confirm("Isso apagará o histórico local deste banco e buscará tudo novamente. Deseja continuar?")) {
                        forceSync.mutate(bank.itemId!, {
                          onSuccess: () => toast.success("Sincronização profunda concluída!"),
                        });
                      }
                    }}
                    disabled={forceSync.isPending}
                    className="w-9 h-9 rounded-2xl glass-card flex items-center justify-center text-primary active:scale-90 disabled:opacity-50"
                    title="Resetar e Sincronizar Tudo"
                  >
                    {forceSync.isPending ? <Loader2 size={12} className="animate-spin" /> : <Zap size={14} />}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Rules Summary (Glassy Notification-like card) */}
        {showRulesPanel && (
          <div className="glass-card-elevated p-4 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles size={16} className="text-primary" />
                Regras de Automação
              </h3>
              <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">
                {rules.length} Ativa{rules.length === 1 ? "s" : "s"}
              </span>
            </div>
            {rules.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 italic">Ative regras clicando no ícone de varinha ao consolidar uma transação externa.</p>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                {rules.map((r) => (
                  <div key={r.id} className="flex items-center justify-between glass-inner p-3 group transition-all hover:bg-white/[0.05]">
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      <span className="text-xs font-mono text-white/90 truncate max-w-[150px]">"{r.keyword}"</span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        Aplica <span style={{ color: r.categories?.color }} className="flex items-center gap-1">
                          {r.categories?.icon_emoji && <span>{r.categories.icon_emoji}</span>}
                          {r.categories?.name}
                        </span>
                      </span>
                    </div>
                    <button
                      onClick={() => deleteRule.mutate(r.id)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Liquid Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4 py-1">
           <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all shrink-0 ${showFilters ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'glass-card text-muted-foreground'}`}
          >
            <Filter size={14} />
            Filtros
          </button>
          
          <div className="h-4 w-[1px] bg-white/10 shrink-0" />
          
          <button
            onClick={() => setWalletFilter("all")}
            className={`px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all shrink-0 ${walletFilter === "all" ? 'bg-white text-black' : 'glass-inner text-muted-foreground'}`}
          >
            Todas
          </button>
          
          {hasUnlinked && (
            <button
              onClick={() => setWalletFilter("__none__")}
              className={`px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all shrink-0 flex items-center gap-2 ${walletFilter === "__none__" ? 'bg-white text-black' : 'glass-inner text-muted-foreground'}`}
            >
              <div className="w-2 h-2 rounded-full bg-slate-500" />
              Externas
            </button>
          )}

          {uniqueWalletIds.map((w) => (
            <button
              key={w.id}
              onClick={() => setWalletFilter(w.id)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all shrink-0 flex items-center gap-2 ${walletFilter === w.id ? 'bg-white text-black' : 'glass-inner text-muted-foreground'}`}
            >
              <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: w.color }} />
              {w.name}
            </button>
          ))}
        </div>

        {/* Date Filter Panel (Liquid Slide) */}
        {showFilters && (
          <div className="glass-card p-4 grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Início</label>
              <div className="relative">
                <Calendar size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full bg-glass-inner rounded-xl pl-8 pr-3 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary/50 [color-scheme:dark]"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Fim</label>
              <div className="relative">
                <Calendar size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full bg-glass-inner rounded-xl pl-8 pr-3 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary/50 [color-scheme:dark]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Liquid Transaction List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 size={40} className="animate-spin text-primary opacity-50" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">Sincronizando dados...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4 animate-in fade-in zoom-in-95 duration-500">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
              <div className="relative w-20 h-20 rounded-[2.5rem] glass-card flex items-center justify-center">
                <Inbox size={32} className="text-primary/60" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Limbo Vazio</h3>
              <p className="text-sm text-muted-foreground max-w-[240px] leading-relaxed">
                Excelente! Todas as suas transações já foram processadas.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filtered.map((tx, idx) => {
              const suggested = findSuggestedCategory(tx.description) ?? tx.suggested_category_id;
              const suggestedCat = getCategory(suggested);
              const isSuccess = successId === tx.id;
              const wColor = walletColor(tx.wallet_id);

              return (
                <button
                  key={tx.id}
                  onClick={() => openDetail(tx)}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  className={`group relative glass-card p-5 text-left transition-all hover:translate-y-[-2px] active:scale-[0.98] animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden ${isSuccess ? 'border-chart-green shadow-[0_0_30px_rgba(16,185,129,0.15)]' : ''} ${tx.status === 'rejected' ? 'opacity-50' : ''}`}
                >
                  {/* Subtle edge glow based on wallet */}
                  <div className={`absolute top-0 left-0 w-[2px] h-full ${tx.status === 'rejected' ? 'opacity-20' : 'opacity-40'}`} style={{ backgroundColor: tx.status === 'rejected' ? '#64748b' : wColor }} />
                  
                  {/* Success Reveal Overlay */}
                  {isSuccess && (
                     <div className="absolute inset-0 bg-chart-green/10 flex items-center justify-center z-10 animate-in fade-in duration-300 backdrop-blur-[2px]">
                        <div className="w-12 h-12 rounded-full bg-chart-green flex items-center justify-center shadow-lg shadow-chart-green/40">
                          <Check size={24} className="text-white" />
                        </div>
                     </div>
                  )}

                  <div className="flex items-center gap-4">
                    {/* Wallet Icon with specific glow */}
                    <div 
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative overflow-hidden ${tx.status === 'rejected' ? 'bg-slate-500/10' : ''}`}
                      style={tx.status !== 'rejected' ? { backgroundColor: `${wColor}15` } : {}}
                    >
                       <div className="absolute inset-0 opacity-20 blur-sm" style={{ backgroundColor: tx.status === 'rejected' ? '#64748b' : wColor }} />
                       <Wallet size={20} className="relative z-10" style={{ color: tx.status === 'rejected' ? '#64748b' : wColor }} />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                       <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm font-bold truncate leading-none ${tx.status === 'rejected' ? 'text-slate-500 line-through' : 'text-white/90'}`}>
                            {tx.description}
                          </p>
                          <span className={`text-base font-black tabular-nums shrink-0 ${tx.status === 'rejected' ? 'text-slate-500 line-through' : tx.type === 'income' ? 'text-chart-green' : 'text-white'}`}>
                            {tx.type === 'income' ? '+\u00a0' : '-\u00a0'}
                            {Number(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                       </div>
                       
                       <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-muted-foreground/80 flex items-center gap-1">
                            {format(new Date(tx.date), "dd MMM")}
                          </span>
                          <span className="text-white/10 text-[10px]">•</span>
                          <span className="text-[11px] font-medium text-muted-foreground truncate uppercase tracking-tight">
                            {walletName(tx.wallet_id)}
                          </span>
                          {tx.status === 'rejected' && (
                            <span className="text-[9px] font-bold text-slate-600 bg-black/40 px-1.5 py-0.5 rounded-md border border-white/5">
                              IGNORADO
                            </span>
                          )}
                          
                          {suggestedCat && (
                            <>
                              <span className="text-white/10 text-[10px]">•</span>
                              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                {suggestedCat.icon_emoji ? (
                                  <span className="text-[10px]">{suggestedCat.icon_emoji}</span>
                                ) : (
                                  <Sparkles size={10} />
                                )}
                                <span className="text-[10px] font-bold uppercase tracking-tighter">{suggestedCat.name}</span>
                              </div>
                            </>
                          )}
                       </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Liquid Action Drawer ── */}
      {selected && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-500"
            onClick={closeDetail}
          />

          <div className="relative w-full max-w-lg glass-card-elevated rounded-[2.5rem] p-7 pt-10 space-y-6 animate-in slide-in-from-bottom-full duration-500 ease-out-expo max-h-[90vh] overflow-y-auto">
            {/* Close Button (Premium) */}
            <button
              onClick={closeDetail}
              className="absolute top-4 right-4 w-10 h-10 rounded-2xl glass-inner flex items-center justify-center text-muted-foreground hover:bg-white/10 hover:text-white transition-all active:rotate-90"
            >
              <X size={20} />
            </button>

            {/* Handle Bar */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/10 rounded-full" />

            {/* Header Content */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div
                  className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                  style={{
                    backgroundColor: `${walletColor(selected.wallet_id)}20`,
                    color: walletColor(selected.wallet_id),
                    border: `1px solid ${walletColor(selected.wallet_id)}30`,
                  }}
                >
                  {walletName(selected.wallet_id)}
                </div>
                <span className="text-xs font-semibold text-muted-foreground">
                  {format(new Date(selected.date), "dd/MM/yyyy 'às' HH:mm")}
                </span>
              </div>
              <h2 className={`text-4xl font-black tabular-nums tracking-tighter ${selected.type === "income" ? "text-chart-green" : "text-white"}`}>
                {selected.type === "income" ? "+" : "-"} R${" "}
                {Number(selected.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </h2>
            </div>

            {/* Original Source (Faded code block style) */}
            <div className="space-y-2">
               <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-1">Origem Pluggy</label>
               <div className="glass-inner bg-black/20 p-4 rounded-2xl border-white/5 font-mono text-[11px] text-white/50 leading-relaxed italic break-all">
                  {selected.description}
               </div>
            </div>

            {/* Input Fields Group */}
            <div className="space-y-5">
               {/* Description */}
               <div className="space-y-2">
                  <label className="text-xs font-bold text-white/70 px-1">Como você descreve?</label>
                  <div className="relative group">
                    <input
                      type="text"
                      value={editedDescription}
                      onChange={(e) => setEditedDescription(e.target.value)}
                      placeholder="Ex: Assinatura Netflix"
                      className="w-full glass-inner bg-white/[0.03] rounded-2xl px-5 py-4 text-base font-medium text-white placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white/[0.06] transition-all"
                    />
                  </div>
               </div>

               {/* Dual Select Layout */}
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white/70 px-1 flex items-center gap-1.5">
                      <Tag size={12} /> Categoria
                    </label>
                    <div className="relative">
                      <select
                        value={selectedCategoryId}
                        onChange={(e) => setSelectedCategoryId(e.target.value)}
                        className="w-full appearance-none glass-inner bg-white/[0.03] rounded-2xl px-5 py-4 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all cursor-pointer"
                      >
                        <option value="" className="bg-slate-900">Tipo...</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id} className="bg-slate-900">
                            {c.icon_emoji ? `${c.icon_emoji} ${c.name}` : c.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white/70 px-1 flex items-center gap-1.5">
                      <Wallet size={12} /> Carteira
                    </label>
                    <div className="relative">
                      <select
                        value={selectedWalletId}
                        onChange={(e) => setSelectedWalletId(e.target.value)}
                        className="w-full appearance-none glass-inner bg-white/[0.03] rounded-2xl px-5 py-4 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all cursor-pointer"
                      >
                        <option value="" className="bg-slate-900">Escolha...</option>
                        {wallets.map((w) => (
                          <option key={w.id} value={w.id} className="bg-slate-900">{w.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                    </div>
                  </div>
               </div>
            </div>

            {/* Action Buttons (Floating style) */}
            <div className="flex gap-3 pt-4">
               <button
                  onClick={handleReject}
                  disabled={rejectTransaction.isPending}
                  className={`flex-1 py-4 rounded-2xl glass-inner border-white/10 text-sm font-bold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                    selected.status === 'rejected' ? 'text-primary hover:bg-primary/10' : 'text-white/70 hover:bg-white/5'
                  }`}
               >
                  {selected.status === 'rejected' ? (
                    <>
                      <RefreshCw size={18} className="animate-in spin-in-180 duration-500" />
                      Restaurar
                    </>
                  ) : (
                    <>
                      <XCircle size={18} />
                      Ignorar
                    </>
                  )}
               </button>

               <button
                 onClick={async () => {
                   if (window.confirm("Deseja deletar permanentemente esta transação da lista?")) {
                     await deletePermanently.mutateAsync(selected.id);
                     toast.success("Deletado com sucesso.");
                     closeDetail();
                   }
                 }}
                 disabled={deletePermanently.isPending}
                 className="w-14 rounded-2xl glass-inner border-white/5 flex items-center justify-center text-destructive/40 hover:text-destructive hover:bg-destructive/10 active:scale-90 transition-all disabled:opacity-50"
                 title="Deletar Permanente"
               >
                 {deletePermanently.isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={18} />}
               </button>

               <button
                  onClick={handleApprove}
                  disabled={approveTransaction.isPending}
                  className="flex-[2] py-4 rounded-2xl bg-primary text-white font-bold text-sm shadow-xl shadow-primary/30 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
               >
                 {approveTransaction.isPending ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                 Consolidar
               </button>
            </div>

            {/* Smart Rule Automation Section */}
            <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-5 space-y-4">
               {!showRuleForm ? (
                  <button
                    onClick={() => {
                      setShowRuleForm(true);
                      const words = selected.description.split(" ").slice(0, 3).join(" ");
                      setRuleKeyword(words.toLowerCase());
                      setRuleCategoryId(selectedCategoryId);
                    }}
                    className="w-full flex items-center justify-center gap-2 text-xs font-bold text-primary group-hover:text-primary-foreground transition-all"
                  >
                    <Sparkles size={14} className="animate-pulse" />
                    Automatizar transações futuras deste tipo
                  </button>
               ) : (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Configurar Automação</h4>
                      <button onClick={() => setShowRuleForm(false)} className="text-white/30 hover:text-white"><X size={14}/></button>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-muted-foreground ml-1">Regra de detecção</span>
                        <input
                          type="text"
                          value={ruleKeyword}
                          onChange={(e) => setRuleKeyword(e.target.value)}
                          className="w-full glass-inner bg-black/20 rounded-xl px-4 py-3 text-xs font-mono text-primary placeholder:text-primary/20 focus:outline-none border-primary/20"
                          placeholder="Termo de busca..."
                        />
                      </div>
                      
                      <button
                        onClick={handleCreateRule}
                        disabled={addRule.isPending}
                        className="w-full py-3 rounded-2xl bg-primary/10 text-primary border border-primary/20 text-xs font-black uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center justify-center gap-2"
                      >
                        {addRule.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        Ativar Regra Inteligente
                      </button>
                    </div>
                  </div>
               )}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default TransactionLimbo;
