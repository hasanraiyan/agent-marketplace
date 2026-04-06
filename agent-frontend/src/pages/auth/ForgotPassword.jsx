import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '@/lib/api';
import AuthLayout from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await authApi.requestPasswordReset({ email });
      setIsSubmitted(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset code');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Enter your email address and we will send you a verification code."
    >
      {!isSubmitted ? (
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && (
              <div className="text-sm text-destructive text-center">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="rounded-md bg-muted p-4 text-center">
          <p className="text-sm font-medium text-foreground">
            Check your email!
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            If an account exists with that email address, we've sent
            instructions to reset your password.
          </p>
          <div className="flex gap-2 justify-center mt-4">
            <Button variant="outline" onClick={() => setIsSubmitted(false)}>
              Try another email
            </Button>
            <Button
              onClick={() => navigate('/reset-password', { state: { email } })}
            >
              Enter Code
            </Button>
          </div>
        </div>
      )}

      <p className="px-8 mt-6 text-center text-sm text-muted-foreground">
        Remember your password?{' '}
        <Link
          to="/login"
          className="underline underline-offset-4 hover:text-primary font-medium"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
