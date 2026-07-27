import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildWranglerArgs,
  createUploadState,
  isEntryUploaded,
  loadUploadState,
  markEntryUploaded,
  parseOptions,
  resolveSourcePath,
  saveUploadState,
  verifySourceEntry,
} from '../scripts/upload-media-to-r2.mjs';

describe('R2 media uploader helpers', () => {
  it('resolves a manifest key beneath the WordPress uploads directory', () => {
    expect(resolveSourcePath('/uploads', '2018/01/photo.jpg')).toBe(
      '/uploads/2018/01/photo.jpg',
    );
  });

  it('rejects keys that escape the uploads directory', () => {
    expect(() => resolveSourcePath('/uploads', '../secret.txt')).toThrow(
      'escapes the source directory',
    );
  });

  it('rejects a source file whose checksum differs from the manifest', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'theophile-media-'));
    const sourcePath = path.join(root, '2018/01/photo.jpg');
    await fs.mkdir(path.dirname(sourcePath), { recursive: true });
    await fs.writeFile(sourcePath, 'media');
    const checksum = crypto.createHash('sha256').update('media').digest('hex');

    try {
      await expect(
        verifySourceEntry(
          { key: '2018/01/photo.jpg', mime: 'image/jpeg', checksum },
          root,
        ),
      ).resolves.toBe(sourcePath);
      await expect(
        verifySourceEntry(
          {
            key: '2018/01/photo.jpg',
            mime: 'image/jpeg',
            checksum: 'wrong',
          },
          root,
        ),
      ).rejects.toThrow('Checksum mismatch');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('builds a remote Wrangler upload command with content type', () => {
    expect(
      buildWranglerArgs(
        'theophile-media',
        { key: '2018/01/photo.jpg', mime: 'image/jpeg' },
        '/uploads/2018/01/photo.jpg',
      ),
    ).toEqual([
      'r2',
      'object',
      'put',
      'theophile-media/2018/01/photo.jpg',
      '--file',
      '/uploads/2018/01/photo.jpg',
      '--content-type',
      'image/jpeg',
      '--remote',
      '--force',
    ]);
  });

  it('supports a dry run and alternate manifest or bucket', () => {
    expect(
      parseOptions([
        '/uploads',
        '--dry-run',
        '--manifest=/tmp/media.json',
        '--bucket=staging-media',
      ]),
    ).toEqual({
      sourceRoot: '/uploads',
      manifestPath: '/tmp/media.json',
      bucket: 'staging-media',
      statePath: '.media-upload-state.json',
      dryRun: true,
    });
  });

  it('persists completed entries so a later run can skip them', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'theophile-media-'));
    const statePath = path.join(root, 'state.json');
    const entry = {
      key: '2018/01/photo.jpg',
      mime: 'image/jpeg',
      checksum: 'abc123',
    };
    const state = markEntryUploaded(
      createUploadState('theophile-media'),
      entry,
    );

    try {
      await saveUploadState(statePath, state);
      const restored = await loadUploadState(statePath, 'theophile-media');

      expect(isEntryUploaded(restored, entry)).toBe(true);
      expect(isEntryUploaded(restored, { ...entry, checksum: 'changed' })).toBe(
        false,
      );
      expect(await fs.readFile(statePath, 'utf8')).toContain('abc123');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
