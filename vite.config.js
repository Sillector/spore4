import { defineConfig } from 'vite';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configDir = path.resolve(__dirname, 'src/config');

function createConfigWriter() {
  return {
    name: 'dev-config-writer',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.originalUrl || req.url;
        if (!url || !url.startsWith('/__config/')) {
          next();
          return;
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }
        const targetUrl = new URL(url, 'http://localhost');
        const name = targetUrl.pathname.replace('/__config/', '').trim();
        if (!name) {
          res.statusCode = 400;
          res.end('Missing config name');
          return;
        }
        const filePath = path.resolve(configDir, `${name}.json`);
        try {
          await fs.access(filePath);
        } catch {
          res.statusCode = 404;
          res.end('Config not found');
          return;
        }
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const serialized = `${JSON.stringify(data, null, 2)}\n`;
            await fs.writeFile(filePath, serialized, 'utf8');
            server.ws.send({ type: 'full-reload' });
            res.statusCode = 200;
            res.end('OK');
          } catch (error) {
            res.statusCode = 400;
            res.end(`Invalid JSON: ${error.message}`);
          }
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [createConfigWriter()]
});
