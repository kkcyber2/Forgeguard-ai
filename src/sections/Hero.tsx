// =====================================================
// Hero Section
// =====================================================

import { ArrowDown, Shield, Lock, Zap, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center"
    >
      <div className="relative z-20 container-custom mx-auto px-4 sm:px-6 lg:px-8 pt-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-800 mb-6">
              <Shield className="w-4 h-4" />
              <span className="text-sm font-medium">
                AI Security Expert
              </span>
            </div>

            {/* Main Heading */}
            <h1 className="text-hero font-heading font-bold leading-tight mb-6">
              <span className="text-gray-900">ForgeGuard</span>
              <span className="text-gray-600"> AI</span>
            </h1>

            {/* Tagline */}
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-2xl mx-auto lg:mx-0">
              AI Security Testing and Hardening Services
            </p>

            {/* Description */}
            <p className="text-gray-600 mb-10 max-w-xl mx-auto lg:mx-0">
              We help secure AI systems by testing for vulnerabilities and implementing protection measures.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                href="#contact"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800 transition-colors"
              >
                <Lock className="w-5 h-5" />
                Get Started
                <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="#demo"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
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
            <div className="relative">
              {/* Feature Cards */}
              <div className="relative space-y-4">
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-gray-100">
                      <Shield className="w-6 h-6 text-gray-700" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">
                        Security Testing
                      </h3>
                      <p className="text-sm text-gray-600">
                        Comprehensive testing to identify and fix AI vulnerabilities.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-gray-100">
                      <Lock className="w-6 h-6 text-gray-700" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">
                        Secure Implementation
                      </h3>
                      <p className="text-sm text-gray-600">
                        Build AI systems with security built-in from the start.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-gray-100">
                      <Zap className="w-6 h-6 text-gray-700" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">
                        Performance Optimization
                      </h3>
                      <p className="text-sm text-gray-600">
                        Ensure your AI systems are both secure and efficient.
                      </p>
                    </div>
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
