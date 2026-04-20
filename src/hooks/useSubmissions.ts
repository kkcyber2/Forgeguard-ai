// =====================================================
// Project Submissions Hook
// =====================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import type { ProjectSubmission, ServiceType, SubmissionStatus } from '@/types';

export function useSubmissions() {
  const [submissions, setSubmissions] = useState<ProjectSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch submissions
  const fetchSubmissions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await (supabaseBrowser.from('project_submissions' as const) as any)
        .select(`
          *,
          client:profiles!client_id(id, full_name, email, company_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch submissions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create submission
  const createSubmission = useCallback(async (submission: {
    github_url?: string;
    service_type: ServiceType;
    description: string;
    budget_range?: string;
    timeline?: string;
  }) => {
    try {
      console.log('🔐 Getting current user...');
      const { data: { user } } = await supabaseBrowser.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated - no user found');
      }
      console.log('✅ User authenticated:', user.id);

      console.log('📝 Inserting submission into project_submissions table...');
      const { data, error } = await (supabaseBrowser.from('project_submissions' as const) as any)
        .insert({
          client_id: user.id,
          ...submission,
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase error:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      console.log('✅ Submission inserted successfully:', data);

      // Refresh submissions
      await fetchSubmissions();
      return { data, error: null };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('❌ createSubmission error:', errorMsg);
      return { data: null, error: errorMsg };
    }
  }, [fetchSubmissions]);

  // Update submission status (admin only)
  const updateSubmissionStatus = useCallback(async (
    submissionId: string,
    status: SubmissionStatus,
    adminNotes?: string
  ) => {
    try {
      const { data, error } = await (supabaseBrowser.from('project_submissions' as const) as any)
        .update({
          status,
          admin_notes: adminNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', submissionId)
        .select()
        .single();

      if (error) throw error;

      // Refresh submissions
      await fetchSubmissions();
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : 'Failed to update submission' };
    }
  }, [fetchSubmissions]);

  // Delete submission
  const deleteSubmission = useCallback(async (submissionId: string) => {
    try {
      const { error } = await (supabaseBrowser.from('project_submissions' as const) as any)
        .delete()
        .eq('id', submissionId);

      if (error) throw error;

      // Refresh submissions
      await fetchSubmissions();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to delete submission' };
    }
  }, [fetchSubmissions]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  return {
    submissions,
    isLoading,
    error,
    createSubmission,
    updateSubmissionStatus,
    deleteSubmission,
    refetch: fetchSubmissions,
  };
}