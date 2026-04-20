'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { Database } from '@/types/supabase';
import Link from 'next/link';
import { Plus, Calendar, AlertCircle } from 'lucide-react';

type Booking = Database['public']['Tables']['bookings']['Row'];

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchBookings() {
      try {
        setLoading(true);
        const { data: userData } = await supabaseBrowser.auth.getUser();

        if (!userData.user) {
          router.push('/auth/login');
          return;
        }

        const { data, error: fetchError } = await supabaseBrowser
          .from('bookings')
          .select('*')
          .eq('client_id', userData.user.id)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        setBookings(data || []);
      } catch (err) {
        console.error('Error fetching bookings:', err);
        setError('Failed to load bookings');
      } finally {
        setLoading(false);
      }
    }

    fetchBookings();
  }, [router]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      completed: 'bg-blue-100 text-blue-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getUrgencyColor = (urgency: string) => {
    const colors: Record<string, string> = {
      low: 'text-blue-400',
      normal: 'text-gray-400',
      high: 'text-orange-400',
      urgent: 'text-red-400',
    };
    return colors[urgency] || 'text-gray-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Service Bookings</h1>
          <p className="text-gray-400 mt-2">Request and manage your service bookings</p>
        </div>
        <Link
          href="/dashboard/bookings/new"
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
        >
          <Plus size={20} />
          New Booking
        </Link>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Bookings List */}
      {bookings.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="mx-auto text-gray-600 mb-4" size={48} />
          <p className="text-gray-400">No bookings yet. Create one to request a service!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <Link
              key={booking.id}
              href={`/dashboard/bookings/${booking.id}`}
              className="group bg-gray-800/50 border border-gray-700 rounded-lg p-6 hover:border-cyan-500 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white group-hover:text-cyan-400 transition-colors">
                    {booking.title}
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">{booking.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2 items-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                      {booking.status}
                    </span>
                    <span className={`text-sm font-medium ${getUrgencyColor(booking.urgency)}`}>
                      {booking.urgency}
                    </span>
                    <span className="text-xs text-gray-500">
                      {booking.project_type.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {booking.preferred_start_date && (
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">Start Date</p>
                    <p className="text-sm text-white font-medium">
                      {new Date(booking.preferred_start_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              {booking.admin_response && (
                <div className="mt-4 p-3 bg-gray-700/50 rounded border border-gray-600">
                  <p className="text-xs font-semibold text-gray-400 mb-1">Admin Response:</p>
                  <p className="text-sm text-gray-300">{booking.admin_response}</p>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
