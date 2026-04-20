// =====================================================
// Project Submission Page
// =====================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Github,
  FileText,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useSubmissions } from '@/hooks/useSubmissions';
import type { ServiceType } from '@/types';

const serviceOptions = [
  {
    value: 'ai_red_teaming' as ServiceType,
    label: 'AI Red Teaming',
    description: 'Comprehensive security testing of AI systems',
    icon: '🔴',
  },
  {
    value: 'secure_ai_agents' as ServiceType,
    label: 'Secure AI Agents',
    description: 'Development of secure AI agent architectures',
    icon: '🤖',
  },
  {
    value: 'ml_hardening' as ServiceType,
    label: 'ML Model Hardening',
    description: 'Strengthen ML models against adversarial attacks',
    icon: '🛡️',
  },
  {
    value: 'prompt_engineering' as ServiceType,
    label: 'Prompt Engineering',
    description: 'Secure prompt design and injection prevention',
    icon: '💬',
  },
  {
    value: 'consultation' as ServiceType,
    label: 'AI Security Consultation',
    description: 'Expert guidance on AI security best practices',
    icon: '💡',
  },
];

const budgetRanges = [
  'Under $5,000',
  '$5,000 - $15,000',
  '$15,000 - $50,000',
  '$50,000 - $100,000',
  '$100,000+',
  'Custom Quote',
];

const timelineOptions = [
  'ASAP (Rush)',
  '1-2 weeks',
  '2-4 weeks',
  '1-3 months',
  '3-6 months',
  '6+ months',
  'Flexible',
];

export default function SubmitProjectPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { createSubmission } = useSubmissions();

  const [formData, setFormData] = useState({
    github_url: '',
    service_type: '' as ServiceType,
    description: '',
    budget_range: '',
    timeline: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.service_type) {
      newErrors.service_type = 'Please select a service type';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Please provide a project description';
    }

    if (formData.description.trim().length < 50) {
      newErrors.description = 'Please provide at least 50 characters describing your project';
    }

    if (formData.github_url && !formData.github_url.match(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+/)) {
      newErrors.github_url = 'Please enter a valid GitHub repository URL';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('🔍 Submit clicked - validating form...');

    if (!validateForm()) {
      console.log('❌ Form validation failed:', errors);
      return;
    }

    console.log('✅ Form validation passed');
    setIsSubmitting(true);

    try {
      console.log('📤 Creating submission with data:', {
        service_type: formData.service_type,
        description: formData.description,
        github_url: formData.github_url || undefined,
        budget_range: formData.budget_range || undefined,
        timeline: formData.timeline || undefined,
      });

      const { error } = await createSubmission({
        github_url: formData.github_url || undefined,
        service_type: formData.service_type,
        description: formData.description,
        budget_range: formData.budget_range || undefined,
        timeline: formData.timeline || undefined,
      });

      if (error) {
        console.error('❌ API Error:', error);
        const submissionError =
          typeof error === 'string'
            ? error
            : error && typeof error === 'object' && 'message' in error
            ? (error as any).message
            : 'Unknown error';
        throw new Error(submissionError);
      }

      console.log('✅ Submission successful!');
      setIsSubmitted(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('❌ Submission error:', errorMessage);
      setErrors({ submit: `Failed to submit project: ${errorMessage}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return null;
  }

  if (isSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
      >
        <div className="glass rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold mb-4">Project Submitted Successfully!</h1>
          <p className="text-gray-400 mb-6">
            Thank you for submitting your project. Our team will review your request and get back to you within 24-48 hours.
          </p>

          <div className="bg-white/5 rounded-xl p-6 mb-8 text-left">
            <h3 className="font-semibold mb-4">What happens next?</h3>
            <ol className="text-sm text-gray-400 space-y-2 list-decimal pl-5">
              <li>Our team reviews your project requirements</li>
              <li>We may reach out for clarification if needed</li>
              <li>You&apos;ll receive a detailed proposal with timeline and pricing</li>
              <li>Once approved, we&apos;ll begin the security assessment</li>
            </ol>
          </div>

          <div className="flex gap-4 justify-center">
            <Link
              href="/dashboard"
              className="px-6 py-3 rounded-xl bg-cyan text-background font-semibold hover:bg-cyan/90 transition-colors"
            >
              Go to Dashboard
            </Link>
            <Link
              href="/dashboard/projects"
              className="px-6 py-3 rounded-xl border border-white/20 hover:bg-white/5 transition-colors"
            >
              View My Projects
            </Link>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="p-2 rounded-xl hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Submit Project</h1>
          <p className="text-gray-400">Request AI security services from ForgeGuard</p>
        </div>
      </div>

      {/* Form */}
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="glass rounded-2xl p-8 space-y-8"
      >
        {/* Service Type */}
        <div>
          <label className="block text-lg font-semibold mb-4">
            What service do you need?
          </label>
          <div className="grid md:grid-cols-2 gap-4">
            {serviceOptions.map((service) => (
              <label
                key={service.value}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  formData.service_type === service.value
                    ? 'border-cyan bg-cyan/10'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <input
                  type="radio"
                  name="service_type"
                  value={service.value}
                  checked={formData.service_type === service.value}
                  onChange={handleChange}
                  className="sr-only"
                />
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{service.icon}</span>
                  <div>
                    <h3 className="font-medium">{service.label}</h3>
                    <p className="text-sm text-gray-400 mt-1">{service.description}</p>
                  </div>
                </div>
              </label>
            ))}
          </div>
          {errors.service_type && (
            <p className="text-red text-sm mt-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {errors.service_type}
            </p>
          )}
        </div>

        {/* GitHub URL */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            GitHub Repository URL <span className="text-gray-600">(Optional)</span>
          </label>
          <div className="relative">
            <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="url"
              name="github_url"
              value={formData.github_url}
              onChange={handleChange}
              placeholder="https://github.com/username/repository"
              className="w-full bg-gray-900 border border-border rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-cyan transition-colors"
            />
          </div>
          {errors.github_url && (
            <p className="text-red text-sm mt-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {errors.github_url}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Project Description <span className="text-red">*</span>
          </label>
          <div className="relative">
            <FileText className="absolute left-4 top-4 w-5 h-5 text-gray-500" />
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={6}
              placeholder="Please describe your project in detail. Include:
• What you're building
• Current security concerns
• Specific areas you'd like us to focus on
• Any existing security measures
• Expected outcomes"
              className="w-full bg-gray-900 border border-border rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-cyan transition-colors resize-none"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {formData.description.length} characters (minimum 50)
          </p>
          {errors.description && (
            <p className="text-red text-sm mt-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {errors.description}
            </p>
          )}
        </div>

        {/* Budget and Timeline */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Budget Range <span className="text-gray-600">(Optional)</span>
            </label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
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
            <label className="block text-sm text-gray-400 mb-2">
              Preferred Timeline <span className="text-gray-600">(Optional)</span>
            </label>
            <div className="relative">
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <select
                name="timeline"
                value={formData.timeline}
                onChange={handleChange}
                className="w-full bg-gray-900 border border-border rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-cyan transition-colors"
              >
                <option value="">Select timeline</option>
                {timelineOptions.map((timeline) => (
                  <option key={timeline} value={timeline}>{timeline}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Submit Error */}
        {errors.submit && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-red/10 text-red text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errors.submit}</span>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-4 rounded-xl bg-cyan text-background font-semibold hover:bg-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Submit Project
              </>
            )}
          </button>
        </div>
      </motion.form>
    </div>
  );
}