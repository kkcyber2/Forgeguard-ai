// =====================================================
// Signup Page
// =====================================================

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Shield,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Building2,
  Chrome,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function SignupPage() {
  const router = useRouter();
  const { signUp, signInWithGoogle } = useAuth();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    companyName: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Enhanced validation
    if (formData.fullName.length < 2 || formData.fullName.length > 100) {
      setError('Full name must be between 2 and 100 characters');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    // Password complexity requirements
    const hasUpperCase = /[A-Z]/.test(formData.password);
    const hasLowerCase = /[a-z]/.test(formData.password);
    const hasNumbers = /\d/.test(formData.password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await signUp(
        formData.email,
        formData.password,
        formData.fullName,
        formData.companyName
      );
      if (error) throw error;
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    const { error } = await signInWithGoogle();
    if (error) {
      setError(error.message);
    }
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-10 text-center max-w-md mx-auto"
      >
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan to-blue-500 flex items-center justify-center">
          <Mail className="w-10 h-10 text-black" />
        </div>

        <h2 className="text-3xl font-bold mb-3 text-white">
          Check Your Email
        </h2>

        <p className="text-gray-400 text-lg mb-8">
          We sent a confirmation link to <br />
          <span className="text-cyan font-medium">{formData.email}</span>
        </p>

        <div className="bg-white/5 rounded-xl p-6 mb-8 text-left">
          <p className="text-sm text-gray-300 mb-4">
            To complete your registration and access the dashboard:
          </p>
          <ol className="text-sm text-gray-400 space-y-2 list-decimal pl-5">
            <li>Go to your inbox (and check spam folder)</li>
            <li>Click the confirmation link in the email</li>
            <li>Come back here and sign in</li>
          </ol>
        </div>

        <div className="space-y-3">
          <Link
            href="/auth/login"
            className="block w-full py-4 rounded-xl bg-cyan text-black font-semibold hover:bg-cyan/90 transition-colors"
          >
            Go to Sign In
          </Link>

          <button
            onClick={() => window.location.reload()}
            className="block w-full py-4 rounded-xl border border-white/20 hover:bg-white/5 transition-colors text-sm"
          >
            I already confirmed — try signing in
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-8">
          Didn&apos;t receive the email? Check spam or contact konain@forgeguard.ai
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass rounded-2xl p-8"
    >
      {/* Logo */}
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2 mb-4">
          <Shield className="w-10 h-10 text-cyan" />
          <div className="flex flex-col">
            <span className="font-heading font-bold text-xl">ForgeGuard</span>
            <span className="text-[10px] text-cyan tracking-wider uppercase">
              AI Security
            </span>
          </div>
        </Link>
        <h1 className="text-2xl font-bold mb-2">Create Account</h1>
        <p className="text-gray-400 text-sm">
          Join ForgeGuard AI to access exclusive client features
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-4 rounded-xl bg-red/10 text-red text-sm mb-6"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      {/* Social Login */}
      <div className="space-y-3 mb-6">
        <button
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-border hover:bg-white/5 transition-colors"
        >
          <Chrome className="w-5 h-5" />
          <span className="text-sm">Continue with Google</span>
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-sm text-gray-500">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Full Name</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
              className="w-full bg-gray-900 border border-border rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-cyan transition-colors"
              placeholder="John Doe"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Email</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full bg-gray-900 border border-border rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-cyan transition-colors"
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Company Name <span className="text-gray-600">(Optional)</span>
          </label>
          <div className="relative">
            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              name="companyName"
              value={formData.companyName}
              onChange={handleChange}
              className="w-full bg-gray-900 border border-border rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-cyan transition-colors"
              placeholder="Acme Inc."
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={8}
              className="w-full bg-gray-900 border border-border rounded-xl pl-12 pr-12 py-3 text-sm focus:outline-none focus:border-cyan transition-colors"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className="w-full bg-gray-900 border border-border rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-cyan transition-colors"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            required
            className="mt-1 rounded border-border bg-gray-900"
          />
          <span className="text-sm text-gray-400">
            I agree to the{' '}
            <Link href="/terms" className="text-cyan hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-cyan hover:underline">
              Privacy Policy
            </Link>
          </span>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-cyan text-background font-semibold hover:bg-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
              Creating account...
            </>
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      {/* Sign In Link */}
      <p className="text-center text-sm text-gray-400 mt-6">
        Already have an account?{' '}
        <Link href="/auth/login" className="text-cyan hover:underline">
          Sign in
        </Link>
      </p>

      {/* Back Link */}
      <Link
        href="/"
        className="block text-center text-sm text-gray-500 hover:text-gray-300 mt-4"
      >
        ← Back to home
      </Link>
    </motion.div>
  );
}
