import { useState } from "react";
import { ArrowLeft, Plus, Circle, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCategories } from "@/hooks/useCategories";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import type { Database } from "@/integrations/supabase/types";
import EditCategoryDrawer from "@/components/EditCategoryDrawer";
import OpenFinanceConnect from "@/components/OpenFinanceConnect";

type CategoryType = Database["public"]["Enums"]["category_type"];

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

const SettingsPage = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { categories, isLoading, addCategory } = useCategories();
  const { paymentMethods, isLoading: isLoadingPMs, addPaymentMethod, deletePaymentMethod } = usePaymentMethods();
  const [activeTab, setActiveTab] = useState<"categories" | "payment_methods" | "integrations">("categories");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<CategoryType>("expense");
  const [newColor, setNewColor] = useState(COLORS[0]);

  const [editingCategory, setEditingCategory] = useState<any | null>(null);

  // Payment method state
  const [pmDrawerOpen, setPmDrawerOpen] = useState(false);
  const [pmName, setPmName] = useState("");

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await addCategory.mutateAsync({
        name: newName.trim(),
        type: newType,
        color: newColor,
        icon: "circle",
      });
      toast.success(t("tx.added"));
      setDrawerOpen(false);
      setNewName("");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddPM = async () => {
    if (!pmName.trim()) return;
    try {
      await addPaymentMethod.mutateAsync({
        name: pmName.trim(),
        icon: "credit-card",
        type: "expense",
      });
      toast.success(t("tx.added"));
      setPmDrawerOpen(false);
      setPmName("");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const incomeCategories = categories.filter((c) => c.type === "income");

  const expenseMethods = paymentMethods.filter((p) => p.type !== "income");
  const incomeMethods = paymentMethods.filter((p) => p.type === "income");

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 py-4">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl glass-card flex items-center justify-center"
          >
            <ArrowLeft size={18} className="text-muted-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">{t("settings.title")}</h1>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 bg-glass-inner p-1 rounded-2xl overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("categories")}
            className={`flex-1 min-w-max px-3 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === "categories" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              }`}
          >
            {t("settings.categories")}
          </button>
          <button
            onClick={() => setActiveTab("payment_methods")}
            className={`flex-1 min-w-max px-3 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === "payment_methods" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              }`}
          >
            {t("tx.paymentMethod")}
          </button>
          <button
            onClick={() => setActiveTab("integrations")}
            className={`flex-1 min-w-max px-3 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === "integrations" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              }`}
          >
            Integrações
          </button>
        </div>

        {activeTab === "categories" && (
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t("settings.categories")}</h3>
              <button
                onClick={() => setDrawerOpen(true)}
                className="w-8 h-8 rounded-xl glass-inner flex items-center justify-center hover:bg-glass-highlight transition-colors"
              >
                <Plus size={16} className="text-muted-foreground" />
              </button>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-2xl bg-glass animate-pulse" />)}
              </div>
            ) : categories.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">{t("settings.noCategories")}</p>
            ) : (
              <>
                {/* Expense Categories */}
                {expenseCategories.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                      {t("tx.expense")}
                    </p>
                    {expenseCategories.map((cat) => (
                      <button 
                        key={cat.id} 
                        onClick={() => setEditingCategory(cat)}
                        className="w-full text-left flex items-center gap-3 p-3 rounded-2xl glass-inner hover:bg-glass-highlight transition-colors"
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: cat.color + "20" }}
                        >
                          <Circle size={14} style={{ color: cat.color }} fill={cat.color} />
                        </div>
                        <span className="text-sm font-medium text-foreground flex-1">{cat.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Income Categories */}
                {incomeCategories.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                      {t("tx.income")}
                    </p>
                    {incomeCategories.map((cat) => (
                      <button 
                        key={cat.id} 
                        onClick={() => setEditingCategory(cat)}
                        className="w-full text-left flex items-center gap-3 p-3 rounded-2xl glass-inner hover:bg-glass-highlight transition-colors"
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: cat.color + "20" }}
                        >
                          <Circle size={14} style={{ color: cat.color }} fill={cat.color} />
                        </div>
                        <span className="text-sm font-medium text-foreground flex-1">{cat.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "payment_methods" && (
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t("tx.paymentMethod")}</h3>
              <button
                onClick={() => setPmDrawerOpen(true)}
                className="w-8 h-8 rounded-xl glass-inner flex items-center justify-center hover:bg-glass-highlight transition-colors"
              >
                <Plus size={16} className="text-muted-foreground" />
              </button>
            </div>

            {isLoadingPMs ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-2xl bg-glass animate-pulse" />)}
              </div>
            ) : paymentMethods.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Adicione um método de pagamento!</p>
            ) : (
              <>
                {expenseMethods.length > 0 && (
                  <div className="space-y-1">
                    {expenseMethods.map((pm) => (
                      <div key={pm.id} className="flex items-center gap-3 p-3 rounded-2xl glass-inner">
                        <span className="text-sm font-medium text-foreground flex-1">{pm.name}</span>
                        <button
                          onClick={() => deletePaymentMethod.mutate(pm.id)}
                          className="p-1.5 rounded-lg hover:bg-glass text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "integrations" && (
          <OpenFinanceConnect />
        )}

        {/* Add Category Drawer */}
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent className="bg-background border-t border-glass-border">
            <div className="mx-auto w-full max-w-sm px-4 pb-8">
              <DrawerHeader className="px-0">
                <DrawerTitle className="text-foreground">{t("settings.addCategory")}</DrawerTitle>
              </DrawerHeader>
              <div className="space-y-4">
                {/* Type toggle */}
                <div className="flex gap-1 p-1 rounded-full glass-card">
                  {(["expense", "income"] as CategoryType[]).map((ct) => (
                    <button
                      key={ct}
                      onClick={() => setNewType(ct)}
                      className={`flex-1 py-2 rounded-full text-xs font-medium transition-all ${newType === ct ? "pill-active" : "pill-inactive"
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
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
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
                        onClick={() => setNewColor(c)}
                        className={`w-8 h-8 rounded-full transition-all ${newColor === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110" : ""
                          }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleAdd}
                  disabled={addCategory.isPending}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-blue transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {addCategory.isPending ? t("auth.loading") : t("common.add")}
                </button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Add Payment Method Drawer */}
        <Drawer open={pmDrawerOpen} onOpenChange={setPmDrawerOpen}>
          <DrawerContent className="bg-background border-t border-glass-border">
            <div className="mx-auto w-full max-w-sm px-4 pb-8">
              <DrawerHeader className="px-0">
                <DrawerTitle className="text-foreground">Novo Método</DrawerTitle>
              </DrawerHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Nome do Método</label>
                  <input
                    type="text"
                    value={pmName}
                    onChange={(e) => setPmName(e.target.value)}
                    placeholder="Ex: Cartão Alimentação, Pix Empresa..."
                    className="w-full glass-inner rounded-xl px-4 py-3 text-base md:text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all"
                  />
                </div>

                <button
                  onClick={handleAddPM}
                  disabled={addPaymentMethod.isPending}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-blue transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {addPaymentMethod.isPending ? t("auth.loading") : t("common.add")}
                </button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>

        <EditCategoryDrawer
          open={!!editingCategory}
          onOpenChange={(op) => !op && setEditingCategory(null)}
          category={editingCategory}
        />
      </div>
    </div>
  );
};

export default SettingsPage;
