import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT ?? 4173);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let filePath = path.resolve(root, `.${pathname}`);
    if (!filePath.startsWith(`${root}${path.sep}`) && filePath !== root) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    if ((await stat(filePath)).isDirectory()) filePath = path.join(filePath, 'index.html');
    const body = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filePath)] ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(body);
  } catch (_) {
    response.writeHead(404).end('Not found');
  }
});

server.listen(port, () => console.log(`Story Builder: http://localhost:${port}`));
