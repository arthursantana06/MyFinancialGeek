import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useDebts } from "@/hooks/useDebts";
import { useLanguage } from "@/i18n/LanguageContext";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { ArrowUpRight, ArrowDownLeft, Plus, Check } from "lucide-react";
import { AddDebtDrawer } from "./AddDebtDrawer";
import { toast } from "sonner";
import { useWallets } from "@/hooks/useWallets";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    debtor: any | null;
}

export const DebtorDetailsDrawer = ({ open, onOpenChange, debtor }: Props) => {
    const { debts, settleDebt, deleteDebt } = useDebts();
    const { wallets } = useWallets();
    const { paymentMethods } = usePaymentMethods();
    const { t, language } = useLanguage();
    const [isAddOpen, setIsAddOpen] = useState(false);

    const [settleMenuOpen, setSettleMenuOpen] = useState<string | null>(null);
    const [selectedWallet, setSelectedWallet] = useState<string>("");
    const [selectedPM, setSelectedPM] = useState<string>("");

    if (!debtor) return null;

    const debtorDebts = debts.filter(d => d.debtor_id === debtor.id);
    const totalOwed = debtorDebts.filter((d) => d.type === "receivable").reduce((s, d) => s + Number(d.amount), 0);
    const totalOwing = debtorDebts.filter((d) => d.type === "payable").reduce((s, d) => s + Number(d.amount), 0);
    const netPosition = totalOwed - totalOwing;

    const dateLocale = language === "pt-BR" ? ptBR : enUS;

    const handleSettle = async (debtId: string) => {
        try {
            if (!selectedWallet && !selectedPM) {
                toast.error("Selecione um método de pagamento ou cartão");
                return;
            }
            await settleDebt.mutateAsync({ debtId, walletId: selectedWallet || null, paymentMethodId: selectedPM || null });
            toast.success("Liquidação registrada com sucesso!");
            setSettleMenuOpen(null);
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const handleDelete = async (debtId: string) => {
        try {
            await deleteDebt.mutateAsync(debtId);
            toast.success("Registro removido!");
        } catch (err: any) {
            toast.error("Erro ao remover");
        }
    }

    return (
        <>
            <Drawer open={open} onOpenChange={onOpenChange}>
                <DrawerContent className="bg-background border-t border-glass-border max-h-[90vh]">
                    <div className="mx-auto w-full max-w-md px-4 pb-8 flex flex-col h-full overflow-hidden">
                        <DrawerHeader className="px-0 flex justify-between items-center">
                            <DrawerTitle className="text-foreground text-xl">{debtor.name}</DrawerTitle>
                            <button onClick={() => setIsAddOpen(true)} className="w-8 h-8 flex justify-center items-center bg-primary rounded-full text-white">
                                <Plus size={18} />
                            </button>
                        </DrawerHeader>

                        {/* Header Balance */}
                        <div className="glass-card p-4 space-y-2 shrink-0 mb-4 mt-2">
                            <p className="text-xs text-muted-foreground">{t("debts.netPosition")}</p>
                            <p className={`text-2xl font-bold ${netPosition >= 0 ? "text-chart-green" : "text-destructive"}`}>
                                {netPosition >= 0 ? "+" : "-"}R${Math.abs(netPosition).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </p>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                            {debtorDebts.length === 0 ? (
                                <p className="text-center text-sm text-muted-foreground mt-8">Nenhum registro encontrado.</p>
                            ) : (
                                debtorDebts.map(d => (
                                    <div key={d.id} className="glass-card p-3 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${d.type === 'receivable' ? 'bg-chart-green/20 text-chart-green' : 'bg-destructive/20 text-destructive'}`}>
                                                    {d.type === 'receivable' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">{d.description}</p>
                                                    <p className="text-[10px] text-muted-foreground">{format(new Date(d.date), "dd MMM yyyy", { locale: dateLocale })}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-sm font-bold ${d.type === 'receivable' ? 'text-chart-green' : 'text-destructive'}`}>
                                                    R${Number(d.amount).toFixed(2)}
                                                </p>
                                            </div>
                                        </div>

                                        {settleMenuOpen === d.id ? (
                                            <div className="pt-2 border-t border-glass-border space-y-2">
                                                <p className="text-xs text-foreground">Como foi liquidado?</p>
                                                <div className="flex gap-1 flex-wrap">
                                                    {paymentMethods.map(pm => (
                                                        <button
                                                            key={pm.id}
                                                            onClick={() => { setSelectedPM(pm.id); setSelectedWallet(""); }}
                                                            className={`px-2 py-1 text-[10px] rounded-full transition-all ${selectedPM === pm.id ? "bg-primary text-white" : "glass-inner text-muted-foreground"}`}
                                                        >
                                                            {pm.name}
                                                        </button>
                                                    ))}
                                                    {wallets.filter(w => w.type === 'credit_card').map(w => (
                                                        <button
                                                            key={w.id}
                                                            onClick={() => { setSelectedWallet(w.id); setSelectedPM(""); }}
                                                            className={`px-2 py-1 text-[10px] rounded-full transition-all ${selectedWallet === w.id ? "bg-indigo-500 text-white" : "glass-inner text-muted-foreground"}`}
                                                        >
                                                            💳 {w.name}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="flex gap-2 pt-1">
                                                    <button onClick={() => setSettleMenuOpen(null)} className="flex-1 py-1.5 text-xs text-muted-foreground bg-glass rounded-lg">Cancelar</button>
                                                    <button onClick={() => handleSettle(d.id)} className="flex-1 py-1.5 text-xs bg-chart-green text-white font-medium rounded-lg">Confirmar</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="pt-2 border-t border-glass-border flex gap-2">
                                                <button onClick={() => handleDelete(d.id)} className="flex-1 py-1.5 text-xs text-destructive bg-destructive/10 rounded-lg hover:bg-destructive/20 transition-all font-medium">Excluir</button>
                                                <button onClick={() => setSettleMenuOpen(d.id)} className="flex-1 py-1.5 text-xs text-foreground bg-glass rounded-lg hover:bg-white/5 transition-all flex items-center justify-center gap-1 font-medium"><Check size={12} /> Liquidar</button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>

            <AddDebtDrawer open={isAddOpen} onOpenChange={setIsAddOpen} debtorId={debtor.id} />
        </>
    );
};
