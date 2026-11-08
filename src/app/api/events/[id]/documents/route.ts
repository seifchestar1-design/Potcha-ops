import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError, audit, ok, parseBody, requireEventAccess, requireSession, route,
} from '@/lib/api';
import { DOCUMENT_CATEGORIES, MAX_UPLOAD_BYTES } from '@/lib/constants';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/events/:id/documents — metadata only (no blobs)
export const GET = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  const event = await requireEventAccess(auth, id);
  if (!auth.perms.has('documents.view') && !auth.perms.has('documents.upload')) {
    throw new ApiError(403, 'Forbidden: missing document permission');
  }
  const docs = await db.document.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, category: true, fileName: true, mimeType: true,
      sizeBytes: true, createdAt: true, uploadedBy: { select: { id: true, name: true } },
    },
  });
  return ok({
    documents: docs.map((d) => ({
      id: d.id,
      name: d.name,
      category: d.category,
      fileName: d.fileName,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      createdAt: d.createdAt,
      uploadedById: d.uploadedBy.id,
      uploadedByName: d.uploadedBy.name,
    })),
    maxBytes: MAX_UPLOAD_BYTES,
  });
});

// POST /api/events/:id/documents — upload (base64 JSON, ≤5MB, private storage)
const uploadSchema = z.object({
  name: z.string().trim().min(2, 'Document name is required'),
  category: z.enum(DOCUMENT_CATEGORIES).default('GENERAL'),
  fileName: z.string().trim().min(1),
  mimeType: z.string().trim().default('application/octet-stream'),
  contentBase64: z.string().min(1, 'File content is required'),
});

const ALLOWED_MIME_PREFIXES = [
  'text/', 'application/pdf', 'image/', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
];

export const POST = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  const event = await requireEventAccess(auth, id);
  if (!auth.perms.has('documents.upload')) {
    throw new ApiError(403, 'Forbidden: missing permission "documents.upload"');
  }
  const body = await parseBody(req, uploadSchema);

  if (!ALLOWED_MIME_PREFIXES.some((p) => body.mimeType.startsWith(p))) {
    throw new ApiError(400, `File type "${body.mimeType}" is not allowed`);
  }

  const buffer = Buffer.from(body.contentBase64, 'base64');
  if (buffer.length === 0) throw new ApiError(400, 'File is empty');
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new ApiError(400, `File exceeds the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB limit`);
  }

  const created = await db.document.create({
    data: {
      companyId: auth.companyId,
      eventId: event.id,
      name: body.name,
      category: body.category,
      fileName: body.fileName.replace(/[\\/:*?"<>|]/g, '_'),
      mimeType: body.mimeType,
      sizeBytes: buffer.length,
      data: buffer,
      uploadedById: auth.id,
    },
  });

  await audit(auth, {
    action: 'document.uploaded',
    entityType: 'Document',
    entityId: created.id,
    eventId: event.id,
    summary: `Uploaded document "${created.name}" (${created.category}) to "${event.name}"`,
    metadata: { sizeBytes: created.sizeBytes, mimeType: created.mimeType },
  });
  return ok({ document: { id: created.id } }, { status: 201 });
});
