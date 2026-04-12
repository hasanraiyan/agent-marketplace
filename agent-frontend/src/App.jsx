import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { AuthProvider } from '@/context/AuthContext';
import RequireAuth from '@/components/auth/RequireAuth';

// 1. Lazy load pages to optimize bundle size
const Home = lazy(() => import('@/pages/Home'));
const BrowseAgents = lazy(() => import('@/pages/BrowseAgents'));
const Login = lazy(() => import('@/pages/auth/Login'));
const SignUp = lazy(() => import('@/pages/auth/SignUp'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const VerifyEmail = lazy(() => import('@/pages/auth/VerifyEmail'));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'));
const Profile = lazy(() => import('@/pages/Profile'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const AssistantChat = lazy(() => import('@/pages/AssistantChat'));
const MyClones = lazy(() => import('@/pages/MyClones'));
const CloneBuilder = lazy(() => import('@/pages/CloneBuilder'));
const AssistantDetail = lazy(() => import('@/pages/AssistantDetail'));

// 2. Create a fallback UI for Suspense
// Tip: You can replace this with a shadcn Skeleton or Spinner component
const PageLoader = () => (
  <div className="flex h-screen w-screen items-center justify-center">
    <span className="text-muted-foreground">Loading...</span>
  </div>
);

// 3. Create a layout for DRY protected routes
const ProtectedLayout = () => (
  <RequireAuth>
    <Outlet />
  </RequireAuth>
);

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="agent-marketplace-theme">
      <TooltipProvider>
        <AuthProvider>
          <BrowserRouter>
            {/* Wrap routing in Suspense to handle lazy-loaded chunks */}
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/browse" element={<BrowseAgents />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/assistants/:assistantId" element={<AssistantDetail />} />

                {/* Protected Routes */}
                <Route element={<ProtectedLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/clones" element={<MyClones />} />
                  <Route path="/clones/new" element={<CloneBuilder />} />
                  <Route path="/clones/:id/edit" element={<CloneBuilder />} />
                  <Route path="/assistants/:assistantId/chat" element={<AssistantChat />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;