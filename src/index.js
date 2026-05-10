import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    try {
      const page = await getAssetFromKV(
        {
          request,
          waitUntil: ctx.waitUntil.bind(ctx),
        },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: ASSET_MANIFEST,
          cacheControl: {
            browserTTL: 60 * 60 * 24 * 30,
            edgeTTL: 60 * 60 * 24 * 30,
            bypassCache: false,
          },
        }
      );

      // Set proper content types for JS files
      const response = new Response(page.body, page);
      if (url.pathname.endsWith('.js')) {
        response.headers.set('Content-Type', 'application/javascript');
      }

      return response;
    } catch (e) {
      // For SPA routing, serve index.html for any non-asset routes
      if (!url.pathname.includes('.')) {
        try {
          const indexPage = await getAssetFromKV(
            {
              request: new Request(`${url.origin}/index.html`, request),
              waitUntil: ctx.waitUntil.bind(ctx),
            },
            {
              ASSET_NAMESPACE: env.__STATIC_CONTENT,
              ASSET_MANIFEST: ASSET_MANIFEST,
            }
          );
          return new Response(indexPage.body, {
            ...indexPage,
            headers: {
              ...indexPage.headers,
              'Content-Type': 'text/html',
            },
          });
        } catch (e) {
          // Fallback if index.html not found
        }
      }

      return new Response('Not found', { status: 404 });
    }
  },
};