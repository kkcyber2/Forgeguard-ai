// =====================================================
// Skills Section
// =====================================================

'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Brain,
  Shield,
  Code2,
  Cloud,
  Terminal,
  Database,
  Layers,
  Server,
  Flame,
  Link,
  Smile,
  MessageCircle,
  Search,
  Target,
  Activity,
  Map,
  ShieldAlert,
  Cpu,
  GitBranch,
  Globe,
  Cog,
  Table,
} from 'lucide-react';

const skillCategories = [
  {
    id: 'ai_ml_tools',
    name: 'AI/ML & Security',
    icon: Brain,
    color: 'default',
    skills: [
      { name: 'Prompt Engineering & AI Security', proficiency: 96, icon: MessageCircle },
      { name: 'OpenAI GPT-4/3.5', proficiency: 95, icon: MessageCircle },
      { name: 'LangChain', proficiency: 90, icon: Link },
      { name: 'LlamaIndex', proficiency: 85, icon: Database },
      { name: 'Hugging Face', proficiency: 88, icon: Smile },
      { name: 'PyTorch', proficiency: 82, icon: Flame },
      { name: 'Anthropic Claude', proficiency: 92, icon: Brain },
    ],
  },
  {
    id: 'red_teaming_tools',
    name: 'Security & Compliance',
    icon: Shield,
    color: 'default',
    skills: [
      { name: 'Cybersecurity Fundamentals', proficiency: 94, icon: Shield },
      { name: 'Kali Linux Tools', proficiency: 95, icon: Terminal },
      { name: 'Burp Suite', proficiency: 88, icon: Search },
      { name: 'Metasploit', proficiency: 85, icon: Target },
      { name: 'Wireshark', proficiency: 80, icon: Activity },
      { name: 'OWASP ZAP', proficiency: 85, icon: ShieldAlert },
    ],
  },
  {
    id: 'programming',
    name: 'Programming',
    icon: Code2,
    color: 'default',
    skills: [
      { name: 'Python', proficiency: 95, icon: Code2 },
      { name: 'TypeScript/JavaScript', proficiency: 92, icon: Code2 },
      { name: 'Go', proficiency: 78, icon: Server },
      { name: 'Rust', proficiency: 75, icon: Cog },
      { name: 'SQL', proficiency: 88, icon: Table },
    ],
  },
  {
    id: 'deployment',
    name: 'Infrastructure',
    icon: Cloud,
    color: 'default',
    skills: [
      { name: 'Docker', proficiency: 90, icon: Server },
      { name: 'Kubernetes', proficiency: 82, icon: Layers },
      { name: 'AWS/GCP/Azure', proficiency: 85, icon: Cloud },
      { name: 'CI/CD Pipelines', proficiency: 88, icon: GitBranch },
      { name: 'Vercel/Netlify', proficiency: 92, icon: Globe },
    ],
  },
];

const colorMap: Record<string, { bg: string; bar: string; text: string }> = {
  default: { bg: 'bg-gray-100', bar: 'bg-gray-900', text: 'text-gray-900' },
};

function SkillBar({
  name,
  proficiency,
  icon: Icon,
  color,
  delay,
}: {
  name: string;
  proficiency: number;
  icon: React.ElementType;
  color: string;
  delay: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const colors = colorMap[color];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay }}
      className="group"
    >
      <div className="flex items-center gap-3 mb-2">
        <div
          className={`w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center`}
        >
          <Icon className={`w-4 h-4 text-gray-700`} />
        </div>
        <span className="flex-1 text-sm font-medium text-gray-900">{name}</span>
        <span className={`text-sm text-gray-900 font-semibold`}>
          {proficiency}%
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={isInView ? { width: `${proficiency}%` } : {}}
          transition={{ duration: 1, delay: delay + 0.2, ease: 'easeOut' }}
          className={`h-full bg-gray-900 rounded-full`}
        />
      </div>
    </motion.div>
  );
}

export default function Skills() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section
      id="skills"
      ref={ref}
      className="section relative"
    >
      <div className="container-custom mx-auto relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-2 rounded-full bg-gray-100 text-gray-800 text-sm font-medium mb-4">
            Skills
          </span>
          <h2 className="text-section font-heading font-bold mb-4">
            Technical <span className="text-gray-900">Skills</span>
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Tools and technologies for building secure AI systems.
          </p>
        </motion.div>

        {/* Skills Grid */}
        <div className="grid lg:grid-cols-2 gap-8">
          {skillCategories.map((category, categoryIndex) => {
            const colors = colorMap[category.color];
            return (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: categoryIndex * 0.1 }}
                className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm"
              >
                {/* Category Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center`}
                  >
                    <category.icon className={`w-6 h-6 text-gray-700`} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{category.name}</h3>
                </div>

                {/* Skills List */}
                <div className="space-y-4">
                  {category.skills.map((skill, skillIndex) => (
                    <SkillBar
                      key={skill.name}
                      name={skill.name}
                      proficiency={skill.proficiency}
                      icon={skill.icon}
                      color={category.color}
                      delay={categoryIndex * 0.1 + skillIndex * 0.05}
                    />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-12 grid md:grid-cols-3 gap-6"
        >
          <div className="glass rounded-xl p-6 text-center">
            <Cpu className="w-8 h-8 text-cyan mx-auto mb-3" />
            <div className="text-2xl font-bold mb-1">5+</div>
            <div className="text-sm text-gray-400">Years Experience</div>
          </div>
          <div className="glass rounded-xl p-6 text-center">
            <Terminal className="w-8 h-8 text-cyan mx-auto mb-3" />
            <div className="text-2xl font-bold mb-1">10K+</div>
            <div className="text-sm text-gray-400">Hours of Practice</div>
          </div>
          <div className="glass rounded-xl p-6 text-center">
            <Shield className="w-8 h-8 text-cyan mx-auto mb-3" />
            <div className="text-2xl font-bold mb-1">100%</div>
            <div className="text-sm text-gray-400">Commitment to Security</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
