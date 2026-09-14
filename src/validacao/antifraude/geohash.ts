/* ---------------------------------------------------------------------------
   Geohash, precisão 7.

   Por que geohash e não latitude e longitude arredondadas: arredondar vira um
   ponto, e ponto continua sendo coordenada de pessoa, só com menos casas. O
   geohash é uma célula, e a pergunta que a auditoria faz ("essa coleta ocorreu
   na ilha?") se responde com célula, não com ponto.

   Precisão 7 dá células de aproximadamente 153 m por 153 m em Boipeba. Confirma
   praia e povoado, e não distingue a casa de ninguém. Precisão 8 (38 m) já
   apontaria residência, e é por isso que o padrão está travado em 7.

   O app hoje guarda `geo: {lat, lng}` com 5 casas (cerca de 1 m) em
   src/lib/evidencia.js. Esse dado continua sendo do aparelho e da operação. O
   que atravessa para a evidência auditável é só o geohash.
--------------------------------------------------------------------------- */

const ALFABETO = '0123456789bcdefghjkmnpqrstuvwxyz'; // base32 do geohash, sem a, i, l, o

/** Precisão usada pelo projeto. Aproximadamente 150 m. */
export const PRECISAO_PADRAO = 7;

/** Codifica uma coordenada em geohash. */
export function geohashCodificar(lat: number, lng: number, precisao = PRECISAO_PADRAO): string {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error(`latitude inválida: ${lat}`);
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error(`longitude inválida: ${lng}`);
  if (precisao < 1 || precisao > 12) throw new Error(`precisão fora de 1 a 12: ${precisao}`);

  let faixaLat: [number, number] = [-90, 90];
  let faixaLng: [number, number] = [-180, 180];
  let ehLongitude = true;
  let bit = 0;
  let valor = 0;
  let saida = '';

  while (saida.length < precisao) {
    if (ehLongitude) {
      const meio = (faixaLng[0] + faixaLng[1]) / 2;
      if (lng >= meio) { valor = (valor << 1) + 1; faixaLng = [meio, faixaLng[1]]; }
      else { valor = valor << 1; faixaLng = [faixaLng[0], meio]; }
    } else {
      const meio = (faixaLat[0] + faixaLat[1]) / 2;
      if (lat >= meio) { valor = (valor << 1) + 1; faixaLat = [meio, faixaLat[1]]; }
      else { valor = valor << 1; faixaLat = [faixaLat[0], meio]; }
    }
    ehLongitude = !ehLongitude;

    if (++bit === 5) {
      saida += ALFABETO[valor];
      bit = 0;
      valor = 0;
    }
  }
  return saida;
}

export interface CelulaGeohash {
  latMin: number; latMax: number;
  lngMin: number; lngMax: number;
  latCentro: number; lngCentro: number;
}

/** Devolve a célula (não um ponto) que o geohash representa. */
export function geohashDecodificar(hash: string): CelulaGeohash {
  let faixaLat: [number, number] = [-90, 90];
  let faixaLng: [number, number] = [-180, 180];
  let ehLongitude = true;

  for (const caractere of hash.toLowerCase()) {
    const indice = ALFABETO.indexOf(caractere);
    if (indice < 0) throw new Error(`caractere inválido em geohash: ${caractere}`);
    for (let mascara = 16; mascara >= 1; mascara >>= 1) {
      const bitLigado = (indice & mascara) !== 0;
      if (ehLongitude) {
        const meio = (faixaLng[0] + faixaLng[1]) / 2;
        faixaLng = bitLigado ? [meio, faixaLng[1]] : [faixaLng[0], meio];
      } else {
        const meio = (faixaLat[0] + faixaLat[1]) / 2;
        faixaLat = bitLigado ? [meio, faixaLat[1]] : [faixaLat[0], meio];
      }
      ehLongitude = !ehLongitude;
    }
  }

  return {
    latMin: faixaLat[0], latMax: faixaLat[1],
    lngMin: faixaLng[0], lngMax: faixaLng[1],
    latCentro: (faixaLat[0] + faixaLat[1]) / 2,
    lngCentro: (faixaLng[0] + faixaLng[1]) / 2,
  };
}

/**
 * Distância aproximada em metros entre os centros de duas células.
 *
 * Equirretangular e não Haversine: as distâncias que interessam aqui são de
 * centenas de metros dentro de uma ilha, onde a diferença entre as duas fórmulas
 * é de centímetros, e esta roda em qualquer celular sem pensar duas vezes.
 */
export function distanciaMetros(a: string, b: string): number {
  const ca = geohashDecodificar(a);
  const cb = geohashDecodificar(b);
  const RAIO = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const latMedia = rad((ca.latCentro + cb.latCentro) / 2);
  const dx = rad(cb.lngCentro - ca.lngCentro) * Math.cos(latMedia);
  const dy = rad(cb.latCentro - ca.latCentro);
  return Math.sqrt(dx * dx + dy * dy) * RAIO;
}

/**
 * Prefixos de geohash que cobrem a área de operação do projeto.
 *
 * `7js6` (precisão 4) contém a Ilha de Boipeba inteira, de Monte Alegre a Ponta
 * dos Castelhanos, e deixa de fora os vizinhos que importam: Valença e a sede de
 * Cairu caem em `7js5`, Morro de São Paulo em `7js7`, Salvador em `7jsw`.
 *
 * Precisão 4 e não 5 de propósito: a ilha atravessa três células de precisão 5
 * (`7js64`, `7js66`, `7js6d`), e uma lista de três prefixos é uma lista que
 * alguém esquece de atualizar quando a operação chegar em outra praia. Aqui a
 * checagem responde "é o território de operação?", não "é a praia certa?".
 */
export const PREFIXOS_TERRITORIO = ['7js6'];

export function dentroDoTerritorio(hash: string, prefixos = PREFIXOS_TERRITORIO): boolean {
  return prefixos.some(p => hash.startsWith(p));
}
