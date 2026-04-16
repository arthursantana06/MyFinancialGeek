import { useState, useMemo } from "react";
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
    const { debts, isLoading, addDebt, settleDebt, deleteDebt } = useDebts();
    const { t, language } = useLanguage();
    const [isAddOpen, setIsAddOpen] = useState(false);

    const [settleMenuOpen, setSettleMenuOpen] = useState<string | null>(null);
    const [settleAmount, setSettleAmount] = useState("");
    const [settleDescription, setSettleDescription] = useState("");

    const { debtorDebts, activeDebts, archivedDebts, totalOwed, totalOwing, netPosition } = useMemo(() => {
        if (!debtor) return { debtorDebts: [], activeDebts: [], archivedDebts: [], totalOwed: 0, totalOwing: 0, netPosition: 0 };
        
        const filtered = debts.filter(d => d.debtor_id === debtor.id);
        const owed = filtered.filter((d) => d.type === "receivable").reduce((s, d) => s + Number(d.currentAmount || 0), 0);
        const owing = filtered.filter((d) => d.type === "payable").reduce((s, d) => s + Number(d.currentAmount || 0), 0);
        
        return {
            debtorDebts: filtered,
            activeDebts: filtered.filter(d => Number(d.currentAmount || 0) > 0),
            archivedDebts: filtered.filter(d => Number(d.currentAmount || 0) <= 0),
            totalOwed: owed,
            totalOwing: owing,
            netPosition: owed - owing
        };
    }, [debts, debtor?.id]);

    const [isGeneralOpen, setIsGeneralOpen] = useState(false);
    const [generalAmount, setGeneralAmount] = useState("");
    const [generalDesc, setGeneralDesc] = useState("Abatimento Geral");
    const [showArchivedList, setShowArchivedList] = useState(false);

    if (!debtor) return null;

    const dateLocale = language === "pt-BR" ? ptBR : enUS;

    const handleSettle = async (debtId: string) => {
        try {
            const amount = parseFloat(settleAmount);
            if (isNaN(amount) || amount <= 0) {
                toast.error("Insira um valor válido");
                return;
            }
            if (!settleDescription.trim()) {
                toast.error("Insira uma descrição para o log");
                return;
            }
            await settleDebt.mutateAsync({ 
                debtId, 
                amount, 
                description: settleDescription 
            });
            toast.success("Pagamento registrado!");
            setSettleMenuOpen(null);
            setSettleAmount("");
            setSettleDescription("");
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const handleDelete = async (debtId: string) => {
        try {
            await deleteDebt.mutateAsync(debtId);
            toast.success("Registro removido!");
        } catch (err: any) {
            toast.error(err.message || "Erro ao remover");
        }
    }

    const handleGeneralAbatement = async () => {
        try {
            const totalToAbate = parseFloat(generalAmount);
            if (isNaN(totalToAbate) || totalToAbate <= 0) {
                toast.error("Insira um valor válido para o abatimento");
                return;
            }

            if (netPosition === 0) return;
            
            // Target debts of the same sign as the net position
            // If netPosition > 0, it's a balance against receivables (debtor owes me)
            // If netPosition < 0, it's a balance against payables (I owe debtor)
            const targetType = netPosition > 0 ? "receivable" : "payable";
            const candidates = activeDebts
                .filter(d => d.type === targetType)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            let remainingAmount = totalToAbate;
            
            for (const debt of candidates) {
                if (remainingAmount <= 0) break;
                
                const amountToApply = Math.min(debt.currentAmount, remainingAmount);
                if (amountToApply > 0) {
                    await settleDebt.mutateAsync({
                        debtId: debt.id,
                        amount: amountToApply,
                        description: generalDesc
                    });
                    remainingAmount -= amountToApply;
                }
            }
            
            toast.success("Abatimento registrado com sucesso!");
            setIsGeneralOpen(false);
            setGeneralAmount("");
        } catch (err: any) {
            toast.error("Erro ao aplicar abatimento");
            console.error(err);
        }
    };

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
                        <div className="glass-card p-4 space-y-3 shrink-0 mb-4 mt-2">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-xs text-muted-foreground">{t("debts.netPosition")}</p>
                                    <p className={`text-2xl font-bold ${netPosition >= 0 ? "text-chart-green" : "text-destructive"}`}>
                                        {netPosition >= 0 ? "+" : "-"}R${Math.abs(netPosition).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                                {Math.abs(netPosition) > 0 && (
                                    <button 
                                        onClick={() => {
                                            if (!isGeneralOpen) {
                                                setGeneralAmount(Math.abs(netPosition).toFixed(2));
                                            }
                                            setIsGeneralOpen(!isGeneralOpen);
                                        }}
                                        className="h-8 px-3 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-white uppercase tracking-wider hover:bg-white/10 transition-all"
                                    >
                                        {isGeneralOpen ? "Cancelar" : "Abatimento Geral"}
                                    </button>
                                )}
                            </div>

                            {isGeneralOpen && (
                                <div className="pt-3 border-t border-white/5 space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase ml-1">Valor do Abatimento</span>
                                            <input 
                                                type="number"
                                                value={generalAmount}
                                                onChange={(e) => setGeneralAmount(e.target.value)}
                                                className="w-full glass-inner bg-black/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none placeholder:text-white/20"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase ml-1">Descrição</span>
                                            <input 
                                                type="text"
                                                value={generalDesc}
                                                onChange={(e) => setGeneralDesc(e.target.value)}
                                                className="w-full glass-inner bg-black/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none placeholder:text-white/20"
                                                placeholder="Ex: Pagamento parcial"
                                            />
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleGeneralAbatement}
                                        className="w-full py-2 bg-white text-black text-[10px] font-black rounded-lg uppercase tracking-widest hover:bg-white/90 transition-all font-bold"
                                    >
                                        Confirmar Abatimento
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
                            {isLoading ? (
                                <div className="space-y-4 py-8">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-24 w-full rounded-2xl bg-white/5 animate-pulse" />
                                    ))}
                                </div>
                            ) : debtorDebts.length === 0 ? (
                                <p className="text-center text-sm text-muted-foreground mt-8">Nenhum registro encontrado.</p>
                            ) : (
                                <>
                                    {/* Active Debts */}
                                    {activeDebts.length > 0 && (
                                        <div className="space-y-3">
                                            {activeDebts.map(d => (
                                                <div key={d.id} className="glass-card p-3 space-y-3 animate-in fade-in slide-in-from-bottom-2">
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
                                                                R${Number(d.currentAmount).toFixed(2)}
                                                            </p>
                                                            {Number(d.currentAmount) !== Number(d.amount) && (
                                                                <p className="text-[9px] text-muted-foreground line-through">R${Number(d.amount).toFixed(2)}</p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Mutations Log */}
                                                    {d.mutations && d.mutations.length > 0 && (
                                                        <div className="pl-10 space-y-2 pb-1">
                                                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Histórico de Pagamentos</p>
                                                            {d.mutations.map((m: any) => (
                                                                <div key={m.id} className="flex justify-between items-center text-[10px] border-l border-glass-border pl-3 py-0.5">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-foreground font-medium">{m.description}</span>
                                                                        <span className="text-muted-foreground">{format(new Date(m.date), "dd/MM")}</span>
                                                                    </div>
                                                                    <span className="font-bold text-foreground">- R${Number(m.amount).toFixed(2)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {settleMenuOpen === d.id ? (
                                                        <div className="pt-2 border-t border-glass-border space-y-3 animate-in fade-in zoom-in-95">
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div className="space-y-1">
                                                                    <span className="text-[9px] font-bold text-muted-foreground uppercase ml-1">Valor do Pagamento</span>
                                                                    <input 
                                                                        type="number"
                                                                        value={settleAmount}
                                                                        onChange={(e) => setSettleAmount(e.target.value)}
                                                                        className="w-full glass-inner bg-black/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none placeholder:text-white/20"
                                                                        placeholder="0.00"
                                                                    />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <span className="text-[9px] font-bold text-muted-foreground uppercase ml-1">Nota / Descrição</span>
                                                                    <input 
                                                                        type="text"
                                                                        value={settleDescription}
                                                                        onChange={(e) => setSettleDescription(e.target.value)}
                                                                        className="w-full glass-inner bg-black/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none placeholder:text-white/20"
                                                                        placeholder="Ex: Via PIX"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button onClick={() => setSettleMenuOpen(null)} className="flex-1 py-2 text-xs text-muted-foreground bg-glass rounded-lg font-medium">Cancelar</button>
                                                                <button onClick={() => handleSettle(d.id)} className="flex-1 py-2 text-xs bg-chart-green text-white font-bold rounded-lg uppercase tracking-wider">Confirmar</button>
                                                            </div>
                                                        </div>
                                                    ) : d.currentAmount > 0 && (
                                                        <div className="pt-2 border-t border-glass-border flex gap-2">
                                                            <button onClick={() => handleDelete(d.id)} className="flex-1 py-1.5 text-[10px] text-destructive bg-destructive/10 rounded-lg hover:bg-destructive/20 transition-all font-bold uppercase">Excluir</button>
                                                            <button 
                                                                onClick={() => {
                                                                    setSettleMenuOpen(d.id);
                                                                    setSettleAmount(d.currentAmount.toString());
                                                                    setSettleDescription("Pagamento Parcial");
                                                                }} 
                                                                className="flex-1 py-1.5 text-[10px] text-foreground bg-glass rounded-lg hover:bg-white/5 transition-all flex items-center justify-center gap-1 font-bold uppercase"
                                                            >
                                                                <Check size={12} /> Liquidar
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Archived/Paid Debts */}
                                    {archivedDebts.length > 0 && (
                                        <div className="pt-2">
                                            <button 
                                                onClick={() => setShowArchivedList(!showArchivedList)}
                                                className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1 py-2 hover:text-foreground transition-all"
                                            >
                                                <Check size={14} className="text-chart-green" />
                                                Dívidas Arquivadas ({archivedDebts.length})
                                            </button>

                                            {showArchivedList && (
                                                <div className="space-y-3 mt-2 animate-in fade-in slide-in-from-top-2">
                                                    {archivedDebts.map(d => (
                                                        <div key={d.id} className="glass-card p-3 space-y-3 opacity-60">
                                                            <div className="flex justify-between items-start">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted/20 text-muted-foreground">
                                                                        <Check size={16} />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-medium text-foreground">{d.description}</p>
                                                                        <p className="text-[10px] text-muted-foreground">{format(new Date(d.date), "dd MMM yyyy", { locale: dateLocale })}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-sm font-bold text-muted-foreground">QUITADO</p>
                                                                    <p className="text-[9px] text-muted-foreground line-through">R${Number(d.amount).toFixed(2)}</p>
                                                                </div>
                                                            </div>
                                                            
                                                            {/* History for archived ones too */}
                                                            {d.mutations && d.mutations.length > 0 && (
                                                                <div className="pl-10 space-y-2 pb-1">
                                                                    {d.mutations.map((m: any) => (
                                                                        <div key={m.id} className="flex justify-between items-center text-[10px] border-l border-white/10 pl-3 py-0.5">
                                                                            <span className="text-muted-foreground">{m.description}</span>
                                                                            <span className="font-medium text-muted-foreground">R${Number(m.amount).toFixed(2)}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            <div className="pt-2 border-t border-white/5">
                                                                <button onClick={() => handleDelete(d.id)} className="w-full py-1.5 text-[9px] text-destructive/60 hover:text-destructive font-bold uppercase transition-all">Remover do Histórico</button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>

            <AddDebtDrawer open={isAddOpen} onOpenChange={setIsAddOpen} debtorId={debtor.id} />
        </>
    );
};
