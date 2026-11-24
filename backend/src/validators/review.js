const { invalid, requireFields, text, pageNumber } = require('./input');

function day(value, field) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/.test(value) ||
      value.startsWith('9999')) throw invalid(field);
  const parsed = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) throw invalid(field);
  return value;
}

function reviewFilters(query, history) {
  requireFields(query, ['page', 'limit', 'search', 'from', 'to', ...(history ? ['decision'] : [])]);
  const page = pageNumber(query.page, 1, 1000000, 'page');
  const limit = pageNumber(query.limit, 20, 100, 'limit');
  const from = day(query.from, 'from');
  const to = day(query.to, 'to');
  if (from && to && from > to) throw invalid('date range');
  if (query.decision !== undefined && !['approved', 'rejected'].includes(query.decision)) {
    throw invalid('decision');
  }
  return {
    page, limit, offset: (page - 1) * limit, from, to,
    decision: query.decision,
    search: query.search === undefined ? undefined : text(query.search, 100, 'search')
  };
}

function reviewNote(body = {}, decision) {
  requireFields(body, ['note']);
  if (decision === 'approved' && body.note === undefined) return null;
  return text(body.note, 2000, 'note', true);
}

function withdrawalReason(body) {
  requireFields(body, ['reason']);
  return text(body.reason, 2000, 'reason', true);
}

module.exports = { reviewFilters, reviewNote, withdrawalReason };
