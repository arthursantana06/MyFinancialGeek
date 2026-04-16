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
        .in("status", ["pending", "rejected", "approved"])
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

      const { error: updateError } = await supabase
        .from("staged_transactions")
        .update({ 
          status: "approved", 
          suggested_category_id: category_id,
          wallet_id,
          updated_at: new Date().toISOString() 
        })
        .eq("id", stagedId)
        .eq("user_id", user!.id);
      if (updateError) throw updateError;
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["staged_transactions"] });
    },
  });

  const deletePermanently = useMutation({
    mutationFn: async (stagedId: string) => {
      const { error } = await supabase
        .from("staged_transactions")
        .delete()
        .eq("id", stagedId)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["staged_transactions"] });
    },
  });

  const rejectAllPending = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("staged_transactions")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("user_id", user!.id)
        .eq("status", "pending");
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["staged_transactions"] });
    },
  });

  const resetRejectedTransactions = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("staged_transactions")
        .update({ status: "pending", updated_at: new Date().toISOString() })
        .eq("user_id", user!.id)
        .eq("status", "rejected");
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["staged_transactions"] });
    },
  });

  const forceSync = useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase.functions.invoke("pluggy-sync-transactions", {
        body: { itemId, userId: user!.id, force: true },
      });
      if (error) throw error;
      return data;
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
    deletePermanently,
    rejectAllPending,
    resetRejectedTransactions,
    forceSync,
  };
};
