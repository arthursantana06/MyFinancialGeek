import { useState, useEffect } from "react";
import { ShoppingBag, Coffee, Car, Zap, Circle } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { useLanguage } from "@/i18n/LanguageContext";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { toast } from "sonner";
import EditTransactionDrawer from "./EditTransactionDrawer";

const iconMap: Record<string, any> = {
  "shopping-bag": ShoppingBag,
  coffee: Coffee,
  car: Car,
  zap: Zap,
};

export default function TransactionList({ externalFilters, pageSize = 15 }: { externalFilters?: any, pageSize?: number }) {
  const [page, setPage] = useState(1);

  // Reset page back to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [JSON.stringify(externalFilters)]);

  const { grouped, totalCount, isLoading, deleteTransaction } = useTransactions(externalFilters, page, pageSize);
  const { t, language } = useLanguage();

  const groupEntries = Object.entries(grouped);
  const hasMore = page * pageSize < totalCount;

  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [editingTx, setEditingTx] = useState<any | null>(null);

  const handleDelete = async () => {
    if (!selectedTx) return;
    try {
      await deleteTransaction.mutateAsync(selectedTx.id);
      toast.success(t("common.delete") + " realizado");
      setSelectedTx(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">{t("dashboard.recentTransactions")}</h3>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-2xl bg-glass animate-pulse" />
          ))}
        </div>
      ) : groupEntries.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">{t("dashboard.noTransactions")}</p>
      ) : (
        <div className="space-y-4">
          {groupEntries.map(([label, txs]) => (
            <div key={label} className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-3">{label}</p>
              {(txs as any[])!.map((tx) => {
                const isPositive = tx.type === "income";
                const IconComp = (tx.categories && iconMap[tx.categories.icon]) || Circle;
                return (
                  <button
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
                    className="w-full text-left flex items-center gap-3 p-3 rounded-2xl transition-colors hover:bg-glass"
                  >
                    <div
                      className="w-10 h-10 rounded-xl bg-glass border border-glass flex items-center justify-center flex-shrink-0"
                      style={tx.categories ? { borderColor: tx.categories.color + "30" } : {}}
                    >
                      {tx.categories?.icon_emoji ? (
                        <span className="text-xl">{tx.categories.icon_emoji}</span>
                      ) : (
                        <IconComp size={18} className="text-muted-foreground" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{tx.categories?.name || (tx.payment_methods as any)?.name || tx.wallets?.name}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-semibold ${isPositive ? "text-chart-green" : "text-foreground"}`}>
                        {isPositive ? "+" : "-"}R${Number(tx.amount).toFixed(2)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}

          {/* Pagination Controls */}
          {totalCount > 0 && (
            <div className="flex justify-between items-center pt-6 mt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
                className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-glass-inner disabled:opacity-50 text-foreground transition-all active:scale-95"
              >
                Página Anterior
              </button>
              <span className="text-xs text-muted-foreground font-medium">Página {page}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={!hasMore || isLoading}
                className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-glass-inner disabled:opacity-50 text-foreground transition-all active:scale-95"
              >
                Próxima ({Math.max(0, totalCount - page * pageSize)})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Transaction Detail Drawer */}
      <Drawer open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
        {selectedTx && (
          <DrawerContent className="bg-background border-t border-glass-border">
            <div className="mx-auto w-full max-w-sm px-4 pb-8">
              <DrawerHeader className="px-0">
                <DrawerTitle className="text-foreground">Detalhes da Transação</DrawerTitle>
              </DrawerHeader>
              <div className="space-y-4 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t("tx.amount")}</span>
                  <span className={`text-xl font-bold ${selectedTx.type === 'income' ? 'text-chart-green' : 'text-foreground'}`}>
                    {selectedTx.type === 'income' ? '+' : '-'}R${Number(selectedTx.amount).toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t("tx.description")}</span>
                  <span className="text-sm font-medium text-foreground truncate max-w-[200px] text-right">{selectedTx.description}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t("tx.date")}</span>
                  <span className="text-sm font-medium text-foreground">
                    {format(new Date(selectedTx.date), "dd 'de' MMMM, yyyy", { locale: language === "pt-BR" ? ptBR : enUS })}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t("tx.category")}</span>
                  <div className="flex items-center gap-2">
                    {selectedTx.categories?.icon_emoji && <span>{selectedTx.categories.icon_emoji}</span>}
                    <span className="text-sm font-medium text-foreground">{selectedTx.categories?.name || "-"}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t("tx.paymentMethod")}</span>
                  <span className="text-sm font-medium text-foreground">{(selectedTx.payment_methods as any)?.name || selectedTx.wallets?.name || selectedTx.payment_method || "-"}</span>
                </div>

                <div className="pt-6 flex gap-3">
                  <button
                    onClick={() => { setEditingTx(selectedTx); setSelectedTx(null); }}
                    className="flex-1 py-3 rounded-xl bg-primary/10 text-primary font-semibold text-sm transition-all active:scale-[0.98]"
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleteTransaction.isPending}
                    className="flex-1 py-3 rounded-xl bg-destructive/10 text-destructive font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {deleteTransaction.isPending ? t("auth.loading") : t("common.delete")}
                  </button>
                </div>
              </div>
            </div>
          </DrawerContent>
        )}
      </Drawer>

      <EditTransactionDrawer
        open={!!editingTx}
        onOpenChange={(op) => !op && setEditingTx(null)}
        transaction={editingTx}
      />
    </div>
  );
};
