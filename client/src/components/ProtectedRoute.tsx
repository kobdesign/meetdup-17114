import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useUserTenantInfo } from "@/hooks/useUserTenantInfo";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "super_admin" | "chapter_admin" | "member";
}

// Routes that authenticated users can access even without a chapter/role
const ONBOARDING_ROUTES = [
  '/welcome',
  '/create-chapter',
  '/discover-chapters',
  '/invite/',  // Any invite token route
];

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Use React Query hook instead of manual Supabase checks
  const userInfoQuery = useUserTenantInfo();
  const { data: userInfo, isLoading, isFetching } = userInfoQuery;

  const isOnboardingRoute = () => {
    return ONBOARDING_ROUTES.some(route => location.pathname.startsWith(route));
  };

  useEffect(() => {
    // Wait for query to finish loading before making decisions
    if (isLoading || isFetching) {
      console.log("[ProtectedRoute] Query loading, showing loader");
      return;
    }

    // Check if user is authenticated
    if (!userInfo?.userId) {
      console.log("[ProtectedRoute] No user, redirecting to /auth");
      navigate("/auth");
      return;
    }

    // Always allow onboarding routes without any role check
    if (isOnboardingRoute()) {
      console.log("[ProtectedRoute] Onboarding route detected, allowing access");
      return;
    }

    // After query is done and user is authenticated, check roles
    if (requiredRole) {
      // Super admin can access everything
      if (userInfo.isSuperAdmin) {
        console.log("[ProtectedRoute] Super admin access granted");
        return;
      }

      // Check role directly (no mapping needed - database uses actual values)
      if (userInfo.role !== requiredRole) {
        console.log("[ProtectedRoute] Insufficient role, redirecting to /");
        navigate("/");
        return;
      }
    }

    // If no specific role required, just check if user has any role
    if (!requiredRole && !userInfo.role) {
      console.log("[ProtectedRoute] No role assigned, redirecting to /welcome");
      navigate("/welcome");
      return;
    }

    console.log("[ProtectedRoute] Access granted");
  }, [isLoading, isFetching, userInfo, location.pathname, requiredRole, navigate]);

  // Show loader while query is fetching
  if (isLoading || isFetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If not authenticated, don't render anything (redirect will happen in useEffect)
  if (!userInfo?.userId) {
    return null;
  }

  // If onboarding route, always render
  if (isOnboardingRoute()) {
    return <>{children}</>;
  }

  // For protected routes, check role requirements
  if (requiredRole) {
    if (!userInfo.isSuperAdmin && userInfo.role !== requiredRole) {
      return null; // Redirect will happen in useEffect
    }
  } else if (!userInfo.role) {
    return null; // Redirect will happen in useEffect
  }

  return <>{children}</>;
}
