import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AutomationRule {
  id: string;
  user_id: string;
  keyword: string;
  category_id: string;
  created_at: string | null;
  categories?: {
    id: string;
    name: string;
    icon: string;
    color: string;
    type: "income" | "expense";
  } | null;
}

export const useAutomationRules = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["automation_rules", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_rules")
        .select("*, categories(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AutomationRule[];
    },
    enabled: !!user,
  });

  const addRule = useMutation({
    mutationFn: async ({ keyword, category_id }: { keyword: string; category_id: string }) => {
      const { data, error } = await supabase
        .from("automation_rules")
        .insert({ keyword: keyword.toLowerCase().trim(), category_id, user_id: user!.id })
        .select("*, categories(*)")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation_rules"] });
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("automation_rules")
        .delete()
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation_rules"] });
    },
  });

  /**
   * Given a transaction description, find the first matching automation rule
   * and return the suggested category_id.
   */
  const findSuggestedCategory = (description: string): string | null => {
    const rules = query.data ?? [];
    const lower = description.toLowerCase();
    const match = rules.find((r) => lower.includes(r.keyword.toLowerCase()));
    return match?.category_id ?? null;
  };

  return {
    rules: query.data ?? [],
    isLoading: query.isLoading,
    addRule,
    deleteRule,
    findSuggestedCategory,
  };
};
