import express, { type Express } from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';

export function mountFrontend(app: Express, directory: string) {
  const index = path.join(directory, 'index.html');
  if (!existsSync(index)) throw new Error('Frontend build is missing. Run npm run build first.');

  app.use(
    '/assets',
    express.static(path.join(directory, 'assets'), {
      immutable: true,
      maxAge: '1y',
      index: false,
      dotfiles: 'deny',
    }),
    (_req, res) => res.status(404).type('text').send('Asset not found'),
  );
  app.use(
    express.static(directory, {
      index: false,
      dotfiles: 'deny',
      setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
    }),
  );
  app.get('/{*path}', (req, res, next) => {
    if (req.path.includes('/.') || path.extname(req.path) || !req.accepts('html')) return next();
    res.set('Cache-Control', 'no-cache').sendFile(index);
  });
}
