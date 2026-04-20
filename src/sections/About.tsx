// =====================================================
// About Section
// =====================================================

'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  GraduationCap,
  Terminal,
  Brain,
  Shield,
  Award,
  MapPin,
  Calendar,
  Code2,
} from 'lucide-react';

const certifications = [
  {
    name: 'Harvard CS50',
    description: 'Computer Science',
    icon: GraduationCap,
  },
  {
    name: 'Google Cybersecurity',
    description: 'Professional Certificate',
    icon: Shield,
  },
  {
    name: 'ISC2 CC Candidate',
    description: 'Certified in Cybersecurity',
    icon: Award,
  },
];

const highlights = [
  {
    icon: Shield,
    title: 'Security Testing',
    description:
      'I test AI systems to find security weaknesses before attackers can exploit them.',
  },
  {
    icon: Code2,
    title: 'AI Development',
    description:
      'I build secure AI applications using Python, TypeScript, and modern frameworks.',
  },
  {
    icon: Terminal,
    title: 'Cybersecurity',
    description:
      'I use Kali Linux and penetration testing tools to assess system security.',
  },
];

export default function About() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section
      id="about"
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
            About
          </span>
          <h2 className="text-section font-heading font-bold mb-4">
            About <span className="text-gray-900">ForgeGuard</span>
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Professional AI security services by a dedicated cybersecurity expert.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left Column - Profile */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Profile Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-8 shadow-sm">
              <div className="flex items-start gap-6 mb-6">
                {/* Avatar */}
                <div className="relative">
                  <div className="w-24 h-24 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl font-bold text-gray-700">
                    KS
                  </div>
                </div>

                {/* Info */}
                <div>
                  <h3 className="text-2xl font-bold mb-1 text-gray-900">Konain Sultan Khan</h3>
                  <p className="text-gray-600 font-medium mb-2">
                    Founder & AI Security Lead
                  </p>
                  <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      Karachi, Pakistan
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      17 years old
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-gray-700 leading-relaxed mb-6">
                17-year-old self-taught AI Security Specialist from Karachi. Harvard CS50 graduate. Specializing in AI Red Teaming, prompt injection testing, jailbreak resistance, and securing LLMs. Passionate about finding vulnerabilities before malicious actors do.
              </p>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-3 text-sm">Credentials & Continuous Learning</h4>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li className="flex gap-2"><span className="text-gray-400">•</span> Harvard CS50 – Computer Science</li>
                  <li className="flex gap-2"><span className="text-gray-400">•</span> Introduction to Cybersecurity – Great Learning</li>
                  <li className="flex gap-2"><span className="text-gray-400">•</span> Introduction to Information Security – Great Learning</li>
                  <li className="flex gap-2"><span className="text-gray-400">•</span> Introduction to Artificial Intelligence – Great Learning</li>
                  <li className="flex gap-2"><span className="text-gray-400">•</span> Google Cybersecurity Professional Certificate <span className="text-gray-500">(in progress)</span></li>
                  <li className="flex gap-2"><span className="text-gray-400">•</span> IBM AI Fundamentals Badge (SkillsBuild)</li>
                  <li className="flex gap-2"><span className="text-gray-400">•</span> Elements of AI</li>
                  <li className="flex gap-2"><span className="text-gray-400">•</span> ISC2 Certified in Cybersecurity (CC) – Candidate</li>
                </ul>
              </div>
            </div>

            {/* Certifications */}
            <div className="grid grid-cols-3 gap-4">
              {certifications.map((cert, index) => (
                <motion.div
                  key={cert.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.4 + index * 0.1 }}
                  className="bg-white border border-gray-200 rounded-xl p-4 text-center hover:border-gray-300 transition-colors shadow-sm"
                >
                  <cert.icon className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                  <div className="text-sm font-medium text-gray-900">{cert.name}</div>
                  <div className="text-xs text-gray-600">{cert.description}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right Column - Highlights */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="space-y-6"
          >
            {highlights.map((highlight, index) => (
              <motion.div
                key={highlight.title}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
                className="bg-white border border-gray-200 rounded-2xl p-6 group hover:border-gray-300 transition-all shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-gray-100 group-hover:bg-gray-200 transition-colors">
                    <highlight.icon className="w-6 h-6 text-gray-700" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold mb-2 text-gray-900">
                      {highlight.title}
                    </h4>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {highlight.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Philosophy Quote */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.8 }}
              className="relative rounded-2xl p-8 overflow-hidden bg-gray-50 border border-gray-200 shadow-sm"
            >
              <div className="relative z-10">
                <Award className="w-10 h-10 text-gray-700 mb-4" />
                <blockquote className="text-lg font-medium italic mb-4 text-gray-800">
                  &ldquo;The best defense is understanding how attacks work. I test AI systems so you don&apos;t have to worry about real attackers finding the weaknesses first.&rdquo;
                </blockquote>
                <cite className="text-sm text-gray-600 not-italic">
                  — Konain Sultan Khan, Founder
                </cite>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

