import { useRef, useState } from 'react';
import { useStore, trunc } from '../estado/store.jsx';
import { useToast } from '../componentes/ui.jsx';
import { Icon } from '../painel/ui/Icones.jsx';
import {
  Card, CardCabecalho, CardNota, Campo, Botao, Grade, Nota, Pill, Tabela, Vazio, FigRow, Fig,
} from '../painel/ui/primitivos.jsx';
import { TelaCabecalho } from '../painel/ui/TelaCabecalho.jsx';
import { useDestaque } from '../componentes/demo.jsx';
import { sha256Arquivo, pegarGeo } from '../lib/evidencia.js';
import './coleta.css';

const MATERIAIS = ['Plástico PET', 'Plástico misto', 'Vidro', 'Alumínio', 'Papel/Papelão', 'Rejeito de praia'];

export default function Coleta() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [form, setForm] = useState({ coletor: '', material: 'Plástico PET', kg: '', local: '', familiaId: '' });
  const [foto, setFoto] = useState(null);         // { nome, hash, url }
  const [calculando, setCalculando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const arqRef = useRef(null);
  const foco = useDestaque('coleta-form');
  const ok = form.coletor && Number(form.kg) > 0 && form.local;

  const aoEscolherFoto = async e => {
    const arq = e.target.files?.[0];
    if (!arq) return;
    setCalculando(true);
    try {
      const hash = await sha256Arquivo(arq);
      setFoto({ nome: arq.name, hash, url: URL.createObjectURL(arq) });
      toast(`Evidência protegida: sha256 ${trunc(hash, 8, 8)}`, 'info');
    } catch {
      toast('Não foi possível ler a foto', 'alerta');
    }
    setCalculando(false);
  };

  const enviar = async () => {
    setEnviando(true);
    const geo = await pegarGeo();
    dispatch({
      type: 'NOVA_COLETA',
      payload: {
        ...form, kg: Number(form.kg),
        /* SEM ESTE VINCULO a renda de 60% nao chega a conta de ninguem e a familia
           nao pode conferir a propria entrega. Opcional de proposito: coletor
           pode nao ser de familia participante, e o painel mostra a diferenca. */
        familiaId: form.familiaId ? Number(form.familiaId) : null,
        data: new Date().toISOString().slice(0, 10),
        evidHash: foto?.hash || null, fotoNome: foto?.nome || null, geo,
      },
    });
    toast(`Coleta de ${form.kg} kg enviada${geo ? ', com localização registrada' : ''}`);
    setForm({ coletor: '', material: 'Plástico PET', kg: '', local: '', familiaId: '' });
    setFoto(null);
    if (arqRef.current) arqRef.current.value = '';
    setEnviando(false);
  };

  const registradas = state.coletas.reduce((a, c) => a + Number(c.kg), 0);
  const validadas = state.coletas.filter(c => c.status === 'validada');
  const kgValidados = validadas.reduce((a, c) => a + Number(c.kg), 0);
  const coletores = new Set(state.coletas.map(c => c.coletor)).size;
  const pendentes = state.coletas.filter(c => c.status === 'pendente').length;

  return (
    <div className="pn-screen">
      <TelaCabecalho area="Operação · Coleta" titulo="Registrar uma entrega leva menos de um minuto.">
        O que o coletor faz no celular, na praia, com a sacola ainda na mão: peso, material,
        local e foto. <b>Menos de um minuto por entrega.</b>
      </TelaCabecalho>

      <Nota tipo="i" icone="coin">
        <b>A renda da coleta é incondicional.</b> Os 60% da receita vão direto ao coletor pelo
        trabalho feito. Não depende de vacina, matrícula nem de qualquer contrapartida.
      </Nota>

      <Grade colunas="5-8">
        <Card className={foco}>
          <CardCabecalho titulo="Nova ação de coleta" />
          <div style={{ marginTop: 16 }}>
            <Campo id="col-quem" rotulo="Coletor(a) ou grupo">
              <input
                id="col-quem"
                className="pn-inp"
                value={form.coletor}
                onChange={e => setForm({ ...form, coletor: e.target.value })}
                placeholder="Ex.: Dona Nilza"
              />
            </Campo>

            <Grade colunas={2} style={{ gap: 14 }}>
              <Campo id="col-material" rotulo="Material">
                <select
                  id="col-material"
                  className="pn-inp"
                  value={form.material}
                  onChange={e => setForm({ ...form, material: e.target.value })}
                >
                  {MATERIAIS.map(m => <option key={m}>{m}</option>)}
                </select>
              </Campo>
              <Campo id="col-kg" rotulo="Peso (kg)">
                <input
                  id="col-kg"
                  className="pn-inp"
                  type="number"
                  min="1"
                  value={form.kg}
                  onChange={e => setForm({ ...form, kg: e.target.value })}
                  placeholder="Ex.: 40"
                />
              </Campo>
            </Grade>

            <Campo id="col-local" rotulo="Local">
              <input
                id="col-local"
                className="pn-inp"
                value={form.local}
                onChange={e => setForm({ ...form, local: e.target.value })}
                placeholder="Ex.: Praia de Cueira"
              />
            </Campo>

            <Campo
              id="col-familia"
              rotulo="Família do coletor"
              dica={<>Vincular é o que faz os <b>60% da renda chegarem à conta dela</b>, e o que permite à família conferir esta entrega no app.</>}
            >
              <select
                id="col-familia"
                className="pn-inp"
                value={form.familiaId}
                onChange={e => setForm({ ...form, familiaId: e.target.value })}
              >
                <option value="">não é de família cadastrada</option>
                {state.familias.map(fa => (
                  <option key={fa.id} value={fa.id}>{fa.resp} ({fa.codigo})</option>
                ))}
              </select>
            </Campo>

            <Campo id="col-foto" rotulo="Evidência fotográfica">
              <div className="pn-drop">
                <div className="t">Tirar foto ou anexar arquivo</div>
                <div className="d">
                  Foto e localização compõem a evidência da metodologia DeTrash. O hash é
                  calculado no aparelho e a imagem não sai dele.
                </div>
                <input
                  ref={arqRef}
                  id="col-foto"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={aoEscolherFoto}
                  className="pn-arquivo"
                />
              </div>
            </Campo>

            {calculando && <p className="pn-hint">Calculando o hash da evidência…</p>}
            {foto && (
              <div className="pn-foto-previa">
                <img src={foto.url} alt="Prévia da evidência" />
                <div>
                  <b>{foto.nome}</b>
                  <span className="pn-mono">sha256: {trunc(foto.hash, 12, 12)}</span>
                  <span className="pn-hint">
                    A foto fica no aparelho: só o hash vai ao registro (LGPD).
                  </span>
                </div>
              </div>
            )}

            <Botao
              style={{ width: '100%', marginTop: 4 }}
              disabled={!ok || calculando || enviando}
              onClick={enviar}
            >
              {enviando ? 'Registrando…' : 'Enviar para validação'}
            </Botao>
          </div>
        </Card>

        <Card>
          <CardCabecalho
            titulo="Coletas registradas"
            acessorio={pendentes > 0 ? <Pill tom="warn">{pendentes} aguardando</Pill> : <Pill tom="ok">nada pendente</Pill>}
          />
          <CardNota>
            A coleta vale renda a partir da validação. O hash aparece quando a DeTrash confere.
          </CardNota>

          {state.coletas.length === 0 ? (
            <Vazio
              titulo="Nenhuma coleta registrada"
              dica="Preencha o formulário ao lado para registrar a primeira ação."
            />
          ) : (
            <Tabela className="pn-tabela-coletas">
              <thead>
                <tr>
                  <th>Data</th><th>Coletor</th><th>Material</th>
                  <th style={{ textAlign: 'right' }}>kg</th><th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {[...state.coletas].reverse().map(c => (
                  <tr key={c.id} className={c.status === 'validada' ? 'done' : 'needs'}>
                    <td className="pn-mono">{c.data}</td>
                    <td><strong>{c.coletor}</strong></td>
                    <td>{c.material}</td>
                    <td className="num">{c.kg}</td>
                    <td>
                      <Pill tom={c.status === 'validada' ? 'ok' : 'warn'}>{c.status}</Pill>
                      {c.signature && <div className="pn-mono pn-sub">{trunc(c.signature, 6, 6)}</div>}
                      {c.evidHash && (
                        <div className="pn-mono pn-sub" title="SHA-256 real da foto de evidência">
                          <Icon name="shield" className="sm" /> {trunc(c.evidHash, 6, 6)}
                        </div>
                      )}
                      {c.geo && (
                        <div className="pn-mono pn-sub" title="Localização registrada">
                          <Icon name="scan" className="sm" /> {c.geo.lat}, {c.geo.lng}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )}

          <FigRow colunas={3} style={{ marginTop: 16 }}>
            <div><Fig valor={`${registradas} kg`} rotulo="registrados" /></div>
            <div><Fig valor={`${kgValidados} kg`} rotulo="validados" /></div>
            <div><Fig valor={coletores} rotulo="coletores ativos" /></div>
          </FigRow>
        </Card>
      </Grade>
    </div>
  );
}
