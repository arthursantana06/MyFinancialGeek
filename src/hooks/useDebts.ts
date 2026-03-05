import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { TablesInsert } from "@/integrations/supabase/types";

export const useDebts = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["debts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debts")
        .select("*, debtors(*)")
        .eq("user_id", user!.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const addDebt = useMutation({
    mutationFn: async (debt: Omit<TablesInsert<"debts">, "user_id">) => {
      const { data, error } = await supabase
        .from("debts")
        .insert({ ...debt, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["debtors"] });
    },
  });

  const deleteDebt = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("debts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["debtors"] });
    },
  });

  const settleDebt = useMutation({
    mutationFn: async ({ debtId, walletId, paymentMethodId }: { debtId: string; walletId: string | null; paymentMethodId: string | null }) => {
      const debt = (query.data ?? []).find((d) => d.id === debtId);
      if (!debt) throw new Error("Debt not found");

      const debtorName = (debt.debtors as any)?.name || "Unknown";

      // Create settlement transaction
      const { error: txError } = await supabase.from("transactions").insert({
        user_id: user!.id,
        amount: Number(debt.amount),
        type: debt.type === "payable" ? "expense" : "income",
        description: `Liquidação: ${debt.description} - ${debtorName}`,
        wallet_id: walletId,
        payment_method_id: paymentMethodId,
        status: "paid",
        debt_id: debtId,
        date: new Date().toISOString()
      });
      if (txError) throw txError;

      // In this new reality we don't necessarily zero out the debt, 
      // but if the user wants to "settle" they are adding a negative/positive debt or we create a matching transaction.
      // Easiest is to add a counter-debt so the history remains.
      const counterType = debt.type === "payable" ? "receivable" : "payable";

      const { error: debtError } = await supabase
        .from("debts")
        .insert({
          user_id: user!.id,
          debtor_id: debt.debtor_id,
          amount: debt.amount,
          type: counterType,
          description: `Liquidação (Ref: ${debt.description})`,
          date: new Date().toISOString()
        });
      if (debtError) throw debtError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["debtors"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  const debts = query.data ?? [];
  const totalOwed = debts.filter((d) => d.type === "receivable").reduce((s, d) => s + Number(d.amount), 0);
  const totalOwing = debts.filter((d) => d.type === "payable").reduce((s, d) => s + Number(d.amount), 0);
  const netPosition = totalOwed - totalOwing;

  return {
    debts,
    isLoading: query.isLoading,
    addDebt,
    settleDebt,
    deleteDebt,
    totalOwed,
    totalOwing,
    netPosition,
  };
};
