const { pipeline } = require('node:stream/promises');

function createReviewController(service) {
  return {
    async pending(req, res) {
      res.json(await service.list(req.user, req.query, false));
    },
    async history(req, res) {
      res.json(await service.list(req.user, req.query, true));
    },
    async detail(req, res) {
      res.json(await service.detail(req.user, req.params.id));
    },
    async preview(req, res) {
      const pdf = await service.preview(req.user, req.params.id);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdf.size),
        'Content-Disposition': 'attachment; filename="review.pdf"',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff'
      });
      await pipeline(pdf.stream, res);
    },
    async approve(req, res) {
      res.json(await service.decide(req.user, req.params.id, 'approved', req.body));
    },
    async reject(req, res) {
      res.json(await service.decide(req.user, req.params.id, 'rejected', req.body));
    },
    async withdraw(req, res) {
      res.json(await service.withdraw(req.user, req.params.id, req.body));
    }
  };
}

module.exports = { createReviewController };
