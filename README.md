# PWA - Fila de Trabalho

Aplicação React com estratégia **offline-first** para continuidade de uso quando os colaboradores estiverem sem Wi-Fi.

## Funcionalidades entregues

- Tela inicial simples com mensagem `Hello Fila de Trabalho`.
- Status de conectividade `Online/Offline`.
- Fila local de ações usando `IndexedDB`.
- Sincronização automática ao reconectar e também via botão manual.
- Configuração PWA com `service worker` e cache de assets/documentos/API.

## Proxy de desenvolvimento

Para executar o Vite localmente contra uma API remota, crie um `.env` e ajuste:

```bash
API_PROXY_TARGET=https://servidor-do-cliente
```

Essa configuração é usada exclusivamente pelo proxy do `npm run dev`. O build usa
sempre a origem onde o PWA estiver publicado, sem incorporar URL de outro cliente.

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
