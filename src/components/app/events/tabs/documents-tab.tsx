'use client';

import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, Download, Trash2, FileText, FileCheck2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api, ApiClientError } from '@/lib/client/api';
import type { DocumentRow } from '@/lib/client/types';
import { DOCUMENT_CATEGORIES, MAX_UPLOAD_BYTES } from '@/lib/constants';
import { fmtDate, documentCategoryLabel, fileSize } from '@/lib/client/format';
import { useAppStore } from '@/components/app/store';
import { EmptyState } from '@/components/app/ui/empty-state';
import { ConfirmDialog } from '@/components/app/ui/confirm-dialog';

export function DocumentsTab({ eventId }: { eventId: string }) {
  const user = useAppStore((s) => s.user);
  const queryClient = useQueryClient();
  const canUpload = user?.perms.includes('documents.upload') ?? false;
  const canDeleteAny = user?.perms.includes('events.edit') ?? false;
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleting, setDeleting] = useState<DocumentRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['event-documents', eventId],
    queryFn: () => api<{ documents: DocumentRow[]; maxBytes: number }>(`/events/${eventId}/documents`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/events/${eventId}/documents/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Document deleted');
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ['event-documents', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const docs = data?.documents ?? [];

  const download = async (doc: DocumentRow) => {
    try {
      const res = await fetch(`/api/events/${eventId}/documents/${doc.id}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not download the file');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          Private storage — authorized team members only · max {Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB per file
        </p>
        {canUpload && (
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="mr-1 h-4 w-4" aria-hidden /> Upload document
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : docs.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title="No documents yet"
          description="Upload the signed contract, floor plan, vendor agreements and any reference the team needs."
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {docs.map((d) => {
            const mayDelete = canDeleteAny || d.uploadedById === user?.id;
            return (
              <Card key={d.id}>
                <CardContent className="flex items-center gap-3 p-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{d.name}</p>
                      <Badge variant="outline" className="shrink-0 text-[10px]">{documentCategoryLabel(d.category)}</Badge>
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {d.fileName} · {fileSize(d.sizeBytes)} · {d.uploadedByName} · {fmtDate(d.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Download ${d.name}`}
                      onClick={() => void download(d)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    {mayDelete && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={`Delete ${d.name}`}
                        onClick={() => setDeleting(d)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        eventId={eventId}
        onUploaded={() => {
          queryClient.invalidateQueries({ queryKey: ['event-documents', eventId] });
          queryClient.invalidateQueries({ queryKey: ['event', eventId] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        description="The file is permanently removed from private storage. The deletion is audited."
        confirmLabel="Delete document"
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

function UploadDialog({
  open, onOpenChange, eventId, onUploaded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventId: string;
  onUploaded: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('GENERAL');

  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setError(null);
      setFile(null);
      setName('');
      setCategory('GENERAL');
    }
  }

  const pick = (f: File | null) => {
    setFile(f);
    if (f && !name) setName(f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new ApiClientError(`File exceeds the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB limit`, 400);
      }
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result);
          resolve(result.slice(result.indexOf(',') + 1));
        };
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
      });
      await api(`/events/${eventId}/documents`, {
        method: 'POST',
        body: {
          name: name || file.name,
          category,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          contentBase64,
        },
      });
      toast.success('Document uploaded');
      onOpenChange(false);
      onUploaded();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload a document</DialogTitle>
          <DialogDescription>
            Stored privately — only team members with access to this event can download it.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="doc-file">File</Label>
            <Input
              id="doc-file" type="file" ref={fileRef}
              accept=".pdf,.txt,.md,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.zip"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-[11px] text-muted-foreground">{file.name} · {fileSize(file.size)}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-name">Display name</Label>
            <Input id="doc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Signed contract" required minLength={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger aria-label="Document category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{documentCategoryLabel(c)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || !file}>{busy ? 'Uploading…' : 'Upload'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
