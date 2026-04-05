import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPassword() {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Front-end only for now
    console.log('Forgot password submitted');
    setIsSubmitted(true);
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
              />
            </div>
            <Button type="submit" className="w-full">
              Send Reset Link
            </Button>
          </div>
        </form>
      ) : (
        <div className="rounded-md bg-muted p-4 text-center">
          <p className="text-sm font-medium text-foreground">
            Check your email!
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            If an account exists with that email address, we've sent instructions to reset your password.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setIsSubmitted(false)}
          >
            Try another email
          </Button>
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
