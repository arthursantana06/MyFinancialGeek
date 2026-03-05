import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const CalendarWidget = () => {
  const [currentDate] = useState(new Date(2026, 0, 11)); // Jan 11, 2026
  const today = currentDate.getDate();
  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1;

  const days: (number | null)[] = [];
  for (let i = 0; i < offset; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{MONTHS[month]}, {year}</h3>
        <div className="flex gap-1">
          <button className="w-7 h-7 rounded-lg glass-inner flex items-center justify-center hover:bg-glass-border-highlight transition-colors">
            <ChevronLeft size={14} className="text-muted-foreground" />
          </button>
          <button className="w-7 h-7 rounded-lg glass-inner flex items-center justify-center hover:bg-glass-border-highlight transition-colors">
            <ChevronRight size={14} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DAYS.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
        ))}
        {days.map((day, i) => (
          <div key={i} className="flex items-center justify-center">
            {day !== null ? (
              <button
                className={`w-8 h-8 rounded-xl text-xs font-medium transition-all ${
                  day === today
                    ? "bg-primary text-primary-foreground glow-blue"
                    : day === 1
                    ? "bg-chart-green/20 text-chart-green"
                    : "text-foreground/80 hover:bg-glass-border-highlight"
                }`}
              >
                {day}
              </button>
            ) : (
              <div className="w-8 h-8" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CalendarWidget;
