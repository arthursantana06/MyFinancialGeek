import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, endOfMonth } from "date-fns";

export const useDashboard = () => {
  const { user } = useAuth();
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();

  const walletsQuery = useQuery({
    queryKey: ["wallets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const monthlyTransactionsQuery = useQuery({
    queryKey: ["transactions-monthly", user?.id, monthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user!.id)
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .order("date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const wallets = walletsQuery.data ?? [];
  const transactions = monthlyTransactionsQuery.data ?? [];

  const monthlyIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const monthlyExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalBalance = monthlyIncome - monthlyExpenses;

  return {
    totalBalance,
    monthlyIncome,
    monthlyExpenses,
    cashFlow: totalBalance,
    wallets,
    transactions,
    isLoading: walletsQuery.isLoading || monthlyTransactionsQuery.isLoading,
  };
};
