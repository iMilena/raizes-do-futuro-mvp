import React, { useEffect, useState } from 'react';
import {
  useStore, fmt, trunc, BONUS_POR_CRIANCA, VERSAO_TERMO, TEXTO_TERMO, hashTermo,
  VALIDADE_MESES, consentimentoAtivo, situacaoConsentimento, venceEm, temPin,
} from '../store.jsx';
import { useToast, Badge, EstadoVazio } from '../ui.jsx';
import * as auth from '../auth.js';

/* ---------------------------------------------------------------------------
   Cadastro de famílias — o que faltava para o piloto crescer de dentro do app.

   As famílias existiam só na seed: não havia como o Instituto Vivá incluir a
   décima quinta família sem editar código. Esta tela fecha isso.

   ── UMA DECISÃO DE ORDEM ──────────────────────────────────────────────────
   O consentimento é passo do MESMO formulário, não uma etapa depois. Duas
   razões, e nenhuma é burocrática:

     · a policy do banco recusa família sem consentimento ativo. Cadastrar
       primeiro e autorizar depois criaria uma linha que não sobe e uma fila de
       sincronização travada atrás dela;
     · na prática de campo, quem cadastra está na frente da pessoa. É ali que se
       lê o termo, não numa visita seguinte.

   O nome do responsável fica NESTE APARELHO. Para a base compartilhada vai só o
   código (BOI-014) — ver LGPD no SUPABASE.md.
--------------------------------------------------------------------------- */

const COMPROMISSOS = [
  'Vacinação em dia',
  'Matrícula escolar',
  'Consulta pediátrica em dia',
  'Acompanhamento de saúde',
];

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/* ------------------------------------------- compromissos de cada mês ----- */
/**
 * Abre o mês seguinte — a tarefa mais repetida do piloto.
 *
 * Antes, compromisso só nascia junto com o cadastro da família: dava para rodar
 * um mês e depois o ciclo travava. Como todo mês repete quase a mesma lista para
 * quase todas as famílias, isto é em LOTE, com a opção de escolher quem.
 *
 * O que já existe não é duplicado, e o que já foi comprovado não é apagável —
 * ver ABRIR_MES e REMOVER_COMPROMISSO no store.
 */
function AbrirMes() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [mes, setMes] = useState(MESES[(new Date().getMonth() + 1) % 12]);
  const [tipos, setTipos] = useState(['Vacinação em dia']);
  const [quem, setQuem] = useState([]); // vazio = todas

  const comConsentimento = state.familias.filter(f => consentimentoAtivo(f));
  const alvo = quem.length ? comConsentimento.filter(f => quem.includes(f.id)) : comConsentimento;
  const semConsentimento = state.familias.length - comConsentimento.length;

  /* prévia honesta: mostra o que SERÁ criado e o que será pulado por já existir,
     porque "criei 12" sem dizer que pulou 4 é relatório enganoso */
  const previa = (() => {
    let novos = 0, repetidos = 0;
    for (const f of alvo) {
      for (const base of tipos) {
        const tipo = f.criancas > 1 ? `${base} (${f.criancas} crianças)` : base;
        if ((f.condicoes || []).some(c => c.mes === mes && c.tipo === tipo)) repetidos++;
        else novos++;
      }
    }
    return { novos, repetidos };
  })();

  const alternar = (lista, set, v) =>
    set(lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v]);

  const abrir = () => {
    if (!tipos.length || !alvo.length) { toast('Escolha o compromisso e ao menos uma família', 'alerta'); return; }
    dispatch({ type: 'ABRIR_MES', mes, tipos, familiaIds: quem.length ? quem : null });
    toast(previa.novos > 0
      ? `${mes}: ${previa.novos} compromisso(s) criados${previa.repetidos ? ` · ${previa.repetidos} já existiam` : ''}`
      : `Nada a criar — esses compromissos de ${mes} já existem`, 'info', 6000);
  };

  return (
    <>
      <h3>Compromissos de cada mês</h3>
      <div className="card destaque">
        <p className="mini" style={{ marginTop: 0 }}>
          O ciclo é mensal: todo mês a operação define o que cada família vai comprovar.
          Faça em lote e ajuste caso a caso na tabela abaixo. <b>A renda do trabalho de
          coleta não depende disto</b> — aqui só se define o bônus.
        </p>

        <div className="grid g2" style={{ marginTop: 4 }}>
          <div>
            <label htmlFor="mes-abrir">Mês</label>
            <select id="mes-abrir" value={mes} onChange={e => setMes(e.target.value)}>
              {MESES.map(m => <option key={m}>{m}</option>)}
            </select>

            <label style={{ marginTop: 14 }}>Compromissos deste mês</label>
            {COMPROMISSOS.map(c => (
              <label key={c} className="opcao-aviso" style={{ marginTop: 6 }}>
                <input type="checkbox" checked={tipos.includes(c)}
                  onChange={() => alternar(tipos, setTipos, c)} />
                <span><b>{c}</b></span>
              </label>
            ))}
          </div>

          <div>
            <label>Para quem</label>
            <p className="mini" style={{ margin: '0 0 6px' }}>
              Sem marcar ninguém, vale para <b>todas as {comConsentimento.length} famílias
              com consentimento vigente</b>.
              {semConsentimento > 0 && (
                <> {semConsentimento} família(s) ficam de fora por não ter consentimento vigente.</>
              )}
            </p>
            <div className="lista-quem">
              {comConsentimento.map(f => (
                <label key={f.id} className={'chip-familia' + (quem.includes(f.id) ? ' on' : '')}>
                  <input type="checkbox" checked={quem.includes(f.id)}
                    onChange={() => alternar(quem, setQuem, f.id)} />
                  {f.resp.split(' ')[0]} <small>{f.codigo}</small>
                </label>
              ))}
              {comConsentimento.length === 0 && (
                <p className="mini">Nenhuma família com consentimento vigente ainda.</p>
              )}
            </div>
          </div>
        </div>

        <div className="aviso" style={{ marginTop: 12 }}>
          <b>Vai criar {previa.novos} compromisso(s)</b> em {mes}, para {alvo.length} família(s)
          {previa.repetidos > 0 && <> · <b>{previa.repetidos}</b> já existem e serão pulados (não duplica bônus)</>}
          {previa.novos > 0 && <> · bônus potencial total de {fmt(alvo.reduce((a, f) => a + BONUS_POR_CRIANCA * f.criancas * tipos.filter(base => {
            const tipo = f.criancas > 1 ? `${base} (${f.criancas} crianças)` : base;
            return !(f.condicoes || []).some(c => c.mes === mes && c.tipo === tipo);
          }).length, 0))}</>}
        </div>

        <button className="acao" disabled={previa.novos === 0} onClick={abrir}>
          Abrir {mes} para {alvo.length} família(s)
        </button>
      </div>

      <h3>Compromissos já definidos</h3>
      <div className="card">
        <ListaCompromissos />
      </div>
    </>
  );
}

/** Todos os compromissos, por mês, com remoção só do que ainda está pendente. */
function ListaCompromissos() {
  const { state, dispatch } = useStore();
  const toast = useToast();

  const linhas = state.familias.flatMap(f =>
    (f.condicoes || []).map(c => ({ ...c, familia: f })));
  if (linhas.length === 0) {
    return <EstadoVazio icone="📋" titulo="Nenhum compromisso definido"
      dica="Use o bloco acima para abrir um mês." />;
  }

  const porMes = [...new Set(linhas.map(l => l.mes))];

  return (
    <>
      {porMes.map(m => (
        <div key={m} style={{ marginBottom: 14 }}>
          <b style={{ fontSize: 13.5 }}>{m}</b>
          <table style={{ marginTop: 6 }}>
            <thead><tr><th>Família</th><th>Compromisso</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {linhas.filter(l => l.mes === m).map(l => (
                <tr key={l.id}>
                  <td>{l.familia.resp}</td>
                  <td>{l.tipo}</td>
                  <td>
                    <Badge tom={l.status === 'liberada' ? 'ok' : l.status === 'pendente' ? 'pend' : 'info'}>
                      {l.status.replace(/-/g, ' ')}
                    </Badge>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {l.status === 'pendente' ? (
                      <button className="meta-apagar" onClick={() => {
                        dispatch({ type: 'REMOVER_COMPROMISSO', condicaoId: l.id });
                        toast('Compromisso removido');
                      }}>remover</button>
                    ) : (
                      /* comprovado, validado ou liberado é histórico: apagar removeria
                         a prova que a família enviou, ou contradiria um repasse feito */
                      <span className="mini" title="Já comprovado ou repassado — faz parte do histórico">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}

export default function Cadastro() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [form, setForm] = useState({
    resp: '', criancas: 1, celular: '', mes: MESES[new Date().getMonth()],
  });
  const [compromissos, setCompromissos] = useState(['Vacinação em dia']);
  const [forma, setForma] = useState('presencial-assinado');
  const [aceito, setAceito] = useState(false);
  const [hash, setHash] = useState('');
  const [criada, setCriada] = useState(null);

  useEffect(() => { hashTermo().then(setHash).catch(() => setHash('')); }, []);

  /* o código é previsível para a agente conferir em voz alta com a família */
  const proximoCodigo = (() => {
    const usados = new Set(state.familias.map(f => f.codigo));
    let n = state.familias.length + 1;
    let c = `BOI-${String(n).padStart(3, '0')}`;
    while (usados.has(c)) { n++; c = `BOI-${String(n).padStart(3, '0')}`; }
    return c;
  })();

  const nomeOk = form.resp.trim().length >= 3;
  const podeSalvar = nomeOk && Number(form.criancas) >= 1 && aceito && hash;

  const alternarCompromisso = c =>
    setCompromissos(l => (l.includes(c) ? l.filter(x => x !== c) : [...l, c]));

  const salvar = () => {
    dispatch({
      type: 'NOVA_FAMILIA',
      resp: form.resp.trim(),
      criancas: Number(form.criancas),
      celular: form.celular.trim(),
      codigo: proximoCodigo,
      mes: form.mes,
      condicoes: compromissos.map(c =>
        (Number(form.criancas) > 1 ? `${c} (${form.criancas} crianças)` : c)),
      forma,
      termoHash: hash,
      versaoTermo: VERSAO_TERMO,
      coletadoPor: auth.atual()?.usuario?.id || null,
    });
    toast(`Família ${proximoCodigo} cadastrada com consentimento ✍️`, 'info', 6000);
    setCriada({ codigo: proximoCodigo, nome: form.resp.trim(), criancas: Number(form.criancas) });
    setForm({ resp: '', criancas: 1, celular: '', mes: form.mes });
    setCompromissos(['Vacinação em dia']);
    setAceito(false);
  };

  return (
    <>
      <h2>Cadastro de famílias</h2>
      <p className="mini" style={{ maxWidth: 620 }}>
        Inclui uma família no piloto. O <b>nome fica só neste aparelho</b>; para a base
        compartilhada vai apenas o código ({proximoCodigo}). O consentimento é parte
        deste formulário porque é na frente da família que o termo é lido — e porque
        sem ele o banco recusa o cadastro.
      </p>

      {criada && (
        <div className="card" style={{ borderLeft: '3px solid var(--verde)', marginBottom: 14 }}>
          <b>✅ {criada.nome} cadastrada como {criada.codigo}</b>
          <p className="mini" style={{ margin: '4px 0 0' }}>
            Bônus potencial de {fmt(BONUS_POR_CRIANCA * criada.criancas)}/mês
            ({criada.criancas} criança{criada.criancas > 1 ? 's' : ''}). Próximo passo: a família
            abre a conta dela no <b>App da Família</b> e escolhe o PIN.
          </p>
        </div>
      )}

      <div className="grid g2">
        <div className="card destaque">
          <h3 style={{ marginTop: 0 }}>1. Quem é a família</h3>

          <label htmlFor="cad-resp">Nome do responsável <span className="mini">(fica neste aparelho)</span></label>
          <input id="cad-resp" value={form.resp} autoComplete="off"
            onChange={e => setForm({ ...form, resp: e.target.value })}
            placeholder="ex.: Maria de Lourdes" />
          {form.resp && !nomeOk && <p className="mini alerta-txt">Nome muito curto.</p>}

          <label htmlFor="cad-criancas">Quantas crianças</label>
          <input id="cad-criancas" type="number" min="1" max="12" value={form.criancas}
            onChange={e => setForm({ ...form, criancas: e.target.value })} />
          <p className="mini">
            Bônus de {fmt(BONUS_POR_CRIANCA)} por criança/mês ={' '}
            <b>{fmt(BONUS_POR_CRIANCA * (Number(form.criancas) || 0))}</b> por mês com as condições em dia.
          </p>

          <label htmlFor="cad-celular">Celular de contato <span className="mini">(opcional)</span></label>
          <input id="cad-celular" value={form.celular} inputMode="tel"
            onChange={e => setForm({ ...form, celular: e.target.value })}
            placeholder="(75) 9 ....-...." />

          <div className="meta-carteira">
            <span className="mini" style={{ margin: 0 }}>código na base compartilhada</span>
            <div className="hash sel" style={{ fontSize: 14, fontWeight: 700 }}>{proximoCodigo}</div>
          </div>
        </div>

        <div className="card destaque">
          <h3 style={{ marginTop: 0 }}>2. Compromissos do mês</h3>
          <label htmlFor="cad-mes">Mês de referência</label>
          <select id="cad-mes" value={form.mes} onChange={e => setForm({ ...form, mes: e.target.value })}>
            {MESES.map(m => <option key={m}>{m}</option>)}
          </select>

          <p className="mini" style={{ marginTop: 12 }}>
            Marque o que a família vai comprovar neste mês. Pode ficar sem nenhum: a
            <b> renda do trabalho de coleta não depende disto</b>.
          </p>
          {COMPROMISSOS.map(c => (
            <label key={c} className="opcao-aviso" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={compromissos.includes(c)}
                onChange={() => alternarCompromisso(c)} />
              <span><b>{c}</b></span>
            </label>
          ))}
        </div>
      </div>

      <div className="card destaque" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>3. Consentimento do responsável</h3>
        <label>Termo apresentado ({VERSAO_TERMO})</label>
        <pre className="termo">{TEXTO_TERMO}</pre>
        <div className="hash">SHA-256 do termo: {hash ? trunc(hash, 16, 16) : 'calculando…'}</div>

        <label htmlFor="cad-forma">Como o consentimento foi colhido</label>
        <select id="cad-forma" value={forma} onChange={e => setForma(e.target.value)}>
          <option value="presencial-assinado">Presencial, com assinatura no papel</option>
          <option value="presencial-verbal">Presencial, verbal com testemunha</option>
          <option value="whatsapp">Por WhatsApp, com confirmação escrita</option>
          <option value="formulario">Formulário preenchido pela família</option>
        </select>

        <label className="opcao-aviso" style={{ marginTop: 12 }}>
          {/* id próprio: é a confirmação que libera o cadastro, e alvo posicional
              ("o último checkbox da tela") quebra assim que a tela cresce */}
          <input id="cad-aceito" type="checkbox" checked={aceito}
            onChange={e => setAceito(e.target.checked)} />
          <span>
            <b>Confirmo que li o termo acima para o responsável e que ele autorizou.</b>
            <small>
              Validade de {VALIDADE_MESES} meses, renovável em visita. O sistema guarda a
              forma e o hash do termo — nunca foto de documento nem assinatura digitalizada.
            </small>
          </span>
        </label>

        <button className="acao grande" disabled={!podeSalvar} onClick={salvar}>
          Cadastrar família
        </button>
        {!podeSalvar && (
          <p className="mini centro">
            {!nomeOk ? 'Informe o nome do responsável.' : !aceito ? 'Marque a confirmação do consentimento.' : 'Calculando o hash do termo…'}
          </p>
        )}
      </div>

      <AbrirMes />

      <h3>Famílias no piloto ({state.familias.length})</h3>
      <div className="card">
        {state.familias.length === 0 && (
          <EstadoVazio icone="👨‍👩‍👧" titulo="Nenhuma família ainda"
            dica="Use o formulário acima para incluir a primeira." />
        )}
        {state.familias.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Código</th><th>Responsável</th><th>Crianças</th>
                <th>Consentimento</th><th>Conta</th><th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {state.familias.map(f => {
                const c = consentimentoAtivo(f);
                const sit = c ? situacaoConsentimento(c) : 'ausente';
                return (
                  <tr key={f.id}>
                    <td className="mono">{f.codigo || '—'}</td>
                    <td>{f.resp}</td>
                    <td>{f.criancas}</td>
                    <td>
                      {c
                        ? <Badge tom={sit === 'vencendo' ? 'pend' : 'ok'}>
                          {sit === 'vencendo' ? 'vence em breve' : `até ${venceEm(c).toLocaleDateString('pt-BR')}`}
                        </Badge>
                        : <Badge tom="pend">sem consentimento</Badge>}
                    </td>
                    <td>
                      {f.carteira
                        ? <Badge tom="ok">{temPin(f) ? 'conta + PIN' : 'conta criada'}</Badge>
                        : <Badge tom="info">a família abre</Badge>}
                    </td>
                    <td>{fmt(f.saldo)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
