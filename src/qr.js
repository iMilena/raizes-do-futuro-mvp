/* ---------------------------------------------------------------------------
   Gerador de QR Code de verdade — sem dependências.

   O turista escaneia o chaveiro com a câmera do celular, então isto precisa
   ser um QR válido pela ISO/IEC 18004, não um enfeite. Escopo deliberadamente
   estreito para reduzir risco: modo byte, níveis de correção M e L, versões
   1 a 4 (até 78 bytes) — folgado para uma URL de rastreio.

   Verificado decodificando a saída com um decodificador independente
   (ver scratchpad/verifica-qr.*): o que sai daqui abre no leitor.
--------------------------------------------------------------------------- */

/* ---------- aritmética em GF(256), polinômio 0x11d ---------- */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Polinômio gerador de Reed-Solomon para `n` codewords de correção. */
function gerador(n) {
  let g = new Uint8Array([1]); // índice 0 = maior grau
  for (let i = 0; i < n; i++) {
    const novo = new Uint8Array(g.length + 1);
    for (let j = 0; j < g.length; j++) {
      novo[j] ^= g[j];                    // x · g
      novo[j + 1] ^= mul(g[j], EXP[i]);   // α^i · g
    }
    g = novo;
  }
  return g;
}

/** Codewords de correção (resto da divisão sintética). */
function correcao(dados, n) {
  const g = gerador(n);
  const buf = new Uint8Array(dados.length + n);
  buf.set(dados);
  for (let i = 0; i < dados.length; i++) {
    const c = buf[i];
    if (c === 0) continue;
    for (let j = 0; j < g.length; j++) buf[i + j] ^= mul(g[j], c);
  }
  return buf.slice(dados.length);
}

/* ---------- tabela de capacidade (versões 1–4) ----------
   ecPorBloco = codewords de correção em cada bloco
   blocos     = [quantidade, codewords de dados por bloco][]                */
const NIVEIS = {
  M: { bits: 0, v: [
    { ecPorBloco: 10, blocos: [[1, 16]] },
    { ecPorBloco: 16, blocos: [[1, 28]] },
    { ecPorBloco: 26, blocos: [[1, 44]] },
    { ecPorBloco: 18, blocos: [[2, 32]] },
  ] },
  L: { bits: 1, v: [
    { ecPorBloco: 7, blocos: [[1, 19]] },
    { ecPorBloco: 10, blocos: [[1, 34]] },
    { ecPorBloco: 15, blocos: [[1, 55]] },
    { ecPorBloco: 20, blocos: [[1, 80]] },
  ] },
};

const totalDados = cfg => cfg.blocos.reduce((a, [n, d]) => a + n * d, 0);
/** Capacidade em bytes: 4 bits de modo + 8 bits de contador cabem antes dos dados. */
const capacidade = cfg => totalDados(cfg) - 2;

/* ---------- montagem dos codewords ---------- */
function codewords(bytes, cfg) {
  const bits = [];
  const push = (valor, n) => { for (let i = n - 1; i >= 0; i--) bits.push((valor >> i) & 1); };

  push(0b0100, 4);          // modo byte
  push(bytes.length, 8);    // contador (versões 1–9 usam 8 bits no modo byte)
  for (const b of bytes) push(b, 8);

  const alvo = totalDados(cfg) * 8;
  push(0, Math.min(4, alvo - bits.length));      // terminador
  while (bits.length % 8 !== 0) bits.push(0);    // fecha o byte

  const dados = [];
  for (let i = 0; i < bits.length; i += 8) {
    dados.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  }
  const enchimento = [0xec, 0x11];
  for (let i = 0; dados.length < totalDados(cfg); i++) dados.push(enchimento[i % 2]);

  // divide em blocos, calcula a correção de cada um e intercala
  const blocosDados = [], blocosEc = [];
  let pos = 0;
  for (const [quantos, porBloco] of cfg.blocos) {
    for (let i = 0; i < quantos; i++) {
      const d = Uint8Array.from(dados.slice(pos, pos + porBloco));
      pos += porBloco;
      blocosDados.push(d);
      blocosEc.push(correcao(d, cfg.ecPorBloco));
    }
  }

  const saida = [];
  const maxD = Math.max(...blocosDados.map(b => b.length));
  for (let i = 0; i < maxD; i++) for (const b of blocosDados) if (i < b.length) saida.push(b[i]);
  for (let i = 0; i < cfg.ecPorBloco; i++) for (const b of blocosEc) saida.push(b[i]);
  return Uint8Array.from(saida);
}

/* ---------- matriz ---------- */
const bitDe = (valor, i) => (valor >>> i) & 1;

function novaMatriz(versao) {
  const lado = 21 + 4 * (versao - 1);
  const mods = Array.from({ length: lado }, () => new Uint8Array(lado));
  const fixo = Array.from({ length: lado }, () => new Uint8Array(lado));
  return { lado, mods, fixo };
}

function marcarFixos(m, nivel, mascara) {
  const { lado, mods, fixo } = m;
  const set = (col, lin, escuro) => { mods[lin][col] = escuro ? 1 : 0; fixo[lin][col] = 1; };

  // localizadores 7×7 + separadores
  const localizador = (col0, lin0) => {
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        const col = col0 + dx, lin = lin0 + dy;
        if (col < 0 || col >= lado || lin < 0 || lin >= lado) continue;
        const d = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
        set(col, lin, d !== 2 && d <= 3);
      }
    }
  };
  localizador(0, 0);
  localizador(lado - 7, 0);
  localizador(0, lado - 7);

  // linhas de sincronismo
  for (let i = 8; i < lado - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  // alinhamento: versões 2–4 têm exatamente um, no canto inferior direito
  if (m.versao >= 2) {
    const c = lado - 7;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        set(c + dx, c + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  // informação de formato (BCH 15,5) + módulo escuro obrigatório
  const dado = (NIVEIS[nivel].bits << 3) | mascara;
  let resto = dado;
  for (let i = 0; i < 10; i++) resto = (resto << 1) ^ ((resto >>> 9) * 0x537);
  const fmt = ((dado << 10) | resto) ^ 0x5412;

  for (let i = 0; i <= 5; i++) set(8, i, bitDe(fmt, i));
  set(8, 7, bitDe(fmt, 6));
  set(8, 8, bitDe(fmt, 7));
  set(7, 8, bitDe(fmt, 8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bitDe(fmt, i));

  for (let i = 0; i < 8; i++) set(lado - 1 - i, 8, bitDe(fmt, i));
  for (let i = 8; i < 15; i++) set(8, lado - 15 + i, bitDe(fmt, i));
  set(8, lado - 8, 1);
}

function colocarDados(m, dados) {
  const { lado, mods, fixo } = m;
  let i = 0;
  for (let dir = lado - 1; dir >= 1; dir -= 2) {
    if (dir === 6) dir = 5; // pula a coluna de sincronismo
    for (let v = 0; v < lado; v++) {
      for (let j = 0; j < 2; j++) {
        const col = dir - j;
        const subindo = ((dir + 1) & 2) === 0;
        const lin = subindo ? lado - 1 - v : v;
        if (!fixo[lin][col] && i < dados.length * 8) {
          mods[lin][col] = bitDe(dados[i >>> 3], 7 - (i & 7));
          i++;
        }
      }
    }
  }
}

const MASCARAS = [
  (c, l) => (c + l) % 2 === 0,
  (c, l) => l % 2 === 0,
  (c, l) => c % 3 === 0,
  (c, l) => (c + l) % 3 === 0,
  (c, l) => (Math.floor(c / 3) + Math.floor(l / 2)) % 2 === 0,
  (c, l) => ((c * l) % 2) + ((c * l) % 3) === 0,
  (c, l) => (((c * l) % 2) + ((c * l) % 3)) % 2 === 0,
  (c, l) => (((c + l) % 2) + ((c * l) % 3)) % 2 === 0,
];

function aplicarMascara(m, n) {
  const { lado, mods, fixo } = m;
  const f = MASCARAS[n];
  for (let lin = 0; lin < lado; lin++) {
    for (let col = 0; col < lado; col++) {
      if (!fixo[lin][col] && f(col, lin)) mods[lin][col] ^= 1;
    }
  }
}

/** Penalidade das quatro regras da norma — escolhe a máscara que menos atrapalha o leitor. */
function penalidade(m) {
  const { lado, mods } = m;
  let p = 0;

  const linhaDe = i => Array.from({ length: lado }, (_, j) => mods[i][j]);
  const colunaDe = j => Array.from({ length: lado }, (_, i) => mods[i][j]);

  // regra 1: sequências de 5 ou mais do mesmo tom
  for (const pegar of [linhaDe, colunaDe]) {
    for (let k = 0; k < lado; k++) {
      const v = pegar(k);
      let corrida = 1;
      for (let i = 1; i < lado; i++) {
        if (v[i] === v[i - 1]) { corrida++; if (corrida === 5) p += 3; else if (corrida > 5) p += 1; }
        else corrida = 1;
      }
    }
  }

  // regra 2: blocos 2×2 de tom uniforme
  for (let i = 0; i < lado - 1; i++) {
    for (let j = 0; j < lado - 1; j++) {
      const a = mods[i][j];
      if (a === mods[i][j + 1] && a === mods[i + 1][j] && a === mods[i + 1][j + 1]) p += 3;
    }
  }

  // regra 3: padrão parecido com localizador (1:1:3:1:1 com área clara)
  const alvo1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const alvo2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  for (const pegar of [linhaDe, colunaDe]) {
    for (let k = 0; k < lado; k++) {
      const v = pegar(k);
      for (let i = 0; i + 11 <= lado; i++) {
        const trecho = v.slice(i, i + 11);
        if (alvo1.every((x, n) => x === trecho[n]) || alvo2.every((x, n) => x === trecho[n])) p += 40;
      }
    }
  }

  // regra 4: desvio da proporção de 50% de módulos escuros
  let escuros = 0;
  for (let i = 0; i < lado; i++) for (let j = 0; j < lado; j++) escuros += mods[i][j];
  const pct = (escuros * 100) / (lado * lado);
  p += Math.floor(Math.abs(pct - 50) / 5) * 10;

  return p;
}

/**
 * Gera a matriz de um QR Code.
 * @returns {{lado:number, mods:Uint8Array[], versao:number, nivel:string, mascara:number}}
 */
export function gerarQR(texto, nivelPreferido = 'M') {
  const bytes = new TextEncoder().encode(String(texto));

  // menor versão que couber, priorizando o nível mais robusto
  let escolha = null;
  for (const nivel of [nivelPreferido, nivelPreferido === 'M' ? 'L' : 'M']) {
    for (let v = 1; v <= 4; v++) {
      const cfg = NIVEIS[nivel].v[v - 1];
      if (bytes.length <= capacidade(cfg)) { escolha = { nivel, versao: v, cfg }; break; }
    }
    if (escolha) break;
  }
  if (!escolha) throw new Error(`texto longo demais para QR versão 4 (${bytes.length} bytes)`);

  const { nivel, versao, cfg } = escolha;
  const dados = codewords(bytes, cfg);

  let melhor = null;
  for (let mascara = 0; mascara < 8; mascara++) {
    const m = novaMatriz(versao);
    m.versao = versao;
    marcarFixos(m, nivel, mascara);
    colocarDados(m, dados);
    aplicarMascara(m, mascara);
    const p = penalidade(m);
    if (!melhor || p < melhor.p) melhor = { m, p, mascara };
  }

  return {
    lado: melhor.m.lado,
    mods: melhor.m.mods,
    versao,
    nivel,
    mascara: melhor.mascara,
  };
}

/** Caminho SVG único com todos os módulos escuros — leve e nítido em qualquer tamanho. */
export function qrParaPath(qr) {
  let d = '';
  for (let lin = 0; lin < qr.lado; lin++) {
    for (let col = 0; col < qr.lado; col++) {
      if (qr.mods[lin][col]) d += `M${col} ${lin}h1v1h-1z`;
    }
  }
  return d;
}
