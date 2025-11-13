import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { TenantProvider } from "./contexts/TenantContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Dashboard from "./pages/admin/Dashboard";
import Participants from "./pages/admin/Participants";
import Meetings from "./pages/admin/Meetings";
import MeetingDetails from "./pages/admin/MeetingDetails";
import Visitors from "./pages/admin/Visitors";
import CheckIn from "./pages/admin/CheckIn";
import Settings from "./pages/admin/Settings";
import PaymentHistory from "./pages/admin/PaymentHistory";
import PaymentReviews from "./pages/admin/PaymentReviews";
import Authorization from "./pages/admin/Authorization";
import RefundApprovals from "./pages/admin/RefundApprovals";
import LineConfigPage from "./pages/admin/LineConfigPage";
import RichMenuPage from "./pages/admin/RichMenuPage";
import Tenants from "./pages/super-admin/Tenants";
import ChapterProfile from "./pages/public/ChapterProfile";
import CheckInScanner from "./pages/public/CheckInScanner";
import PaymentPage from "./pages/public/PaymentPage";
import NotFound from "./pages/NotFound";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <TenantProvider>
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
          <Route path="/admin/meetings/:meetingId" element={
            <ProtectedRoute>
              <MeetingDetails />
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
          <Route path="/admin/payment-reviews" element={
            <ProtectedRoute>
              <PaymentReviews />
            </ProtectedRoute>
          } />
          <Route path="/admin/authorization" element={
            <ProtectedRoute requiredRole="super_admin">
              <Authorization />
            </ProtectedRoute>
          } />
          <Route path="/admin/refund-approvals" element={
            <ProtectedRoute requiredRole="super_admin">
              <RefundApprovals />
            </ProtectedRoute>
          } />
          <Route path="/admin/line-config" element={
            <ProtectedRoute requiredRole="chapter_admin">
              <LineConfigPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/rich-menu" element={
            <ProtectedRoute requiredRole="chapter_admin">
              <RichMenuPage />
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
      </TenantProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
