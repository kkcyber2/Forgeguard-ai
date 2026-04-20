// =====================================================
// Services Section
// =====================================================

'use client';

import { useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Bot,
  Cpu,
  MessageSquare,
  Users,
  Check,
  ArrowRight,
  X,
} from 'lucide-react';
import Link from 'next/link';

const services = [
  {
    id: 'ai-red-teaming',
    icon: Shield,
    title: 'AI Security Testing',
    shortDescription: 'Find vulnerabilities in AI systems',
    description:
      'We test your AI systems for security weaknesses. This includes checking for prompt injection, jailbreaking, data extraction, and other attack methods.',
    features: [
      'Prompt Injection Testing',
      'Jailbreak Attempts',
      'Data Extraction Tests',
      'Security Report',
    ],
    startingPrice: '$1,500',
    duration: '1-2 weeks',
    color: 'gray',
  },
  {
    id: 'secure-ai-agents',
    icon: Bot,
    title: 'Secure AI Development',
    shortDescription: 'Build secure AI applications',
    description:
      'We develop AI agents and automation tools with security built-in. This includes input validation, rate limiting, and monitoring.',
    features: [
      'Custom AI Agent Development',
      'Security Features',
      'API Integration',
      'Monitoring & Logging',
    ],
    startingPrice: '$2,500',
    duration: '2-4 weeks',
    color: 'gray',
  },
  {
    id: 'ml-model-hardening',
    icon: Cpu,
    title: 'ML Model Security',
    shortDescription: 'Secure ML model deployment',
    description:
      'We help secure your machine learning models during deployment. This includes input validation and monitoring for attacks.',
    features: [
      'Model Security',
      'Input Validation',
      'API Deployment',
      'Monitoring',
    ],
    startingPrice: '$3,000',
    duration: '3-6 weeks',
    color: 'gray',
  },
  {
    id: 'secure-prompt-engineering',
    icon: MessageSquare,
    title: 'Secure Prompt Design',
    shortDescription: 'Design safe prompts for AI',
    description:
      'We help design prompts that are both effective and secure. This reduces the risk of injection attacks while maintaining performance.',
    features: [
      'Prompt Design',
      'Security Testing',
      'Injection Prevention',
      'Performance Optimization',
    ],
    startingPrice: '$800',
    duration: '3-5 days',
    color: 'gray',
  },
  {
    id: 'security-consultation',
    icon: Users,
    title: 'Security Consulting',
    shortDescription: 'AI security advice and guidance',
    description:
      'We provide expert advice on AI security. This includes reviewing your architecture and recommending security improvements.',
    features: [
      'Architecture Review',
      'Security Planning',
      'Code Review',
      'Ongoing Support',
    ],
    startingPrice: '$200',
    duration: 'Hourly',
    color: 'gray',
  },
];

const colorClasses: Record<string, { bg: string; text: string; border: string }> =
  {
    gray: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  };

export default function Services() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [selectedService, setSelectedService] = useState<(typeof services)[0] | null>(
    null
  );

  return (
    <section
      id="services"
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
            Services
          </span>
          <h2 className="text-section font-heading font-bold mb-4">
            Our <span className="text-gray-900">Services</span>
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Professional AI security services to protect your systems.
          </p>
        </motion.div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => {
            const colors = colorClasses[service.color];
            return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`bg-white border border-gray-200 rounded-2xl p-6 cursor-pointer group hover:border-gray-300 transition-all duration-300 shadow-sm`}
                onClick={() => setSelectedService(service)}
              >
                {/* Icon */}
                <div
                  className={`w-14 h-14 rounded-xl ${colors.bg} flex items-center justify-center mb-4 group-hover:bg-gray-200 transition-colors`}
                >
                  <service.icon className={`w-7 h-7 ${colors.text}`} />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold mb-2 text-gray-900">{service.title}</h3>
                <p className="text-gray-600 text-sm mb-4">
                  {service.shortDescription}
                </p>

                {/* Price & Duration */}
                <div className="flex items-center justify-between text-sm mb-4">
                  <span className="text-gray-900 font-medium">
                    From {service.startingPrice}
                  </span>
                  <span className="text-gray-500">{service.duration}</span>
                </div>

                {/* CTA */}
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                  <span>Learn More</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-16 text-center"
        >
          <p className="text-gray-600 mb-6">
            Need help with AI security? Let&apos;s discuss your requirements.
          </p>
          <Link
            href="#contact"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800 transition-colors"
          >
            <Shield className="w-5 h-5" />
            Contact Us
          </Link>
        </motion.div>
      </div>

      {/* Service Detail Modal */}
      <AnimatePresence>
        {selectedService && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedService(null)}
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
                    <selectedService.icon className="w-6 h-6 text-gray-700" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{selectedService.title}</h3>
                    <p className="text-gray-600">{selectedService.shortDescription}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedService(null)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                <p className="text-gray-700 mb-6">{selectedService.description}</p>

                {/* Features */}
                <div className="mb-6">
                  <h4 className="font-semibold mb-3 text-gray-900">What&apos;s Included:</h4>
                  <ul className="space-y-2">
                    {selectedService.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-gray-700">
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Pricing */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{selectedService.startingPrice}</div>
                    <div className="text-sm text-gray-600">{selectedService.duration}</div>
                  </div>
                  <Link
                    href="#contact"
                    className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                  >
                    Get Started
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
