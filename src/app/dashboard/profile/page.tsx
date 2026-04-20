'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, Phone, Building } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase';
import { Database } from '@/types/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    company_name: '',
    phone: '',
  });
  const router = useRouter();

  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true);
        const { data: userData } = await supabaseBrowser.auth.getUser();

        if (!userData.user) {
          router.push('/auth/login');
          return;
        }

        const { data, error: fetchError } = await supabaseBrowser
          .from('profiles')
          .select('*')
          .eq('id', userData.user.id)
          .single();

        if (fetchError) throw fetchError;
        const profileData = data as any;
        setProfile(profileData as Profile);
        setFormData({
          full_name: profileData?.full_name || '',
          company_name: profileData?.company_name || '',
          phone: profileData?.phone || '',
        });
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      setIsSaving(true);
      const { error: updateError } = await ((supabaseBrowser
        .from('profiles' as any) as any)
        .update({
          full_name: formData.full_name,
          company_name: formData.company_name,
          phone: formData.phone,
          updated_at: new Date().toISOString(),
        } as any) as any)
        .eq('id', profile.id);

      if (updateError) throw updateError;
      alert('Profile updated successfully!');
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">Failed to load profile</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">My Profile</h1>
        <p className="text-gray-400 mt-2">Manage your account information</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Profile Information */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8">
        {/* Avatar Section */}
        <div className="mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center">
            <User size={48} className="text-white" />
          </div>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Email (Read-only) */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Email</label>
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-700/50 rounded-lg text-gray-400">
              <Mail size={18} />
              <span>{profile.email}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Full Name</label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleInputChange}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none transition-colors"
              placeholder="Enter your full name"
            />
          </div>

          {/* Company Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
              <Building size={16} />
              Company Name
            </label>
            <input
              type="text"
              name="company_name"
              value={formData.company_name}
              onChange={handleInputChange}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none transition-colors"
              placeholder="Enter your company name (optional)"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
              <Phone size={16} />
              Phone Number
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none transition-colors"
              placeholder="Enter your phone number (optional)"
            />
          </div>

          {/* Role (Read-only) */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Account Role</label>
            <div className="px-4 py-2 bg-gray-700/50 rounded-lg text-gray-400 capitalize">
              {profile.role}
            </div>
          </div>

          {/* Verification Status */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Verification Status</label>
            <div className={`px-4 py-2 rounded-lg ${profile.is_verified ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
              {profile.is_verified ? '✓ Verified' : '⚠ Pending Verification'}
            </div>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Account Created Date */}
      <p className="text-sm text-gray-500">
        Account created on {new Date(profile.created_at).toLocaleDateString()}
      </p>
    </div>
  );
}
