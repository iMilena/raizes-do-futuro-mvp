/* ---------------------------------------------------------------------------
   Montagem e entrega das mensagens dos formulários públicos.

   Nenhum dos dois formulários (contato na landing, pedido de acesso na porta do
   painel) envia nada por conta própria: eles montam o texto e entregam ao
   programa de e-mail da pessoa, com "copiar" como saída para quem não tem
   cliente configurado — cerca de metade de quem usa webmail no desktop.

   Se um dia isto virar um POST de verdade (Formspree, Resend, uma rota
   serverless), o lugar de trocar é aqui, e o botão de copiar deve ficar como
   plano B. O endereço de destino vem de `src/config.js`, nunca escrito no meio
   de um componente.
--------------------------------------------------------------------------- */

/** Monta o corpo do e-mail a partir de pares rótulo/valor, pulando o que veio vazio. */
export function montarCorpo(linhas) {
  return linhas
    .map((linha) => {
      if (typeof linha === 'string') return linha;
      return `${linha.rotulo}: ${linha.valor?.trim() || '-'}`;
    })
    .join('\n');
}

/** Abre o programa de e-mail com assunto e corpo já preenchidos. */
export function abrirEmail(destino, assunto, corpo) {
  const url = `mailto:${destino}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  window.location.href = url;
}

/**
 * Copia a mensagem inteira, com destinatário e assunto, para a área de
 * transferência. Devolve `false` quando o navegador recusa — sem permissão, ou
 * fora de contexto seguro — para quem chamou poder dizer isso em vez de mentir
 * que copiou.
 */
export async function copiarMensagem(destino, assunto, corpo) {
  const texto = `Para: ${destino}\nAssunto: ${assunto}\n\n${corpo}`;
  if (!navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}
