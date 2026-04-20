// =====================================================
// Projects Section
// =====================================================

'use client';

import { useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  Github,
  ExternalLink,
  Play,
  X,
  Code2,
  Shield,
  Bot,
  Lock,
} from 'lucide-react';
import Link from 'next/link';

const projects = [
  {
    id: 'promptguard',
    title: 'PromptGuard',
    subtitle: 'AI Injection Detector',
    description:
      'A system that analyzes user inputs to identify potential attacks before they reach the AI. Uses machine learning to detect suspicious patterns.',
    shortDescription:
      'Real-time prompt injection detection system',
    technologies: ['Python', 'PyTorch', 'FastAPI', 'Redis', 'Docker'],
    githubUrl: 'https://github.com/konainsultan/promptguard',
    demoUrl: 'https://promptguard-demo.forgeguard.ai',
    loomUrl: 'https://www.loom.com/share/example',
    icon: Shield,
    color: 'gray',
    featured: true,
  },
  {
    id: 'redteamllm',
    title: 'RedTeamLLM',
    subtitle: 'Automated Testing Framework',
    description:
      'A framework for testing AI systems automatically. Generates adversarial prompts and produces security reports.',
    shortDescription:
      'Automated LLM security testing framework',
    technologies: ['Python', 'LangChain', 'OpenAI API', 'Streamlit', 'PostgreSQL'],
    githubUrl: 'https://github.com/konainsultan/redteamllm',
    demoUrl: 'https://redteamllm-demo.forgeguard.ai',
    loomUrl: 'https://www.loom.com/share/example',
    icon: Bot,
    color: 'gray',
    featured: true,
  },
  {
    id: 'secureagent',
    title: 'SecureAgent',
    subtitle: 'Hardened AI Assistant',
    description:
      'An AI assistant built with security features including input validation, output filtering, and audit logging.',
    shortDescription: 'Production-ready secure AI assistant',
    technologies: ['TypeScript', 'Next.js', 'OpenAI', 'Prisma', 'Supabase'],
    githubUrl: 'https://github.com/konainsultan/secureagent',
    demoUrl: 'https://secureagent-demo.forgeguard.ai',
    loomUrl: 'https://www.loom.com/share/example',
    icon: Lock,
    color: 'gray',
    featured: true,
  },
  {
    id: 'jailbreakshield',
    title: 'JailbreakShield',
    subtitle: 'Safety Filter',
    description:
      'Advanced filtering system that detects and blocks jailbreak attempts and harmful content generation.',
    shortDescription: 'Real-time safety filtering for AI outputs',
    technologies: ['Python', 'Transformers', 'FastAPI', 'Kubernetes'],
    githubUrl: 'https://github.com/konainsultan/jailbreakshield',
    demoUrl: null,
    loomUrl: null,
    icon: Lock,
    color: 'gray',
    featured: false,
  },
  {
    id: 'adversarialbench',
    title: 'AdversarialBench',
    subtitle: 'ML Testing Suite',
    description:
      'A testing suite for evaluating ML model robustness against adversarial attacks.',
    shortDescription: 'ML model robustness testing and benchmarking',
    technologies: ['Python', 'PyTorch', 'TensorFlow', 'MLflow'],
    githubUrl: 'https://github.com/konainsultan/adversarialbench',
    demoUrl: null,
    loomUrl: null,
    icon: Code2,
    color: 'gray',
    featured: false,
  },
];

const colorClasses: Record<string, { bg: string; text: string; glow: string }> = {
  gray: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    glow: '',
  },
};

function ProjectCard({
  project,
  index,
  onClick,
}: {
  project: (typeof projects)[0];
  index: number;
  onClick: () => void;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const colors = colorClasses[project.color];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="relative group"
      onClick={onClick}
    >
      <div className="bg-white border border-gray-200 rounded-2xl p-6 cursor-pointer h-full transition-all duration-300 hover:border-gray-300 shadow-sm hover:shadow-md">
        {/* Featured Badge */}
        {project.featured && (
          <div className="absolute -top-3 left-6 px-3 py-1 rounded-full bg-gray-900 text-white text-xs font-semibold">
            Featured
          </div>
        )}

        {/* Icon */}
        <div
          className={`w-14 h-14 rounded-xl ${colors.bg} flex items-center justify-center mb-4`}
        >
          <project.icon className={`w-7 h-7 ${colors.text}`} />
        </div>

        {/* Content */}
        <h3 className="text-xl font-bold mb-1 text-gray-900">{project.title}</h3>
        <p className={`text-sm ${colors.text} mb-3`}>{project.subtitle}</p>
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {project.shortDescription}
        </p>

        {/* Technologies */}
        <div className="flex flex-wrap gap-2 mb-4">
          {project.technologies.slice(0, 3).map((tech) => (
            <span
              key={tech}
              className="px-2 py-1 rounded-md bg-gray-100 text-xs text-gray-700"
            >
              {tech}
            </span>
          ))}
          {project.technologies.length > 3 && (
            <span className="px-2 py-1 rounded-md bg-gray-100 text-xs text-gray-700">
              +{project.technologies.length - 3}
            </span>
          )}
        </div>

        {/* Links */}
        <div className="flex items-center gap-3">
          {project.githubUrl && (
            <a
              href={project.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Github className="w-5 h-5 text-gray-700" />
            </a>
          )}
          {project.demoUrl && (
            <a
              href={project.demoUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ExternalLink className="w-5 h-5 text-gray-700" />
            </a>
          )}
          {project.loomUrl && (
            <a
              href={project.loomUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Play className="w-5 h-5 text-gray-700" />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ProjectModal({
  project,
  onClose,
}: {
  project: (typeof projects)[0];
  onClose: () => void;
}) {
  const colors = colorClasses[project.color];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-auto bg-white border border-gray-200 rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
              <project.icon className="w-6 h-6 text-gray-700" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">{project.title}</h3>
              <p className="text-gray-600">{project.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 mb-6">{project.description}</p>

          {/* Technologies */}
          <div className="mb-6">
            <h4 className="font-semibold mb-3 text-gray-900">Technologies:</h4>
            <div className="flex flex-wrap gap-2">
              {project.technologies.map((tech) => (
                <span
                  key={tech}
                  className="px-3 py-1 rounded-full bg-gray-100 text-sm text-gray-700"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* Links */}
          <div className="flex gap-4 pt-4 border-t border-gray-200">
            {project.githubUrl && (
              <a
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
              >
                <Github className="w-4 h-4" />
                View Code
              </a>
            )}
            {project.demoUrl && (
              <a
                href={project.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Live Demo
              </a>
            )}
            {project.loomUrl && (
              <a
                href={project.loomUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Play className="w-4 h-4" />
                Watch Demo
              </a>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Projects() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [selectedProject, setSelectedProject] = useState<(typeof projects)[0] | null>(
    null
  );

  return (
    <section
      id="projects"
      ref={ref}
      className="section relative overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 neural-bg" />

      <div className="container-custom mx-auto relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-2 rounded-full bg-cyan/10 text-cyan text-sm font-medium mb-4">
            Portfolio
          </span>
          <h2 className="text-section font-heading font-bold mb-4">
            Featured <span className="text-cyan">Projects</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Open-source tools and frameworks I&apos;ve built to advance AI security
            research and practice.
          </p>
        </motion.div>

        {/* Projects Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project, index) => (
            <ProjectCard
              key={project.id}
              project={project}
              index={index}
              onClick={() => setSelectedProject(project)}
            />
          ))}
        </div>

        {/* View All CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-12 text-center"
        >
          <a
            href="https://github.com/konainsultan"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-border hover:bg-white/5 transition-colors"
          >
            <Github className="w-5 h-5" />
            View All Projects on GitHub
          </a>
        </motion.div>
      </div>

      {/* Project Modal */}
      <AnimatePresence>
        {selectedProject && (
          <ProjectModal
            project={selectedProject}
            onClose={() => setSelectedProject(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
