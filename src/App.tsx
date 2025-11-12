import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Dashboard from "./pages/admin/Dashboard";
import Participants from "./pages/admin/Participants";
import Meetings from "./pages/admin/Meetings";
import Visitors from "./pages/admin/Visitors";
import CheckIn from "./pages/admin/CheckIn";
import Analytics from "./pages/admin/Analytics";
import Settings from "./pages/admin/Settings";
import PaymentHistory from "./pages/admin/PaymentHistory";
import Tenants from "./pages/super-admin/Tenants";
import ChapterProfile from "./pages/public/ChapterProfile";
import CheckInScanner from "./pages/public/CheckInScanner";
import PaymentPage from "./pages/public/PaymentPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Public Chapter Profile */}
          <Route path="/chapter/:slug" element={<ChapterProfile />} />
          
          {/* Public Check-In */}
          <Route path="/checkin/:meetingId" element={<CheckInScanner />} />
          
          {/* Public Payment */}
          <Route path="/payment/:participantId" element={<PaymentPage />} />
          
          {/* Protected Routes */}
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/participants" element={
            <ProtectedRoute>
              <Participants />
            </ProtectedRoute>
          } />
          <Route path="/admin/meetings" element={
            <ProtectedRoute>
              <Meetings />
            </ProtectedRoute>
          } />
          <Route path="/admin/visitors" element={
            <ProtectedRoute>
              <Visitors />
            </ProtectedRoute>
          } />
          <Route path="/admin/checkin" element={
            <ProtectedRoute>
              <CheckIn />
            </ProtectedRoute>
          } />
          <Route path="/admin/analytics" element={
            <ProtectedRoute>
              <Analytics />
            </ProtectedRoute>
          } />
          <Route path="/admin/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />
          <Route path="/admin/payment-history/:participantId" element={
            <ProtectedRoute>
              <PaymentHistory />
            </ProtectedRoute>
          } />
          
          {/* Super Admin Routes */}
          <Route path="/super-admin/tenants" element={
            <ProtectedRoute requiredRole="super_admin">
              <Tenants />
            </ProtectedRoute>
          } />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
