const { randomUUID } = require('node:crypto');
const { constants } = require('node:fs');
const { mkdir, open, lstat, unlink } = require('node:fs/promises');
const { join } = require('node:path');
const { ApiError } = require('../utils/api-error');

function validatePdf(buffer) {
  if (!Buffer.isBuffer(buffer) || !/^%PDF-(?:1\.[0-7]|2\.0)[\r\n]/.test(buffer.subarray(0, 12).toString('latin1'))) {
    throw new ApiError(400, 'INVALID_PDF', 'Invalid PDF structure');
  }
  const tail = buffer.subarray(-2048).toString('latin1');
  const end = /startxref[\r\n\t ]+(\d+)[\r\n\t ]+%%EOF[\r\n\t ]*$/.exec(tail);
  const offset = end ? Number(end[1]) : NaN;
  const target = Number.isSafeInteger(offset) && offset > 0 && offset < buffer.length - end[0].length
    ? buffer.subarray(offset, offset + 2048).toString('latin1') : '';
  const classic = /^xref\s+\d+\s+\d+\s+\d{10}\s+\d{5}\s+[nf]\s/.test(target);
  const stream = /^\d+[ \t]+\d+[ \t]+obj\s*<<[\s\S]*?\/Type\s*\/XRef\b[\s\S]*?stream[\r\n]/.test(target);
  if (!classic && !stream) throw new ApiError(400, 'INVALID_PDF', 'Invalid PDF structure');
}

function createFileStorage(directory) {
  function filePath(reference) {
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.pdf$/.test(reference)) return null;
    return join(directory, reference);
  }

  return {
    async save(buffer) {
      validatePdf(buffer);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const reference = randomUUID() + '.pdf';
      const path = filePath(reference);
      const file = await open(path, 'wx', 0o600);
      try {
        try {
          await file.writeFile(buffer);
          await file.sync();
        } finally {
          await file.close();
        }
      } catch (error) {
        await unlink(path).catch(() => console.error('Could not clean up incomplete Teacher upload'));
        throw error;
      }
      return reference;
    },
    async exists(reference) {
      const path = filePath(reference);
      if (!path) return false;
      try {
        return (await lstat(path)).isFile();
      } catch (error) {
        if (error.code === 'ENOENT') return false;
        throw error;
      }
    },
    async openPdf(reference) {
      const path = filePath(reference);
      if (!path) return null;
      let handle;
      try {
        if (!(await lstat(path)).isFile()) return null;
        handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
        const stats = await handle.stat();
        if (!stats.isFile()) {
          await handle.close();
          return null;
        }
        return { size: stats.size, stream: handle.createReadStream() };
      } catch (error) {
        if (handle) await handle.close();
        if (['ENOENT', 'ELOOP'].includes(error.code)) return null;
        throw error;
      }
    },
    async remove(reference) {
      const path = filePath(reference);
      if (path) await unlink(path);
    }
  };
}

module.exports = { createFileStorage, validatePdf };
