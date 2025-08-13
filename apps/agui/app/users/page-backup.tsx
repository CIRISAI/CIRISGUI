'use client';

import { ProtectedRoute } from '../../components/ProtectedRoute';

export default function UsersPage() {
  return (
    <ProtectedRoute requiredRole="ADMIN">
      <div>Test</div>
    </ProtectedRoute>
  );
}
