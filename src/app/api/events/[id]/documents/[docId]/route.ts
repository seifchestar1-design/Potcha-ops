import { db } from '@/lib/db';
import {
  ApiError, audit, ok, requireEventAccess, requireSession, route,
} from '@/lib/api';

type Ctx = { params: Promise<{ id: string; docId: string }> };

// GET /api/events/:id/documents/:docId — authorized download.
// Files live in private storage (DB blobs) and are streamed only to
// users with documents.view + event access. Never publicly reachable.
export const GET = route<{ id: string; docId: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id, docId } = await ctx.params;
  const event = await requireEventAccess(auth, id);
  if (!auth.perms.has('documents.view') && !auth.perms.has('documents.upload')) {
    throw new ApiError(403, 'Forbidden: missing document permission');
  }

  const doc = await db.document.findFirst({
    where: { id: docId, eventId: event.id, companyId: auth.companyId },
  });
  if (!doc) throw new ApiError(404, 'Document not found');

  const bytes = Buffer.isBuffer(doc.data) ? doc.data : Buffer.from(doc.data as unknown as Uint8Array);
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': doc.mimeType,
      'Content-Length': String(bytes.length),
      'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.fileName)}"`,
      'Cache-Control': 'private, no-store',
    },
  }) as never;
});

// DELETE /api/events/:id/documents/:docId — uploader or CEO (events.edit)
export const DELETE = route<{ id: string; docId: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id, docId } = await ctx.params;
  const event = await requireEventAccess(auth, id);

  const doc = await db.document.findFirst({
    where: { id: docId, eventId: event.id, companyId: auth.companyId },
  });
  if (!doc) throw new ApiError(404, 'Document not found');

  const mayDelete = doc.uploadedById === auth.id || auth.perms.has('events.edit');
  if (!mayDelete) throw new ApiError(403, 'Only the uploader or the CEO can delete this document');

  await db.document.delete({ where: { id: doc.id } });
  await audit(auth, {
    action: 'document.deleted',
    entityType: 'Document',
    entityId: doc.id,
    eventId: event.id,
    summary: `Deleted document "${doc.name}" from "${event.name}"`,
  });
  return ok({ success: true });
});
