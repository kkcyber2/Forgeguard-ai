// =====================================================
// Authentication Hook
// =====================================================

'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import type { Profile } from '@/types';

export function useAuth() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, setUser, setLoading, logout } =
    useAuthStore();

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabaseBrowser.auth.getSession();

        if (session?.user) {
          const { data: profile } = await supabaseBrowser
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          setUser((profile as any) || null);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const { data: profile } = await supabaseBrowser
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        setUser(profile ? (profile as Profile) : null);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, setLoading]);

  // Sign up
  const signUp = useCallback(
    async (email: string, password: string, fullName: string, companyName?: string) => {
      try {
        const { data, error } = await supabaseBrowser.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              company_name: companyName,
            },
          },
        });

        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        return { data: null, error: error as Error };
      }
    },
    []
  );

  // Sign in with email/password
  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        const { data, error } = await supabaseBrowser.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        return { data: null, error: error as Error };
      }
    },
    []
  );

  // Sign in with OAuth (Google)
  const signInWithGoogle = useCallback(async () => {
    try {
      const { data, error } = await supabaseBrowser.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      const { error } = await supabaseBrowser.auth.signOut();
      if (error) throw error;
      logout();
      router.push('/');
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, [logout, router]);

  // Reset password
  const resetPassword = useCallback(async (email: string) => {
    try {
      const { data, error } = await supabaseBrowser.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        }
      );

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }, []);

  // Update password
  const updatePassword = useCallback(async (newPassword: string) => {
    try {
      const { data, error } = await supabaseBrowser.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }, []);

  // Update profile
  const updateProfile = useCallback(
    async (updates: Partial<Profile>) => {
      try {
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await (supabaseBrowser as any)
          .from('profiles')
          .update(updates)
          .eq('id', user.id)
          .select()
          .single();

        if (error) throw error;
        setUser(data as Profile);
        return { data, error: null };
      } catch (error) {
        return { data: null, error: error as Error };
      }
    },
    [user, setUser]
  );

  return {
    user,
    isLoading,
    isAuthenticated,
    isAdmin: user?.role === 'admin',
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
  };
}
