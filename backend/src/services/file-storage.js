const { randomUUID } = require('node:crypto');
const { constants } = require('node:fs');
const { mkdir, open, lstat, realpath, unlink } = require('node:fs/promises');
const { join } = require('node:path');
const { ApiError } = require('../utils/api-error');

function xrefOffset(header, tail, size) {
  if (!/^%PDF-(?:1\.[0-7]|2\.0)[\r\n]/.test(header.toString('latin1'))) return null;
  const end = /startxref[\r\n\t ]+(\d+)[\r\n\t ]+%%EOF[\r\n\t ]*$/.exec(tail.toString('latin1'));
  if (!end) return null;
  const offset = Number(end[1]);
  return Number.isSafeInteger(offset) && offset > 0 && offset < size - end[0].length ? offset : null;
}

function validXref(target) {
  const text = target.toString('latin1');
  return /^xref\s+\d+\s+\d+\s+\d{10}\s+\d{5}\s+[nf]\s/.test(text) ||
    /^\d+[ \t]+\d+[ \t]+obj\s*<<[\s\S]*?\/Type\s*\/XRef\b[\s\S]*?stream[\r\n]/.test(text);
}

function validatePdf(buffer) {
  const offset = Buffer.isBuffer(buffer)
    ? xrefOffset(buffer.subarray(0, 12), buffer.subarray(-2048), buffer.length) : null;
  if (offset === null || !validXref(buffer.subarray(offset, offset + 2048))) {
    throw new ApiError(400, 'INVALID_PDF', 'Invalid PDF structure');
  }
}

async function readSegment(handle, position, length) {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, position);
  return buffer.subarray(0, bytesRead);
}

async function verifyStoredPdf(handle, size) {
  const tailStart = Math.max(0, size - 2048);
  const header = await readSegment(handle, 0, 12);
  const tail = await readSegment(handle, tailStart, size - tailStart);
  const offset = xrefOffset(header, tail, size);
  return offset !== null && validXref(await readSegment(handle, offset, Math.min(2048, size - offset)));
}

function createFileStorage(directory) {
  function filePath(reference) {
    if (typeof reference !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.pdf$/.test(reference)) return null;
    return join(directory, reference);
  }

  async function openStored(reference, { maxSize = Number.MAX_SAFE_INTEGER, verify = false } = {}) {
    const path = filePath(reference);
    if (!path) return null;
    let handle;
    let retained = false;
    try {
      if (!(await lstat(directory)).isDirectory()) return null;
      const root = await realpath(directory);
      const expected = await lstat(path, { bigint: true });
      if (!expected.isFile() || await realpath(path) !== join(root, reference)) return null;

      const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);
      handle = await open(path, flags);
      const actual = await handle.stat({ bigint: true });
      if (!actual.isFile() || actual.ino !== expected.ino || actual.dev !== expected.dev ||
          actual.size <= 0n || actual.size > BigInt(maxSize)) return null;
      const size = Number(actual.size);
      if (verify && !await verifyStoredPdf(handle, size)) return null;
      retained = true;
      return { size, stream: () => handle.createReadStream({ start: 0, end: size - 1 }), close: () => handle.close() };
    } catch (error) {
      if (['ENOENT', 'ENOTDIR', 'ELOOP'].includes(error.code)) return null;
      throw error;
    } finally {
      if (handle && !retained) await handle.close();
    }
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
      const file = await openStored(reference);
      return file ? { size: file.size, stream: file.stream() } : null;
    },
    openPublicPdf(reference, maxSize) {
      return openStored(reference, { maxSize, verify: true });
    },
    async hasPublicPdf(reference, maxSize) {
      const file = await openStored(reference, { maxSize, verify: true });
      if (!file) return false;
      await file.close();
      return true;
    },
    async remove(reference) {
      const path = filePath(reference);
      if (path) await unlink(path);
    }
  };
}

module.exports = { createFileStorage, validatePdf };
