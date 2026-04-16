import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { TablesInsert } from "@/integrations/supabase/types";

export const useDebtors = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["debtors", user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("debtors")
                .select("*, debts(*, debt_mutations(*))")
                .eq("user_id", user!.id)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data;
        },
        enabled: !!user,
    });

    const addDebtor = useMutation({
        mutationFn: async (debtor: Omit<TablesInsert<"debtors">, "user_id">) => {
            const { data, error } = await supabase
                .from("debtors")
                .insert({ ...debtor, user_id: user!.id })
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["debtors"] }),
    });

    const deleteDebtor = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("debtors").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["debtors"] }),
    });

    const debtors = (query.data ?? []).map(debtor => {
        const debts = (debtor.debts || []).map((d: any) => {
            const mutations = d.debt_mutations || [];
            const totalPaid = mutations.reduce((acc: number, m: any) => acc + Number(m.amount), 0);
            return {
                ...d,
                currentAmount: Math.max(0, Number(d.amount) - totalPaid),
                mutations
            };
        });
        return { ...debtor, debts };
    });

    return {
        debtors,
        isLoading: query.isLoading,
        addDebtor,
        deleteDebtor,
    };
};
