import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStagedTransactions } from "@/hooks/useStagedTransactions";
import { useAutomationRules } from "@/hooks/useAutomationRules";
import { useCategories } from "@/hooks/useCategories";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useWallets } from "@/hooks/useWallets";
import { useBanks } from "@/hooks/useBanks";
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
  Banknote,
  Landmark,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import AddTransactionDrawer from "@/components/AddTransactionDrawer";

const TransactionLimbo = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    stagedTransactions,
    isLoading: isStagedLoading,
    approveTransaction,
    rejectTransaction,
    deletePermanently,
    syncNew
  } = useStagedTransactions();
  const { findSuggestedCategory } = useAutomationRules();
  const { categories } = useCategories();
  const { wallets } = useWallets();
  const { banks } = useBanks();
  const { paymentMethods } = usePaymentMethods();

  const isLoading = isStagedLoading;

  // Fetch connections to map account names/institutions for "Origem Imutável"
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

  const lastUpdateDate = useMemo(() => {
    if (!connections || connections.length === 0) return null;
    const dates = connections.map(c => new Date(c.updated_at || c.created_at || 0).getTime());
    return new Date(Math.max(...dates));
  }, [connections]);

  // Filters
  const [activePeriod, setActivePeriod] = useState<"7d" | "15d" | "30d" | "all" | "custom">("15d");
  const [activeBankId, setActiveBankId] = useState<string>("all");
  const [activeWalletId, setActiveWalletId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Selected transaction for action drawer
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [drawerData, setDrawerData] = useState<any>(null);

  // Detail view for approved
  const [selectedApprovedTx, setSelectedApprovedTx] = useState<any | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  // Grouped Banks present in staged
  const activeBanks = useMemo(() => {
    const bankIds = new Set(wallets.filter(w => stagedTransactions.some(t => t.wallet_id === w.id)).map(w => w.bank_id).filter(Boolean));
    return banks.filter(b => bankIds.has(b.id));
  }, [stagedTransactions, wallets, banks]);

  const hasUnlinked = useMemo(
    () => stagedTransactions.some((t) => !t.wallet_id),
    [stagedTransactions]
  );

  // Filtered list 
  const filtered = useMemo(() => {
    let list = stagedTransactions;

    // Bank filter
    if (activeBankId !== "all" && activeBankId !== "__none__") {
      list = list.filter(t => {
        const w = wallets.find(w => w.id === t.wallet_id);
        return w?.bank_id === activeBankId;
      });
    }

    // specific wallet/account filter
    if (activeWalletId === "__none__" || activeBankId === "__none__") {
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
  }, [stagedTransactions, wallets, activeBankId, activeWalletId, activePeriod, dateFrom, dateTo]);

  // Grouped transactions by date
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
    if (tx.status === 'approved') {
      setSelectedApprovedTx(tx);
      return;
    }

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

  const walletName = (walletId: string | null) => {
    if (!walletId) return "Sem conta";
    return wallets.find((w) => w.id === walletId)?.name ?? "Conta";
  };

  const getCategory = (catId: string | null) => {
    if (!catId) return null;
    return categories.find((c) => c.id === catId) ?? null;
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20 z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-chart-purple/10 blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 p-4 pb-28 max-w-md mx-auto space-y-5">
        <header className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/transactions")}
              className="w-10 h-10 rounded-2xl glass-card flex items-center justify-center hover:bg-glass-border/20 transition-all active:scale-90 shadow-xl"
            >
              <ArrowLeft size={18} className="text-foreground/80" />
            </button>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white leading-tight">Consolidar</h1>
              <p className="text-[9px] font-bold text-primary uppercase tracking-[0.2em] opacity-40">
                Gestão de Fluxos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end pr-2 justify-center">
              <span className="text-[7px] text-muted-foreground uppercase font-black tracking-[0.2em] leading-none mb-1">Último Sync</span>
              <span className="text-[10px] text-white/50 font-black whitespace-nowrap leading-tight">
                {lastUpdateDate ? formatDistanceToNow(lastUpdateDate, { locale: ptBR, addSuffix: true }) : '...'}
              </span>
            </div>

            <button
              onClick={async () => {
                if (!connections?.length || isManualSyncing) return;
                setIsManualSyncing(true);
                try {
                  toast.loading("Buscando novas transações...", { id: "sync-transactions" });
                  await Promise.all(connections.map(async (c) => {
                    try {
                      await syncNew.mutateAsync(c.pluggy_item_id);
                    } catch (e) {
                      console.error(`Erro ao sincronizar item ${c.pluggy_item_id}`, e);
                    }
                  }));
                  toast.success("Busca concluída!", { id: "sync-transactions" });
                } catch (e) {
                  toast.error("Erro na sincronização", { id: "sync-transactions" });
                } finally {
                  setIsManualSyncing(false);
                }
              }}
              disabled={isManualSyncing}
              className={`w-11 h-11 rounded-2xl glass-card-elevated flex items-center justify-center transition-all active:scale-90 disabled:opacity-50 ${isManualSyncing ? 'text-primary' : 'text-primary/60 hover:text-primary hover:bg-primary/10 shadow-lg'}`}
            >
              {isManualSyncing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <RefreshCw size={18} strokeWidth={3} />
              )}
            </button>
          </div>
        </header>

        {/* Hierarchical Filters */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4 py-1">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shrink-0 ${showFilters ? 'bg-primary text-white shadow-[0_4px_15px_rgba(59,130,246,0.3)]' : 'glass-card border-none text-muted-foreground'}`}
            >
              <Calendar size={13} strokeWidth={3} />
              Calendário
            </button>

            <div className="h-4 w-[1px] bg-white/10 shrink-0 mx-1" />

            <button
              onClick={() => {
                setActiveBankId("all");
                setActiveWalletId("all");
              }}
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shrink-0 ${activeBankId === "all" ? 'bg-white text-black shadow-xl' : 'glass-inner text-muted-foreground hover:bg-white/5'}`}
            >
              Todos
            </button>

            {activeBanks.map((bank) => (
              <button
                key={bank.id}
                onClick={() => {
                  setActiveBankId(bank.id);
                  setActiveWalletId("all");
                }}
                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shrink-0 flex items-center gap-2.5 ${activeBankId === bank.id ? 'bg-white text-black shadow-xl' : 'glass-inner text-muted-foreground hover:bg-white/5'}`}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: bank.color, boxShadow: `0 0 8px ${bank.color}` }} />
                {bank.name}
              </button>
            ))}

            {hasUnlinked && (
              <button
                onClick={() => {
                  setActiveBankId("__none__");
                  setActiveWalletId("__none__");
                }}
                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shrink-0 flex items-center gap-2 ${activeBankId === "__none__" ? 'bg-slate-700 text-white' : 'glass-inner text-muted-foreground hover:bg-white/5'}`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                Avulsos
              </button>
            )}
          </div>

          {/* Wallet sub-filters */}
          {activeBankId !== "all" && activeBankId !== "__none__" && (
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4 pb-2 animate-in fade-in slide-in-from-top-2 duration-400">
              <button
                onClick={() => setActiveWalletId("all")}
                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shrink-0 ${activeWalletId === "all" ? 'bg-primary/20 text-primary border border-primary/40' : 'bg-white/5 text-muted-foreground/40 border border-transparent'}`}
              >
                Contas ({wallets.filter(w => w.bank_id === activeBankId).length})
              </button>
              {wallets.filter(w => w.bank_id === activeBankId).map(w => (
                <button
                  key={w.id}
                  onClick={() => setActiveWalletId(w.id)}
                  className={`px-4 py-2 rounded-lg text-[9px] font-black tracking-widest transition-all shrink-0 flex items-center gap-2 uppercase ${activeWalletId === w.id ? 'bg-primary/20 text-primary border border-primary/40' : 'bg-white/5 text-muted-foreground/40 border border-transparent'}`}
                >
                  {w.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {showFilters && (
          <div className="glass-card-elevated p-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300 border-none">
            <div className="flex gap-2">
              {[
                { id: "7d", label: "7D" },
                { id: "15d", label: "15D" },
                { id: "30d", label: "30D" },
                { id: "all", label: "TUDO" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActivePeriod(p.id as any)}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activePeriod === p.id
                      ? "bg-primary text-white shadow-lg"
                      : "bg-white/5 text-muted-foreground"
                    }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => setActivePeriod("custom")}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${activePeriod === 'custom' ? 'bg-primary text-white shadow-lg' : 'bg-white/5 text-muted-foreground'}`}
              >
                FLEX
              </button>
            </div>

            {activePeriod === "custom" && (
              <div className="flex gap-2 p-1 animate-in zoom-in-95 duration-400">
                <div className="flex-1 space-y-1.5">
                  <span className="text-[8px] font-black text-white/30 ml-2 uppercase tracking-widest">Início</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full h-12 glass-inner rounded-[1rem] px-4 text-[10px] font-black text-white focus:outline-none border-none [color-scheme:dark]"
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <span className="text-[8px] font-black text-white/30 ml-2 uppercase tracking-widest">Fim</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full h-12 glass-inner rounded-[1rem] px-4 text-[10px] font-black text-white focus:outline-none border-none [color-scheme:dark]"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <div className="relative">
              <Loader2 size={40} className="animate-spin text-primary opacity-30" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap size={16} className="text-primary" />
              </div>
            </div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Mapeando Fluxos...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-6 animate-in fade-in duration-700">
            <div className="w-24 h-24 rounded-[3rem] glass-card-elevated flex items-center justify-center border-none shadow-2xl relative">
              <div className="absolute inset-0 bg-primary/5 rounded-[3rem] blur-xl" />
              <Inbox size={32} strokeWidth={1} className="text-white/10" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-black text-white tracking-tight">Tudo em Ordem</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest max-w-[200px] leading-relaxed opacity-60">
                Seu limbo financeiro está perfeitamente sincronizado.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-8 px-1">
            {Object.entries(grouped).map(([label, groupItems]) => (
              <div key={label} className="space-y-4">
                <div className="flex items-center gap-3 px-3">
                  <div className="w-1 h-3 rounded-full bg-primary" />
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">
                    {label}
                  </p>
                </div>
                <div className="space-y-3">
                  {groupItems.map((tx, idx) => {
                    const isPositive = tx.type === "income";
                    const suggested = findSuggestedCategory(tx.description) ?? tx.suggested_category_id;
                    const suggestedCat = getCategory(suggested);
                    const isApproved = tx.status === 'approved';
                    const wallet = wallets.find(w => w.id === tx.wallet_id);
                    const bank = banks.find(b => b.id === wallet?.bank_id);

                    return (
                      <button
                        key={tx.id}
                        onClick={() => openDetail(tx)}
                        style={{ animationDelay: `${idx * 40}ms` }}
                        className={`w-full text-left flex items-center gap-4 p-4 rounded-[1.75rem] transition-all hover:bg-white/[0.03] animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both relative group shadow-lg
                          ${isApproved ? 'bg-primary/5 border border-primary/10' : 'glass-card border-none'}`}
                      >
                        <div
                          className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center flex-shrink-0 relative transition-transform group-hover:scale-110"
                          style={suggestedCat ? { borderColor: suggestedCat.color + "40", backgroundColor: suggestedCat.color + "08" } : {}}
                        >
                          {suggestedCat?.icon_emoji ? (
                            <span className="text-2xl">{suggestedCat.icon_emoji}</span>
                          ) : (
                            <Wallet size={20} className="text-muted-foreground/40" />
                          )}
                          {isApproved && (
                            <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] flex items-center justify-center border-2 border-[#0A0A0A] z-20 animate-in zoom-in duration-300">
                              <Check size={12} strokeWidth={4} className="text-white" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate leading-tight mb-0.5 tracking-tight">
                            {tx.description}
                          </p>
                          <div className="flex items-center gap-2 truncate">
                            {suggestedCat && (
                              <>
                                <span className="text-[8px] font-bold text-primary uppercase tracking-widest">{suggestedCat.name}</span>
                                <span className="text-white/10 text-[8px]">•</span>
                              </>
                            )}
                            <div className="flex items-center gap-1.5 truncate">
                              <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-tight truncate max-w-[80px]">
                                {bank?.name || 'Manual'}
                              </p>
                              <p className="text-[8px] font-medium text-white/30 uppercase truncate italic">
                                {wallet?.name ?? ''}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-bold tabular-nums tracking-tighter ${isPositive ? "text-chart-green" : "text-white"}`}>
                            {isPositive ? "+" : ""}R$ {Number(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
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
          if (window.confirm("Apagar permanentemente esta transação do servidor?")) {
            deletePermanently.mutate(id);
            closeDetail();
          }
        }}
      />

      <Drawer open={!!selectedApprovedTx} onOpenChange={(open) => !open && setSelectedApprovedTx(null)}>
        {selectedApprovedTx && (
          <DrawerContent className="bg-background border-t border-glass-border">
            <div className="mx-auto w-full max-w-sm px-6 pb-14">
              <div className="w-12 h-1.5 rounded-full bg-white/10 mx-auto mt-4 mb-8" />

              <DrawerHeader className="px-0 pb-10 text-center">
                <DrawerTitle className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-8">Origem Certificada</DrawerTitle>

                <div className="flex flex-col items-center gap-4">
                  <div
                    className="w-24 h-24 rounded-[3rem] bg-glass border-2 flex items-center justify-center mb-2 shadow-2xl relative overflow-hidden"
                    style={{ borderColor: getCategory(selectedApprovedTx.suggested_category_id)?.color + "40" }}
                  >
                    <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundColor: getCategory(selectedApprovedTx.suggested_category_id)?.color }} />
                    {getCategory(selectedApprovedTx.suggested_category_id)?.icon_emoji ? (
                      <span className="text-5xl">{getCategory(selectedApprovedTx.suggested_category_id)?.icon_emoji}</span>
                    ) : (
                      <Check size={40} strokeWidth={3} className="text-primary" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-4xl font-black text-white tabular-nums tracking-tighter">
                      R$ {Number(selectedApprovedTx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm font-bold text-white/40 tracking-tight">{selectedApprovedTx.description}</p>
                  </div>
                </div>
              </DrawerHeader>

              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex justify-between items-center p-5 glass-inner rounded-3xl border-none">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Data Fluxo</span>
                    <span className="text-xs font-black text-white">
                      {format(new Date(selectedApprovedTx.date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-5 glass-inner rounded-3xl border-none">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Categoria</span>
                    <div className="flex items-center gap-2 bg-white/5 py-1.5 px-4 rounded-xl">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getCategory(selectedApprovedTx.suggested_category_id)?.color }} />
                      <span className="text-[10px] font-black text-white uppercase tracking-tighter">{getCategory(selectedApprovedTx.suggested_category_id)?.name || "Geral"}</span>
                    </div>
                  </div>

                  <div className="p-6 glass-card-elevated rounded-3xl border-none relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Rastro do Banco</span>
                      <Landmark size={14} className="text-primary opacity-40" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xl font-black text-white tracking-tighter uppercase">
                        {connections?.find(c => c.pluggy_account_id === selectedApprovedTx.pluggy_account_id)?.institution_name || "CONEXÃO DIRETA"}
                      </p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                        CONTA • {walletName(selectedApprovedTx.wallet_id)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-5 flex gap-4 items-center">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Zap size={18} fill="currentColor" />
                  </div>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">
                    Importação verificada via Smart Sync. Os dados de origem são protegidos e <span className="text-primary">imutáveis</span>.
                  </p>
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
