import { useState, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useCategories } from "@/hooks/useCategories";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type CategoryType = Database["public"]["Enums"]["category_type"];

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: any | null;
}

const EditCategoryDrawer = ({ open, onOpenChange, category }: Props) => {
  const { updateCategory, deleteCategory } = useCategories();
  const { t } = useLanguage();

  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("expense");
  const [color, setColor] = useState(COLORS[0]);

  useEffect(() => {
    if (category && open) {
      setName(category.name);
      setType(category.type);
      setColor(category.color || COLORS[0]);
    }
  }, [category, open]);

  const handleUpdate = async () => {
    if (!category) return;
    if (!name.trim()) return;

    try {
      await updateCategory.mutateAsync({
        id: category.id,
        name: name.trim(),
        type,
        color,
      });
      toast.success(t("common.save") + " realizado");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (!category) return;
    
    try {
      await deleteCategory.mutateAsync(category.id);
      toast.success(t("common.delete") + " realizado");
      onOpenChange(false);
    } catch (err: any) {
      if (err.message?.includes("foreign key constraint")) {
        toast.error("Não é possível excluir: existem transações vinculadas a esta categoria. Tente editar em vez disso.");
      } else {
        toast.error(err.message);
      }
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-background border-t border-glass-border">
        <div className="mx-auto w-full max-w-sm px-4 pb-8">
          <DrawerHeader className="px-0">
            <DrawerTitle className="text-foreground">{t("common.edit")} Categoria</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-4 pt-4">
            {/* Type toggle */}
            <div className="flex gap-1 p-1 rounded-full glass-card">
              {(["expense", "income"] as CategoryType[]).map((ct) => (
                <button
                  key={ct}
                  onClick={() => setType(ct)}
                  className={`flex-1 py-2 rounded-full text-xs font-medium transition-all ${
                    type === ct ? "pill-active" : "pill-inactive"
                  }`}
                >
                  {ct === "income" ? t("tx.income") : t("tx.expense")}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{t("settings.categoryName")}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("settings.categoryName")}
                className="w-full glass-inner rounded-xl px-4 py-3 text-base md:text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{t("settings.categoryColor")}</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-all ${
                      color === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110" : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button
                onClick={handleUpdate}
                disabled={updateCategory.isPending || deleteCategory.isPending}
                className="flex-[2] py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-blue transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {updateCategory.isPending ? t("auth.loading") : t("common.save")}
              </button>
              <button
                onClick={handleDelete}
                disabled={updateCategory.isPending || deleteCategory.isPending}
                className="flex-1 py-3 rounded-xl bg-destructive/10 text-destructive font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {deleteCategory.isPending ? t("auth.loading") : t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default EditCategoryDrawer;
