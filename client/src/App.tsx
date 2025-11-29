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
import Welcome from "./pages/Welcome";
import CreateChapter from "./pages/CreateChapter";
import AcceptInvite from "./pages/AcceptInvite";
import DiscoverChapters from "./pages/DiscoverChapters";
import Profile from "./pages/Profile";
import Dashboard from "./pages/admin/Dashboard";
import Participants from "./pages/admin/Participants";
import Meetings from "./pages/admin/Meetings";
import MeetingDetails from "./pages/admin/MeetingDetails";
import Visitors from "./pages/admin/Visitors";
import CheckIn from "./pages/admin/CheckIn";
import Settings from "./pages/admin/Settings";
import Authorization from "./pages/admin/Authorization";
import LineConfigPage from "./pages/admin/LineConfigPage";
import RichMenuPage from "./pages/admin/RichMenuPage";
import MembersManagement from "./pages/admin/MembersManagement";
import ImportMembers from "./pages/admin/ImportMembers";
import Tenants from "./pages/super-admin/Tenants";
import LiffSettings from "./pages/admin/LiffSettings";
import ChapterProfile from "./pages/public/ChapterProfile";
import CheckInScanner from "./pages/public/CheckInScanner";
import VisitorRegister from "./pages/public/VisitorRegister";
import PublicProfile from "./pages/public/PublicProfile";
// DEPRECATED: LIFF-based LINE registration (using message-based flow instead)
// import LineRegister from "./pages/public/LineRegister";
import ParticipantProfile from "./pages/ParticipantProfile";
import Activate from "./pages/Activate";
import LineActivate from "./pages/LineActivate";
import NotFound from "./pages/NotFound";
import LiffSearchHome from "./pages/liff/LiffSearchHome";
import LiffCategories from "./pages/liff/LiffCategories";
import LiffPositions from "./pages/liff/LiffPositions";
import LiffPowerTeams from "./pages/liff/LiffPowerTeams";
import LiffMembersList from "./pages/liff/LiffMembersList";
import LiffBusinessCard from "./pages/liff/LiffBusinessCard";
import LiffShareCard from "./pages/liff/LiffShareCard";

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
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/create-chapter" element={<CreateChapter />} />
          <Route path="/invite/:token" element={<AcceptInvite />} />
          <Route path="/discover-chapters" element={<DiscoverChapters />} />
          
          {/* Public Chapter Profile */}
          <Route path="/chapter/:subdomain" element={<ChapterProfile />} />
          
          {/* Public Member Profile (for sharing) */}
          <Route path="/p/:participantId" element={<PublicProfile />} />
          
          {/* Public Check-In & Registration */}
          <Route path="/checkin/:meetingId" element={<CheckInScanner />} />
          <Route path="/register" element={<VisitorRegister />} />
          {/* DEPRECATED: LIFF-based LINE registration */}
          {/* <Route path="/line-register" element={<LineRegister />} /> */}
          <Route path="/participant-profile/edit" element={<ParticipantProfile />} />
          
          {/* Member Activation */}
          <Route path="/activate/:token" element={<Activate />} />
          <Route path="/line-activate" element={<LineActivate />} />
          
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
            <ProtectedRoute requiredRole="chapter_admin">
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
            <ProtectedRoute requiredRole="chapter_admin">
              <Visitors />
            </ProtectedRoute>
          } />
          <Route path="/admin/checkin" element={
            <ProtectedRoute requiredRole="chapter_admin">
              <CheckIn />
            </ProtectedRoute>
          } />
          <Route path="/admin/settings" element={
            <ProtectedRoute requiredRole="chapter_admin">
              <Settings />
            </ProtectedRoute>
          } />
          <Route path="/admin/authorization" element={
            <ProtectedRoute requiredRole="super_admin">
              <Authorization />
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
          <Route path="/admin/members-management" element={
            <ProtectedRoute requiredRole="chapter_admin">
              <MembersManagement />
            </ProtectedRoute>
          } />
          <Route path="/admin/import-members" element={
            <ProtectedRoute requiredRole="chapter_admin">
              <ImportMembers />
            </ProtectedRoute>
          } />
          
          {/* Super Admin Routes */}
          <Route path="/super-admin/tenants" element={
            <ProtectedRoute requiredRole="super_admin">
              <Tenants />
            </ProtectedRoute>
          } />
          <Route path="/super-admin/liff-settings" element={
            <ProtectedRoute requiredRole="super_admin">
              <LiffSettings />
            </ProtectedRoute>
          } />
          
          {/* LIFF Routes (Public - for LINE in-app browser) */}
          <Route path="/liff/search" element={<LiffSearchHome />} />
          <Route path="/liff/search/category" element={<LiffCategories />} />
          <Route path="/liff/search/category/:code" element={<LiffMembersList />} />
          <Route path="/liff/search/position" element={<LiffPositions />} />
          <Route path="/liff/search/position/:code" element={<LiffMembersList />} />
          <Route path="/liff/search/powerteam" element={<LiffPowerTeams />} />
          <Route path="/liff/search/powerteam/:id" element={<LiffMembersList />} />
          <Route path="/liff/card/:participantId" element={<LiffBusinessCard />} />
          <Route path="/liff/share/:participantId" element={<LiffShareCard />} />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </TenantProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
