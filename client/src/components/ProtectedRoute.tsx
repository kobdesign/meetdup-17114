import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "super_admin" | "chapter_admin" | "member";
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else if (requiredRole) {
        checkRole(session.user.id);
      } else {
        setAuthorized(true);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, requiredRole]);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      if (requiredRole) {
        await checkRole(session.user.id);
      } else {
        setAuthorized(true);
      }
    } catch (error) {
      console.error("Auth check error:", error);
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const checkRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error || !data || data.length === 0) {
        navigate("/");
        return;
      }

      // Get the highest priority role
      // Priority: super_admin > chapter_admin > chapter_member
      const roleHierarchy = { super_admin: 3, chapter_admin: 2, chapter_member: 1 };
      const highestRole = data.reduce((highest, current) => {
        const currentPriority = roleHierarchy[current.role as keyof typeof roleHierarchy] || 0;
        const highestPriority = roleHierarchy[highest.role as keyof typeof roleHierarchy] || 0;
        return currentPriority > highestPriority ? current : highest;
      });

      // Super admin can access everything
      if (highestRole.role === "super_admin") {
        setAuthorized(true);
        return;
      }

      // Check if user has required role
      if (requiredRole && highestRole.role !== requiredRole) {
        navigate("/");
        return;
      }

      setAuthorized(true);
    } catch (error) {
      console.error("Role check error:", error);
      navigate("/");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return <>{children}</>;
}
