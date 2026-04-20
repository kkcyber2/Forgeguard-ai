'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase';
import { ArrowLeft, Calendar, AlertTriangle, ShieldCheck, Users } from 'lucide-react';

type BookingDetail = {
  id: string;
  client_id: string;
  project_type: string;
  title: string;
  description: string;
  budget_range: string | null;
  preferred_start_date: string | null;
  urgency: string;
  status: string;
  admin_response: string | null;
  created_at: string;
  updated_at: string;
};

export default function BookingDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBooking() {
      try {
        setLoading(true);
        const { data: { user } } = await supabaseBrowser.auth.getUser();
        if (!user) {
          router.push('/auth/login');
          return;
        }

        const { data, error: fetchError } = await supabaseBrowser
          .from('bookings')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError || !data) {
          throw fetchError || new Error('Booking not found');
        }

        setBooking(data as BookingDetail);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load booking');
      } finally {
        setLoading(false);
      }
    }

    loadBooking();
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center text-gray-400">
        <p>{error || 'Booking not found.'}</p>
        <Link href="/dashboard/bookings" className="inline-flex items-center gap-2 mt-6 rounded-xl border border-white/10 px-5 py-3 hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Bookings
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/bookings" className="p-2 rounded-xl hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{booking.title}</h1>
          <p className="text-gray-400">Booking details and status</p>
        </div>
      </div>

      <div className="glass rounded-2xl p-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Service Type</p>
            <p className="text-white font-semibold">{booking.project_type.replace('_', ' ')}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan/10 px-3 py-1 text-sm text-cyan">
            <ShieldCheck className="w-4 h-4" />
            {booking.urgency}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-background p-6">
          <h2 className="text-lg font-semibold text-white">Description</h2>
          <p className="mt-3 text-gray-300 whitespace-pre-line">{booking.description}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-background p-5">
            <p className="text-sm text-gray-400">Status</p>
            <p className="mt-2 text-white font-semibold">{booking.status}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-background p-5">
            <p className="text-sm text-gray-400">Preferred Start</p>
            <p className="mt-2 text-white">{booking.preferred_start_date ? new Date(booking.preferred_start_date).toLocaleDateString() : 'Not specified'}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-background p-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-gray-400">Budget</p>
            <p className="mt-2 text-white">{booking.budget_range || 'Not specified'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Client</p>
            <p className="mt-2 text-white">{booking.client_id}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-background p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-400">Admin Response</p>
              <p className="text-xs text-gray-500">Updated {new Date(booking.updated_at).toLocaleDateString()}</p>
            </div>
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
          </div>
          <p className="text-gray-300">
            {booking.admin_response || 'No response has been posted yet.'}
          </p>
        </div>
      </div>
    </div>
  );
}
