import { User, CreditCard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

const DashboardHeader = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
  const initials = displayName
    .split(" ")
    .map((s: string) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center justify-between py-4">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">{t("dashboard.title")}</h1>
        <p className="text-xs text-muted-foreground">
          {t("dashboard.welcome")} {displayName}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate("/wallets")}
          className="w-10 h-10 rounded-xl glass-card flex items-center justify-center transition-colors hover:bg-glass-highlight"
          aria-label="Wallets"
        >
          <CreditCard size={18} strokeWidth={1.5} className="text-muted-foreground" />
        </button>
        <button
          onClick={() => navigate("/profile")}
          className="w-10 h-10 rounded-full border border-glass-highlight bg-glass flex items-center justify-center overflow-hidden transition-colors hover:bg-glass-highlight"
        >
          <span className="text-xs font-semibold text-foreground">{initials}</span>
        </button>
      </div>
    </div>
  );
};

export default DashboardHeader;
