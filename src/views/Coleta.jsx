import React, { useState } from 'react';
import { useStore, trunc } from '../store.jsx';
import { useToast, Badge, EstadoVazio } from '../ui.jsx';
import { useDestaque } from '../demo.jsx';

export default function Coleta() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [form, setForm] = useState({ coletor: '', material: 'Plástico PET', kg: '', local: '' });
  const foco = useDestaque('coleta-form');
  const ok = form.coletor && Number(form.kg) > 0 && form.local;

  const enviar = () => {
    dispatch({ type: 'NOVA_COLETA', payload: { ...form, kg: Number(form.kg), data: new Date().toISOString().slice(0, 10) } });
    toast(`Coleta de ${form.kg} kg enviada ✔`);
    setForm({ coletor: '', material: 'Plástico PET', kg: '', local: '' });
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
          <input type="file" disabled title="Disponível no aplicativo de campo" />
          <p className="mini">📷 No app real, fotos e geolocalização compõem a evidência (metodologia DeTrash).</p>
          <button className="acao" disabled={!ok} onClick={enviar}>Enviar para validação</button>
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
