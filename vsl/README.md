# Protocolo Antiflacidez — Página VSL

Página de vendas separada da versão longa/padrão.

## Estrutura

- `index.html`: conteúdo e estrutura semântica.
- `src/styles.css`: sistema visual responsivo.
- `src/main.js`: player, bloqueio, desbloqueio, persistência, FAQ e CTA móvel.
- `assets/video/vsl-antiflacidez.mp4`: arquivo da VSL.

## Regra de desbloqueio

O conteúdo de oferta fica invisível até o evento `ended` do vídeo. Após a conclusão, a página salva o estado no `localStorage` para que a mesma pessoa não precise assistir novamente no mesmo navegador.

Para testar novamente o bloqueio, remova a chave abaixo do armazenamento local do navegador:

`gamarra:vsl-antiflacidez:complete:v1`

## Publicação

O vídeo usa `preload="metadata"` para evitar o download integral antes do play. Para tráfego em escala, hospede o MP4 em uma CDN/serviço de streaming e substitua apenas o endereço do `<source>` em `index.html`.
