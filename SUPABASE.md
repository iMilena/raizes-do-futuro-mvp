# Dados compartilhados entre aparelhos (Supabase) ☁️

Por padrão o app guarda os dados no navegador de cada pessoa. Com esta configuração (~10 min, plano gratuito), **todos veem os mesmos dados**: o coletor registra no celular e o Instituto Vivá valida no notebook.

## Passo a passo

1. Crie uma conta gratuita em https://supabase.com → **New project** (região São Paulo)
2. No painel do projeto, abra **SQL Editor** e rode:

```sql
create table estado (
  id int primary key,
  dados jsonb
);
insert into estado (id, dados) values (1, null);

alter table estado enable row level security;
-- demo pública: qualquer pessoa com a anon key lê e escreve.
create policy "demo aberta" on estado
  for all using (true) with check (true);
```

3. Em **Settings → API**, copie a **Project URL** e a **anon public key**
4. Crie o arquivo `public/supabase.json` neste projeto:

```json
{
  "url": "https://SEUPROJETO.supabase.co",
  "anonKey": "SUA_ANON_KEY"
}
```

5. `npm run build` e republique o site. Pronto — o app detecta o arquivo e passa a sincronizar sozinho (grava a cada ação, confere novidades a cada 7 s; a versão mais nova vence).

## Avisos

- **Demo apenas:** a política acima deixa a tabela aberta para quem tiver a anon key. Perfeito para o piloto/banca; em produção, usar autenticação por papel e políticas restritivas.
- Sem o `supabase.json`, nada muda: o app segue 100% local e offline.
- O botão "Resetar demo" também sincroniza — restaura o estado inicial para todos os aparelhos.
