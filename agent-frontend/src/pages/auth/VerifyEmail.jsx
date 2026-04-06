import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api';

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const emailFromState = location.state?.email || '';

  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);
    try {
      await authApi.verifyEmail({ email: emailFromState, otp });
      setSuccess('Email verified successfully! You can now sign in.');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message || 'Failed to verify email');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    try {
      await authApi.resendOtp({ email: emailFromState });
      setSuccess('A new verification code has been sent to your email.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to resend code');
    }
  };

  if (!emailFromState) {
    return (
      <AuthLayout title="Verify Email" subtitle="Missing email address">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">Please return to the sign up page and try again.</p>
          <Button onClick={() => navigate('/signup')}>Back to Sign Up</Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Check your inbox"
      subtitle={`We've sent a verification code to ${emailFromState}.`}
    >
      <form onSubmit={handleSubmit}>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="otp">Verification Code</Label>
            <Input
              id="otp"
              type="text"
              placeholder="Enter code"
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
          </div>
          {error && <div className="text-sm text-destructive text-center">{error}</div>}
          {success && <div className="text-sm text-green-600 text-center">{success}</div>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Verifying...' : 'Verify Email'}
          </Button>
        </div>
      </form>
      <p className="px-8 mt-6 text-center text-sm text-muted-foreground">
        Didn't receive a code?{' '}
        <button
          type="button"
          onClick={handleResend}
          className="underline underline-offset-4 hover:text-primary font-medium"
        >
          Resend
        </button>
      </p>
    </AuthLayout>
  );
}
