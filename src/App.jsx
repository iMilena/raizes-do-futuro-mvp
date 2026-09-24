import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Landing } from './landing';
import { Login } from './login/Login';

/* ---------------------------------------------------------------------------
   O roteador do aplicativo, e nada além disso.

   Só a landing e a porta do painel entram direto. Todo o resto — o painel da
   operação, o app da família e a página pública de rastreio — vive em
   `painel/PainelApp.jsx` e é buscado sob demanda: essas tres rotas carregam o
   estado da operação inteiro (reducer, sincronização, nuvem, as nove telas), e
   antes disso tudo vinha junto na primeira visita a QUALQUER rota, inclusive na
   página de apresentação, que não usa nada disso.

   A landing é a rota mais visitada e a que precisa aparecer rápido no celular;
   quem entra no painel espera um aplicativo e tolera o instante de carga.
--------------------------------------------------------------------------- */
const PainelApp = lazy(() => import('./painel/PainelApp.jsx'));

/* As duas páginas públicas novas também chegam sob demanda: a de contato é
   pequena, mas a do mapa traz o Leaflet, e nenhuma das duas precisa pesar na
   primeira visita à landing. */
const Contato = lazy(() => import('./contato/Contato.jsx'));
const Explorar = lazy(() => import('./explorar/Explorar.jsx'));

/**
 * Ponte enquanto o pedaço do painel chega.
 *
 * Estilo inline de propósito: a folha do painel viaja no mesmo pedaço que ainda
 * está sendo buscado, então qualquer classe usada aqui apareceria sem estilo.
 */
function Abrindo() {
  return (
    <p
      style={{
        padding: '40px 20px',
        textAlign: 'center',
        font: '14px/1.6 system-ui, sans-serif',
        color: '#667',
      }}
    >
      Abrindo o painel…
    </p>
  );
}

/** Enquanto uma página pública chega: só o fundo escuro, sem lampejo branco. */
function FundoDoSite() {
  return <div style={{ minHeight: '100vh', background: '#04100d' }} />;
}

const ROTAS_DO_PAINEL = ['#/rastreio/', '#/familia', '#/painel'];

export default function App() {
  const [rota, setRota] = useState(() => window.location.hash);

  useEffect(() => {
    const aoMudar = () => setRota(window.location.hash);
    window.addEventListener('hashchange', aoMudar);
    return () => window.removeEventListener('hashchange', aoMudar);
  }, []);

  /* Trocar de página começa do topo. Só quando a PÁGINA muda: as âncoras da
     landing (#impacto, #faq) também mexem no hash, e essas têm de rolar até a
     seção, não voltar ao início. */
  const pagina = rota.startsWith('#/') ? rota.slice(2).split(/[/?]/)[0] : '';
  const paginaAnterior = useRef(pagina);
  useEffect(() => {
    if (paginaAnterior.current !== pagina) window.scrollTo(0, 0);
    paginaAnterior.current = pagina;
  }, [pagina]);

  /* Entrada do painel — sem credencial, por decisão de produto.
     O painel é a demonstração da jornada e roda local: `nuvem.ativo()` exige
     sessão, então sem login nada sobe para o banco e não há o que proteger aqui.
     A autenticação de verdade (lib/auth.js, papéis e RLS, 44 asserções) está no
     cabeçalho do painel, no componente `Perfil` — onde a sessão de fato libera
     escrita na nuvem em nome de uma organização.

     O placeholder que veio no PR fazia pior que isto: pedia e-mail e senha,
     imprimia a SENHA no console e abria o painel com qualquer credencial. Uma
     porta honestamente aberta é melhor do que uma tranca de mentira. */
  if (rota.startsWith('#/login')) {
    return <Login onLogin={async () => { window.location.hash = '#/painel'; }} />;
  }

  if (rota.startsWith('#/contato')) {
    return (
      <Suspense fallback={<FundoDoSite />}>
        <Contato rota={rota} />
      </Suspense>
    );
  }

  if (rota.startsWith('#/explorar')) {
    return (
      <Suspense fallback={<FundoDoSite />}>
        <Explorar />
      </Suspense>
    );
  }

  if (ROTAS_DO_PAINEL.some(prefixo => rota.startsWith(prefixo))) {
    return (
      <Suspense fallback={<Abrindo />}>
        <PainelApp rota={rota} />
      </Suspense>
    );
  }

  return <Landing />;
}
