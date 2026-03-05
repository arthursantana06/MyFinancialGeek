import { Lightbulb } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { dailyTips } from "@/i18n/translations";
import { useMemo } from "react";

const DailyTip = () => {
  const { t, language } = useLanguage();

  const tip = useMemo(() => {
    const tips = dailyTips[language];
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    return tips[dayOfYear % tips.length];
  }, [language]);

  return (
    <div className="glass-card p-4 flex gap-3 items-start">
      <div className="w-8 h-8 rounded-xl bg-chart-yellow/15 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Lightbulb size={16} className="text-chart-yellow" />
      </div>
      <div className="space-y-1 min-w-0">
        <p className="text-[10px] font-semibold text-chart-yellow uppercase tracking-wider">{t("dashboard.tipOfDay")}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{tip}</p>
      </div>
    </div>
  );
};

export default DailyTip;
