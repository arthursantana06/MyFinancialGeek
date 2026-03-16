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
  type?: string;
}

export const useTransactions = (filters?: TransactionFilters, page: number = 1, pageSize: number = 20) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["transactions", user?.id, filters],
    queryFn: async () => {
      let q = supabase
        .from("transactions")
        .select("*, categories(*), wallets(*), payment_methods(*)", { count: "exact" })
        .eq("user_id", user!.id)
        .order("date", { ascending: false });

      if (filters?.dateFrom) q = q.gte("date", filters.dateFrom);
      if (filters?.dateTo) q = q.lte("date", filters.dateTo);
      if (filters?.categoryId && filters.categoryId !== "all") q = q.eq("category_id", filters.categoryId);
      if (filters?.walletId && filters.walletId !== "all") q = q.eq("wallet_id", filters.walletId);
      if (filters?.type && filters.type !== "all") q = q.eq("type", filters.type as "income" | "expense");

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      q = q.range(from, to);

      const { data, count, error } = await q;
      if (error) throw error;
      return { data, count };
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
  const grouped = (query.data?.data ?? []).reduce<Record<string, typeof query.data.data>>((acc, tx) => {
    const d = new Date(tx.date);
    const label = isToday(d) ? "Hoje" : isYesterday(d) ? "Ontem" : format(d, "dd/MM/yyyy");
    (acc[label] ??= []).push(tx);
    return acc;
  }, {});

  return {
    transactions: query.data?.data ?? [],
    totalCount: query.data?.count ?? 0,
    grouped,
    isLoading: query.isLoading,
    addTransaction,
    deleteTransaction,
    updateTransaction,
  };
};

export const useFilteredSum = (filters?: TransactionFilters) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["transactionsSum", user?.id, filters],
    queryFn: async () => {
      let q = supabase
        .from("transactions")
        .select("amount, type")
        .eq("user_id", user!.id);

      if (filters?.dateFrom) q = q.gte("date", filters.dateFrom);
      if (filters?.dateTo) q = q.lte("date", filters.dateTo);
      if (filters?.categoryId && filters.categoryId !== "all") q = q.eq("category_id", filters.categoryId);
      if (filters?.walletId && filters.walletId !== "all") q = q.eq("wallet_id", filters.walletId);
      if (filters?.type && filters.type !== "all") q = q.eq("type", filters.type as "income" | "expense");

      const { data, error } = await q;
      if (error) throw error;

      let income = 0;
      let expenses = 0;

      (data || []).forEach(tx => {
        if (tx.type === "income") income += Number(tx.amount);
        else if (tx.type === "expense") expenses += Number(tx.amount);
      });

      return {
        income,
        expenses,
        balance: income - expenses
      };
    },
    enabled: !!user,
  });
};
