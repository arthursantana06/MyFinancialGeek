import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isToday, isYesterday, format } from "date-fns";
import type { TablesInsert } from "@/integrations/supabase/types";

interface TransactionFilters {
  dateFrom?: string;
  dateTo?: string;
  categoryId?: string;
  walletId?: string;
}

export const useTransactions = (filters?: TransactionFilters) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["transactions", user?.id, filters],
    queryFn: async () => {
      let q = supabase
        .from("transactions")
        .select("*, categories(*), wallets(*), payment_methods(*)")
        .eq("user_id", user!.id)
        .order("date", { ascending: false })
        .limit(50);

      if (filters?.dateFrom) q = q.gte("date", filters.dateFrom);
      if (filters?.dateTo) q = q.lte("date", filters.dateTo);
      if (filters?.categoryId) q = q.eq("category_id", filters.categoryId);
      if (filters?.walletId) q = q.eq("wallet_id", filters.walletId);

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const addTransaction = useMutation({
    mutationFn: async (tx: Omit<TablesInsert<"transactions">, "user_id">) => {
      const { data, error } = await supabase
        .from("transactions")
        .insert({ ...tx, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });

  const updateTransaction = useMutation({
    mutationFn: async ({ id, ...tx }: Partial<TablesInsert<"transactions">> & { id: string }) => {
      const { data, error } = await supabase
        .from("transactions")
        .update(tx)
        .eq("id", id)
        .eq("user_id", user!.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });

  // Group transactions by date label
  const grouped = (query.data ?? []).reduce<Record<string, typeof query.data>>((acc, tx) => {
    const d = new Date(tx.date);
    const label = isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "MMM d, yyyy");
    (acc[label] ??= []).push(tx);
    return acc;
  }, {});

  return {
    transactions: query.data ?? [],
    grouped,
    isLoading: query.isLoading,
    addTransaction,
    deleteTransaction,
    updateTransaction,
  };
};
