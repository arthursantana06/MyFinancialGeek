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
        .select("*, debtors(*), debt_mutations(*)")
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
      // First clean up mutations explicitly to ensure no constraint errors regardless of DB config
      await supabase.from("debt_mutations").delete().eq("debt_id", id);
      const { error } = await supabase.from("debts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["debtors"] });
    },
  });

  const addMutation = useMutation({
    mutationFn: async ({ debtId, amount, description }: { debtId: string; amount: number; description: string }) => {
      const { data, error } = await supabase
        .from("debt_mutations")
        .insert({
          debt_id: debtId,
          amount,
          description,
          user_id: user!.id,
          date: new Date().toISOString()
        })
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

  const settleDebt = useMutation({
    mutationFn: async ({ 
      debtId, 
      amount, 
      description 
    }: { 
      debtId: string; 
      amount: number; 
      description: string;
    }) => {
      // For now we just add a mutation as requested (no transaction link)
      return addMutation.mutateAsync({ debtId, amount, description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["debtors"] });
    },
  });

  const debts = (query.data ?? []).map(d => {
    const mutations = (d as any).debt_mutations || [];
    const totalPaid = mutations.reduce((acc: number, m: any) => acc + Number(m.amount), 0);
    return {
      ...d,
      currentAmount: Math.max(0, Number(d.amount) - totalPaid),
      mutations
    };
  });

  const totalOwed = debts.filter((d) => d.type === "receivable").reduce((s, d) => s + Number(d.currentAmount), 0);
  const totalOwing = debts.filter((d) => d.type === "payable").reduce((s, d) => s + Number(d.currentAmount), 0);
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
