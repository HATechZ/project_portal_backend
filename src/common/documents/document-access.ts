/** Authenticated, relative binary endpoints; never expose a storage key. */
export function documentDownloadUrl(versionId: string): string {
  return `/api/v1/document-versions/${versionId}/download`;
}

export function documentPreviewUrl(
  versionId: string,
  mimeType: string,
): string | null {
  return mimeType === 'application/pdf' || mimeType.startsWith('image/')
    ? `/api/v1/document-versions/${versionId}/preview`
    : null;
}
