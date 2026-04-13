import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { TablesInsert } from "@/integrations/supabase/types";

export const useStagedTransactions = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["staged_transactions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staged_transactions")
        .select("*, wallets(*), categories:suggested_category_id(*)")
        .eq("user_id", user!.id)
        .eq("status", "pending")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const approveTransaction = useMutation({
    mutationFn: async ({
      stagedId,
      description,
      category_id,
      wallet_id,
      amount,
      type,
      date,
    }: {
      stagedId: string;
      description: string;
      category_id: string | null;
      wallet_id: string | null;
      amount: number;
      type: "income" | "expense";
      date: string;
    }) => {
      // 1. Insert into official transactions table
      const { error: insertError } = await supabase
        .from("transactions")
        .insert({
          user_id: user!.id,
          description,
          category_id,
          wallet_id,
          amount,
          type,
          date,
          status: "paid",
        });
      if (insertError) throw insertError;

      // 2. Mark staged transaction as approved
      const { error: updateError } = await supabase
        .from("staged_transactions")
        .update({ status: "approved", updated_at: new Date().toISOString() })
        .eq("id", stagedId)
        .eq("user_id", user!.id);
      if (updateError) throw updateError;
    },
    onMutate: async ({ stagedId }) => {
      // Optimistic: remove from list immediately
      await queryClient.cancelQueries({ queryKey: ["staged_transactions"] });
      const previous = queryClient.getQueryData<any[]>(["staged_transactions", user?.id]);
      queryClient.setQueryData(
        ["staged_transactions", user?.id],
        (old: any[] | undefined) => old?.filter((t) => t.id !== stagedId) ?? []
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(["staged_transactions", user?.id], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["staged_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });

  const rejectTransaction = useMutation({
    mutationFn: async (stagedId: string) => {
      const { error } = await supabase
        .from("staged_transactions")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", stagedId)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onMutate: async (stagedId) => {
      await queryClient.cancelQueries({ queryKey: ["staged_transactions"] });
      const previous = queryClient.getQueryData<any[]>(["staged_transactions", user?.id]);
      queryClient.setQueryData(
        ["staged_transactions", user?.id],
        (old: any[] | undefined) => old?.filter((t) => t.id !== stagedId) ?? []
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["staged_transactions", user?.id], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["staged_transactions"] });
    },
  });

  return {
    stagedTransactions: query.data ?? [],
    isLoading: query.isLoading,
    approveTransaction,
    rejectTransaction,
  };
};
