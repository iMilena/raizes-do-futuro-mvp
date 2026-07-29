import React, { useState } from 'react';
import { fmt } from '../estado/store.jsx';
import { EstadoVazio } from './ui.jsx';

/* ---------- agrupamento por semana ---------- */
/** Segunda-feira da semana de uma data ISO (yyyy-mm-dd). */
function segundaDa(iso) {
  const d = new Date(iso + 'T12:00:00');
  const dia = (d.getDay() + 6) % 7; // 0 = segunda
  d.setDate(d.getDate() - dia);
  return d;
}
const rotuloSemana = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Soma kg das coletas validadas por semana, nas últimas `janela` semanas com registro. */
export function kgPorSemana(coletas, janela = 6) {
  const mapa = new Map();
  for (const c of coletas.filter(c => c.status === 'validada')) {
    const seg = segundaDa(c.data);
    const chave = seg.toISOString().slice(0, 10);
    const atual = mapa.get(chave) || { chave, rot: rotuloSemana(seg), kg: 0, acoes: 0 };
    atual.kg += Number(c.kg);
    atual.acoes += 1;
    mapa.set(chave, atual);
  }
  return [...mapa.values()].sort((a, b) => a.chave.localeCompare(b.chave)).slice(-janela);
}

/* ---------- barras: kg por semana ---------- */
export function BarrasKgSemana({ coletas }) {
  const dados = kgPorSemana(coletas);
  const [ativo, setAtivo] = useState(null);

  if (dados.length === 0) {
    return <EstadoVazio icone="" titulo="Nenhuma coleta validada ainda" dica="Valide uma coleta na aba Instituto Vivá para ver o gráfico." />;
  }

  const L = 40, T = 12, A = 150, larg = 100 / dados.length;
  const max = Math.max(...dados.map(d => d.kg));
  const escala = Math.ceil(max / 20) * 20 || 20;
  const linhas = [0, 0.5, 1];

  return (
    <div className="grafico" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <svg viewBox="0 0 320 180" role="img" aria-label="Quilos coletados por semana">
        {/* gradiente tem de morar no próprio SVG: CSS não cria paint server.
            Vertical, mais saturado embaixo, para a barra ter peso na base. */}
        <defs>
        </defs>
        {linhas.map(f => {
          const y = T + A * (1 - f);
          return (
            <g key={f}>
              <line className="eixo" x1={L} y1={y} x2={312} y2={y} />
              <text className="rot-eixo" x={L - 6} y={y + 3.5} textAnchor="end">{Math.round(escala * f)}</text>
            </g>
          );
        })}
        {dados.map((d, i) => {
          const cx = L + (272 / dados.length) * (i + 0.5);
          const h = (d.kg / escala) * A;
          const bw = Math.min(30, (272 / dados.length) * 0.55);
          const on = ativo === i;
          return (
            <g key={d.chave} onMouseEnter={() => setAtivo(i)} onMouseLeave={() => setAtivo(null)}>
              <rect x={cx - bw / 2} y={T + A - h} width={bw} height={h} rx="4"
                fill={on ? '#0d5530' : '#0b7ba8'} className="barra-anim" style={{ '--h': h + 'px' }} />
              <text className="rot-eixo" x={cx} y={T + A + 13} textAnchor="middle">{d.rot}</text>
              <text x={cx} y={T + A - h - 5} textAnchor="middle" fontSize="9.5" fontWeight="700"
                fill={on ? 'var(--verde-escuro)' : 'var(--azul-escuro)'}>{d.kg}</text>
            </g>
          );
        })}
        <text x={L - 6} y={T + A + 13} textAnchor="end" fontSize="8" fill="var(--cinza)">kg</text>
      </svg>
      <div className="grafico-legenda">
        {ativo != null
          ? <span><b>Semana de {dados[ativo].rot}</b> · {dados[ativo].kg} kg em {dados[ativo].acoes} ação(ões)</span>
          : <span>Total validado: <b>{dados.reduce((a, d) => a + d.kg, 0)} kg</b> em {dados.length} semana(s)</span>}
      </div>
    </div>
  );
}

/* ---------- donut: receita por fonte ---------- */
const FONTES = {
  produto: { rot: 'Produtos (turismo)', cor: '#1cabe2' },
  esg: { rot: 'Relatórios ESG (empresas)', cor: '#1b7a43' },
  credito: { rot: 'Créditos de reciclagem', cor: '#f2c14e' },
};
const fonteDe = tipo => FONTES[tipo] || { rot: 'Outras fontes', cor: '#8a5cf6' };

export function DonutReceita({ vendas }) {
  const [ativo, setAtivo] = useState(null);

  const mapa = new Map();
  for (const v of vendas) {
    const f = fonteDe(v.tipo);
    const atual = mapa.get(f.rot) || { rot: f.rot, cor: f.cor, valor: 0, n: 0 };
    atual.valor += v.valor;
    atual.n += 1;
    mapa.set(f.rot, atual);
  }
  const dados = [...mapa.values()].sort((a, b) => b.valor - a.valor);
  const total = dados.reduce((a, d) => a + d.valor, 0);

  if (total === 0) {
    return <EstadoVazio icone="" titulo="Nenhuma receita registrada" dica="Faça uma venda na aba Mercado para ver a divisão por fonte." />;
  }

  const R = 52, r = 32, cx = 62, cy = 62;
  let acc = 0;

  return (
    <div className="grafico donut-wrap">
      <svg viewBox="0 0 124 124" role="img" aria-label="Receita por fonte">
        <defs>
          {dados.map((d, i) => (
            <linearGradient key={d.rot} id={'g-fatia-' + i} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={d.cor} stopOpacity=".78" />
              <stop offset="100%" stopColor={d.cor} />
            </linearGradient>
          ))}
        </defs>
        {dados.map((d, i) => {
          const frac = d.valor / total;
          const a0 = acc * 2 * Math.PI - Math.PI / 2;
          acc += frac;
          const a1 = acc * 2 * Math.PI - Math.PI / 2;
          const grande = frac > 0.5 ? 1 : 0;
          const on = ativo === i;
          const raio = on ? R + 4 : R;
          const p = (ang, rad) => `${cx + rad * Math.cos(ang)} ${cy + rad * Math.sin(ang)}`;
          // fatia única: desenha um anel completo (arco de 360° é degenerado em path)
          if (frac > 0.999) {
            return (
              <g key={d.rot} onMouseEnter={() => setAtivo(i)} onMouseLeave={() => setAtivo(null)}>
                <circle cx={cx} cy={cy} r={(raio + r) / 2} fill="none" stroke={'url(#g-fatia-' + i + ')'} strokeWidth={raio - r} />
              </g>
            );
          }
          return (
            <path key={d.rot} className="fatia"
              onMouseEnter={() => setAtivo(i)} onMouseLeave={() => setAtivo(null)}
              d={`M ${p(a0, raio)} A ${raio} ${raio} 0 ${grande} 1 ${p(a1, raio)} L ${p(a1, r)} A ${r} ${r} 0 ${grande} 0 ${p(a0, r)} Z`}
              fill={'url(#g-fatia-' + i + ')'} stroke="#fff" strokeWidth="1.2" />
          );
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="var(--verde-escuro)">
          {ativo != null ? Math.round(dados[ativo].valor / total * 100) + '%' : 'R$'}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="7.5" fill="var(--cinza)">
          {ativo != null ? dados[ativo].n + ' venda(s)' : (total / 1000).toFixed(1) + ' mil'}
        </text>
      </svg>
      <ul className="donut-legenda">
        {dados.map((d, i) => (
          <li key={d.rot} className={ativo === i ? 'on' : ''}
            onMouseEnter={() => setAtivo(i)} onMouseLeave={() => setAtivo(null)}>
            <i style={{ background: d.cor }} />
            <span>{d.rot}</span>
            <b>{fmt(d.valor)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
