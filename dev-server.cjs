const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.argv[2] || 8000);
const root = process.cwd();
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".glb": "model/gltf-binary"
};

function titleFromFileName(fileName) {
  return path.basename(fileName, ".glb")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);

  if (pathname === "/structures.json") {
    fs.readdir(root, (error, files) => {
      if (error) {
        response.writeHead(500);
        response.end("[]");
        return;
      }

      const structures = files
        .filter((fileName) => path.extname(fileName).toLowerCase() === ".glb")
        .sort((a, b) => a.localeCompare(b))
        .map((fileName) => ({
          id: path.basename(fileName, ".glb").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          title: titleFromFileName(fileName),
          description: `Structure chargee depuis le fichier ${fileName}.`,
          fileName,
          modelUrl: `./${fileName}`
        }));

      response.writeHead(200, { "Content-Type": contentTypes[".json"] });
      response.end(JSON.stringify(structures));
    });
    return;
  }

  if (pathname === "/structures/stream") {
    // SSE endpoint: push updates when .glb files change in the root
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    });
    response.write('\n');

    const sendStructures = () => {
      fs.readdir(root, (error, files) => {
        if (error) {
          response.write(`data: ${JSON.stringify([])}\n\n`);
          return;
        }

        const structures = files
          .filter((fileName) => path.extname(fileName).toLowerCase() === '.glb')
          .sort((a, b) => a.localeCompare(b))
          .map((fileName) => ({
            id: path.basename(fileName, '.glb').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            title: titleFromFileName(fileName),
            description: `Structure chargee depuis le fichier ${fileName}.`,
            fileName,
            modelUrl: `./${fileName}`
          }));

        response.write(`data: ${JSON.stringify(structures)}\n\n`);
      });
    };

    // send initial list
    sendStructures();

    // watch for changes and notify client (with simple debounce)
    let debounce = null;
    const watcher = fs.watch(root, { persistent: true }, (ev, file) => {
      if (!file) return;
      if (path.extname(file).toLowerCase() !== '.glb') return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => sendStructures(), 150);
    });

    // cleanup when client disconnects
    request.on('close', () => {
      try { watcher.close(); } catch (e) {}
    });

    return;
  }

  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(root, requested);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream"
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    response.end(data);
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`Minecraft Circle Builder: http://127.0.0.1:${port}/index.html`);
});
