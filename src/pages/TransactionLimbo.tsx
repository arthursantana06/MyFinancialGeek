import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStagedTransactions } from "@/hooks/useStagedTransactions";
import { useAutomationRules } from "@/hooks/useAutomationRules";
import { useCategories } from "@/hooks/useCategories";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useWallets } from "@/hooks/useWallets";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
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
  ShieldCheck,
  Banknote,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import AddTransactionDrawer from "@/components/AddTransactionDrawer";

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
  const { paymentMethods } = usePaymentMethods();

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

  const [showFilters, setShowFilters] = useState(false);
  const [activePluggyId, setActivePluggyId] = useState<string>("all");

  const lastUpdateDate = useMemo(() => {
    if (!connections || connections.length === 0) return null;
    const dates = connections.map(c => new Date(c.updated_at || c.created_at || 0).getTime());
    return new Date(Math.max(...dates));
  }, [connections]);

  // Filters
  // Filters
  const [activePeriod, setActivePeriod] = useState<"7d" | "15d" | "30d" | "all" | "custom">("15d"); // Default to 15d maybe, but user had "all"
  const [activeInstitution, setActiveInstitution] = useState<string>("all");
  const [activeWalletId, setActiveWalletId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Selected transaction for action drawer
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [drawerData, setDrawerData] = useState<any>(null);

  // For rule creation
  const [selectedForRules, setSelectedForRules] = useState<(typeof stagedTransactions)[number] | null>(null);

  // Create rule mini-form
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleKeyword, setRuleKeyword] = useState("");
  const [ruleCategoryId, setRuleCategoryId] = useState("");
  const [ruleType, setRuleType] = useState<"suggest" | "auto_approve">("suggest");
  const [rulePaymentMethodId, setRulePaymentMethodId] = useState("");

  // Show rules panel
  const [showRulesPanel, setShowRulesPanel] = useState(false);

  // Success animation state
  const [successId, setSuccessId] = useState<string | null>(null);
  const [selectedApprovedTx, setSelectedApprovedTx] = useState<any | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  // Unique wallets present in staged
  const uniqueWallets = useMemo(() => {
    const ids = new Set(stagedTransactions.map((t) => t.wallet_id));
    return wallets.filter((w) => ids.has(w.id));
  }, [stagedTransactions, wallets]);

  const institutions = useMemo(() => {
    const insts = new Set<string>();
    uniqueWallets.forEach(w => insts.add(w.institution_name || 'Diversos'));
    return Array.from(insts);
  }, [uniqueWallets]);

  const hasUnlinked = useMemo(
    () => stagedTransactions.some((t) => !t.wallet_id),
    [stagedTransactions]
  );

  // Filtered list with Tab support
  const filtered = useMemo(() => {
    let list = stagedTransactions;
    
    // Institution filter
    if (activeInstitution !== "all") {
       list = list.filter(t => {
          const w = wallets.find(w => w.id === t.wallet_id);
          const inst = w?.institution_name || 'Diversos';
          return inst === activeInstitution;
       });
    }

    // specific wallet/account filter
    if (activeWalletId === "__none__") {
      list = list.filter((t) => !t.wallet_id);
    } else if (activeWalletId !== "all") {
      list = list.filter((t) => t.wallet_id === activeWalletId);
    }

    const now = new Date();
    if (activePeriod === "7d") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      list = list.filter((t) => new Date(t.date) >= d);
    } else if (activePeriod === "30d") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      list = list.filter((t) => new Date(t.date) >= d);
    } else if (activePeriod === "custom") {
      if (dateFrom) list = list.filter((t) => t.date >= dateFrom);
      if (dateTo) {
        const toEnd = dateTo + "T23:59:59";
        list = list.filter((t) => t.date <= toEnd);
      }
    }
    
    return list;
  }, [stagedTransactions, wallets, activeInstitution, activeWalletId, activePeriod, dateFrom, dateTo]);

  // Grouped transactions
  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    filtered.forEach((tx) => {
      const d = new Date(tx.date);
      let label = format(d, "dd 'de' MMMM", { locale: ptBR });
      if (format(d, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")) {
        label = "Hoje";
      } else {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (format(d, "yyyy-MM-dd") === format(yesterday, "yyyy-MM-dd")) {
          label = "Ontem";
        }
      }
      if (!groups[label]) groups[label] = [];
      groups[label].push(tx);
    });
    return groups;
  }, [filtered]);

  const openDetail = (tx: (typeof stagedTransactions)[number]) => {
    const suggested = findSuggestedCategory(tx.description) ?? tx.suggested_category_id;
    
    setDrawerData({
      amount: tx.amount.toString(),
      description: tx.description,
      date: tx.date,
      type: tx.type,
      walletId: tx.wallet_id,
      categoryId: suggested || "",
      paymentMethodId: tx.payment_method_id || "",
      stagedId: tx.id
    });
    setAddDrawerOpen(true);
  };

  const closeDetail = () => {
    setAddDrawerOpen(false);
    setDrawerData(null);
  };



  const handleCreateRule = async () => {
    if (!ruleKeyword.trim() || !ruleCategoryId) {
      toast.error("Preencha a palavra-chave e a categoria.");
      return;
    }
    try {
      await addRule.mutateAsync({
        keyword: ruleKeyword,
        category_id: ruleCategoryId,
        rule_type: ruleType,
        payment_method_id: rulePaymentMethodId || undefined
      });
      toast.success("Regra de automação criada!");
      setShowRuleForm(false);
    } catch {
      toast.error("Erro ao criar regra.");
    }
  };

  const walletName = (walletId: string | null) => {
    if (!walletId) return "Sem conta";
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
            <div className="flex flex-col items-end pr-1 justify-center mt-1">
              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider leading-none">Atualização</span>
              <span className="text-[10px] text-white/80 font-medium whitespace-nowrap leading-tight">
                {lastUpdateDate ? `há ${formatDistanceToNow(lastUpdateDate, { locale: ptBR })}` : '...'}
              </span>
            </div>

            <button
              onClick={async () => {
                if (!connections?.length || isManualSyncing) return;
                setIsManualSyncing(true);
                try {
                  toast.loading("Buscando novas transações...", { id: "sync-transactions" });
                  // Avoid Promise.all rejection short-circuiting everything by handling errors per-item
                  await Promise.all(connections.map(async (c) => {
                    try {
                      await forceSync.mutateAsync(c.pluggy_item_id);
                    } catch (e) {
                      console.error(`Erro ao sincronizar item ${c.pluggy_item_id}`, e);
                    }
                  }));
                  toast.success("Busca concluída!", { id: "sync-transactions" });
                } catch (e) {
                  toast.error("Processo finalizado com avisos", { id: "sync-transactions" });
                } finally {
                  setIsManualSyncing(false);
                }
              }}
              disabled={isManualSyncing}
              className={`w-10 h-10 rounded-2xl glass-card border flex items-center justify-center transition-all active:scale-90 disabled:opacity-50 ${isManualSyncing ? 'border-primary/50 bg-primary/10 text-primary' : 'border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/10'}`}
              title="Buscar novas transações"
            >
              {isManualSyncing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={18} />
              )}
            </button>

            <button
              onClick={() => setShowRulesPanel(!showRulesPanel)}
              className={`w-10 h-10 rounded-2xl glass-card flex items-center justify-center transition-all active:scale-90 ${showRulesPanel ? "bg-primary text-white border-primary shadow-lg glow-blue" : "text-muted-foreground hover:bg-white/5"}`}
              title="Regras de Automação"
            >
              <Wand2 size={20} />
            </button>
          </div>
        </header>


        {/* Rules Summary (Glassy Notification-like card) */}
        {showRulesPanel && (
          <div className="glass-card-elevated p-4 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles size={16} className="text-primary" />
                Regras de Automação
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowRuleForm(!showRuleForm);
                    if (!showRuleForm) {
                      setRuleKeyword("");
                      setRuleCategoryId("");
                    }
                  }}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${showRuleForm ? 'bg-primary text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                >
                  {showRuleForm ? <X size={14} /> : <Plus size={14} />}
                </button>
                <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">
                  {rules.length} Ativa{rules.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            {showRuleForm && (
              <div className="space-y-4 p-4 glass-inner rounded-2xl border-primary/20 animate-in zoom-in-95 duration-200">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground ml-1">Termo exato na descrição</span>
                  <input
                    type="text"
                    value={ruleKeyword}
                    onChange={(e) => setRuleKeyword(e.target.value)}
                    className="w-full glass-inner bg-black/20 rounded-xl px-4 py-3 text-xs font-mono text-primary placeholder:text-primary/20 focus:outline-none border-primary/20"
                    placeholder="Ex: Netflix"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground ml-1">Categoria</span>
                    <select
                      value={ruleCategoryId}
                      onChange={(e) => setRuleCategoryId(e.target.value)}
                      className="w-full appearance-none glass-inner bg-black/20 rounded-xl px-4 py-3 text-[10px] font-bold text-white/60 focus:outline-none border border-white/10"
                    >
                      <option value="">Categoria...</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.icon_emoji ? `${c.icon_emoji} ${c.name}` : c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground ml-1">Método</span>
                    <select
                      value={rulePaymentMethodId}
                      onChange={(e) => setRulePaymentMethodId(e.target.value)}
                      className="w-full appearance-none glass-inner bg-black/20 rounded-xl px-4 py-3 text-[10px] font-bold text-white/60 focus:outline-none border border-white/10"
                    >
                      <option value="">Padrão...</option>
                      {paymentMethods.map(pm => (
                        <option key={pm.id} value={pm.id}>{pm.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => setRuleType(ruleType === 'auto_approve' ? 'suggest' : 'auto_approve')}
                  className={`w-full py-3 rounded-xl border text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                    ruleType === 'auto_approve' 
                    ? 'bg-chart-green/20 border-chart-green text-chart-green' 
                    : 'bg-white/5 border-white/10 text-white/40'
                  }`}
                >
                  <ShieldCheck size={12} />
                  {ruleType === 'auto_approve' ? 'Consolidar Direto Ativado' : 'Apenas Preencher Dados'}
                </button>
                
                <button
                  onClick={handleCreateRule}
                  disabled={addRule.isPending}
                  className="w-full py-3 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                >
                  {addRule.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Salvar Fluxo Automático
                </button>
              </div>
            )}
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

        {/* Hierarchical Filter Bar */}
        <div className="space-y-4">
          {/* Level 1: Banks */}
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4 py-1">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${showFilters ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'glass-card text-muted-foreground'}`}
            >
              <Calendar size={14} />
              Período
            </button>
            
            <div className="h-4 w-[1px] bg-white/10 shrink-0" />
            
            <button
              onClick={() => {
                setActiveInstitution("all");
                setActiveWalletId("all");
              }}
              className={`px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${activeInstitution === "all" ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'glass-inner text-muted-foreground hover:bg-white/5'}`}
            >
              Todos os Bancos
            </button>
            
            {institutions.map((inst) => (
              <button
                key={inst}
                onClick={() => {
                  setActiveInstitution(inst);
                  setActiveWalletId("all");
                }}
                className={`px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 flex items-center gap-2 ${activeInstitution === inst && activeWalletId !== "__none__" ? 'bg-white text-black shadow-lg shadow-white/20' : 'glass-inner text-muted-foreground hover:bg-white/5'}`}
              >
                <Banknote size={14} />
                {inst}
              </button>
            ))}

            {hasUnlinked && (
              <button
                onClick={() => {
                  setActiveInstitution("all");
                  setActiveWalletId("__none__");
                }}
                className={`px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 flex items-center gap-2 ${activeWalletId === "__none__" ? 'bg-slate-700 text-white' : 'glass-inner text-muted-foreground hover:bg-white/5'}`}
              >
                <div className="w-2 h-2 rounded-full bg-slate-400" />
                Sem Banco
              </button>
            )}
          </div>

          {/* Level 2: Accounts within bank */}
          {activeInstitution !== "all" && activeWalletId !== "__none__" && (
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4 pb-1 animate-in fade-in slide-in-from-top-2">
              <button
                onClick={() => setActiveWalletId("all")}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all shrink-0 ${activeWalletId === "all" ? 'bg-chart-green text-white shadow-md' : 'bg-white/5 text-muted-foreground/60 hover:bg-white/10'}`}
              >
                Todas as Contas
              </button>
              {uniqueWallets.filter(w => (w.institution_name || 'Diversos') === activeInstitution).map(w => (
                <button
                  key={w.id}
                  onClick={() => setActiveWalletId(w.id)}
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-black tracking-tighter transition-all shrink-0 flex items-center gap-1.5 uppercase ${activeWalletId === w.id ? 'bg-chart-green text-white shadow-md' : 'bg-white/5 text-muted-foreground/60 hover:bg-white/10'}`}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: w.color }} />
                  {w.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date Filter Panel (Premium Period Selector) */}
        {showFilters && (
          <div className="glass-card p-2 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex gap-1">
              {[
                { id: "7d", label: "7 Dias" },
                { id: "30d", label: "30 Dias" },
                { id: "all", label: "Tudo" },
                { id: "custom", label: "Personalizado" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActivePeriod(p.id as any)}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                    activePeriod === p.id 
                      ? "bg-primary text-white shadow-md" 
                      : "bg-white/5 text-muted-foreground hover:bg-white/10"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {activePeriod === "custom" && (
              <div className="grid grid-cols-2 gap-2 p-2 animate-in zoom-in-95 duration-200">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-muted-foreground ml-1 uppercase">De</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full bg-black/40 rounded-xl px-3 py-2 text-[10px] text-white focus:outline-none border border-white/5 [color-scheme:dark]"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-muted-foreground ml-1 uppercase">Até</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full bg-black/40 rounded-xl px-3 py-2 text-[10px] text-white focus:outline-none border border-white/5 [color-scheme:dark]"
                  />
                </div>
              </div>
            )}
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
          <div className="space-y-8">
            {Object.entries(grouped).map(([label, groupItems]) => (
              <div key={label} className="space-y-4">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-1 opacity-70">
                  {label}
                </p>
                <div className="grid grid-cols-1 gap-4">
                  {groupItems.map((tx, idx) => {
                    const isSuccess = successId === tx.id;
                    const suggested = (isSuccess || tx.status === 'approved') ? tx.suggested_category_id : (findSuggestedCategory(tx.description) ?? tx.suggested_category_id);
                    const suggestedCat = getCategory(suggested);
                    const wColor = walletColor(tx.wallet_id);

                    if (isSuccess || tx.status === 'approved') {
                      const isPositive = tx.type === "income";
                      return (
                        <button
                          key={tx.id}
                          onClick={() => setSelectedApprovedTx(tx)}
                          style={{ animationDelay: `${idx * 40}ms`, position: 'relative' }}
                          className="w-full text-left flex items-center gap-4 p-4 rounded-2xl transition-all animate-in fade-in duration-500 bg-glass/40 border border-white/[0.03] hover:bg-white/5 hover:-translate-y-0.5"
                        >
                          {isSuccess && (
                            <div className="absolute inset-0 flex items-center justify-center z-10 animate-in fade-in duration-300 backdrop-blur-[2px] bg-chart-green/10 rounded-2xl">
                              <div className="w-10 h-10 rounded-full bg-chart-green flex items-center justify-center shadow-lg shadow-chart-green/40">
                                <Check size={20} className="text-white" />
                              </div>
                            </div>
                          )}
                          <div
                            className="w-11 h-11 rounded-xl bg-glass border flex items-center justify-center flex-shrink-0"
                            style={suggestedCat ? { borderColor: suggestedCat.color + "40", backgroundColor: suggestedCat.color + "10" } : { borderColor: 'rgba(255,255,255,0.05)' }}
                          >
                            {suggestedCat?.icon_emoji ? (
                              <span className="text-2xl">{suggestedCat.icon_emoji}</span>
                            ) : (
                              <Sparkles size={18} className="text-muted-foreground" strokeWidth={1.5} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate leading-tight mb-0.5">{tx.description}</p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded flex items-center gap-1 border border-white/5">
                                <Landmark size={10} className="text-primary/70" />
                                {wallets.find(w => w.id === tx.wallet_id)?.institution_name || 'Banco'}
                              </span>
                              <span className="text-white/20 text-[10px]">•</span>
                              <span className="text-[10px] font-bold text-muted-foreground truncate uppercase tracking-[0.05em]">
                                {walletName(tx.wallet_id)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-base font-black tabular-nums tracking-tight ${isPositive ? "text-chart-green" : "text-white"}`}>
                              {isPositive ? "+" : "-"}&nbsp;R${Number(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </button>
                      );
                    }

                    return (
                      <button
                        key={tx.id}
                        onClick={() => openDetail(tx)}
                        style={{ animationDelay: `${idx * 40}ms` }}
                        className={`group relative glass-card p-5 text-left transition-all hover:translate-y-[-2px] active:scale-[0.98] animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden 
                          ${tx.status === 'rejected' ? 'opacity-40' : 'hover:bg-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'}`}
                      >
                        {/* Subtle edge glow based on wallet */}
                        <div className={`absolute top-0 left-0 w-[2px] h-full ${tx.status === 'rejected' ? 'opacity-20' : 'opacity-40'}`} style={{ backgroundColor: tx.status === 'rejected' ? '#64748b' : wColor }} />
                        
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
                                <p className={`text-sm font-bold truncate leading-none ${tx.status === 'rejected' ? 'text-white/40 line-through' : 'text-white/90'}`}>
                                  {tx.description}
                                </p>
                                <span className={`text-base font-black tabular-nums shrink-0 ${tx.status === 'rejected' ? 'text-white/40 line-through' : tx.type === 'income' ? 'text-chart-green' : 'text-white'}`}>
                                  {tx.type === 'income' ? '+\u00a0' : '-\u00a0'}
                                  {Number(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                             </div>
                             
                             <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold text-muted-foreground/80 flex items-center gap-1 uppercase tracking-wider">
                                  {walletName(tx.wallet_id)}
                                </span>
                                <span className="text-white/10 text-[10px]">•</span>
                          <span className="text-[11px] font-medium text-muted-foreground truncate uppercase tracking-tight">
                            {walletName(tx.wallet_id)}
                          </span>

                          <div className="flex-1" />

                          {tx.payment_method_id && (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              <Zap size={10} />
                              <span className="text-[9px] font-bold uppercase">Auto-PIX</span>
                            </div>
                          )}
                          
                          {suggestedCat && (
                             <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition-all bg-primary/10 text-primary border border-primary/20`}>
                               {suggestedCat.icon_emoji ? (
                                 <span className="text-[12px]">{suggestedCat.icon_emoji}</span>
                               ) : (
                                 <Sparkles size={11} />
                               )}
                               <span className="text-[11px] font-bold uppercase tracking-tight">{suggestedCat.name}</span>
                             </div>
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

      <AddTransactionDrawer 
        open={addDrawerOpen} 
        onOpenChange={setAddDrawerOpen} 
        initialData={drawerData}
        onIgnore={(id) => {
          rejectTransaction.mutate(id);
          closeDetail();
        }}
        onDelete={(id) => {
          if (window.confirm("Deseja deletar permanentemente esta transação da lista?")) {
            deletePermanently.mutate(id);
            closeDetail();
          }
        }}
        onCreateRule={(desc, catId) => {
          closeDetail();
          setShowRulesPanel(true);
          setShowRuleForm(true);
          setRuleKeyword(desc);
          setRuleCategoryId(catId);
          // Scroll to top or ensure form is visible
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      <Drawer open={!!selectedApprovedTx} onOpenChange={(open) => !open && setSelectedApprovedTx(null)}>
        {selectedApprovedTx && (
          <DrawerContent className="bg-background border-t border-glass-border">
            <div className="mx-auto w-full max-w-sm px-4 pb-12">
              <DrawerHeader className="px-0 pb-6">
                <DrawerTitle className="text-foreground text-center">Detalhes da Transação</DrawerTitle>
              </DrawerHeader>
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-2 py-4">
                  <div 
                    className="w-16 h-16 rounded-[2rem] bg-glass border flex items-center justify-center mb-2"
                    style={{ borderColor: getCategory(selectedApprovedTx.suggested_category_id)?.color + "40", backgroundColor: getCategory(selectedApprovedTx.suggested_category_id)?.color + "10" }}
                  >
                    {getCategory(selectedApprovedTx.suggested_category_id)?.icon_emoji ? (
                      <span className="text-4xl">{getCategory(selectedApprovedTx.suggested_category_id)?.icon_emoji}</span>
                    ) : (
                      <Sparkles size={28} className="text-primary" />
                    )}
                  </div>
                  <span className={`text-3xl font-black tabular-nums ${selectedApprovedTx.type === 'income' ? 'text-chart-green' : 'text-white'}`}>
                    {selectedApprovedTx.type === 'income' ? '+' : '-'}R${Number(selectedApprovedTx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <p className="text-sm font-medium text-white/60">{selectedApprovedTx.description}</p>
                </div>

                <div className="space-y-3 px-2">
                  <div className="flex justify-between items-center py-3 border-b border-white/[0.03]">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Data</span>
                    <span className="text-sm font-semibold text-white/90">
                      {format(new Date(selectedApprovedTx.date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-3 border-b border-white/[0.03]">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Categoria</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white/90">{getCategory(selectedApprovedTx.suggested_category_id)?.name || "Sem categoria"}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-3 border-b border-white/[0.03]">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Origem</span>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary leading-none mb-1">
                        {connections?.find(c => c.pluggy_account_id === selectedApprovedTx.pluggy_account_id)?.institution_name?.toUpperCase() || "MANUAL"}
                      </p>
                      <p className="text-[10px] font-medium text-white/40 uppercase tracking-tighter">
                        {walletName(selectedApprovedTx.wallet_id)}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4">
                   <button
                     onClick={() => setSelectedApprovedTx(null)}
                     className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm transition-all active:scale-[0.98] hover:bg-white/10"
                   >
                     Entendido
                   </button>
                </div>
              </div>
            </div>
          </DrawerContent>
        )}
      </Drawer>

      <BottomNav />
    </div>
  );
};

export default TransactionLimbo;
