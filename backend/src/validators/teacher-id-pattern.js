const { ApiError } = require('../utils/api-error');

const token = /([A-Za-z0-9_-]|\[(?:A-Z|a-z|0-9|A-Za-z|A-Z0-9|a-z0-9|A-Za-z0-9)\])(?:\{([1-9][0-9]{0,2})\})?/y;

function compileTeacherIdPattern(pattern) {
  const invalid = () => new ApiError(400, 'INVALID_TEACHER_ID_PATTERN', 'Unsupported Teacher ID pattern');
  if (typeof pattern !== 'string' || pattern.length > 255 ||
      pattern.length < 3 || !pattern.startsWith('^') || !pattern.endsWith('$')) {
    throw invalid();
  }

  const expression = pattern.slice(1, -1);
  let index = 0;
  let sample = '';
  while (index < expression.length) {
    token.lastIndex = index;
    const match = token.exec(expression);
    if (!match) throw invalid();

    const [, atom, repetition = '1'] = match;
    const width = Number(repetition);
    if (sample.length + width > 100) throw invalid();

    sample += (atom.startsWith('[') ? atom[1] : atom).repeat(width);
    index = token.lastIndex;
  }

  // The allowlist has only single-character atoms and fixed repetition. The
  // additional end assertion requires the true end of input in JavaScript.
  const regex = new RegExp(`^${expression}(?![\\s\\S])$`);
  const matches = code => typeof code === 'string' && code.length === sample.length && regex.test(code);
  if (!matches(sample) || matches(sample + '0') || matches('!' + sample.slice(1))) throw invalid();

  return matches;
}

module.exports = { compileTeacherIdPattern };
