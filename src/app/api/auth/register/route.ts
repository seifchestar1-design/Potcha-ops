import { ApiError, route } from '@/lib/api';

// Self-registration is permanently CLOSED.
// ------------------------------------------------------------------
// Potcha Ops moved from self-service signup to a platform-administered
// subscriber model: the platform administrator (role ADMIN) creates every
// company workspace, sets its event & team quotas and manages suspension
// via POST /api/admin/companies. This endpoint remains mounted so old
// links/bookmarks get a clear message instead of a silent 404.
export const POST = route(async () => {
  throw new ApiError(
    403,
    'Self-registration is disabled. Company workspaces are created by the Potcha Ops platform administrator — contact us to subscribe.'
  );
});
