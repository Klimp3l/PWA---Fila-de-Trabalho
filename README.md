# PWA - Fila de Trabalho

Aplicação React com estratégia **offline-first** para continuidade de uso quando os colaboradores estiverem sem Wi-Fi.

## Funcionalidades entregues

- Tela inicial simples com mensagem `Hello Fila de Trabalho`.
- Status de conectividade `Online/Offline`.
- Fila local de ações usando `IndexedDB`.
- Sincronização automática ao reconectar e também via botão manual.
- Configuração PWA com `service worker` e cache de assets/documentos/API.

## Configuração de ambiente

Copie o arquivo `.env.example` para `.env` e ajuste a URL:

```bash
VITE_API_BASE_URL=https://observador.smvioleta.com.br
```

Em produção (Tomcat do cliente), a URL pode apontar para o mesmo domínio do ambiente publicado.

## Comandos

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Build e publicação no Tomcat

1. Execute `npm run build`.
2. O conteúdo final será gerado em `dist/`.
3. Publique os arquivos de `dist/` dentro do contexto web desejado no Tomcat do cliente.
4. Garanta que o backend esteja acessível em `.../bdoserver2.7/odwctrl?action=execTarefa&apelido=HEAVEN-wfg-fila-trabalho-mobile-backend`.

## Comportamento offline

1. Quando não houver conexão, as ações são salvas localmente no `IndexedDB`.
2. Ao voltar a conexão, a aplicação tenta sincronizar automaticamente em lote.
3. Se ocorrer erro de envio, o item permanece na fila para novas tentativas.
