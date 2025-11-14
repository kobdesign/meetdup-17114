import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function Welcome() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleCreateChapter = () => {
    navigate("/create-chapter");
  };

  const handleJoinChapter = () => {
    navigate("/discover-chapters");
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            ยินดีต้อนรับสู่ BNI Management
          </h1>
          <p className="text-muted-foreground">
            เริ่มต้นใช้งานด้วยการสร้าง Chapter ใหม่หรือเข้าร่วม Chapter ที่มีอยู่
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <Card className="hover-elevate cursor-pointer transition-all" onClick={handleCreateChapter}>
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-xl">สร้าง Chapter ใหม่</CardTitle>
              <CardDescription>
                เริ่มต้นจัดการ Chapter ของคุณเอง คุณจะกลายเป็น Admin ทันที
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                size="lg"
                data-testid="button-create-chapter"
              >
                เริ่มสร้าง Chapter
              </Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer transition-all" onClick={handleJoinChapter}>
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center">
                <Search className="h-8 w-8 text-accent" />
              </div>
              <CardTitle className="text-xl">เข้าร่วม Chapter</CardTitle>
              <CardDescription>
                ค้นหาและขอเข้าร่วม Chapter ที่มีอยู่แล้ว
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                size="lg" 
                variant="outline"
                data-testid="button-join-chapter"
              >
                ค้นหา Chapter
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Button 
            variant="ghost" 
            onClick={handleLogout} 
            disabled={loading}
            data-testid="button-logout"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            ออกจากระบบ
          </Button>
        </div>
      </div>
    </div>
  );
}
