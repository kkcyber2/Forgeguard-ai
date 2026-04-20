// =====================================================
// Submissions Management Page (Admin Only)
// =====================================================

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  MoreVertical,
  User,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSubmissions } from '@/hooks/useSubmissions';
import type { SubmissionStatus } from '@/types';

const statusConfig = {
  pending: { label: 'Pending Review', color: 'bg-yellow-500', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-cyan', icon: AlertCircle },
  completed: { label: 'Completed', color: 'bg-green-500', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-500', icon: XCircle },
};

export default function SubmissionsPage() {
  const { user } = useAuth();
  const { submissions, isLoading, updateSubmissionStatus } = useSubmissions();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | 'all'>('all');
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null);

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red" />
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-400">You don&apos;t have permission to view this page.</p>
        </div>
      </div>
    );
  }

  const filteredSubmissions = submissions.filter((submission) => {
    const matchesSearch =
      submission.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      submission.service_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      submission.client?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      submission.client?.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || submission.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = async (submissionId: string, newStatus: SubmissionStatus) => {
    await updateSubmissionStatus(submissionId, newStatus);
    setSelectedSubmission(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Project Submissions</h1>
          <p className="text-gray-400">Review and manage client project requests</p>
        </div>
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6"
      >
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search submissions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-900 border border-border rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-cyan transition-colors"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as SubmissionStatus | 'all')}
              className="bg-gray-900 border border-border rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-cyan transition-colors min-w-[150px]"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </motion.div>

      {/* Submissions List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="space-y-4"
      >
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="glass rounded-2xl p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-white/10 rounded w-1/4 mb-4"></div>
                  <div className="h-3 bg-white/10 rounded w-1/2 mb-2"></div>
                  <div className="h-3 bg-white/10 rounded w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No submissions found</h3>
            <p className="text-gray-400">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'No project submissions yet.'}
            </p>
          </div>
        ) : (
          filteredSubmissions.map((submission) => {
            const statusInfo = statusConfig[submission.status];
            const StatusIcon = statusInfo.icon;

            return (
              <div key={submission.id} className="glass rounded-2xl p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`w-3 h-3 rounded-full ${statusInfo.color} mt-2`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold capitalize">
                            {submission.service_type.replace('_', ' ')}
                          </h3>
                          <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 ${
                            submission.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                            submission.status === 'in_progress' ? 'bg-cyan/20 text-cyan' :
                            submission.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                            'bg-red-500/20 text-red-500'
                          }`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusInfo.label}
                          </div>
                        </div>

                        {/* Client Info */}
                        <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>{submission.client?.full_name || 'Unknown Client'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(submission.created_at)}</span>
                          </div>
                          {submission.budget_range && (
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4" />
                              <span>{submission.budget_range}</span>
                            </div>
                          )}
                        </div>

                        {/* Description */}
                        <p className="text-gray-300 text-sm mb-4 line-clamp-3">
                          {submission.description}
                        </p>

                        {/* Links */}
                        <div className="flex items-center gap-4 text-sm">
                          {submission.github_url && (
                            <a
                              href={submission.github_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan hover:underline flex items-center gap-1"
                            >
                              <FileText className="w-4 h-4" />
                              View Repository
                            </a>
                          )}
                          {submission.timeline && (
                            <span className="text-gray-400 flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {submission.timeline}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="relative">
                    <button
                      onClick={() => setSelectedSubmission(
                        selectedSubmission === submission.id ? null : submission.id
                      )}
                      className="p-2 rounded-xl hover:bg-white/5 transition-colors"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>

                    {selectedSubmission === submission.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute right-0 top-12 w-48 glass rounded-xl p-2 z-10"
                      >
                        <div className="space-y-1">
                          {submission.status !== 'in_progress' && (
                            <button
                              onClick={() => handleStatusChange(submission.id, 'in_progress')}
                              className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-sm flex items-center gap-2"
                            >
                              <AlertCircle className="w-4 h-4 text-cyan" />
                              Mark In Progress
                            </button>
                          )}
                          {submission.status !== 'completed' && (
                            <button
                              onClick={() => handleStatusChange(submission.id, 'completed')}
                              className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-sm flex items-center gap-2"
                            >
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              Mark Completed
                            </button>
                          )}
                          {submission.status !== 'rejected' && (
                            <button
                              onClick={() => handleStatusChange(submission.id, 'rejected')}
                              className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-sm flex items-center gap-2"
                            >
                              <XCircle className="w-4 h-4 text-red-500" />
                              Mark Rejected
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Admin Notes */}
                {submission.admin_notes && (
                  <div className="mt-4 p-4 bg-white/5 rounded-xl">
                    <h4 className="text-sm font-medium mb-2">Admin Notes:</h4>
                    <p className="text-sm text-gray-400">{submission.admin_notes}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </motion.div>
    </div>
  );
}