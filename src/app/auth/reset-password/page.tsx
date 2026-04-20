'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { Lock, Mail, ArrowRight } from 'lucide-react';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!email) {
      setMessage({ type: 'error', text: 'Please enter your email address' });
      return;
    }

    try {
      setIsLoading(true);

      const { error } = await supabaseBrowser.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password/update`,
      });

      if (error) throw error;

      setSuccess(true);
      setMessage({
        type: 'success',
        text: 'Password reset instructions have been sent to your email. Please check your inbox.',
      });
    } catch (err: any) {
      console.error('Error resetting password:', err);
      setMessage({
        type: 'error',
        text: err.message || 'Failed to send reset instructions. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Back Link */}
        <Link href="/auth/login" className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1 mb-8">
          ← Back to Login
        </Link>

        {/* Card */}
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700 rounded-2xl p-8">
          {/* Icon */}
          <div className="mb-6 flex justify-center">
            <div className="p-4 bg-cyan-500/10 rounded-lg">
              <Lock className="text-cyan-400" size={32} />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white text-center mb-2">Reset Password</h1>
          <p className="text-gray-400 text-center mb-8">
            Enter your email address and we&apos;ll send you a link to reset your password
          </p>

          {/* Message */}
          {message && (
            <div
              className={`px-4 py-3 rounded-lg mb-6 ${
                message.type === 'success'
                  ? 'bg-green-500/10 border border-green-500 text-green-400'
                  : 'bg-red-500/10 border border-red-500 text-red-400'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Form */}
          {!success ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {/* Email Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-gray-500" size={20} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none transition-colors"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center justify-center gap-2"
              >
                {isLoading ? 'Sending...' : (
                  <>
                    Send Reset Link
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-gray-400">
                Check your email for the password reset link. The link will expire in 24 hours.
              </p>
              <Link
                href="/auth/login"
                className="inline-block px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors font-medium"
              >
                Back to Login
              </Link>
            </div>
          )}

          {/* Footer Link */}
          <p className="text-center text-gray-400 text-sm mt-8">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="text-cyan-400 hover:text-cyan-300 font-medium">
              Sign up here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
