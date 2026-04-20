'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase';
import { ArrowLeft, Plus, FileText, Calendar, DollarSign, Activity } from 'lucide-react';

type ProjectFormData = {
  title: string;
  description: string;
  project_type: string;
  budget_range: string;
  deadline: string;
  github_url: string;
  demo_url: string;
};

const projectTypes = [
  { value: 'ai_red_teaming', label: 'AI Red Teaming' },
  { value: 'llm_security_audit', label: 'LLM Security Audit' },
  { value: 'secure_agent_development', label: 'Secure Agent Development' },
  { value: 'ml_model_hardening', label: 'ML Model Hardening' },
  { value: 'prompt_engineering', label: 'Prompt Engineering' },
  { value: 'consultation', label: 'Consultation' },
];

const budgetRanges = [
  'Under $5,000',
  '$5,000 - $15,000',
  '$15,000 - $50,000',
  '$50,000 - $100,000',
  '$100,000+',
  'Custom Quote',
];

export default function NewProjectPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<ProjectFormData>({
    title: '',
    description: '',
    project_type: '',
    budget_range: '',
    deadline: '',
    github_url: '',
    demo_url: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function ensureAuth() {
      const { data: { user } } = await supabaseBrowser.auth.getUser();
      if (!user) {
        router.push('/auth/login');
      }
    }

    ensureAuth();
  }, [router]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!formData.title.trim() || !formData.project_type || !formData.description.trim()) {
      setError('Please fill in the title, project type, and description.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabaseBrowser.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      const { error: insertError } = await (supabaseBrowser.from('projects' as const) as any)
        .insert({
          client_id: user.id,
          title: formData.title,
          description: formData.description,
          project_type: formData.project_type,
          budget_range: formData.budget_range || null,
          deadline: formData.deadline || null,
          github_url: formData.github_url || null,
          demo_url: formData.demo_url || null,
          status: 'pending',
          progress: 0,
        });

      if (insertError) {
        throw insertError;
      }

      router.push('/dashboard/projects');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unable to create project.';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/projects" className="p-2 rounded-xl hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New Project</h1>
          <p className="text-gray-400">Create a new client project request for ForgeGuard delivery.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass rounded-2xl p-8 space-y-8">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Project Title</label>
          <input
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Enter project title"
            className="w-full bg-gray-900 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Project Type</label>
          <select
            name="project_type"
            value={formData.project_type}
            onChange={handleChange}
            className="w-full bg-gray-900 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan transition-colors"
          >
            <option value="">Select a project type</option>
            {projectTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Project Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={6}
            placeholder="Describe the project scope and security goals"
            className="w-full bg-gray-900 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan transition-colors resize-none"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Budget Range</label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <select
                name="budget_range"
                value={formData.budget_range}
                onChange={handleChange}
                className="w-full bg-gray-900 border border-border rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-cyan transition-colors"
              >
                <option value="">Select budget range</option>
                {budgetRanges.map((range) => (
                  <option key={range} value={range}>{range}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Deadline</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="date"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
                className="w-full bg-gray-900 border border-border rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-cyan transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm text-gray-400 mb-2">GitHub URL</label>
            <div className="relative">
              <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="url"
                name="github_url"
                value={formData.github_url}
                onChange={handleChange}
                placeholder="https://github.com/username/repo"
                className="w-full bg-gray-900 border border-border rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-cyan transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Demo URL</label>
            <div className="relative">
              <Activity className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="url"
                name="demo_url"
                value={formData.demo_url}
                onChange={handleChange}
                placeholder="Optional demo or staging URL"
                className="w-full bg-gray-900 border border-border rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-cyan transition-colors"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-3 rounded-xl bg-cyan px-6 py-3 text-sm font-semibold text-background transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating project...' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
}
