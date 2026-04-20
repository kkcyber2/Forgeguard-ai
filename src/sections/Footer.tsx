// =====================================================
// Footer Component
// =====================================================

'use client';

import Link from 'next/link';
import { Shield, Github, Linkedin, Twitter, Mail, Heart } from 'lucide-react';

const footerLinks = {
  services: [
    { label: 'AI Security Testing', href: '#services' },
    { label: 'LLM Security Audits', href: '#services' },
    { label: 'Secure AI Development', href: '#services' },
    { label: 'ML Model Security', href: '#services' },
  ],
  company: [
    { label: 'About', href: '#about' },
    { label: 'Projects', href: '#projects' },
    { label: 'Demo', href: '#demo' },
    { label: 'Contact', href: '#contact' },
  ],
  legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
  ],
};

const socialLinks = [
  { icon: Github, href: 'https://github.com/konainsultan', label: 'GitHub' },
  { icon: Linkedin, href: 'https://linkedin.com/in/konainsultan', label: 'LinkedIn' },
  { icon: Twitter, href: 'https://twitter.com/konainsultan', label: 'Twitter' },
  { icon: Mail, href: 'mailto:konain@forgeguard.ai', label: 'Email' },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-border">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-t from-gray-900/50 to-transparent pointer-events-none" />

      <div className="container-custom mx-auto relative z-10">
        {/* Main Footer */}
        <div className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-4 lg:col-span-1">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <Shield className="w-8 h-8 text-gray-900" />
                <div className="flex flex-col">
                  <span className="font-heading font-bold text-lg leading-tight text-gray-900">
                    ForgeGuard
                  </span>
                  <span className="text-[10px] text-gray-600 tracking-wider uppercase">
                    AI Security
                  </span>
                </div>
              </Link>
              <p className="text-gray-600 text-sm mb-6 max-w-xs">
                Building secure AI systems with comprehensive testing and audits.
              </p>
              {/* Social Links */}
              <div className="flex gap-3">
                {socialLinks.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 text-gray-700 hover:text-gray-900 transition-all"
                    aria-label={social.label}
                  >
                    <social.icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>

            {/* Services */}
            <div>
              <h4 className="font-semibold mb-4 text-gray-900">Services</h4>
              <ul className="space-y-3">
                {footerLinks.services.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-semibold mb-4 text-gray-900">Company</h4>
              <ul className="space-y-3">
                {footerLinks.company.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-semibold mb-4 text-gray-900">Legal</h4>
              <ul className="space-y-3">
                {footerLinks.legal.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-semibold mb-4 text-gray-900">Contact</h4>
              <ul className="space-y-3 text-sm text-gray-600">
                <li>
                  <a
                    href="mailto:konain@forgeguard.ai"
                    className="hover:text-gray-900 transition-colors"
                  >
                    konain@forgeguard.ai
                  </a>
                </li>
                <li>Karachi, Pakistan</li>
                <li>Available Worldwide</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-200 py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-600">
              &copy; {currentYear} ForgeGuard AI. All rights reserved.
            </p>
            <p className="text-sm text-gray-600 flex items-center gap-1">
              Built with <Heart className="w-4 h-4 text-red-500 fill-red-500" /> by{' '}
              <span className="text-gray-900">Konain Sultan Khan</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
