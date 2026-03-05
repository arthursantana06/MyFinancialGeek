import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { TablesInsert } from "@/integrations/supabase/types";

export const useWallets = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
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

  const addWallet = useMutation({
    mutationFn: async (wallet: Omit<TablesInsert<"wallets">, "user_id">) => {
      const { data, error } = await supabase
        .from("wallets")
        .insert({ ...wallet, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wallets"] }),
  });

  // Credit card invoice logic
  const getCreditCardInvoice = (walletId: string, closingDay: number) => {
    const now = new Date();
    const currentDay = now.getDate();

    // If past closing day, current invoice started after closing day this month
    // If before closing day, current invoice started after closing day last month
    let invoiceStart: Date;
    if (currentDay > closingDay) {
      invoiceStart = new Date(now.getFullYear(), now.getMonth(), closingDay + 1);
    } else {
      invoiceStart = new Date(now.getFullYear(), now.getMonth() - 1, closingDay + 1);
    }

    return supabase
      .from("transactions")
      .select("amount")
      .eq("user_id", user!.id)
      .eq("wallet_id", walletId)
      .eq("type", "expense")
      .gte("date", invoiceStart.toISOString())
      .then(({ data, error }) => {
        if (error) throw error;
        return (data ?? []).reduce((sum, t) => sum + Number(t.amount), 0);
      });
  };

  return {
    wallets: query.data ?? [],
    isLoading: query.isLoading,
    addWallet,
    getCreditCardInvoice,
  };
};
