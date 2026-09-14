import React, { lazy, Suspense, useEffect, useState } from 'react';
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

const ROTAS_DO_PAINEL = ['#/rastreio/', '#/familia', '#/painel'];

export default function App() {
  const [rota, setRota] = useState(() => window.location.hash);

  useEffect(() => {
    const aoMudar = () => setRota(window.location.hash);
    window.addEventListener('hashchange', aoMudar);
    return () => window.removeEventListener('hashchange', aoMudar);
  }, []);

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

  if (ROTAS_DO_PAINEL.some(prefixo => rota.startsWith(prefixo))) {
    return (
      <Suspense fallback={<Abrindo />}>
        <PainelApp rota={rota} />
      </Suspense>
    );
  }

  return <Landing />;
}
