import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useDebts } from "@/hooks/useDebts";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type DebtType = Database["public"]["Enums"]["debt_type"];

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    debtorId: string | null;
}

export const AddDebtDrawer = ({ open, onOpenChange, debtorId }: Props) => {
    const { addDebt } = useDebts();
    const { t } = useLanguage();

    const [type, setType] = useState<DebtType>("receivable");
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");

    const getLocalDateString = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const [date, setDate] = useState<string>(getLocalDateString());

    const handleSubmit = async () => {
        if (!debtorId) return;
        if (!amount || !description) {
            toast.error(t("tx.fillRequired"));
            return;
        }

        const [year, month, day] = date.split('-').map(Number);
        const safeDate = new Date(year, month - 1, day, 12, 0, 0);

        try {
            await addDebt.mutateAsync({
                debtor_id: debtorId,
                amount: parseFloat(amount.replace(",", ".")),
                type,
                description,
                date: safeDate.toISOString(),
            });
            toast.success("Registro adicionado!");
            onOpenChange(false);
            setAmount("");
            setDescription("");
            setDate(getLocalDateString());
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="bg-background border-t border-glass-border">
                <div className="mx-auto w-full max-w-sm px-4 pb-8">
                    <DrawerHeader className="px-0">
                        <DrawerTitle className="text-foreground">Novo Registro</DrawerTitle>
                    </DrawerHeader>

                    <div className="space-y-4">
                        <div className="flex gap-1 p-1 rounded-full glass-card">
                            {(["receivable", "payable"] as DebtType[]).map((tp) => (
                                <button
                                    key={tp}
                                    onClick={() => setType(tp)}
                                    className={`flex-1 py-2 rounded-full text-xs font-medium transition-all ${type === tp ? "pill-active" : "pill-inactive"
                                        }`}
                                >
                                    {tp === "receivable" ? t("debts.owesYou") : t("debts.youOwe")}
                                </button>
                            ))}
                        </div>

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

                        <div className="space-y-1.5">
                            <label className="text-xs text-muted-foreground">{t("tx.description")}</label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Motivo (ex: Conta de luz, Almoço)"
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

                        <button
                            onClick={handleSubmit}
                            disabled={addDebt.isPending}
                            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-blue transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {addDebt.isPending ? t("auth.loading") : "Salvar Registro"}
                        </button>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    );
};
