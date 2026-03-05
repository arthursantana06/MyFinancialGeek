import { Home, ArrowLeftRight, Users, CalendarDays, Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, Fragment } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import AddTransactionDrawer from "./AddTransactionDrawer";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = [
    { icon: Home, label: t("nav.dashboard"), path: "/" },
    { icon: ArrowLeftRight, label: t("nav.activity"), path: "/transactions" },
    { icon: CalendarDays, label: t("nav.planning"), path: "/planning" },
    { icon: Users, label: t("nav.debts"), path: "/debts" },
  ];

  return (
    <>
      <div className="fixed bottom-4 left-0 right-0 z-50 px-4 pointer-events-none">
        <div className="max-w-md mx-auto relative pointer-events-auto">
          {/* FAB - Add Transaction (Centered overlapping nav) */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="absolute -top-1 left-1/2 -translate-x-1/2 z-50 w-14 h-14 rounded-full bg-primary flex items-center justify-center glow-blue transition-transform active:scale-95 shadow-lg"
          >
            <Plus size={24} className="text-primary-foreground" strokeWidth={2.5} />
          </button>

          <nav className="glass-nav rounded-2xl px-1 py-2 flex items-center justify-between">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Fragment key={item.path}>
                  {index === 2 && <div className="w-14 shrink-0" />} {/* Spacer for FAB */}
                  <button
                    onClick={() => navigate(item.path)}
                    className="flex flex-col flex-1 items-center gap-0.5 px-1 py-1 transition-colors min-w-0"
                  >
                    <Icon
                      size={20}
                      strokeWidth={1.5}
                      className={isActive ? "text-primary" : "text-muted-foreground"}
                    />
                    <span className={`text-[9px] font-medium truncate ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                      {item.label}
                    </span>
                  </button>
                </Fragment>
              );
            })}
          </nav>
        </div>
      </div>
      <AddTransactionDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
};

export default BottomNav;
