# Deploy na Railway

Este projeto publica:

- `/` — página de vendas padrão;
- `/vsl/` — página com VSL;
- `/quiz/` — página gamificada.

## Deploy

```powershell
railway login
railway init
railway up
railway domain
```

O serviço usa `process.env.PORT`, fornecido automaticamente pela Railway.

## Domínio

No serviço, abra `Settings > Networking > Public Networking` e adicione:

`protocoloantiflacidez.gusttavogamarra.com.br`

Copie para o provedor de DNS exatamente os registros CNAME e TXT apresentados
pela Railway.
