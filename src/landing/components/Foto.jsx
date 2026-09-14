/**
 * Uma foto do projeto, servida como `<picture>`.
 *
 * WebP primeiro, em algumas larguras, com o JPEG/PNG original de fallback para
 * quem não lê WebP. `width` e `height` vão sempre no `<img>`, mesmo quando o
 * CSS estica a foto: é a proporção declarada que faz o navegador reservar o
 * espaço antes do download e impede o texto de pular quando a imagem chega.
 *
 * `alt` cai no texto que acompanha o descritor da foto, mas pode ser
 * sobrescrito por quem usa — a mesma foto descreve coisas diferentes conforme o
 * lugar. Foto decorativa recebe `alt=""` explicitamente.
 */
export function Foto({ imagem, sizes = '100vw', alt, prioridade = false, ...resto }) {
  const { fallback, webp, width, height, alt: altPadrao } = imagem;

  return (
    <picture>
      <source type="image/webp" srcSet={webp} sizes={sizes} />
      <img
        src={fallback}
        width={width}
        height={height}
        alt={alt ?? altPadrao ?? ''}
        loading={prioridade ? 'eager' : 'lazy'}
        decoding={prioridade ? 'sync' : 'async'}
        fetchPriority={prioridade ? 'high' : undefined}
        {...resto}
      />
    </picture>
  );
}

export default Foto;
