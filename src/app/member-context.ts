import { createContext, useContext } from 'react';

/**
 * The member the app works for. Until Identity exists, a member id is the member's email address,
 * not verified, and the app lets anyone choose one (fitness-backend's `docs/architecture.md`, 14 #6).
 */
export interface MemberChoice {
  memberId: string;
  chooseMember(memberId: string): void;
}

/** The members in the services' test records (fitness-backend's `apps/<service>/liquibase/test-data`). */
export const TEST_MEMBERS = ['ada@example.com', 'grace@example.com', 'linus@example.com'] as const;

export const MemberContext = createContext<MemberChoice | null>(null);

export function useMember(): MemberChoice {
  const choice = useContext(MemberContext);
  if (!choice) {
    throw new Error('useMember() needs a <MemberProvider>');
  }
  return choice;
}

/** Member ids are compared lower-case by every service. */
export function normalizeMemberId(memberId: string): string {
  return memberId.trim().toLowerCase();
}
