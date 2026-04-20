// =====================================================
// Dashboard Overview Page
// =====================================================

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FolderKanban,
  MessageSquare,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Plus,
  FileText,
  Users,
  BarChart3,
  Activity,
} from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { useMessages } from '@/hooks/useMessages';
import { useAuth } from '@/hooks/useAuth';
import { useSubmissions } from '@/hooks/useSubmissions';
import { getProjectStatusDisplay, getStatusColor } from '@/lib/utils';

type DashboardStatCard = {
  label: string;
  icon: typeof FileText;
  color: 'cyan' | 'purple' | 'orange' | 'green';
  getValue: (...args: any[]) => number;
};

const adminStatsCards: DashboardStatCard[] = [
  {
    label: 'Total Submissions',
    icon: FileText,
    color: 'cyan',
    getValue: (submissions: any[]) => submissions.length,
  },
  {
    label: 'Pending Reviews',
    icon: Clock,
    color: 'orange',
    getValue: (submissions: any[]) =>
      submissions.filter((s: any) => s.status === 'pending').length,
  },
  {
    label: 'Active Projects',
    icon: FolderKanban,
    color: 'purple',
    getValue: (_: any[], projects: any[]) =>
      projects.filter((p: any) => p.status === 'in_progress').length,
  },
  {
    label: 'Completed Projects',
    icon: CheckCircle,
    color: 'green',
    getValue: (_: any[], projects: any[]) =>
      projects.filter((p: any) => p.status === 'completed').length,
  },
];

const clientStatsCards = [
  {
    label: 'My Projects',
    icon: FolderKanban,
    color: 'cyan',
    getValue: (projects: any[]) => projects.length,
  },
  {
    label: 'Active Projects',
    icon: Activity,
    color: 'purple',
    getValue: (projects: any[]) =>
      projects.filter((p: any) => p.status === 'in_progress').length,
  },
  {
    label: 'Unread Messages',
    icon: MessageSquare,
    color: 'orange',
    getValue: (_: any[], unreadCount: number) => unreadCount,
  },
  {
    label: 'Completed',
    icon: CheckCircle,
    color: 'green',
    getValue: (projects: any[]) =>
      projects.filter((p: any) => p.status === 'completed').length,
  },
];

const colorClasses: Record<string, { bg: string; text: string }> = {
  cyan: { bg: 'bg-cyan/10', text: 'text-cyan' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-500' },
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-500' },
  green: { bg: 'bg-green-500/10', text: 'text-green-500' },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { projects, isLoading: projectsLoading } = useProjects();
  const { unreadCount, isLoading: messagesLoading } = useMessages();
  const { submissions, isLoading: submissionsLoading } = useSubmissions();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !user) {
    return null;
  }

  const isAdmin = user.role === 'admin';
  const statsCards = isAdmin ? adminStatsCards : clientStatsCards;
  const recentProjects = projects.slice(0, 5);
  const recentSubmissions = submissions.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">
            {isAdmin ? 'Admin Dashboard' : 'Client Dashboard'}
          </h1>
          <p className="text-gray-400">
            {isAdmin
              ? 'Manage submissions, projects, and client communications'
              : 'Welcome back! Here\'s your project overview.'
            }
          </p>
        </div>
        {!isAdmin && (
          <Link
            href="/dashboard/submit"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan text-background font-semibold text-sm hover:bg-cyan/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Submit Project
          </Link>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat, index) => {
          const colors = colorClasses[stat.color];
          const value = isAdmin
            ? (stat as typeof adminStatsCards[number]).getValue(submissions, projects)
            : (stat as typeof clientStatsCards[number]).getValue(projects, unreadCount);

          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="glass rounded-xl p-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold">
                    {isAdmin && stat.label.includes('Submission')
                      ? (submissionsLoading ? '-' : value)
                      : projectsLoading && stat.label.includes('Project')
                      ? '-'
                      : messagesLoading && stat.label.includes('Message')
                      ? '-'
                      : value}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${colors.text}`} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Admin: Recent Submissions */}
        {isAdmin ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="glass rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Recent Submissions</h2>
              <Link
                href="/dashboard/submissions"
                className="text-sm text-cyan hover:underline flex items-center gap-1"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {submissionsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-16 bg-white/5 rounded-xl animate-pulse"
                  />
                ))}
              </div>
            ) : recentSubmissions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No submissions yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentSubmissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-white/5"
                  >
                    <div
                      className="w-2 h-12 rounded-full"
                      style={{
                        backgroundColor:
                          submission.status === 'pending' ? '#f59e0b' :
                          submission.status === 'in_progress' ? '#06b6d4' :
                          submission.status === 'completed' ? '#10b981' : '#ef4444',
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate capitalize">
                        {submission.service_type.replace('_', ' ')}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-gray-400">
                        <span>{submission.client?.full_name || 'Unknown Client'}</span>
                        <span>•</span>
                        <span className="capitalize">{submission.status.replace('_', ' ')}</span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-500" />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          /* Client: Recent Projects */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="glass rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">My Projects</h2>
              <Link
                href="/dashboard/projects"
                className="text-sm text-cyan hover:underline flex items-center gap-1"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {projectsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-16 bg-white/5 rounded-xl animate-pulse"
                  />
                ))}
              </div>
            ) : recentProjects.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <FolderKanban className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No projects yet</p>
                <Link
                  href="/dashboard/submit"
                  className="text-cyan hover:underline text-sm"
                >
                  Submit your first project
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recentProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/dashboard/projects/${project.id}`}
                    className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div
                      className="w-2 h-12 rounded-full"
                      style={{
                        backgroundColor: getStatusColor(project.status),
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{project.title}</h3>
                      <div className="flex items-center gap-3 text-sm text-gray-400">
                        <span>{getProjectStatusDisplay(project.status)}</span>
                        <span>•</span>
                        <span>{project.progress}% complete</span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-500" />
                  </Link>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Admin: Admin Actions */}
        {isAdmin ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="space-y-6"
          >
            {/* Admin Actions Card */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-6">Admin Actions</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <Link
                  href="/dashboard/submissions"
                  className="flex items-center gap-3 p-4 rounded-xl bg-cyan/10 hover:bg-cyan/20 transition-colors"
                >
                  <FileText className="w-5 h-5 text-cyan" />
                  <div>
                    <p className="font-medium">Review Submissions</p>
                    <p className="text-sm text-gray-400">Approve or reject requests</p>
                  </div>
                </Link>
                <Link
                  href="/dashboard/messages"
                  className="flex items-center gap-3 p-4 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                >
                  <MessageSquare className="w-5 h-5 text-purple-500" />
                  <div>
                    <p className="font-medium">Client Messages</p>
                    <p className="text-sm text-gray-400">Respond to inquiries</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Submission Status Overview */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-6">Submission Status</h2>
              <div className="space-y-4">
                {[
                  { label: 'Pending Review', count: submissions.filter((s) => s.status === 'pending').length, color: 'bg-yellow-500' },
                  { label: 'In Progress', count: submissions.filter((s) => s.status === 'in_progress').length, color: 'bg-cyan' },
                  { label: 'Completed', count: submissions.filter((s) => s.status === 'completed').length, color: 'bg-green-500' },
                  { label: 'Rejected', count: submissions.filter((s) => s.status === 'rejected').length, color: 'bg-red-500' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                    <span className="flex-1">{item.label}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          /* Client: Quick Actions */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="space-y-6"
          >
            {/* Quick Actions Card */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-6">Quick Actions</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <Link
                  href="/dashboard/submit"
                  className="flex items-center gap-3 p-4 rounded-xl bg-cyan/10 hover:bg-cyan/20 transition-colors"
                >
                  <Plus className="w-5 h-5 text-cyan" />
                  <div>
                    <p className="font-medium">Submit Project</p>
                    <p className="text-sm text-gray-400">Request AI security services</p>
                  </div>
                </Link>
                <Link
                  href="/dashboard/messages"
                  className="flex items-center gap-3 p-4 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                >
                  <MessageSquare className="w-5 h-5 text-purple-500" />
                  <div>
                    <p className="font-medium">Send Message</p>
                    <p className="text-sm text-gray-400">Chat with Konain</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Project Status Overview */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-6">Project Status</h2>
              <div className="space-y-4">
                {[
                  { label: 'In Progress', count: projects.filter((p) => p.status === 'in_progress').length, color: 'bg-cyan' },
                  { label: 'Under Review', count: projects.filter((p) => p.status === 'review').length, color: 'bg-purple-500' },
                  { label: 'Completed', count: projects.filter((p) => p.status === 'completed').length, color: 'bg-green-500' },
                  { label: 'Pending', count: projects.filter((p) => p.status === 'pending').length, color: 'bg-yellow-500' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                    <span className="flex-1">{item.label}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
