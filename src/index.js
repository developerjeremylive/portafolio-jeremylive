import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';

const DEBUG = false;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      const page = await getAssetFromKV(
        {
          request,
          waitUntil: ctx.waitUntil.bind(ctx),
        },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: manifestJSON,
          cacheControl: {
            browserTTL: 60 * 60 * 24 * 30,
            edgeTTL: 60 * 60 * 24 * 30,
            bypassCache: false,
          },
        }
      );

      // Set proper content types
      const response = new Response(page.body, page);
      if (pathname.endsWith('.js')) {
        response.headers.set('Content-Type', 'application/javascript');
      } else if (pathname.endsWith('.css')) {
        response.headers.set('Content-Type', 'text/css');
      } else if (pathname.endsWith('.json')) {
        response.headers.set('Content-Type', 'application/json');
      }

      return response;
    } catch (e) {
      // For SPA routing, serve index.html for any non-asset routes
      if (!pathname.includes('.') || pathname === '/' || pathname === '') {
        try {
          const indexRequest = new Request(`${url.origin}/index.html`, request);
          const indexPage = await getAssetFromKV(
            {
              request: indexRequest,
              waitUntil: ctx.waitUntil.bind(ctx),
            },
            {
              ASSET_NAMESPACE: env.__STATIC_CONTENT,
              ASSET_MANIFEST: manifestJSON,
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
          if (DEBUG) {
            return new Response(`Error loading index.html: ${e.message}`, { status: 500 });
          }
        }
      }

      if (DEBUG) {
        return new Response(`Asset not found: ${pathname}`, { status: 404 });
      }

      return new Response('Not found', { status: 404 });
    }
  },
};