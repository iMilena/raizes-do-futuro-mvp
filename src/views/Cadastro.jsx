import { useEffect, useState } from 'react';
import {
  useStore, fmt, trunc, BONUS_POR_CRIANCA, VERSAO_TERMO, TEXTO_TERMO, hashTermo,
  VALIDADE_MESES, consentimentoAtivo, situacaoConsentimento, venceEm, temPin,
} from '../estado/store.jsx';
import { useToast } from '../componentes/ui.jsx';
import {
  Card, CardNota, Campo, Caixa, Botao, Grade, Nota, Pill, Vazio,
  Secao, RotuloSecao, Tabela, Mono, HashChip,
} from '../painel/ui/primitivos.jsx';
import { TelaCabecalho } from '../painel/ui/TelaCabecalho.jsx';
import * as auth from '../lib/auth.js';
import './cadastro.css';

/* ---------------------------------------------------------------------------
   Cadastro de famílias: o que faltava para o piloto crescer de dentro do app.

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
   código (BOI-014), ver LGPD no SUPABASE.md.
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
 * Abre o mês seguinte, a tarefa mais repetida do piloto.
 *
 * Antes, compromisso só nascia junto com o cadastro da família: dava para rodar
 * um mês e depois o ciclo travava. Como todo mês repete quase a mesma lista para
 * quase todas as famílias, isto é em LOTE, com a opção de escolher quem.
 *
 * O que já existe não é duplicado, e o que já foi comprovado não é apagável:
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
      : `Nada a criar: esses compromissos de ${mes} já existem`, 'info', 6000);
  };

  return (
    <>
      <Secao>
        <RotuloSecao>Compromissos de cada mês</RotuloSecao>
        <Card>
          <CardNota>
            O ciclo é mensal: todo mês a operação define o que cada família vai comprovar.
            Faça em lote e ajuste caso a caso na tabela abaixo. <b>A renda do trabalho de
            coleta não depende disto</b>, aqui só se define o bônus.
          </CardNota>

          <Grade colunas={2} style={{ marginTop: 18 }}>
            <div>
              <Campo id="mes-abrir" rotulo="Mês">
                <select
                  id="mes-abrir"
                  className="pn-inp"
                  value={mes}
                  onChange={e => setMes(e.target.value)}
                >
                  {MESES.map(m => <option key={m}>{m}</option>)}
                </select>
              </Campo>

              <fieldset className="pn-fs">
                <legend>Compromissos deste mês</legend>
                {COMPROMISSOS.map(c => (
                  <Caixa
                    key={c}
                    id={'lote-' + c}
                    checked={tipos.includes(c)}
                    onChange={() => alternar(tipos, setTipos, c)}
                  >
                    <b>{c}</b>
                  </Caixa>
                ))}
              </fieldset>
            </div>

            <fieldset className="pn-fs">
              <legend>Para quem</legend>
              <p className="pn-hint" style={{ marginBottom: 4 }}>
                Sem marcar ninguém, vale para <b>todas as {comConsentimento.length} famílias
                com consentimento vigente</b>.
                {semConsentimento > 0 && (
                  <> {semConsentimento} família(s) ficam de fora por não ter consentimento vigente.</>
                )}
              </p>
              {/* Os nomes viram fichas que quebram em linhas: com 14 famílias, uma
                  lista vertical empurraria o botão de abrir o mês para fora da tela. */}
              <div className="pn-fichas">
                {comConsentimento.map(f => (
                  <label
                    key={f.id}
                    className={'pn-ficha' + (quem.includes(f.id) ? ' on' : '')}
                    htmlFor={'quem-' + f.id}
                  >
                    <input
                      id={'quem-' + f.id}
                      type="checkbox"
                      checked={quem.includes(f.id)}
                      onChange={() => alternar(quem, setQuem, f.id)}
                    />
                    {f.resp.split(' ')[0]} <Mono>{f.codigo}</Mono>
                  </label>
                ))}
                {comConsentimento.length === 0 && (
                  <p className="pn-hint">Nenhuma família com consentimento vigente ainda.</p>
                )}
              </div>
            </fieldset>
          </Grade>

          <Nota tipo="i" icone="lamp">
            <b>Vai criar {previa.novos} compromisso(s)</b> em {mes}, para {alvo.length} família(s)
            {previa.repetidos > 0 && <> · <b>{previa.repetidos}</b> já existem e serão pulados (não duplica bônus)</>}
            {previa.novos > 0 && <> · bônus potencial total de {fmt(alvo.reduce((a, f) => a + BONUS_POR_CRIANCA * f.criancas * tipos.filter(base => {
              const tipo = f.criancas > 1 ? `${base} (${f.criancas} crianças)` : base;
              return !(f.condicoes || []).some(c => c.mes === mes && c.tipo === tipo);
            }).length, 0))}</>}
          </Nota>

          <Botao style={{ marginTop: 14 }} disabled={previa.novos === 0} onClick={abrir}>
            Abrir {mes} para {alvo.length} família(s)
          </Botao>
        </Card>
      </Secao>

      <Secao>
        <RotuloSecao>Compromissos já definidos</RotuloSecao>
        <ListaCompromissos />
      </Secao>
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
    return (
      <Vazio titulo="Nenhum compromisso definido" dica="Use o bloco acima para abrir um mês." />
    );
  }

  const porMes = [...new Set(linhas.map(l => l.mes))];

  return (
    <Card>
      {porMes.map(m => (
        <div key={m} className="pn-mes">
          <b className="pn-mes-nome">{m}</b>
          <Tabela>
            <thead><tr><th>Família</th><th>Compromisso</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {linhas.filter(l => l.mes === m).map(l => (
                <tr key={l.id}>
                  <td><strong>{l.familia.resp}</strong></td>
                  <td>{l.tipo}</td>
                  <td>
                    <Pill tom={l.status === 'liberada' ? 'ok' : l.status === 'pendente' ? 'warn' : 'wait'}>
                      {l.status.replace(/-/g, ' ')}
                    </Pill>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {l.status === 'pendente' ? (
                      <Botao tom="ghost" pequeno onClick={() => {
                        dispatch({ type: 'REMOVER_COMPROMISSO', condicaoId: l.id });
                        toast('Compromisso removido');
                      }}>remover</Botao>
                    ) : (
                      /* comprovado, validado ou liberado é histórico: apagar removeria
                         a prova que a família enviou, ou contradiria um repasse feito */
                      <span
                        className="pn-hint"
                        title="Já comprovado ou repassado: faz parte do histórico"
                      >
                        histórico
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        </div>
      ))}
    </Card>
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
    toast(`Família ${proximoCodigo} cadastrada com consentimento`, 'info', 6000);
    setCriada({ codigo: proximoCodigo, nome: form.resp.trim(), criancas: Number(form.criancas) });
    setForm({ resp: '', criancas: 1, celular: '', mes: form.mes });
    setCompromissos(['Vacinação em dia']);
    setAceito(false);
  };

  return (
    <div className="pn-screen">
      <TelaCabecalho area="Famílias · Cadastro" titulo="Cadastro de famílias">
        Inclui uma família no piloto. O <b>nome fica só neste aparelho</b>; para a base
        compartilhada vai apenas o código ({proximoCodigo}). O consentimento é parte
        deste formulário porque é na frente da família que o termo é lido, e porque
        sem ele o banco recusa o cadastro.
      </TelaCabecalho>

      {criada && (
        <Nota tipo="i" icone="check">
          <b>{criada.nome} cadastrada como {criada.codigo}</b>
          <p style={{ margin: '4px 0 0' }}>
            Bônus potencial de {fmt(BONUS_POR_CRIANCA * criada.criancas)}/mês
            ({criada.criancas} criança{criada.criancas > 1 ? 's' : ''}). Próximo passo: a família
            abre a conta dela no <b>App da Família</b> e escolhe o PIN.
          </p>
        </Nota>
      )}

      <Grade colunas={2}>
        <Card>
          <h3 className="pn-passo">1. Quem é a família</h3>

          <Campo
            id="cad-resp"
            rotulo="Nome do responsável (fica neste aparelho)"
            dica={form.resp && !nomeOk ? 'Nome muito curto.' : undefined}
          >
            <input
              id="cad-resp"
              className="pn-inp"
              value={form.resp}
              autoComplete="off"
              onChange={e => setForm({ ...form, resp: e.target.value })}
              placeholder="ex.: Maria de Lourdes"
            />
          </Campo>

          <Campo id="cad-criancas" rotulo="Quantas crianças">
            <input
              id="cad-criancas"
              className="pn-inp"
              type="number"
              min="1"
              max="12"
              value={form.criancas}
              onChange={e => setForm({ ...form, criancas: e.target.value })}
            />
            <p className="pn-hint">
              Bônus de {fmt(BONUS_POR_CRIANCA)} por criança/mês ={' '}
              <b>{fmt(BONUS_POR_CRIANCA * (Number(form.criancas) || 0))}</b> por mês com as condições em dia.
            </p>
          </Campo>

          <Campo id="cad-celular" rotulo="Celular de contato (opcional)">
            <input
              id="cad-celular"
              className="pn-inp"
              value={form.celular}
              inputMode="tel"
              onChange={e => setForm({ ...form, celular: e.target.value })}
              placeholder="(75) 9 ....-...."
            />
          </Campo>

          <div className="pn-codigo">
            <span className="l">código na base compartilhada</span>
            <HashChip texto={proximoCodigo} rotulo="Copiar código" />
          </div>
        </Card>

        <Card>
          <h3 className="pn-passo">2. Compromissos do mês</h3>

          <Campo id="cad-mes" rotulo="Mês de referência">
            <select
              id="cad-mes"
              className="pn-inp"
              value={form.mes}
              onChange={e => setForm({ ...form, mes: e.target.value })}
            >
              {MESES.map(m => <option key={m}>{m}</option>)}
            </select>
          </Campo>

          <fieldset className="pn-fs">
            <legend>O que a família vai comprovar</legend>
            <p className="pn-hint" style={{ marginBottom: 4 }}>
              Marque o que a família vai comprovar neste mês. Pode ficar sem nenhum: a
              <b> renda do trabalho de coleta não depende disto</b>.
            </p>
            {COMPROMISSOS.map(c => (
              <Caixa
                key={c}
                id={'cad-' + c}
                checked={compromissos.includes(c)}
                onChange={() => alternarCompromisso(c)}
              >
                <b>{c}</b>
              </Caixa>
            ))}
          </fieldset>
        </Card>
      </Grade>

      <Card>
        <h3 className="pn-passo">3. Consentimento do responsável</h3>

        <div className="pn-bloco-det">
          <span>Termo apresentado ({VERSAO_TERMO})</span>
          {/* O termo é o texto que vira hash: rola dentro da própria caixa em vez
              de encolher, porque encolher texto de consentimento é o começo de
              ninguém ler. `tabIndex` porque região rolável precisa chegar pelo
              teclado. */}
          <pre
            className="pn-termo"
            tabIndex={0}
            role="region"
            aria-label={`Termo de consentimento ${VERSAO_TERMO}`}
          >{TEXTO_TERMO}</pre>
        </div>
        <div className="pn-bloco-det">
          <span>SHA-256 do termo</span>
          <div>
            {hash
              ? <HashChip texto={trunc(hash, 16, 16)} copia={hash} rotulo="Copiar hash do termo" />
              : <Mono>calculando…</Mono>}
          </div>
        </div>

        <Campo id="cad-forma" rotulo="Como o consentimento foi colhido">
          <select
            id="cad-forma"
            className="pn-inp"
            value={forma}
            onChange={e => setForma(e.target.value)}
          >
            <option value="presencial-assinado">Presencial, com assinatura no papel</option>
            <option value="presencial-verbal">Presencial, verbal com testemunha</option>
            <option value="whatsapp">Por WhatsApp, com confirmação escrita</option>
            <option value="formulario">Formulário preenchido pela família</option>
          </select>
        </Campo>

        {/* id próprio: é a confirmação que libera o cadastro, e alvo posicional
            ("o último checkbox da tela") quebra assim que a tela cresce */}
        <Caixa id="cad-aceito" checked={aceito} onChange={e => setAceito(e.target.checked)}>
          <b>Confirmo que li o termo acima para o responsável e que ele autorizou.</b>
          <small>
            Validade de {VALIDADE_MESES} meses, renovável em visita. O sistema guarda a
            forma e o hash do termo, nunca foto de documento nem assinatura digitalizada.
          </small>
        </Caixa>

        <Botao style={{ marginTop: 16 }} disabled={!podeSalvar} onClick={salvar}>
          Cadastrar família
        </Botao>
        {!podeSalvar && (
          <p className="pn-hint" style={{ marginTop: 8 }}>
            {!nomeOk ? 'Informe o nome do responsável.' : !aceito ? 'Marque a confirmação do consentimento.' : 'Calculando o hash do termo…'}
          </p>
        )}
      </Card>

      <AbrirMes />

      <Secao>
        <RotuloSecao>Famílias no piloto ({state.familias.length})</RotuloSecao>
        {state.familias.length === 0 ? (
          <Vazio titulo="Nenhuma família ainda" dica="Use o formulário acima para incluir a primeira." />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <th>Código</th><th>Responsável</th>
                <th style={{ textAlign: 'right' }}>Crianças</th>
                <th>Consentimento</th><th>Conta</th>
                <th style={{ textAlign: 'right' }}>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {state.familias.map(f => {
                const c = consentimentoAtivo(f);
                const sit = c ? situacaoConsentimento(c) : 'ausente';
                return (
                  <tr key={f.id} className={c ? '' : 'needs'}>
                    <td className="num">{f.codigo || 'sem código'}</td>
                    <td><strong>{f.resp}</strong></td>
                    <td className="num">{f.criancas}</td>
                    <td>
                      {c
                        ? <Pill tom={sit === 'vencendo' ? 'warn' : 'ok'}>
                          {sit === 'vencendo' ? 'vence em breve' : `até ${venceEm(c).toLocaleDateString('pt-BR')}`}
                        </Pill>
                        : <Pill tom="warn">sem consentimento</Pill>}
                    </td>
                    <td>
                      {f.carteira
                        ? <Pill tom="ok">{temPin(f) ? 'conta + PIN' : 'conta criada'}</Pill>
                        : <Pill tom="wait">a família abre</Pill>}
                    </td>
                    <td className="num">{fmt(f.saldo)}</td>
                  </tr>
                );
              })}
            </tbody>
          </Tabela>
        )}
      </Secao>
    </div>
  );
}
