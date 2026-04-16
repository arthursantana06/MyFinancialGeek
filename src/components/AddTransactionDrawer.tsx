import { useState, useEffect, useMemo } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useTransactions } from "@/hooks/useTransactions";
import { useWallets } from "@/hooks/useWallets";
import { useCategories } from "@/hooks/useCategories";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAutomationRules } from "@/hooks/useAutomationRules";
import { Sparkles, Trash2, XCircle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type TxType = Database["public"]["Enums"]["transaction_type"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    amount: string;
    description: string;
    date: string;
    type: TxType;
    walletId?: string;
    categoryId?: string;
    paymentMethodId?: string;
    stagedId?: string;
  };
  onIgnore?: (stagedId: string) => void;
  onDelete?: (stagedId: string) => void;
  onCreateRule?: (description: string, categoryId: string) => void;
}

const AddTransactionDrawer = ({ 
  open, 
  onOpenChange, 
  initialData,
  onIgnore,
  onDelete,
  onCreateRule
}: Props) => {
  const { addTransaction } = useTransactions();
  const { wallets } = useWallets();
  const { categories } = useCategories();
  const { paymentMethods } = usePaymentMethods();
  const { addRule } = useAutomationRules();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const creditCards = wallets.filter(w => w.type === "credit_card");
  const regularWallets = wallets.filter(w => w.type !== "credit_card");

  const [type, setType] = useState<TxType>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [selectedWalletId, setSelectedWalletId] = useState<string>("");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>("");

  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [date, setDate] = useState<string>(getLocalDateString());

  // Populate from initialData
  useState(() => {
    if (initialData) {
      setType(initialData.type || "expense");
      setAmount(initialData.amount || "");
      setDescription(initialData.description || "");
      setCategoryId(initialData.categoryId || "");
      setSelectedWalletId(initialData.walletId || "");
      setSelectedPaymentMethodId(initialData.paymentMethodId || "");
      if (initialData.date) {
        setDate(initialData.date.split("T")[0]);
      }
    }
  });

  // Also update when initialData specifically changes if the drawer is already open
  useEffect(() => {
    if (initialData && open) {
      setType(initialData.type || "expense");
      setAmount(initialData.amount || "");
      setDescription(initialData.description || "");
      setCategoryId(initialData.categoryId || "");
      setSelectedWalletId(initialData.walletId || "");
      setSelectedPaymentMethodId(initialData.paymentMethodId || "");
      if (initialData.date) {
        setDate(initialData.date.split("T")[0]);
      }
    }
  }, [initialData, open]);

  // Force expense type for Credit Cards
  useEffect(() => {
    const wallet = wallets.find(w => w.id === selectedWalletId);
    if (wallet?.type === "credit_card") {
      setType("expense");
    }
  }, [selectedWalletId, wallets]);

  const isCreditCard = useMemo(() => {
    const wallet = wallets.find(w => w.id === selectedWalletId);
    return wallet?.type === "credit_card";
  }, [selectedWalletId, wallets]);

  const handleSubmit = async () => {
    if (!amount || !description || !selectedWalletId) {
      toast.error(t("tx.fillRequired"));
      return;
    }

    // Fix timezone shift by creating date at local noon
    const [year, month, day] = date.split('-').map(Number);
    const safeDate = new Date(year, month - 1, day, 12, 0, 0);

    try {
      await addTransaction.mutateAsync({
        amount: parseFloat(amount.replace(",", ".")),
        type,
        description,
        wallet_id: selectedWalletId,
        category_id: categoryId || undefined,
        payment_method_id: selectedPaymentMethodId || null,
        status: "paid",
        date: safeDate.toISOString(),
      });

      // Cleanup staged transaction if applicable
      if (initialData?.stagedId) {
        const { supabase } = await import("@/integrations/supabase/client");
        await supabase.from("staged_transactions").delete().eq("id", initialData.stagedId);
        queryClient.invalidateQueries({ queryKey: ["staged_transactions"] });
      }

      toast.success(t("tx.added"));
      onOpenChange(false);
      
      // Reset after success
      if (!initialData) {
        setAmount("");
        setDescription("");
        setSelectedWalletId("");
        setSelectedPaymentMethodId("");
        setCategoryId("");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-background border-t border-glass-border">
        <div className="mx-auto w-full max-w-sm px-4 pb-8">
          <DrawerHeader className="px-0">
            <DrawerTitle className="text-foreground">{t("tx.addTransaction")}</DrawerTitle>
          </DrawerHeader>

          <div className="space-y-4">
            {/* Type toggle */}
            <div className="flex gap-1 p-1 rounded-full glass-card">
              {(["expense", "income"] as TxType[]).map((tp) => (
                <button
                  key={tp}
                  onClick={() => !isCreditCard && setType(tp)}
                  className={`flex-1 py-2 rounded-full text-xs font-medium transition-all ${type === tp ? "pill-active" : "pill-inactive"
                    } ${isCreditCard && tp === "income" ? "opacity-30 grayscale cursor-not-allowed" : ""}`}
                  disabled={isCreditCard && tp === "income"}
                >
                  {tp === "income" ? t("tx.income") : t("tx.expense")}
                </button>
              ))}
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{t("tx.amount")}</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="w-full glass-inner rounded-xl px-4 py-3 text-2xl font-bold text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all text-center"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{t("tx.description")}</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("tx.whatFor")}
                className="w-full glass-inner rounded-xl px-4 py-3 text-base md:text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all"
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{t("tx.date")}</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full glass-inner rounded-xl px-4 py-3 text-base md:text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all appearance-none"
              />
            </div>

            {/* Category */}
            {categories.filter((c) => c.type === type).length > 0 && (
              <div className="space-y-1.5 overflow-hidden">
                <label className="text-xs text-muted-foreground">{t("tx.category")}</label>
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                  {categories.filter((c) => c.type === type).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCategoryId(c.id)}
                      className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${categoryId === c.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-glass border-glass-border text-muted-foreground hover:text-foreground hover:border-glass-border/80"
                        }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>


              </div>
            )}

            {/* Wallet Selection */}
            <div className="space-y-1.5 mt-4">
              <label className="text-xs text-muted-foreground">Onde?</label>
              <div className="flex gap-1 flex-wrap">
                {wallets.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setSelectedWalletId(w.id)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                      selectedWalletId === w.id 
                      ? (w.type === "credit_card" ? "bg-indigo-500 text-white" : "bg-primary text-white") 
                      : "glass-inner text-muted-foreground"
                    }`}
                  >
                    {w.type === "credit_card" ? "💳" : "🏦"} {w.name.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment method */}
            {type === "expense" && selectedWalletId && (
              <div className="space-y-1.5 mt-4">
                <label className="text-xs text-muted-foreground">{t("tx.paymentMethod")}</label>
                <div className="flex gap-1 flex-wrap">
                  <button
                    onClick={() => setSelectedPaymentMethodId("")}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                      !selectedPaymentMethodId ? "pill-active" : "glass-inner text-muted-foreground"
                    }`}
                  >
                    PADRÃO
                  </button>
                  {paymentMethods.filter(m => m.type === "expense").map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedPaymentMethodId(m.id)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                        selectedPaymentMethodId === m.id ? "pill-active" : "glass-inner text-muted-foreground"
                      }`}
                    >
                      {m.name.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Discrete Contextual Actions for Staged Transactions */}
            {initialData?.stagedId && (
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => onIgnore?.(initialData.stagedId!)}
                  className="flex-1 py-3 rounded-xl border border-white/5 bg-white/[0.03] text-xs font-bold text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-all flex items-center justify-center gap-2"
                >
                  <XCircle size={14} />
                  Ignorar
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => onCreateRule?.(description, categoryId)}
                    className="w-11 h-11 rounded-xl glass-inner border border-primary/20 flex items-center justify-center text-primary/60 hover:text-primary hover:bg-primary/10 transition-all active:scale-90"
                    title={t("rules.create")}
                  >
                    <Sparkles size={18} />
                  </button>
                  <button
                    onClick={() => onDelete?.(initialData.stagedId!)}
                    className="w-11 h-11 rounded-xl glass-inner border border-destructive/10 flex items-center justify-center text-destructive/40 hover:text-destructive hover:bg-destructive/10 transition-all active:scale-90"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={addTransaction.isPending}
              className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {addTransaction.isPending ? t("tx.adding") : t("tx.addTransaction")}
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer >
  );
};

export default AddTransactionDrawer;
