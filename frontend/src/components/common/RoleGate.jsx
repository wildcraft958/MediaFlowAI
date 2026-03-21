/**
 * RoleGate — conditionally renders children based on user role.
 *
 * Usage:
 *   <RoleGate allowed={['admin', 'leadership']}>
 *     <BillablePanel />
 *   </RoleGate>
 *
 * Props:
 *   allowed  — array of roles that CAN see the content
 *   fallback — optional element to render for disallowed roles (default: null)
 */
import useStore from '../../store/useStore'

export default function RoleGate({ allowed = [], children, fallback = null }) {
  const role = useStore((s) => s.user?.role)
  if (!role) return fallback
  if (role === 'admin' || allowed.includes(role)) return children
  return fallback
}
