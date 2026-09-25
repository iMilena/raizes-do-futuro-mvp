import { useEffect } from 'react';
import { Nav } from './components/Nav';
import { Capa } from './components/Capa';
import { Manifesto } from './components/Manifesto';
import { Impacto } from './components/Impacto';
import { QuemOpera } from './components/QuemOpera';
import { ComoFunciona } from './components/ComoFunciona';
import { Divisao } from './components/Divisao';
import { Infraestrutura } from './components/Infraestrutura';
import { Galeria } from './components/Galeria';
import { Feira } from './components/Feira';
import { Faq } from './components/Faq';
import { ProximoPasso } from './components/ProximoPasso';
import { Rodape } from './components/Rodape';
import '../estilos/site.css';
import './styles/landing.css';

/**
 * A landing do Raízes do Futuro, seguindo o protótipo aprovado
 * (`prototipos/raizes-landing.html`).
 *
 * A ordem é a do argumento: a capa, o que o projeto faz, os números, quem
 * opera, o ciclo inteiro, o que o contrato faz com o dinheiro, a infraestrutura,
 * as dúvidas e só então o pedido.
 *
 * Todo o CSS da página vive sob `.lp`, e os tokens da marca sob `.rf-site`:
 * as classes do protótipo (`.btn`, `.wrap`, `.nav`) são genéricas e não podem
 * vazar para o painel, que mora no mesmo aplicativo.
 */
export function Landing() {
  /* O fundo do documento acompanha a página: sem isto, o "elástico" da rolagem
     no celular mostra branco acima da capa e abaixo do rodapé. A rolagem suave
     dos links de âncora também vale só aqui. */
  useEffect(() => {
    const html = document.documentElement;
    const antes = { bg: html.style.background, sb: html.style.scrollBehavior };
    html.style.background = '#04100d';
    html.style.scrollBehavior = 'smooth';
    return () => {
      html.style.background = antes.bg;
      html.style.scrollBehavior = antes.sb;
    };
  }, []);

  return (
    <div className="rf-site lp grain">
      <a className="pular" href="#conteudo">
        Pular para o conteúdo
      </a>
      <Nav />
      <main id="conteudo">
        <Capa />
        <Manifesto />
        <Impacto />
        <QuemOpera />
        <ComoFunciona />
        <Divisao />
        <Infraestrutura />
        <Galeria />
        <Feira />
        <Faq />
        <ProximoPasso />
      </main>
      <Rodape />
    </div>
  );
}

export default Landing;
