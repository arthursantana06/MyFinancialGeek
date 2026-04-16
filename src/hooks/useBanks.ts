import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Bank {
  id: string;
  name: string;
  color: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export const useBanks = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: banks = [], isLoading } = useQuery({
    queryKey: ["banks", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("banks")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Bank[];
    },
    enabled: !!user,
  });

  const addBank = useMutation({
    mutationFn: async (newBank: Partial<Bank>) => {
      if (!user) throw new Error("User not authenticated");
      const { data, error } = await supabase
        .from("banks")
        .insert([{ ...newBank, user_id: user.id }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banks"] });
    },
  });

  const updateBank = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Bank> & { id: string }) => {
      const { data, error } = await supabase
        .from("banks")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banks"] });
    },
  });

  const deleteBank = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("banks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banks"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });

  return {
    banks,
    isLoading,
    addBank,
    updateBank,
    deleteBank,
  };
};
