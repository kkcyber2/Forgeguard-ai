// =====================================================
// Admin Analytics Page
// =====================================================

'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Layers, Activity, FolderKanban, MessageSquare, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { useMessages } from '@/hooks/useMessages';
import { useSubmissions } from '@/hooks/useSubmissions';

export default function DashboardAnalyticsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { projects, isLoading: projectsLoading } = useProjects();
  const { submissions, isLoading: submissionsLoading } = useSubmissions();
  const { unreadCount, isLoading: messagesLoading } = useMessages();

  const serviceBreakdown = useMemo(() => {
    return submissions.reduce<Record<string, number>>((acc, submission) => {
      acc[submission.service_type] = (acc[submission.service_type] || 0) + 1;
      return acc;
    }, {});
  }, [submissions]);

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
          <Clock className="w-12 h-12 mx-auto mb-4 text-red" />
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-400">Analytics are available for administrator accounts only.</p>
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: 'Total Submissions',
      value: submissions.length,
      icon: BarChart3,
      description: 'All client requests submitted through the dashboard.',
    },
    {
      label: 'Active Projects',
      value: projects.filter((project) => project.status === 'in_progress').length,
      icon: FolderKanban,
      description: 'Projects currently in active development.',
    },
    {
      label: 'Unread Messages',
      value: unreadCount,
      icon: MessageSquare,
      description: 'Messages waiting for your response.',
    },
    {
      label: 'Pending Reviews',
      value: submissions.filter((submission) => submission.status === 'pending').length,
      icon: Clock,
      description: 'Requests that require review from the team.',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-gray-400">View platform metrics, submission trends, and performance data.</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-gray-300">
          <TrendingUp className="w-5 h-5 text-cyan" />
          Real-time overview
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-6 md:grid-cols-4"
      >
        {stats.map((card) => (
          <div key={card.label} className="glass rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-cyan/10 flex items-center justify-center text-cyan">
                <card.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-gray-400">{card.label}</p>
                <p className="text-2xl font-semibold">{card.value}</p>
              </div>
            </div>
            <p className="text-sm text-gray-500">{card.description}</p>
          </div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-6 lg:grid-cols-[1.5fr_1fr]"
      >
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Service demand</h2>
          {submissionsLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="h-12 rounded-2xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : Object.keys(serviceBreakdown).length === 0 ? (
            <p className="text-gray-400">No submissions available yet.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(serviceBreakdown).map(([service, count]) => (
                <div key={service} className="flex items-center justify-between rounded-3xl border border-white/10 bg-background p-4">
                  <div>
                    <p className="text-sm text-gray-400 capitalize">{service.replace(/_/g, ' ')}</p>
                    <p className="text-lg font-medium text-white">{count} request{count !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-cyan text-xl">
                    <Layers className="w-5 h-5" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Project status</h2>
          {projectsLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="h-12 rounded-2xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'In Progress', count: projects.filter((project) => project.status === 'in_progress').length, color: 'bg-cyan/10 text-cyan' },
                { label: 'Completed', count: projects.filter((project) => project.status === 'completed').length, color: 'bg-green-500/10 text-green-400' },
                { label: 'Pending', count: projects.filter((project) => project.status === 'pending').length, color: 'bg-yellow-500/10 text-yellow-300' },
                { label: 'Cancelled', count: projects.filter((project) => project.status === 'cancelled').length, color: 'bg-red-500/10 text-red-400' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-3xl border border-white/10 bg-background p-4">
                  <span className="text-sm text-gray-400">{item.label}</span>
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${item.color}`}>
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
