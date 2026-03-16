import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useDebtors } from "@/hooks/useDebtors";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const AddDebtorDrawer = ({ open, onOpenChange }: Props) => {
    const { addDebtor } = useDebtors();
    const { t } = useLanguage();
    const [name, setName] = useState("");

    const handleSubmit = async () => {
        if (!name.trim()) {
            toast.error(t("tx.fillRequired") || "Name is required");
            return;
        }

        try {
            await addDebtor.mutateAsync({ name: name.trim() });
            toast.success("Adicionado com sucesso!");
            onOpenChange(false);
            setName("");
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="bg-background border-t border-glass-border">
                <div className="mx-auto w-full max-w-sm px-4 pb-8">
                    <DrawerHeader className="px-0">
                        <DrawerTitle className="text-foreground">Adicionar Pessoa</DrawerTitle>
                    </DrawerHeader>

                    <div className="space-y-4 mt-4">
                        <div className="space-y-1.5">
                            <label className="text-xs text-muted-foreground">{t("auth.name")}</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Nome da pessoa"
                                className="w-full glass-inner rounded-xl px-4 py-3 text-base md:text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all"
                            />
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={addDebtor.isPending}
                            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-blue transition-all active:scale-[0.98] disabled:opacity-50 mt-4"
                        >
                            {addDebtor.isPending ? t("auth.loading") : t("common.add")}
                        </button>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    );
};

export default AddDebtorDrawer;
