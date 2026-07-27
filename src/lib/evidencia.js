/* ---------------------------------------------------------------------------
   Evidências reais: hash SHA-256 calculado no navegador (o arquivo NUNCA sai
   do aparelho — só o hash vai ao registro, conforme LGPD) e geolocalização.
--------------------------------------------------------------------------- */

/** SHA-256 real do arquivo, em hexadecimal. */
export async function sha256Arquivo(arquivo) {
  const buf = await arquivo.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Posição aproximada (5 casas ≈ 1 m) ou null se negado/indisponível. */
export function pegarGeo() {
  return new Promise(resolve => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 },
    );
  });
}
