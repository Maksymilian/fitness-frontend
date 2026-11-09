import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { json, mockFetch, operationName, variables } from '../test/fetch';
import { renderPage } from '../test/render';
import { TrainingGoalsPage } from './TrainingGoalsPage';

const ACHIEVED_GOAL = {
  id: 'g1',
  metric: 'DISTANCE',
  target: 200_000,
  discipline: 'CYCLING',
  startsOn: '2026-10-01T00:00:00.000Z',
  endsOn: '2026-11-01T00:00:00.000Z',
  status: 'ACHIEVED',
  progress: 204_500,
  achievedAt: '2026-10-28T18:00:00.000Z',
};

describe('TrainingGoalsPage', () => {
  it('shows the member’s goals with their goal progress', async () => {
    mockFetch(() => json({ data: { member: { trainingGoals: [ACHIEVED_GOAL] } } }));

    renderPage(<TrainingGoalsPage />);

    expect(await screen.findByText('200.00 km of cycling')).toBeInTheDocument();
    expect(screen.getByText('Achieved', { selector: '.badge' })).toBeInTheDocument();
    expect(screen.getByText('204.50 km of 200.00 km (100%)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abandon' })).not.toBeInTheDocument();
  });

  it('sets a goal in the API’s units, ending at midnight UTC after the last day', async () => {
    const sent = mockFetch((request) =>
      operationName(request) === 'SetTrainingGoal'
        ? json({ data: { setTrainingGoal: { ...ACHIEVED_GOAL, status: 'ACTIVE', progress: 0, achievedAt: null } } })
        : json({ data: { member: { trainingGoals: [] } } }),
    );
    renderPage(<TrainingGoalsPage />);

    await userEvent.type(screen.getByLabelText('Goal target (km)'), '150');
    fireEvent.change(screen.getByLabelText('First day'), { target: { value: '2026-12-01' } });
    fireEvent.change(screen.getByLabelText('Last day'), { target: { value: '2026-12-31' } });
    await userEvent.click(screen.getByRole('button', { name: 'Set goal' }));

    const mutation = sent.find((request) => operationName(request) === 'SetTrainingGoal');
    expect(mutation && variables(mutation)).toEqual({
      input: {
        memberId: 'ada@example.com',
        metric: 'DISTANCE',
        target: 150_000,
        startsOn: '2026-12-01T00:00:00.000Z',
        endsOn: '2027-01-01T00:00:00.000Z',
      },
    });
  });

  it('points to a membership when the goal allowance is reached', async () => {
    mockFetch((request) =>
      operationName(request) === 'SetTrainingGoal'
        ? json({
            data: null,
            errors: [
              {
                message: 'grace@example.com may hold 1 active training goal at a time',
                extensions: { code: 'CONFLICT', reason: 'GoalAllowanceReached' },
              },
            ],
          })
        : json({ data: { member: { trainingGoals: [] } } }),
    );
    renderPage(<TrainingGoalsPage />, { memberId: 'grace@example.com' });

    await userEvent.type(screen.getByLabelText('Goal target (km)'), '50');
    await userEvent.click(screen.getByRole('button', { name: 'Set goal' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('GoalAllowanceReached');
    expect(alert).toHaveTextContent('may hold 1 active training goal at a time');
    expect(screen.getByRole('link', { name: 'A membership' })).toHaveAttribute('href', '/membership');
  });
});
