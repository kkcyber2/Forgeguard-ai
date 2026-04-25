// =====================================================
// Hero Section
// =====================================================

import { ArrowDown, Shield, Lock, Zap, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center bg-white"
    >
      <div className="relative z-20 container-custom mx-auto px-4 sm:px-6 lg:px-8 pt-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-700 mb-6">
              <Shield className="w-4 h-4" />
              <span className="text-sm font-medium">
                AI Security Services
              </span>
            </div>

            {/* Main Heading */}
            <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6 text-gray-900">
              ForgeGuard AI
            </h1>

            {/* Tagline */}
            <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto lg:mx-0">
              Professional AI security testing and hardening services.
            </p>

            {/* Description */}
            <p className="text-gray-600 mb-10 max-w-xl mx-auto lg:mx-0">
              We help organizations identify and fix vulnerabilities in their AI systems. Our comprehensive security audits, red teaming, and hardening strategies protect your AI deployment from adversarial attacks.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                href="#contact"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 transition-colors"
              >
                <Lock className="w-5 h-5" />
                Get Started
                <ChevronRight className="w-5 h-5" />
              </Link>
              <Link
                href="#demo"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg border border-gray-300 text-gray-900 font-semibold hover:bg-gray-50 transition-colors"
              >
                <Zap className="w-5 h-5" />
                View Demo
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 mt-12 pt-8 border-t border-gray-200">
              <div>
                <div className="text-3xl font-bold text-gray-900">50+</div>
                <div className="text-sm text-gray-600">Projects Completed</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">100%</div>
                <div className="text-sm text-gray-600">Client Satisfaction</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">24/7</div>
                <div className="text-sm text-gray-600">Support Available</div>
              </div>
            </div>
          </div>

          {/* Right Content - Feature Cards */}
          <div className="hidden lg:block">
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-lg p-6 hover:border-gray-300 hover:shadow-md transition-all">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-gray-100">
                    <Shield className="w-6 h-6 text-gray-900" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">
                      Security Testing
                    </h3>
                    <p className="text-sm text-gray-600">
                      Comprehensive evaluation to identify and remediate AI vulnerabilities in your systems.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6 hover:border-gray-300 hover:shadow-md transition-all">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-gray-100">
                    <Lock className="w-6 h-6 text-gray-900" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">
                      Secure Implementation
                    </h3>
                    <p className="text-sm text-gray-600">
                      Develop secure AI systems with built-in protections from the initial architecture phase.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6 hover:border-gray-300 hover:shadow-md transition-all">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-gray-100">
                    <Zap className="w-6 h-6 text-gray-900" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">
                      Performance Optimization
                    </h3>
                    <p className="text-sm text-gray-600">
                      Ensure your AI systems maintain speed and efficiency while meeting security standards.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
        <ArrowDown className="w-6 h-6 text-gray-400 animate-bounce" />
      </div>
    </section>
  );
}
