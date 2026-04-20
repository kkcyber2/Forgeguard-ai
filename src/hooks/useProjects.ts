// =====================================================
// Projects Hook
// =====================================================

'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import type { Project, ProjectFile } from '@/types';

export function useProjects() {
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's projects
  const fetchProjects = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await (supabaseBrowser as any)
        .from('projects')
        .select('*')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setProjects(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch single project with files
  const fetchProject = useCallback(async (projectId: string) => {
    if (!user) return null;

    try {
      const { data: project, error: projectError } = await (supabaseBrowser as any)
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('client_id', user.id)
        .single();

      if (projectError) throw projectError;

      const { data: files } = await (supabaseBrowser as any)
        .from('project_files')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      return { ...(project as any), files: (files || []) as ProjectFile[] } as Project;
    } catch (err) {
      console.error('Error fetching project:', err);
      return null;
    }
  }, [user]);

  // Create new project
  const createProject = useCallback(
    async (projectData: Omit<Project, 'id' | 'client_id' | 'created_at' | 'updated_at'>) => {
      if (!user) throw new Error('Not authenticated');

      try {
        const { data, error: createError } = await (supabaseBrowser as any)
          .from('projects')
          .insert({
            ...projectData,
            client_id: user.id,
          })
          .select()
          .single();

        if (createError) throw createError;

        setProjects((prev) => [data as Project, ...prev]);
        return data as Project;
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to create project');
      }
    },
    [user]
  );

  // Update project
  const updateProject = useCallback(
    async (projectId: string, updates: Partial<Project>) => {
      if (!user) throw new Error('Not authenticated');

      try {
        const { data, error: updateError } = await (supabaseBrowser as any)
          .from('projects')
          .update(updates)
          .eq('id', projectId)
          .eq('client_id', user.id)
          .select()
          .single();

        if (updateError) throw updateError;

        setProjects((prev) =>
          prev.map((p) => (p.id === projectId ? (data as Project) : p))
        );
        return data as Project;
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to update project');
      }
    },
    [user]
  );

  // Delete project
  const deleteProject = useCallback(
    async (projectId: string) => {
      if (!user) throw new Error('Not authenticated');

      try {
        const { error: deleteError } = await (supabaseBrowser as any)
          .from('projects')
          .delete()
          .eq('id', projectId)
          .eq('client_id', user.id);

        if (deleteError) throw deleteError;

        setProjects((prev) => prev.filter((p) => p.id !== projectId));
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to delete project');
      }
    },
    [user]
  );

  // Upload file to project
  const uploadProjectFile = useCallback(
    async (projectId: string, file: File, description?: string) => {
      if (!user) throw new Error('Not authenticated');

      try {
        // Upload to storage
        const filePath = `${user.id}/${projectId}/${file.name}`;
        const { error: uploadError } = await supabaseBrowser.storage
          .from('project-files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabaseBrowser.storage
          .from('project-files')
          .getPublicUrl(filePath);

        // Create file record
        const { data: fileRecord, error: fileError } = await (supabaseBrowser as any)
          .from('project_files')
          .insert({
            project_id: projectId,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user.id,
            description,
          })
          .select()
          .single();

        if (fileError) throw fileError;

        return fileRecord as ProjectFile;
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to upload file');
      }
    },
    [user]
  );

  // Subscribe to project updates
  useEffect(() => {
    if (!user) return;

    const subscription = supabaseBrowser
      .channel('projects')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `client_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setProjects((prev) => [payload.new as Project, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setProjects((prev) =>
              prev.map((p) =>
                p.id === payload.new.id ? (payload.new as Project) : p
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setProjects((prev) =>
              prev.filter((p) => p.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user, fetchProjects]);

  return {
    projects,
    isLoading,
    error,
    fetchProjects,
    fetchProject,
    createProject,
    updateProject,
    deleteProject,
    uploadProjectFile,
  };
}
