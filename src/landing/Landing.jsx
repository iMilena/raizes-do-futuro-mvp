import { useCallback, useMemo, useState } from 'react';
import { Topbar } from './components/Topbar';
import { Hero } from './components/Hero';
import { Tese } from './components/Tese';
import { Impacto } from './components/Impacto';
import { Parceiros } from './components/Parceiros';
import { Ciclo } from './components/Ciclo';
import { Valor } from './components/Valor';
import { Pontas } from './components/Pontas';
import { Pilares } from './components/Pilares';
import { FaixaDeLuz } from './components/FaixaDeLuz';
import { Faq } from './components/Faq';
import { ProximoPasso } from './components/ProximoPasso';
import { Cta } from './components/Cta';
import { Footer } from './components/Footer';
import { Contato } from './components/Contato';
import { navItems } from './data/content';
import { useCromoDoScroll } from './hooks/useCromoDoScroll';
import './styles/landing.css';

/**
 * A landing do Raízes do Futuro.
 *
 * A ordem das seções é a do argumento, não a de um catálogo: o território, a
 * tese, os números que a sustentam, quem opera, o ciclo inteiro, o que o
 * contrato faz com o dinheiro, e só então o pedido. O fundo acompanha essa
 * curva em uma rampa contínua — cada seção declara `--rf-de` e `--rf-ate`, e o
 * `--rf-ate` de uma é o `--rf-de` da seguinte, do verde noturno até a areia.
 * Mudar a ordem das seções exige refazer essa costura, senão aparece emenda.
 */
export function Landing() {
  const [contatoAberto, setContatoAberto] = useState(false);

  const abrirContato = useCallback(() => setContatoAberto(true), []);
  const fecharContato = useCallback(() => setContatoAberto(false), []);

  const idsSecoes = useMemo(() => navItems.map((item) => item.id), []);
  const cromo = useCromoDoScroll({
    idsSecoes,
    idZonaClara: 'faq',
    idFimZonaClara: 'rodape',
  });

  return (
    <div className="rf-landing">
      <a className="rf-pular" href="#conteudo">
        Pular para o conteúdo
      </a>

      <Topbar {...cromo} aoAbrirContato={abrirContato} />

      <main id="conteudo">
        <Hero aoAbrirContato={abrirContato} />
        <Tese />
        <Impacto />
        <Parceiros />
        <Ciclo />
        <Valor />
        <Pontas />
        <Pilares />
        <FaixaDeLuz />
        <Faq />
        <ProximoPasso />
        <Cta aoAbrirContato={abrirContato} />
      </main>

      <Footer aoAbrirContato={abrirContato} />

      <Contato aberto={contatoAberto} aoFechar={fecharContato} />
    </div>
  );
}

export default Landing;
