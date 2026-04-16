import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TransactionList from "@/components/TransactionList";
import BottomNav from "@/components/BottomNav";
import { useLanguage } from "@/i18n/LanguageContext";
import { useFilteredSum } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useWallets } from "@/hooks/useWallets";

import { Filter, Wallet, Tag, Calendar, ChevronDown } from "lucide-react";

const TransactionsPage = () => {
  const { t } = useLanguage();
  const { categories } = useCategories();
  const { wallets } = useWallets();
  const navigate = useNavigate();

  const [activePeriod, setActivePeriod] = useState<"7d" | "15d" | "30d" | "all" | "custom">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [type, setType] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [walletId, setWalletId] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const calculateDateFrom = () => {
    if (activePeriod === "all") return undefined;
    if (activePeriod === "custom") return dateFrom || undefined;
    const d = new Date();
    if (activePeriod === "7d") d.setDate(d.getDate() - 7);
    else if (activePeriod === "15d") d.setDate(d.getDate() - 15);
    else if (activePeriod === "30d") d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  };

  const filters = {
    dateFrom: calculateDateFrom(),
    dateTo: activePeriod === "custom" ? (dateTo || undefined) : undefined,
    type: type !== "all" ? type : undefined,
    categoryId: categoryId !== "all" ? categoryId : undefined,
    walletId: walletId !== "all" ? walletId : undefined,
  };

  const { data: sumData, isLoading: isSumLoading } = useFilteredSum(filters);

  return (
    <div className="min-h-screen bg-background p-4 pb-28">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between py-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">{t("nav.activity")}</h1>
            <p className="text-xs text-muted-foreground">{t("tx.allTransactions")}</p>
          </div>
          <button
            onClick={() => navigate("/limbo")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass-card text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            Consolidar
          </button>
        </div>

        {/* Filters */}
        <div className="flex overflow-x-auto hide-scrollbar gap-3 pb-2 -mx-4 px-4 text-sm z-10 relative">
          
          {/* Period Toggle */}
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-bold uppercase tracking-wider transition-all shrink-0 ${showFilters ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-glass text-muted-foreground border border-white/[0.06]'}`}
          >
            <Calendar size={14} />
            Periodo
            <ChevronDown size={14} className={`transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          <div className="h-5 w-[1px] bg-white/10 shrink-0 self-center" />

          {/* Type Filter */}
          <div className="relative group shrink-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter size={14} className="text-muted-foreground group-focus-within:text-primary transition-colors" />
            </div>
            <select
              className="appearance-none bg-glass hover:bg-white/5 text-foreground rounded-2xl pl-9 pr-8 py-2.5 text-xs font-medium border border-white/[0.06] focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="all" className="bg-background text-foreground text-sm">Todos Tipos</option>
              <option value="income" className="bg-background text-foreground text-sm">Receitas</option>
              <option value="expense" className="bg-background text-foreground text-sm">Despesas</option>
            </select>
          </div>

          {/* Wallet Filter */}
          <div className="relative group shrink-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Wallet size={14} className="text-muted-foreground group-focus-within:text-primary transition-colors" />
            </div>
            <select
              className="appearance-none bg-glass hover:bg-white/5 text-foreground rounded-2xl pl-9 pr-8 py-2.5 text-xs font-medium border border-white/[0.06] focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer max-w-[150px] truncate"
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
            >
              <option value="all" className="bg-background text-foreground text-sm">Contas</option>
              {wallets.map(w => (
                <option key={w.id} value={w.id} className="bg-background text-foreground text-sm">
                  {w.institution_name ? `${w.institution_name} • ` : ''}{w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="relative group shrink-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Tag size={14} className="text-muted-foreground group-focus-within:text-primary transition-colors" />
            </div>
            <select
              className="appearance-none bg-glass hover:bg-white/5 text-foreground rounded-2xl pl-9 pr-8 py-2.5 text-xs font-medium border border-white/[0.06] focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer max-w-[150px] truncate"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="all" className="bg-background text-foreground text-sm">Categorias</option>
              {categories.map(c => <option key={c.id} value={c.id} className="bg-background text-foreground text-sm">{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* Premium Period Selector Panel */}
        {showFilters && (
          <div className="glass-card p-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex gap-1">
              {[
                { id: "7d", label: "7 Dias" },
                { id: "15d", label: "15 Dias" },
                { id: "30d", label: "30 Dias" },
                { id: "all", label: "Tudo" },
                { id: "custom", label: "Esp." },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActivePeriod(p.id as any)}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all animate-in zoom-in-95 ${
                    activePeriod === p.id 
                      ? "bg-primary text-white shadow-lg glow-blue" 
                      : "bg-white/5 text-muted-foreground hover:bg-white/10"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {activePeriod === "custom" && (
              <div className="grid grid-cols-2 gap-3 p-2 bg-black/20 rounded-2xl animate-in slide-in-from-bottom-2 duration-200">
                <div className="space-y-1.5 text-center">
                  <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Início</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-[11px] text-white focus:outline-none [color-scheme:dark]"
                  />
                </div>
                <div className="space-y-1.5 text-center">
                  <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Término</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-[11px] text-white focus:outline-none [color-scheme:dark]"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Summary Card */}
        <div className="glass-card p-4 flex justify-between items-center !my-6">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Filtrado</p>
            {isSumLoading ? (
              <div className="h-6 w-24 bg-glass-inner animate-pulse rounded mt-1" />
            ) : (
              <p className={`text-lg font-bold ${sumData && sumData.balance >= 0 ? 'text-chart-green' : 'text-foreground'}`}>
                R$ {sumData ? sumData.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0,00"}
              </p>
            )}
          </div>
          {sumData && !isSumLoading && (
            <div className="text-right text-xs">
              <p className="text-chart-green font-medium">+ R$ {sumData.income.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <p className="text-foreground font-medium">- R$ {sumData.expenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
          )}
        </div>

        <TransactionList externalFilters={filters} />
      </div>
      <BottomNav />
    </div>
  );
};

export default TransactionsPage;
