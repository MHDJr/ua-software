"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, Idea } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export function useIdeas(options: any = {}) {
    const { userRole, profile } = useAuth();
    const queryClient = useQueryClient();

    // 1. Fetch all records from the ideas table (ordered by created_at descending)
    const {
        data: ideas = [],
        isLoading,
        error,
        isFetching,
        refetch
    } = useQuery({
        queryKey: ["ideas", userRole, profile?.id],
        queryFn: async () => {
            console.log("Fetching ideas from Supabase...");
            let query = supabase
                .from("ideas")
                .select("*, profiles!created_by(role, is_manager)")
                .eq("archived", false)
                .order("created_at", { ascending: false });

            const { data, error } = await query;

            if (error) {
                console.error("Error fetching ideas:", error);
                throw new Error(error.message);
            }

            if (!userRole) return [];
            
            return data.filter((idea: any) => {
                const creatorRole = idea.profiles?.role;
                const creatorIsManager = idea.profiles?.is_manager;
                
                if (userRole === 'CEO') {
                    return creatorRole === 'ceo';
                } else if (userRole === 'MANAGER') {
                    return creatorRole === 'manager' || creatorIsManager === true;
                }
                return false;
            });
        },
        staleTime: 1000 * 60 * 2,
        ...options
    });

    // 2. Mutation for toggling completion
    const toggleIdeaMutation = useMutation({
        mutationFn: async ({ ideaId, isCompleted }: { ideaId: string, isCompleted: boolean }) => {
            const { error } = await supabase
                .from("ideas")
                .update({
                    completed: !isCompleted,
                    completed_at: !isCompleted ? new Date().toISOString() : null,
                    updated_at: new Date().toISOString()
                })
                .eq("id", ideaId);
            
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["ideas"] });
        }
    });

    // 3. Mutation for disposing idea
    const disposeIdeaMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("ideas").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["ideas"] });
        }
    });

    return {
        ideas,
        isLoading,
        isFetching,
        error,
        refetch,
        toggleIdea: toggleIdeaMutation.mutate,
        disposeIdea: disposeIdeaMutation.mutate
    };
}
