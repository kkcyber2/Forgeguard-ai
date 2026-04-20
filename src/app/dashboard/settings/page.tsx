'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { Settings, Bell, Lock, AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    email_notifications: true,
    marketing_emails: false,
    two_factor_enabled: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const { data: userData } = await supabaseBrowser.auth.getUser();
      if (!userData.user) {
        router.push('/auth/login');
      }
    }

    checkAuth();
  }, [router]);

  const handleToggleSetting = (key: keyof typeof settings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      setMessage(null);
      
      // In a real app, save these to a settings table
      // For now, just save to localStorage
      localStorage.setItem('app_settings', JSON.stringify(settings));
      
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabaseBrowser.auth.signOut();
      router.push('/');
    } catch (err) {
      console.error('Error logging out:', err);
      setMessage({ type: 'error', text: 'Failed to logout' });
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-2">Manage your preferences and account settings</p>
      </div>

      {/* Success/Error Message */}
      {message && (
        <div
          className={`px-4 py-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-500/10 border border-green-500 text-green-400'
              : 'bg-red-500/10 border border-red-500 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Notification Settings */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="text-cyan-400" size={24} />
          <h2 className="text-xl font-semibold text-white">Notifications</h2>
        </div>

        <div className="space-y-4">
          {/* Email Notifications */}
          <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
            <div>
              <p className="font-medium text-white">Email Notifications</p>
              <p className="text-sm text-gray-400 mt-1">Receive email updates about your projects</p>
            </div>
            <button
              onClick={() => handleToggleSetting('email_notifications')}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                settings.email_notifications
                  ? 'bg-cyan-500'
                  : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  settings.email_notifications
                    ? 'translate-x-7'
                    : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Marketing Emails */}
          <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
            <div>
              <p className="font-medium text-white">Marketing Emails</p>
              <p className="text-sm text-gray-400 mt-1">Receive updates about new services and features</p>
            </div>
            <button
              onClick={() => handleToggleSetting('marketing_emails')}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                settings.marketing_emails
                  ? 'bg-cyan-500'
                  : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  settings.marketing_emails
                    ? 'translate-x-7'
                    : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Security Settings */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <Lock className="text-cyan-400" size={24} />
          <h2 className="text-xl font-semibold text-white">Security</h2>
        </div>

        <div className="space-y-4">
          {/* Two-Factor Authentication */}
          <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
            <div>
              <p className="font-medium text-white">Two-Factor Authentication</p>
              <p className="text-sm text-gray-400 mt-1">Add an extra layer of security to your account</p>
            </div>
            <button
              onClick={() => handleToggleSetting('two_factor_enabled')}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                settings.two_factor_enabled
                  ? 'bg-cyan-500'
                  : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  settings.two_factor_enabled
                    ? 'translate-x-7'
                    : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Change Password */}
          <button className="w-full p-4 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition-colors text-left">
            <p className="font-medium text-white">Change Password</p>
            <p className="text-sm text-gray-400 mt-1">Update your password regularly for security</p>
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-gray-800/50 border border-red-500/30 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="text-red-400" size={24} />
          <h2 className="text-xl font-semibold text-red-400">Danger Zone</h2>
        </div>

        <button
          onClick={handleLogout}
          className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500 text-red-400 rounded-lg transition-colors font-medium"
        >
          Log Out
        </button>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSaveSettings}
        disabled={isSaving}
        className="w-full px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
      >
        {isSaving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
