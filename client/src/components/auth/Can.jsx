import { hasPermission } from '../../utils/auth';

/**
 * Conditionally renders children only when the current user holds the given
 * permission. Admin / developer sessions always pass.
 *
 * Usage:
 *   <Can permission="delete"> <DeleteButton/> </Can>
 *   <Can permission="create" fallback={<Locked/>}> ... </Can>
 */
export default function Can({ permission, children, fallback = null }) {
  return hasPermission(permission) ? children : fallback;
}
