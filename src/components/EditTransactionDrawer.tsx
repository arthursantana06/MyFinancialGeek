import { useState, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useTransactions } from "@/hooks/useTransactions";
import { useWallets } from "@/hooks/useWallets";
import { useCategories } from "@/hooks/useCategories";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type TxType = Database["public"]["Enums"]["transaction_type"];

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    transaction: any | null;
}

const EditTransactionDrawer = ({ open, onOpenChange, transaction }: Props) => {
    const { updateTransaction } = useTransactions();
    const { wallets } = useWallets();
    const { categories } = useCategories();
    const { paymentMethods } = usePaymentMethods();
    const { t } = useLanguage();

    const creditCards = wallets.filter(w => w.type === "credit_card");
    const regularWallets = wallets.filter(w => w.type !== "credit_card");

    const [type, setType] = useState<TxType>("expense");
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");

    const getLocalDateString = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [date, setDate] = useState<string>(getLocalDateString());

    useEffect(() => {
        if (transaction && open) {
            setType(transaction.type);
            setAmount(transaction.amount.toString());
            setDescription(transaction.description || "");
            if (transaction.date) {
                const d = new Date(transaction.date);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                setDate(`${year}-${month}-${day}`);
            }
            setCategoryId(transaction.category_id || "");
            // If they had a credit card wallet id previously, we should set it as the payment method visually in our logic
            if (transaction.wallet_id && creditCards.some(c => c.id === transaction.wallet_id)) {
                setSelectedPaymentMethod(transaction.wallet_id);
            }
        }
    }, [transaction, open]);

    const isCreditCard = creditCards.some(c => c.id === selectedPaymentMethod);

    const handleSubmit = async () => {
        if (!transaction) return;

        const defaultWalletId = regularWallets.length > 0
            ? regularWallets[0].id
            : (wallets.length > 0 ? wallets[0].id : null);

        const existingRegularWallet = (transaction.wallet_id && regularWallets.some(w => w.id === transaction.wallet_id))
            ? transaction.wallet_id
            : defaultWalletId;

        const finalWalletId = isCreditCard ? selectedPaymentMethod : existingRegularWallet;
        const finalPaymentMethodId = isCreditCard ? null : selectedPaymentMethod || null;

        if (!amount || !description || !finalWalletId) {
            toast.error(t("tx.fillRequired"));
            return;
        }

        // Fix timezone shift by creating date at local noon
        const [year, month, day] = date.split('-').map(Number);
        const safeDate = new Date(year, month - 1, day, 12, 0, 0);

        try {
            await updateTransaction.mutateAsync({
                id: transaction.id,
                amount: parseFloat(amount.toString().replace(",", ".")),
                type,
                description,
                wallet_id: finalWalletId,
                category_id: categoryId || undefined,
                payment_method_id: finalPaymentMethodId,
                status: transaction.status,
                date: safeDate.toISOString(),
            });
            toast.success("Transação atualizada!");
            onOpenChange(false);
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="bg-background border-t border-glass-border">
                <div className="mx-auto w-full max-w-sm px-4 pb-8">
                    <DrawerHeader className="px-0">
                        <DrawerTitle className="text-foreground">{t("common.edit")} Transação</DrawerTitle>
                    </DrawerHeader>

                    <div className="space-y-4">
                        {/* Type toggle */}
                        <div className="flex gap-1 p-1 rounded-full glass-card">
                            {(["expense", "income"] as TxType[]).map((tp) => (
                                <button
                                    key={tp}
                                    onClick={() => setType(tp)}
                                    className={`flex-1 py-2 rounded-full text-xs font-medium transition-all ${type === tp ? "pill-active" : "pill-inactive"
                                        }`}
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
                            <label className="text-xs text-muted-foreground">Data</label>
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



                        {/* Payment method */}
                        {type === "expense" && (
                            <div className="space-y-1.5 mt-4">
                                <label className="text-xs text-muted-foreground">{t("tx.paymentMethod")}</label>
                                <div className="flex gap-1 flex-wrap">
                                    {paymentMethods.filter(m => m.type === "expense").map((m) => (
                                        <button
                                            key={m.id}
                                            onClick={() => setSelectedPaymentMethod(m.id)}
                                            className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${selectedPaymentMethod === m.id ? "pill-active" : "glass-inner text-muted-foreground"
                                                }`}
                                        >
                                            {m.name.toUpperCase()}
                                        </button>
                                    ))}
                                    {creditCards.map((c) => (
                                        <button
                                            key={c.id}
                                            onClick={() => setSelectedPaymentMethod(c.id)}
                                            className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${selectedPaymentMethod === c.id ? "bg-indigo-500 text-white" : "glass-inner text-muted-foreground border border-indigo-500/30"
                                                }`}
                                        >
                                            💳 {c.institution_name ? `${c.institution_name.toUpperCase()} • ` : ''}{c.name.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleSubmit}
                            disabled={updateTransaction.isPending}
                            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-blue transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {updateTransaction.isPending ? t("auth.loading") : t("common.save")}
                        </button>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    );
};

export default EditTransactionDrawer;
