import { useState } from "react";
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

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [type, setType] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [walletId, setWalletId] = useState("all");

  const filters = {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    type: type !== "all" ? type : undefined,
    categoryId: categoryId !== "all" ? categoryId : undefined,
    walletId: walletId !== "all" ? walletId : undefined,
  };

  const { data: sumData, isLoading: isSumLoading } = useFilteredSum(filters);

  return (
    <div className="min-h-screen bg-background p-4 pb-28">
      <div className="max-w-md mx-auto space-y-4">
        <div className="py-4">
          <h1 className="text-xl font-bold text-foreground">{t("nav.activity")}</h1>
          <p className="text-xs text-muted-foreground">{t("tx.allTransactions")}</p>
        </div>

        {/* Filters */}
        <div className="flex overflow-x-auto hide-scrollbar gap-3 pb-2 -mx-4 px-4 text-sm z-10 relative">

          {/* Type Filter */}
          <div className="relative group shrink-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter size={14} className="text-muted-foreground group-focus-within:text-primary transition-colors" />
            </div>
            <select
              className="appearance-none bg-glass hover:bg-white/5 text-foreground rounded-2xl pl-9 pr-8 py-2.5 text-xs font-medium border border-glass-border/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="all" className="bg-background text-foreground">Tipo (Todos)</option>
              <option value="income" className="bg-background text-foreground">Receitas</option>
              <option value="expense" className="bg-background text-foreground">Despesas</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <ChevronDown size={14} className="text-muted-foreground/50 transition-colors" />
            </div>
          </div>

          {/* Wallet Filter */}
          <div className="relative group shrink-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Wallet size={14} className="text-muted-foreground group-focus-within:text-primary transition-colors" />
            </div>
            <select
              className="appearance-none bg-glass hover:bg-white/5 text-foreground rounded-2xl pl-9 pr-8 py-2.5 text-xs font-medium border border-glass-border/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer max-w-[150px] truncate"
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
            >
              <option value="all" className="bg-background text-foreground">Conta (Todas)</option>
              {wallets.map(w => <option key={w.id} value={w.id} className="bg-background text-foreground">{w.name}</option>)}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <ChevronDown size={14} className="text-muted-foreground/50 transition-colors" />
            </div>
          </div>

          {/* Category Filter */}
          <div className="relative group shrink-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Tag size={14} className="text-muted-foreground group-focus-within:text-primary transition-colors" />
            </div>
            <select
              className="appearance-none bg-glass hover:bg-white/5 text-foreground rounded-2xl pl-9 pr-8 py-2.5 text-xs font-medium border border-glass-border/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer max-w-[150px] truncate"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="all" className="bg-background text-foreground">Cat. (Todas)</option>
              {categories.map(c => <option key={c.id} value={c.id} className="bg-background text-foreground">{c.name}</option>)}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <ChevronDown size={14} className="text-muted-foreground/50 transition-colors" />
            </div>
          </div>

          {/* Date From Filter */}
          <div className="relative group shrink-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar size={14} className="text-muted-foreground group-focus-within:text-primary transition-colors" />
            </div>
            <input
              type="date"
              className="appearance-none bg-glass hover:bg-white/5 text-foreground rounded-2xl pl-9 pr-4 py-2.5 text-xs font-medium border border-glass-border/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="Data Inicial"
            />
          </div>

          {/* Date To Filter */}
          <div className="relative group shrink-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar size={14} className="text-muted-foreground group-focus-within:text-primary transition-colors" />
            </div>
            <input
              type="date"
              className="appearance-none bg-glass hover:bg-white/5 text-foreground rounded-2xl pl-9 pr-4 py-2.5 text-xs font-medium border border-glass-border/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="Data Final"
            />
          </div>

        </div>

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
