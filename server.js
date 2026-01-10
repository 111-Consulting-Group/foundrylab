#!/usr/bin/env node

/**
 * Production server for serving static Expo web build
 * This file serves the exported static site from the dist directory
 */

const { createServer } = require('http');
const { readFileSync, existsSync, statSync } = require('fs');
const { join, extname, resolve } = require('path');
const { parse } = require('url');

const PORT = process.env.PORT || 10000;
const DIST_DIR = resolve(__dirname, 'dist');

// MIME types for common file extensions
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

function getMimeType(filePath) {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function serveFile(filePath, res) {
  try {
    if (!existsSync(filePath)) {
      return false;
    }

    const stats = statSync(filePath);
    if (!stats.isFile()) {
      return false;
    }

    const content = readFileSync(filePath);
    const mimeType = getMimeType(filePath);
    
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Length': content.length,
    });
    res.end(content);
    return true;
  } catch (error) {
    console.error('Error serving file:', error);
    return false;
  }
}

function serveIndexHtml(res) {
  const indexPath = join(DIST_DIR, 'index.html');
  if (existsSync(indexPath)) {
    serveFile(indexPath, res);
    return true;
  }
  return false;
}

const server = createServer((req, res) => {
  const parsedUrl = parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // Default to index.html for root
  if (pathname === '/') {
    pathname = '/index.html';
  }

  // Remove leading slash
  const filePath = join(DIST_DIR, pathname.replace(/^\//, ''));

  // Try to serve the requested file
  if (serveFile(filePath, res)) {
    return;
  }

  // If file doesn't exist and it looks like a route (no extension),
  // serve index.html for SPA routing
  if (!extname(pathname)) {
    if (serveIndexHtml(res)) {
      return;
    }
  }

  // 404 - file not found
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Serving files from: ${DIST_DIR}`);
  
  if (!existsSync(DIST_DIR)) {
    console.error(`ERROR: dist directory not found at ${DIST_DIR}`);
    console.error('Please run "npm run build:web" first');
    process.exit(1);
  }
});
