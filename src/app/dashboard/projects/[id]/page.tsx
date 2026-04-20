'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase';
import { ArrowLeft, FolderKanban, Calendar, CheckCircle, Github, Globe } from 'lucide-react';

type ProjectDetail = {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  status: string;
  project_type: string;
  budget_range: string | null;
  deadline: string | null;
  progress: number;
  github_url: string | null;
  demo_url: string | null;
  loom_url: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

export default function ProjectDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProject() {
      try {
        setLoading(true);
        const { data: { user } } = await supabaseBrowser.auth.getUser();
        if (!user) {
          router.push('/auth/login');
          return;
        }

        const { data, error: fetchError } = await supabaseBrowser
          .from('projects')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError || !data) {
          throw fetchError || new Error('Project not found');
        }

        setProject(data as ProjectDetail);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load project');
      } finally {
        setLoading(false);
      }
    }

    loadProject();
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center text-gray-400">
        <p>{error || 'Project not found.'}</p>
        <Link href="/dashboard/projects" className="inline-flex items-center gap-2 mt-6 rounded-xl border border-white/10 px-5 py-3 hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/projects" className="p-2 rounded-xl hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{project.title}</h1>
          <p className="text-gray-400">Project details and progress overview</p>
        </div>
      </div>

      <div className="glass rounded-2xl p-8 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan/10 px-3 py-1 text-sm text-cyan">
              <FolderKanban className="w-4 h-4" />
              {project.project_type.replace('_', ' ')}
            </span>
          </div>
          <div className="space-y-2 text-right">
            <p className="text-sm text-gray-400">Status</p>
            <p className="text-white font-semibold">{project.status.replace('_', ' ')}</p>
          </div>
        </div>

        {project.description && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Description</h2>
            <p className="text-gray-300 whitespace-pre-line">{project.description}</p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-background p-5">
            <p className="text-sm text-gray-400">Budget</p>
            <p className="mt-2 text-white">{project.budget_range || 'Not specified'}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-background p-5">
            <p className="text-sm text-gray-400">Deadline</p>
            <p className="mt-2 text-white">{project.deadline ? new Date(project.deadline).toLocaleDateString() : 'No deadline set'}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-background p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm text-gray-400">Progress</h3>
              <p className="text-lg font-semibold text-white">{project.progress}%</p>
            </div>
            <div className="text-sm text-gray-400">Updated {new Date(project.updated_at).toLocaleDateString()}</div>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
            <div className="h-3 rounded-full bg-cyan" style={{ width: `${project.progress}%` }} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-background p-5 space-y-3">
            <p className="text-sm text-gray-400">Repository</p>
            {project.github_url ? (
              <a href={project.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-cyan hover:underline">
                <Github className="w-4 h-4" />
                View GitHub repo
              </a>
            ) : (
              <p className="text-gray-500">No repository linked</p>
            )}
          </div>
          <div className="rounded-3xl border border-white/10 bg-background p-5 space-y-3">
            <p className="text-sm text-gray-400">Live Demo</p>
            {project.demo_url ? (
              <a href={project.demo_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-cyan hover:underline">
                <Globe className="w-4 h-4" />
                Open demo link
              </a>
            ) : (
              <p className="text-gray-500">No demo URL provided</p>
            )}
          </div>
        </div>

        {project.admin_notes && (
          <div className="rounded-3xl border border-white/10 bg-background p-5">
            <p className="text-sm text-gray-400">Admin Notes</p>
            <p className="mt-2 text-gray-200">{project.admin_notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
