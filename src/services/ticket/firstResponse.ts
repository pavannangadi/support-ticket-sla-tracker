export interface FirstResponseCheckInput {
  reporterId: string;
  authorId: string;
  firstResponseAt: Date | null;
}

/**
 * Determines whether a newly-added comment should be recorded as the
 * ticket's first response. True only when the comment author is not the
 * reporter AND no first response has been recorded yet.
 */
export function isFirstResponse(input: FirstResponseCheckInput): boolean {
  const isFromNonReporter = input.authorId !== input.reporterId;
  const noResponseRecordedYet = input.firstResponseAt === null;
  return isFromNonReporter && noResponseRecordedYet;
}
