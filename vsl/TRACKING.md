# Rastreamento — Protocolo Antiflacidez

## Identificadores

- GA4: `G-STBMVXHXJX`
- Google Tag Manager: `GTM-M4J7H7W8`
- Meta Pixel: `1346135320973972`
- Microsoft Clarity: `xu4xfl1ckz`
- Google Ads — compra aprovada na Kiwify:
  `AW-10899379805/tvaRCLmsxtgcEN2snc0o`
- Google Ads — checkout iniciado na Kiwify:
  `AW-10899379805/bK1UCO361dgcEN2snc0o`

## Arquitetura

- `src/tracking.js` centraliza consentimento, carregamento das plataformas,
  eventos comportamentais e preservação de atribuição.
- `src/tracking.css` contém somente a interface mobile-first de privacidade.
- GA4, GTM, Meta Pixel e Clarity carregam apenas após o aceite dos cookies
  opcionais.
- A preferência é compartilhada entre as três páginas pelo `localStorage` do
  mesmo domínio.
- UTMs e identificadores de clique permitidos são preservados nos links da
  Kiwify.
- As respostas individuais do quiz não são enviadas às plataformas.

## Fonte de verdade das conversões

`begin_checkout` e `purchase` são disparados somente pela integração da Kiwify.
As páginas enviam `checkout_click`, que mede intenção de saída, mas não é
conversão financeira.

Não publique no GTM outra tag de `begin_checkout` ou `purchase` para os mesmos
eventos. Também não replique no GTM as tags-base instaladas diretamente no
`tracking.js`, pois isso duplicaria pageviews e eventos.

## Eventos disponíveis

- Todas as páginas: `tracking_ready`, `scroll_depth`, `engagement_time`,
  `offer_view`, `checkout_click`, `faq_open` e `proof_engagement`.
- VSL: `vsl_start`, `vsl_progress`, `vsl_complete` e
  `vsl_offer_revealed`.
- Quiz: `quiz_start`, `quiz_progress`, `quiz_answer`, `quiz_complete` e
  `quiz_offer_revealed`.

No `dataLayer`, os eventos recebem o prefixo `paf_`, por exemplo
`paf_checkout_click`.

## Parâmetros de atribuição preservados

`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`,
`utm_id`, `gclid`, `gbraid`, `wbraid`, `fbclid`, `ttclid`, `src` e `sck`.

Nenhum nome, e-mail, telefone, documento ou resposta do quiz é incluído em
URLs ou eventos.

## Depuração

Abra qualquer página com `?tracking_debug=1`. Depois do aceite, o console
mostrará cada evento com o prefixo `[PAF Tracking]`.

Antes de anunciar, validar também:

1. GA4 em Tempo real/DebugView.
2. GTM no Tag Assistant.
3. Meta em “Testar eventos”.
4. Clarity em gravações e eventos personalizados.
5. Checkout e compra em modo de teste da Kiwify.
