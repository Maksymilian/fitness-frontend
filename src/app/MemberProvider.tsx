import { type ReactNode, useMemo, useState } from 'react';
import { MemberContext, normalizeMemberId, TEST_MEMBERS } from './member-context';

const MEMBER_KEY = 'member-id';

function storedMemberId(): string {
  try {
    return localStorage.getItem(MEMBER_KEY) ?? TEST_MEMBERS[0];
  } catch {
    return TEST_MEMBERS[0];
  }
}

export function MemberProvider({ initialMemberId, children }: { initialMemberId?: string; children: ReactNode }) {
  const [memberId, setMemberId] = useState(() => initialMemberId ?? storedMemberId());
  const choice = useMemo(
    () => ({
      memberId,
      chooseMember(next: string) {
        const normalized = normalizeMemberId(next);
        setMemberId(normalized);
        try {
          localStorage.setItem(MEMBER_KEY, normalized);
        } catch {
          // Storage blocked: the choice lasts until the page is reloaded.
        }
      },
    }),
    [memberId],
  );
  return <MemberContext.Provider value={choice}>{children}</MemberContext.Provider>;
}
