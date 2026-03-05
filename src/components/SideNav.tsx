import { LayoutGrid, FileText, Image, Receipt, Shield, Grid3X3, Settings, LogOut } from "lucide-react";
import { useState } from "react";

const navItems = [
  { icon: LayoutGrid, label: "Overview", active: true },
  { icon: FileText, label: "Reports" },
  { icon: Image, label: "Media" },
  { icon: Receipt, label: "Invoices" },
  { icon: Shield, label: "Security" },
  { icon: Grid3X3, label: "Apps" },
  { icon: Settings, label: "Settings" },
];

const SideNav = () => {
  const [active, setActive] = useState("Overview");

  return (
    <aside className="hidden lg:flex flex-col items-center py-6 px-3 w-16 glass-card rounded-3xl gap-2">
      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center mb-4">
        <div className="w-5 h-5 rounded-md bg-primary" />
      </div>

      <div className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.label;
          return (
            <button
              key={item.label}
              onClick={() => setActive(item.label)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                isActive
                  ? "bg-glass-border-highlight text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-glass-border/50"
              }`}
              title={item.label}
            >
              <Icon size={18} strokeWidth={1.5} />
            </button>
          );
        })}
      </div>

      <button className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
        <LogOut size={18} strokeWidth={1.5} />
      </button>
    </aside>
  );
};

export default SideNav;
