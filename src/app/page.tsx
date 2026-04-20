// =====================================================
// Main Landing Page
// =====================================================

import Navigation from '@/sections/Navigation';
import Hero from '@/sections/Hero';
import About from '@/sections/About';
import Services from '@/sections/Services';
import Skills from '@/sections/Skills';
import Projects from '@/sections/Projects';
import Demo from '@/sections/Demo';
import Contact from '@/sections/Contact';
import Footer from '@/sections/Footer';

export default function HomePage() {
  return (
    <main className="relative">
      <Navigation />
      <Hero />
      <About />
      <Services />
      <Skills />
      <Projects />
      <Demo />
      <Contact />
      <Footer />
    </main>
  );
}
