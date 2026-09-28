/* ---------------------------------------------------------------------------
   Todo o texto da página de investidores, em inglês, na ordem da página.

   É a página que vai no link da submissão à Colosseum. Quem lê tem poucos
   segundos, então a ordem responde às perguntas na ordem em que um investidor
   as faz: o que é, está funcionando?, como funciona, dá para conferir?, quem
   paga, quem ganha o quê, quem são vocês.

   As mesmas regras de honestidade do site em português valem aqui:
     · o projeto está em implantação e a coleta não começou (ver src/status.js);
     · meta aparece como meta ("goal"), sempre;
     · os números de receita são as premissas do piloto, as mesmas da
       apresentação à banca (slides 8 e 11), e não resultado.

   PENDENTE com a equipe (a página esconde o que estiver vazio):
     · foto e histórico de cada pessoa, e o texto da CNN: src/landing/data/equipe.js;
     · e-mail de domínio próprio e o PDF para investidores: src/config.js.
--------------------------------------------------------------------------- */

import { URL_EXPLORAR, URL_REPOSITORIO, URL_SITE } from '../config.js';

const explorer = (tipo, id) => `https://explorer.solana.com/${tipo}/${id}?cluster=devnet`;
const noRepositorio = (caminho) => `${URL_REPOSITORIO}/blob/main/${caminho}`;

export const nav = {
  itens: [
    { id: 'cycle', label: 'How it works' },
    { id: 'technology', label: 'Technology' },
    { id: 'companies', label: 'For companies' },
    { id: 'model', label: 'Business model' },
    { id: 'team', label: 'Team' },
  ],
  portugues: { rotulo: 'Português', href: URL_SITE },
  cta: { rotulo: 'Sign a letter of intent', curto: 'Sign LOI', href: '#loi' },
};

export const hero = {
  selo: { destaque: 'Winner', texto: 'Youth Challenge Blockchain · UNICEF Brazil' },
  fase: { implantacao: 'Deploying in Boipeba', piloto: 'Pilot underway' },
  titulo: 'AI-verified collection, paid by contract,',
  destaque: 'with a share guaranteed for children.',
  subtitulo:
    'Families on Boipeba island, Bahia, collect recyclable waste from the beaches. Every weighed collection is checked by AI and by field partners, then anchored on Solana. Companies buy the verified tonnage as recycling credits, and a contract splits every payment: 60% to the families, 25% to a children’s fund, 15% to operations.',
  aviso: {
    implantacao:
      'Status: deploying with Instituto Vivá, our partner on the island. Collection, payments and bonuses have not started yet. Every number on this page is a goal unless it says otherwise.',
    piloto:
      'Status: the pilot is running in Boipeba with Instituto Vivá. Measured results appear next to each goal, and goals are still marked as goals.',
  },
  loi: { rotulo: 'Sign a letter of intent', href: '#loi' },
  material: 'Download investor brief',
  email: 'Email the team',
  imersivo: { rotulo: 'Prefer the immersive version? Explore the island map', href: URL_EXPLORAR },
  rotuloMetas: 'Phase-one goals · 6-month pilot',
  rotuloReal: 'measured',
  /* `chave` liga a meta ao número real em STATUS.real */
  metas: [
    { chave: 'familias', valor: '30', rotulo: 'families' },
    { chave: 'criancas', valor: '60', rotulo: 'children' },
    { chave: 'toneladas', valor: '12 t', rotulo: 'verified waste', unidade: ' t' },
    { chave: null, valor: 'R$ 42k', rotulo: 'into the community' },
  ],
  cartao: {
    eyebrow: 'Children’s Fund',
    texto: 'When a child’s commitments are up to date, the bonus reaches the family.',
    itens: ['Vaccination', 'Enrollment', 'Attendance'],
  },
  altFoto: 'A child from Boipeba in a classroom, making a heart with her hands',
};

/* As seis etapas, as mesmas do mapa "Explorar a ilha" (src/explorar/dados.js). */
export const ciclo = {
  eyebrow: 'How it works',
  titulo: ['A closed loop, from beach waste ', 'to child protection.'],
  lede: 'Verified collection becomes auditable evidence, evidence becomes revenue, and revenue becomes family income and child protection, split by code.',
  etapas: [
    {
      n: '01',
      rotulo: 'Collection',
      titulo: 'Beach clean-ups',
      texto: 'Residents and tourists separate recyclables. Partner collectors gather the PET, aluminum and glass that the tide and tourism bring to the beaches.',
    },
    {
      n: '02',
      rotulo: 'Verification',
      titulo: 'Weighed, photographed, checked by AI',
      texto: 'An offline field app records weight and photo. An on-device vision model and four fraud detectors flag what needs a human check before DeTrash validates the batch.',
    },
    {
      n: '03',
      rotulo: 'Territory',
      titulo: 'Instituto Vivá',
      texto: 'Our partner on the island mobilizes families and collectors, and checks each child’s health and school records in person.',
    },
    {
      n: '04',
      rotulo: 'Revenue',
      titulo: 'Credits and products',
      texto: 'Companies buy the verified tonnage as recycling credits. Tourists buy products made from the material, each with a traceability QR code.',
    },
    {
      n: '05',
      rotulo: 'Vault',
      titulo: '2-of-3 multisig',
      texto: 'Every payment enters a multisig vault on Solana and is split by code before anyone decides. No single organization controls the money.',
    },
    {
      n: '06',
      rotulo: 'Children’s Fund',
      titulo: 'R$ 30 per child, per month',
      texto: 'Released when vaccination, school enrollment and attendance are verified. Income from work is unconditional; the bonus is on top, and an unmet month is held in reserve, never lost.',
    },
  ],
};

export const governanca = {
  eyebrow: 'Governance',
  titulo: ['Three organizations, ', 'none in control alone.'],
  lede: 'Every release from the vault needs 2 of 3 signatures. The rule is enforced by the vault on-chain, not by a bylaw.',
  itens: [
    {
      n: '1',
      etiqueta: 'Territory · Signature 1',
      nome: 'Instituto Vivá',
      texto: 'Present in Boipeba. Mobilizes families and collectors and verifies children’s health and education records in person.',
    },
    {
      n: '2',
      etiqueta: 'Validation · Signature 2',
      nome: 'DeTrash',
      texto: 'Its methodology validates the collection and issues the Circularity Report, with the evidence anchored on-chain.',
    },
    {
      n: '3',
      etiqueta: 'Community · Signature 3',
      nome: 'Community representative',
      texto: 'The island has a seat on the vault. No release from the Children’s Fund happens without the community being able to sign.',
    },
  ],
};

/* Endereços e transações reais da devnet, copiados de onchain/dados/ (os
   mesmos da apresentação à banca, slide 5). */
export const tecnologia = {
  eyebrow: 'Technology',
  titulo: ['Built on Solana. ', 'Open source. Checkable.'],
  lede: 'You don’t have to take our word for any of this. The vault is live on Solana devnet, the batch below can be recomputed in your browser, and the code is public.',
  porQueSolana:
    'Why Solana: fees of a fraction of a cent and confirmation in seconds, which makes R$ 30 monthly payments per child viable.',
  cofre: {
    titulo: 'The multisig vault, on devnet',
    texto: 'Native SPL Token multisig. Threshold 2 of 3: Instituto Vivá, DeTrash and the community representative.',
    endereco: '6tBWXEPUNHBEAvLXY3RJ1ectEPHa7H87oLrP4xD4cPi4',
    href: explorer('address', '6tBWXEPUNHBEAvLXY3RJ1ectEPHa7H87oLrP4xD4cPi4'),
    extras: [
      {
        rotulo: 'A real 2-of-3 release',
        detalhe: 'R$ 30 signed by Instituto Vivá and DeTrash. The third signer did not sign, and it still went through: the threshold is 2.',
        href: explorer('tx', '4vuXwbsTSviC8yNvGYtQ67waArcNAapawwDmZnQQmStJQhsMEx5U5GS4uEGxGmX6FVucK9MdweBom8Ryk6hZfAEX'),
      },
      {
        rotulo: 'The cRED token',
        detalhe: 'The settlement token of the demo (1 cRED = R$ 1.00).',
        href: explorer('address', 'D9J8cMSyimjt9QoHP1w1pcEu4tuevLKcW9vZUTegnjWY'),
      },
      {
        rotulo: 'A Circularity Report hash, anchored',
        detalhe: 'SHA-256 written to the chain with the Memo program.',
        href: explorer('tx', '32236oNENMrvKmfp5e62Asi7Uxf7DabAiJynAeLc5JE6hVDWmEeRUYMJjGspJgt9UadUVKiUVzgKicc1F9LqDN6w'),
      },
    ],
    botao: 'Open in Solana Explorer',
  },
  lote: {
    titulo: 'An example batch, with a checkable Merkle root',
    texto: 'One day of collection becomes one Merkle root. Only the root and the totals go on-chain; photos, locations and collector identities stay off-chain (Brazil’s LGPD privacy law). Anyone holding a single collection can prove it was in the batch.',
    aviso: 'Example data: the same demo day used in our review panel, with flags produced by the real detectors. Real collection has not started.',
    rotuloRaiz: 'Published root',
    rotuloData: 'Batch date',
    rotuloColetas: 'Collections',
    rotuloPeso: 'Total weight',
    rotuloSinalizadas: 'Flagged for human review',
    botao: 'Recompute in my browser',
    recalculando: 'Recomputing…',
    confere: 'The root matches. We rebuilt the tree from the 7 collections, with the same keccak-256 code the field app runs.',
    naoConfere: 'The root does not match. Please tell us: this should never happen.',
    prova: (n) => `Inclusion proof for collection #1: ${n} sibling hashes, verified against the published root.`,
    colunas: ['#', 'Material', 'kg', 'Leaf hash', 'Flags'],
    codigo: { rotulo: 'See merkle.ts', href: noRepositorio('src/validacao/dominio/merkle.ts') },
  },
  repositorio: {
    titulo: 'The code',
    texto: 'Field app, AI checks, Merkle batches, vault scripts and the family app.',
    href: URL_REPOSITORIO,
    rotulo: 'github.com/iMilena/raizes-do-futuro-mvp',
    caminhos: [
      { rotulo: 'Fraud detectors', href: noRepositorio('src/validacao/antifraude/deteccoes.ts') },
      { rotulo: 'Merkle batch', href: noRepositorio('src/validacao/ancoragem/lote-diario.ts') },
      { rotulo: 'Vault scripts (devnet)', href: `${URL_REPOSITORIO}/tree/main/onchain` },
      { rotulo: 'Vision model', href: `${URL_REPOSITORIO}/tree/main/modelo` },
    ],
  },
  detectores: {
    titulo: 'Four AI detectors, one line each',
    itens: [
      {
        nome: 'Reused photo',
        texto: 'A perceptual hash compares each new photo with recent ones from every collector, so the same pile can’t be claimed twice with the same picture.',
      },
      {
        nome: 'Recounted pile',
        texto: 'Same material, similar weight, within 45 minutes and 200 meters: likely the same pile weighed twice, even with a different photo.',
      },
      {
        nome: 'Implausible sequence',
        texto: 'Checks each collector’s timeline: time to weigh, kilos per minute and travel speed between collection points.',
      },
      {
        nome: 'Weight vs. photo',
        texto: 'Compares how much of the frame the material fills with the scale reading, and flags gross mismatches like half a bag at 40 kg.',
      },
    ],
    nota: 'The material type comes from a vision model that runs offline on the collector’s phone. Detectors never reject a collection: they flag it for a person to review.',
  },
};

export const empresas = {
  eyebrow: 'For companies',
  titulo: ['Verified recycling credits, ', 'traceable to the kilo.'],
  lede: 'Our main product is not a report. It is recycling credit backed by evidence that holds up in an audit, with a measurable social outcome attached.',
  quem: {
    titulo: 'Who buys, and why',
    texto: 'Brazil’s National Solid Waste Policy (Law 12,305/2010) makes manufacturers, importers, distributors and retailers responsible for the reverse logistics of their packaging. Decree 11,413/2023 lets them prove it with recycling credits. They need credits whose tonnage can be traced back to real collections.',
    compradores: ['Consumer-goods and beverage brands', 'Packaging manufacturers and importers', 'Retailers, hotels and tour operators with ESG targets'],
  },
  recebe: {
    titulo: 'What a buyer gets',
    itens: [
      'Credits tied to individual weighed, photographed and AI-checked collections',
      'A Merkle proof for each collection, checkable against a root on Solana',
      'A statement of where the money went: families, Children’s Fund, operations',
    ],
  },
  passos: {
    titulo: 'How buying works',
    itens: [
      { n: '01', titulo: 'Sign a letter of intent', texto: 'Tonnes and period. Non-binding: it reserves your share of the first verified batches.' },
      { n: '02', titulo: 'We collect and verify', texto: 'Batches are weighed, checked by AI and field partners, validated by DeTrash and anchored on Solana.' },
      { n: '03', titulo: 'You receive the credits', texto: 'With the inclusion proofs for every collection behind them.' },
      { n: '04', titulo: 'Your payment is split by contract', texto: '60% to the families, 25% to the Children’s Fund, 15% to operations. Automatically.' },
    ],
  },
  preco: { valor: 'R$ 250', unidade: 'per tonne', nota: 'Pilot reference price' },
  tracao: 'Field research, July 2026 (31 interviews): 3 of the 4 local businesses we spoke to said they would pay monthly for verified collection.',
};

export const carta = {
  eyebrow: 'Letter of intent',
  titulo: ['Reserve credits from ', 'the first batches.'],
  lede: 'Fill in the fields and the letter writes itself. It is non-binding: the price and volume are confirmed in a definitive agreement once collection starts.',
  campos: {
    empresa: 'Company',
    nome: 'Your name',
    cargo: 'Role',
    email: 'Work email',
    toneladas: 'Estimated volume',
    periodo: 'Period',
    nota: 'Anything we should know? (optional)',
  },
  opcoesToneladas: ['Up to 5 t', '5 to 20 t', '20 to 100 t', 'More than 100 t', 'Not sure yet'],
  opcoesPeriodo: ['Next 3 months', 'Next 6 months', 'Next 12 months'],
  texto: ({ empresa, toneladas, periodo, nome, cargo }) =>
    `${empresa || '[Company]'} intends to purchase ${toneladas ? toneladas.toLowerCase() : '[volume]'} of verified recycling credits from Raízes do Futuro over the ${periodo ? periodo.toLowerCase() : '[period]'}, at the pilot reference price of R$ 250 per tonne, subject to a definitive agreement. This letter is non-binding.\n\n${nome || '[Name]'}${cargo ? `, ${cargo}` : ''}`,
  autorizacao: 'I can sign this letter on behalf of the company, and I understand it is non-binding.',
  dados: 'Raízes do Futuro may use this information only to follow up on this letter (LGPD).',
  botao: 'Sign letter of intent',
  enviando: 'Sending…',
  erros: {
    empresa: 'Tell us the company name.',
    nome: 'Tell us your name.',
    email: 'Check the email address.',
    aceite: 'Please confirm both boxes to sign.',
    envio: 'We couldn’t send it right now. Please try again in a few minutes.',
  },
  feito: (primeiro) => `Thank you, ${primeiro}. The team will reply within 2 business days with the next steps.`,
  feitoEmail: 'Your email app opened with the signed letter. Send it and we will reply within 2 business days.',
};

/* Premissas do piloto: apresentação à banca, slides 8, 10 e 11. */
export const modelo = {
  eyebrow: 'Business model',
  titulo: ['How Raízes makes money, ', 'and how it pays for itself.'],
  lede: 'Every sale is split by the contract. The families’ and the children’s shares never touch our accounts: they go from the vault straight to them.',
  fatias: [
    { chave: 'a', pct: 60, titulo: 'Families', texto: 'Direct, unconditional income for everyone who collects, with or without children.' },
    { chave: 'b', pct: 25, titulo: 'Children’s Fund', texto: 'R$ 30 per child per month, released by the 2-of-3 vault when health and school are verified.' },
    { chave: 'c', pct: 15, titulo: 'Raízes · operations', texto: 'This is our revenue. It pays field validation, collection logistics, network fees and the platform.' },
  ],
  semTaxa:
    'There is no separate platform fee. Raízes only earns when a verified collection is sold, so our income grows with verified tonnage, never with fees charged to families.',
  fontes: {
    titulo: 'Who pays · 6-month pilot goals',
    itens: [
      { valor: 'R$ 18k', rotulo: 'Companies', texto: 'Recycling credits and Circularity Reports for 3 partner companies.' },
      { valor: 'R$ 24k', rotulo: 'Tourists', texto: '100 products a month from recovered material, average ticket R$ 40.' },
      { valor: 'R$ 42k', rotulo: 'Total', texto: 'At 2 t verified per month. About R$ 140 per family per month in direct income.' },
    ],
  },
  conta: {
    titulo: 'The math we’d rather show than round',
    texto: 'In the pilot, our 15% is about R$ 6,300. That pays field operations, not a team, so the pilot runs on seed capital. The 25% (R$ 10,500) covers 97% of the maximum bonus for 60 children over 6 months (R$ 10,800); the reserve rule keeps the promise to families honest when revenue falls short.',
  },
  caminho: {
    titulo: 'The path to self-funding',
    itens: [
      { quando: 'Year 1', texto: 'Consolidate Boipeba: 60 families, 5 recurring companies, corporate revenue at least 50% of the total.' },
      { quando: 'Year 2', texto: '3 coastal territories in Bahia, about 150 families, through partner organizations.' },
      { quando: 'Year 3+', texto: 'An open deployment toolkit: methodology, template vault and white-label app. Each new territory reuses the technology, so its cost per territory falls.' },
    ],
  },
  semente: {
    titulo: 'What seed capital pays for',
    itens: [
      'Vault audit and mainnet launch, plus a Pix on-ramp for families',
      'Collection and weighing kits, and training for 20 collectors and field validators',
      'The first months of children’s bonuses while corporate revenue scales',
      'A baseline and auditable tracking of the 60 children’s indicators',
    ],
  },
};

/* As pessoas e os reconhecimentos vivem em src/landing/data/equipe.js,
   compartilhados com o site em português. */
export const equipe = {
  eyebrow: 'Team',
  titulo: ['The people ', 'behind Raízes.'],
  base: 'Based in Salvador, Bahia, Brazil.',
};

export const fechamento = {
  eyebrow: 'Let’s talk',
  antes: 'Help us start the first ',
  destaque: 'verified batch',
  depois: ' in Boipeba.',
  email: 'Email the team',
  loi: 'Sign a letter of intent',
  material: 'Download investor brief',
};

export const rodape = {
  assinatura: 'Raízes do Futuro · Boipeba, Cairu, Bahia, Brazil',
  premio: 'Youth Challenge Blockchain · UNICEF Brazil',
  links: [
    { rotulo: 'Site in Portuguese', href: URL_SITE },
    { rotulo: 'Explore the island map', href: URL_EXPLORAR },
    { rotulo: 'GitHub', href: URL_REPOSITORIO, externo: true },
  ],
};
