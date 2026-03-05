import TransactionList from "@/components/TransactionList";
import BottomNav from "@/components/BottomNav";
import { useLanguage } from "@/i18n/LanguageContext";

const TransactionsPage = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background p-4 pb-28">
      <div className="max-w-md mx-auto space-y-4">
        <div className="py-4">
          <h1 className="text-xl font-bold text-foreground">{t("nav.activity")}</h1>
          <p className="text-xs text-muted-foreground">{t("tx.allTransactions")}</p>
        </div>
        <TransactionList />
      </div>
      <BottomNav />
    </div>
  );
};

export default TransactionsPage;
