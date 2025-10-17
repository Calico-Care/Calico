import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/client';

/**
 * Example React Query hooks for Supabase
 *
 * These are templates you can copy and modify for your own data models
 */

// Query Keys - helps with cache management
export const exampleKeys = {
  all: ['examples'] as const,
  lists: () => [...exampleKeys.all, 'list'] as const,
  list: (filters: string) => [...exampleKeys.lists(), { filters }] as const,
  details: () => [...exampleKeys.all, 'detail'] as const,
  detail: (id: string) => [...exampleKeys.details(), id] as const,
};

// Example types (replace with your own)
interface ExampleItem {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

/**
 * Fetch all items
 */
export function useExampleItems() {
  return useQuery({
    queryKey: exampleKeys.lists(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('example_table') // Replace with your table name
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ExampleItem[];
    },
  });
}

/**
 * Fetch single item by ID
 */
export function useExampleItem(id: string) {
  return useQuery({
    queryKey: exampleKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('example_table')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as ExampleItem;
    },
    enabled: !!id, // Only run if id exists
  });
}

/**
 * Create new item
 */
export function useCreateExampleItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newItem: Omit<ExampleItem, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('example_table')
        .insert(newItem)
        .select()
        .single();

      if (error) throw error;
      return data as ExampleItem;
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: exampleKeys.lists() });
    },
  });
}

/**
 * Update item
 */
export function useUpdateExampleItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ExampleItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('example_table')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as ExampleItem;
    },
    onSuccess: (data) => {
      // Update specific item in cache
      queryClient.invalidateQueries({ queryKey: exampleKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: exampleKeys.lists() });
    },
  });
}

/**
 * Delete item
 */
export function useDeleteExampleItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('example_table').delete().eq('id', id);

      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      // Refetch the list
      queryClient.invalidateQueries({ queryKey: exampleKeys.lists() });
    },
  });
}
