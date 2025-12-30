import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface BusinessCategory {
  category_code: string;
  name_th: string;
  name_en: string | null;
  is_active: boolean;
  sort_order: number;
}

interface BusinessCategoriesResponse {
  categories: BusinessCategory[];
}

export function useBusinessCategories() {
  const query = useQuery<BusinessCategoriesResponse>({
    queryKey: ["/api/business-categories"],
    queryFn: () => apiRequest("/api/business-categories"),
    staleTime: 5 * 60 * 1000,
  });

  const categories = query.data?.categories || [];

  const getCategoryLabel = (code: string | null | undefined): string => {
    if (!code) return "";
    const category = categories.find(c => c.category_code === code);
    return category?.name_th || code;
  };

  const getCategoryLabelEn = (code: string | null | undefined): string => {
    if (!code) return "";
    const category = categories.find(c => c.category_code === code);
    return category?.name_en || category?.name_th || code;
  };

  return {
    categories,
    isLoading: query.isLoading,
    getCategoryLabel,
    getCategoryLabelEn,
  };
}
