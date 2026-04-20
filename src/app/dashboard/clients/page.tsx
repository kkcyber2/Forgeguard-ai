// =====================================================
// Admin Clients Page
// =====================================================

'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, User, Search, Mail, Briefcase, Users, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabaseBrowser } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

type ClientProfile = Database['public']['Tables']['profiles']['Row'];

export default function DashboardClientsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadClients() {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabaseBrowser
          .from('profiles')
          .select('*')
          .eq('role', 'client')
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        setClients((data || []) as ClientProfile[]);
      } catch (err) {
        console.error('Error loading clients:', err);
        setError('Unable to load client directory.');
      } finally {
        setIsLoading(false);
      }
    }

    loadClients();
  }, []);

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const query = searchTerm.toLowerCase();
      return (
        client.full_name?.toLowerCase().includes(query) ||
        client.email.toLowerCase().includes(query) ||
        client.company_name?.toLowerCase().includes(query)
      );
    });
  }, [clients, searchTerm]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <XCircle className="w-12 h-12 mx-auto mb-4 text-red" />
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-400">This section is restricted to administrators.</p>
        </div>
      </div>
    );
  }

  const verifiedCount = clients.filter((client) => client.is_verified).length;
  const pendingCount = clients.length - verifiedCount;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-gray-400">Review and manage client accounts and account verification status.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="search"
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent outline-none text-sm text-gray-200 placeholder:text-gray-500"
          />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-4 md:grid-cols-3"
      >
        <div className="glass rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan/10 flex items-center justify-center text-cyan">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-cyan">Client Directory</p>
              <h2 className="text-xl font-semibold">Total clients</h2>
            </div>
          </div>
          <p className="text-3xl font-bold">{clients.length}</p>
        </div>

        <div className="glass rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-500">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-green-400">Verified</p>
              <h2 className="text-xl font-semibold">Verified accounts</h2>
            </div>
          </div>
          <p className="text-3xl font-bold">{verifiedCount}</p>
        </div>

        <div className="glass rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-yellow-400">Pending verification</p>
              <h2 className="text-xl font-semibold">Requires review</h2>
            </div>
          </div>
          <p className="text-3xl font-bold">{pendingCount}</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6"
      >
        <div className="grid gap-4">
          {error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-300">
              {error}
            </div>
          ) : isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="h-24 rounded-3xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-background p-6 text-center text-gray-400">
              No clients found.
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredClients.map((client) => (
                <div key={client.id} className="rounded-3xl border border-white/10 bg-background p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm text-gray-400 mb-2 uppercase tracking-[0.18em]">{client.company_name || 'Individual'}</div>
                      <h3 className="text-lg font-semibold text-white">{client.full_name || client.email}</h3>
                      <p className="text-sm text-gray-500 mt-2 line-clamp-2">{client.email}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${client.is_verified ? 'bg-green-500/10 text-green-300' : 'bg-yellow-500/10 text-yellow-300'}`}>
                        {client.is_verified ? 'Verified' : 'Pending'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-[0.18em]">Joined</p>
                      <p className="mt-2 text-sm text-gray-200">{new Date(client.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-[0.18em]">Contact</p>
                      <p className="mt-2 text-sm text-gray-200">{client.email}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
