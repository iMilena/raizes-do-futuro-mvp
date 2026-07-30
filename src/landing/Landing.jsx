import { Hero } from './components/Hero';
import { Intro } from './components/Intro';
import { ComoFunciona } from './components/ComoFunciona';
import { Solucao } from './components/Solucao';
import { Pilares } from './components/Pilares';
import { Faq } from './components/Faq';
import { Cta } from './components/Cta';
import { Footer } from './components/Footer';
import { navItems } from './data/content';
import { useActiveSection } from './hooks/useActiveSection';
import './styles/landing.css';

const SECTION_IDS = navItems.map((item) => item.id);

export function Landing() {
  const activeSection = useActiveSection(SECTION_IDS, 'inicio');

  return (
    <div className="landing">
      <Hero activeSection={activeSection} />
      <Intro />
      <ComoFunciona />
      <Solucao />
      <Pilares />
      <Faq />
      <Cta />
      <Footer />
    </div>
  );
}

export default Landing;
