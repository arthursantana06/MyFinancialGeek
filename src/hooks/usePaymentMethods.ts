import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type PaymentMethod = Tables<"payment_methods">;

export const usePaymentMethods = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const { data: paymentMethods = [], isLoading } = useQuery({
        queryKey: ["payment_methods", user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("payment_methods")
                .select("*")
                .order("created_at", { ascending: true });

            if (error) throw error;
            return data as PaymentMethod[];
        },
        enabled: !!user,
    });

    const addPaymentMethod = useMutation({
        mutationFn: async (method: Omit<TablesInsert<"payment_methods">, "user_id">) => {
            if (!user) throw new Error("Not authenticated");
            const { data, error } = await supabase
                .from("payment_methods")
                .insert({ ...method, user_id: user.id } as TablesInsert<"payment_methods">)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["payment_methods", user?.id] });
        },
    });

    const deletePaymentMethod = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("payment_methods").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["payment_methods", user?.id] });
        },
    });

    return {
        paymentMethods,
        isLoading,
        addPaymentMethod,
        deletePaymentMethod,
    };
};
