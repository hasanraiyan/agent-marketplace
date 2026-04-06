import React from 'react';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';

export default function Profile() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-card rounded-lg border shadow-sm p-6">
          <h1 className="text-2xl font-bold mb-4">My Account</h1>
          {user ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 max-w-sm">
                <div>
                  <p className="text-sm text-muted-foreground">First Name</p>
                  <p className="font-medium">{user.firstName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Name</p>
                  <p className="font-medium">{user.lastName || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{user.email}</p>
                </div>
              </div>
            </div>
          ) : (
            <p>Loading profile...</p>
          )}
        </div>
      </main>
    </div>
  );
}
