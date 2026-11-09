import type { RouteObject } from 'react-router';
import { MembershipPage } from '../billing/MembershipPage';
import { TrainingGoalsPage } from '../training-progress/TrainingGoalsPage';
import { TrainingPage } from '../training-progress/TrainingPage';
import { EquipmentPage } from '../workout-tracking/EquipmentPage';
import { WorkoutsPage } from '../workout-tracking/WorkoutsPage';
import { Layout } from './Layout';
import { NotFoundPage } from './NotFoundPage';

/** `/membership` is Billing's MEMBERSHIP_PAGE_URL: Stripe's pages send the member back to it. */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <TrainingPage /> },
      { path: 'training-goals', element: <TrainingGoalsPage /> },
      { path: 'membership', element: <MembershipPage /> },
      { path: 'equipment', element: <EquipmentPage /> },
      { path: 'workouts', element: <WorkoutsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
