import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { AuthProvider } from '@/context/AuthContext';
import Home from '@/pages/Home';
import BrowseAgents from '@/pages/BrowseAgents';
import Login from '@/pages/auth/Login';
import SignUp from '@/pages/auth/SignUp';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import VerifyEmail from '@/pages/auth/VerifyEmail';
import ResetPassword from '@/pages/auth/ResetPassword';
import RequireAuth from '@/components/auth/RequireAuth';
import Profile from '@/pages/Profile';

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="agent-marketplace-theme">
      <TooltipProvider>
        <AuthProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/browse" element={<BrowseAgents />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          </Routes>
        </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
