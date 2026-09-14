/* Preparo do ambiente dos testes do módulo de Validação de Coleta.

   O Node 24 já traz `crypto.subtle` e `crypto.randomUUID`, então WebCrypto não
   precisa de remendo. O que falta é IndexedDB, e ele entra só nos testes de
   armazenamento, via importação local de `fake-indexeddb/auto`. Deixar global
   aqui esconderia de nós mesmos quais módulos dependem do banco. */
export {};
