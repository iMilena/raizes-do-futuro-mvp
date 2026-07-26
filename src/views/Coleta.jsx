import React, { useRef, useState } from 'react';
import { useStore, trunc } from '../store.jsx';
import { useToast, Badge, EstadoVazio } from '../ui.jsx';
import { useDestaque } from '../demo.jsx';
import { sha256Arquivo, pegarGeo } from '../evidencia.js';

export default function Coleta() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [form, setForm] = useState({ coletor: '', material: 'Plástico PET', kg: '', local: '' });
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
      toast(`Evidência protegida — sha256 ${trunc(hash, 8, 8)} 🔐`, 'info');
    } catch (err) {
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
        data: new Date().toISOString().slice(0, 10),
        evidHash: foto?.hash || null, fotoNome: foto?.nome || null, geo,
      },
    });
    toast(`Coleta de ${form.kg} kg enviada ✔${geo ? ' · 📍 localização registrada' : ''}`);
    setForm({ coletor: '', material: 'Plástico PET', kg: '', local: '' });
    setFoto(null);
    if (arqRef.current) arqRef.current.value = '';
    setEnviando(false);
  };

  return (
    <>
      <h2>Registro de Coleta — visão do coletor</h2>
      <div className="grid g2">
        <div className={'card destaque' + foco}>
          <h3>Nova ação de coleta</h3>
          <label>Coletor(a) ou grupo</label>
          <input value={form.coletor} onChange={e => setForm({ ...form, coletor: e.target.value })} placeholder="Ex.: Dona Nilza" />
          <label>Material</label>
          <select value={form.material} onChange={e => setForm({ ...form, material: e.target.value })}>
            {['Plástico PET', 'Plástico misto', 'Vidro', 'Alumínio', 'Papel/Papelão', 'Rejeito de praia'].map(m => <option key={m}>{m}</option>)}
          </select>
          <label>Peso (kg)</label>
          <input type="number" min="1" value={form.kg} onChange={e => setForm({ ...form, kg: e.target.value })} placeholder="Ex.: 40" />
          <label>Local</label>
          <input value={form.local} onChange={e => setForm({ ...form, local: e.target.value })} placeholder="Ex.: Praia de Cueira" />
          <label>Evidência fotográfica</label>
          <input ref={arqRef} type="file" accept="image/*" capture="environment" onChange={aoEscolherFoto} />
          {calculando && <p className="mini">🔐 calculando o hash da evidência…</p>}
          {foto && (
            <div className="foto-previa">
              <img src={foto.url} alt="Prévia da evidência" />
              <div>
                <b>{foto.nome}</b>
                <span className="hash">sha256: {trunc(foto.hash, 12, 12)}</span>
                <span className="mini">A foto fica no aparelho — só o hash vai ao registro (LGPD).</span>
              </div>
            </div>
          )}
          <p className="mini">📷 Foto + localização compõem a evidência da metodologia DeTrash. O hash é calculado no seu aparelho.</p>
          <button className="acao" disabled={!ok || calculando || enviando} onClick={enviar}>
            {enviando ? 'Registrando…' : 'Enviar para validação'}
          </button>
        </div>

        <div className="card">
          <h3>Coletas registradas</h3>
          {state.coletas.length === 0
            ? <EstadoVazio icone="🧹" titulo="Nenhuma coleta registrada" dica="Preencha o formulário ao lado para registrar a primeira ação." />
            : (
              <table>
                <thead><tr><th>Data</th><th>Coletor</th><th>Material</th><th>kg</th><th>Status</th></tr></thead>
                <tbody>
                  {[...state.coletas].reverse().map(c => (
                    <tr key={c.id}>
                      <td>{c.data}</td><td>{c.coletor}</td><td>{c.material}</td><td>{c.kg}</td>
                      <td>
                        <Badge tom={c.status === 'validada' ? 'ok' : 'pend'}>{c.status}</Badge>
                        {c.signature && <div className="hash">{trunc(c.signature, 6, 6)}</div>}
                        {c.evidHash && <div className="hash" title="SHA-256 real da foto de evidência">📎 {trunc(c.evidHash, 6, 6)}</div>}
                        {c.geo && <div className="mini" title="Localização registrada">📍 {c.geo.lat}, {c.geo.lng}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </div>
      <div className="aviso">
        <b>Renda incondicional:</b> o pagamento pela coleta é feito diretamente ao coletor (60% da receita) e não depende de nenhuma condição.
      </div>
    </>
  );
}
