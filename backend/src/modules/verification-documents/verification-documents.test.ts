import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectVerificationDocument, safeDocumentFilename } from './verification-documents.service';

test('verification document type is determined from file signatures', () => {
  assert.deepEqual(inspectVerificationDocument(Buffer.from('%PDF-1.7\n')), {
    extension: 'pdf',
    contentType: 'application/pdf',
  });
  assert.deepEqual(inspectVerificationDocument(Buffer.from([0xff, 0xd8, 0xff, 0x00])), {
    extension: 'jpg',
    contentType: 'image/jpeg',
  });
  assert.deepEqual(inspectVerificationDocument(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), {
    extension: 'png',
    contentType: 'image/png',
  });
  assert.equal(inspectVerificationDocument(Buffer.from('not a document')), null);
});

test('verification document filenames cannot carry paths or control characters', () => {
  const filename = safeDocumentFilename('../business\r\nlicense.pdf');
  assert.equal(filename.includes('..'), false);
  assert.equal(filename.includes('/'), false);
  assert.equal(filename.includes('\\'), false);
  assert.equal(/[\u0000-\u001f\u007f]/.test(filename), false);
  assert.equal(safeDocumentFilename(' \u0000 '), 'verification-document');
});
