import React, { Suspense, lazy } from 'react';
import { RouteObject, Navigate } from 'react-router-dom';
import PpmPortalLayout from '@/components/ppm/portal/PpmPortalLayout';
import { Spin, Flex } from 'antd/es';

const PpmLoginPage = lazy(() => import('@/pages/ppm/login/PpmLoginPage'));
const PpmDeliverablesPage = lazy(() => import('@/pages/ppm/deliverables/PpmDeliverablesPage'));
const PpmDeliverableDetailPage = lazy(() => import('@/pages/ppm/deliverables/PpmDeliverableDetailPage'));

const Fallback = () => (
  <Flex justify="center" align="center" style={{ minHeight: '50vh' }}>
    <Spin size="large" />
  </Flex>
);

/**
 * PPM Client Portal routes.
 * Mounted at /portal/* — completely separate from Worklenz's auth/layout.
 */
export const ppmPortalRoutes: RouteObject[] = [
  {
    path: '/portal',
    element: <PpmPortalLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/portal/deliverables" replace />,
      },
      {
        path: 'login',
        element: (
          <Suspense fallback={<Fallback />}>
            <PpmLoginPage />
          </Suspense>
        ),
      },
      {
        path: 'deliverables',
        element: (
          <Suspense fallback={<Fallback />}>
            <PpmDeliverablesPage />
          </Suspense>
        ),
      },
      {
        path: 'deliverables/:id',
        element: (
          <Suspense fallback={<Fallback />}>
            <PpmDeliverableDetailPage />
          </Suspense>
        ),
      },
    ],
  },
];
