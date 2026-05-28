export function getEndUserSessionId(req: Request): string | null {
  const header =
    req.headers.get('x-user-session-id') ||
    req.headers.get('x-session-id') ||
    req.headers.get('x-user-id');
  if (header && header.trim()) return header.trim();

  try {
    const url = new URL(req.url);
    const qp =
      url.searchParams.get('sessionId') ||
      url.searchParams.get('session_id') ||
      url.searchParams.get('userId') ||
      url.searchParams.get('user_id');
    if (qp && qp.trim()) return qp.trim();
  } catch { }

  return null;
}

export function canEndUserAccessResource(params: {
  resourceOwnerId: string | null | undefined;
  requesterSessionId: string | null | undefined;
}): boolean {
  const owner = typeof params.resourceOwnerId === 'string' ? params.resourceOwnerId.trim() : '';
  const requester = typeof params.requesterSessionId === 'string' ? params.requesterSessionId.trim() : '';
  if (!owner || !requester) return false;
  return owner === requester;
}
