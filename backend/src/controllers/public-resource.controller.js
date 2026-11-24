const { pipeline } = require('node:stream/promises');

function createPublicResourceController(service) {
  function sendPdf(disposition) {
    return async (req, res) => {
      const pdf = await service.file(req.params.id, req.query);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdf.size),
        'Content-Disposition': disposition + '; filename="resource-' + req.params.id + '.pdf"',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; sandbox",
        'Referrer-Policy': 'no-referrer'
      });
      if (req.method === 'HEAD') {
        await pdf.close();
        return res.end();
      }
      await pipeline(pdf.stream(), res);
    };
  }

  return {
    async list(req, res) { res.json(await service.list(req.query)); },
    async detail(req, res) { res.json(await service.detail(req.params.id, req.query)); },
    async filters(req, res) { res.json(await service.filters(req.query)); },
    async external(req, res) { res.json(await service.external(req.params.id, req.query)); },
    download: sendPdf('attachment'),
    preview: sendPdf('inline')
  };
}

module.exports = { createPublicResourceController };
