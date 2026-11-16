# Island Trend Detective dentro do site

Cópia estática do projeto da NASA Space Apps 2026 (repositório
`iMilena/raizes-trend-detective`, branch `redesign-globe`, commit `b11d15f`).
O Vite copia esta pasta como está para `dist/trend-detective/`, e a Vercel a
serve em `/trend-detective/`. O `vercel.json` na raiz redireciona
`/trend-detective` para `/trend-detective/`, porque a página usa caminhos
relativos (`css/`, `js/`, `figures/`).

Entram só os arquivos que a página carrega: `index.html`, `css/`, `js/` e as
6 figuras do case study. Os dados brutos, a análise em Python, os testes e os
slides ficam no repositório original.

Única diferença em relação ao original: a marca "Raízes do Futuro" na barra
superior é um link de volta para o site (`/#/site`).

Para atualizar, copie de novo os mesmos arquivos do repositório original e
refaça o link da marca.
