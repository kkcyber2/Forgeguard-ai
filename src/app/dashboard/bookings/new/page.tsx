'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase';
import { ArrowLeft, Plus, Calendar, DollarSign, ShieldCheck } from 'lucide-react';

type BookingFormData = {
  title: string;
  project_type: string;
  description: string;
  budget_range: string;
  preferred_start_date: string;
  urgency: string;
};

const projectTypes = [
  { value: 'ai_red_teaming', label: 'AI Red Teaming' },
  { value: 'llm_security_audit', label: 'LLM Security Audit' },
  { value: 'secure_agent_development', label: 'Secure Agent Development' },
  { value: 'ml_model_hardening', label: 'ML Model Hardening' },
  { value: 'prompt_engineering', label: 'Prompt Engineering' },
  { value: 'consultation', label: 'Consultation' },
];

const urgencyOptions = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const budgetRanges = [
  'Under $5,000',
  '$5,000 - $15,000',
  '$15,000 - $50,000',
  '$50,000 - $100,000',
  '$100,000+',
  'Custom Quote',
];

export default function NewBookingPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<BookingFormData>({
    title: '',
    project_type: '',
    description: '',
    budget_range: '',
    preferred_start_date: '',
    urgency: 'normal',
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

      const { error: insertError } = await (supabaseBrowser.from('bookings' as const) as any)
        .insert({
          client_id: user.id,
          project_type: formData.project_type,
          title: formData.title,
          description: formData.description,
          budget_range: formData.budget_range || null,
          preferred_start_date: formData.preferred_start_date || null,
          urgency: formData.urgency,
          status: 'pending',
        });

      if (insertError) {
        throw insertError;
      }

      router.push('/dashboard/bookings');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unable to create booking.';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/bookings" className="p-2 rounded-xl hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New Booking</h1>
          <p className="text-gray-400">Request a new security booking for your project.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass rounded-2xl p-8 space-y-8">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Booking Title</label>
          <input
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Enter booking title"
            className="w-full bg-gray-900 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Service Type</label>
          <select
            name="project_type"
            value={formData.project_type}
            onChange={handleChange}
            className="w-full bg-gray-900 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan transition-colors"
          >
            <option value="">Select service type</option>
            {projectTypes.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={6}
            placeholder="Describe your booking needs and timeline"
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
            <label className="block text-sm text-gray-400 mb-2">Preferred Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="date"
                name="preferred_start_date"
                value={formData.preferred_start_date}
                onChange={handleChange}
                className="w-full bg-gray-900 border border-border rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-cyan transition-colors"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Urgency</label>
          <div className="relative">
            <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <select
              name="urgency"
              value={formData.urgency}
              onChange={handleChange}
              className="w-full bg-gray-900 border border-border rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-cyan transition-colors"
            >
              {urgencyOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
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
            {isSubmitting ? 'Creating booking...' : 'Create Booking'}
          </button>
        </div>
      </form>
    </div>
  );
}
