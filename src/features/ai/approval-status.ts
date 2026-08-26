const APPROVAL_KEY_PREFIX = "star.agent-runtime.approval.";

export const APPROVAL_STATUS_EVENT = "star:approval-status-change";

function approvalKey(threadId: string) {
  return `${APPROVAL_KEY_PREFIX}${threadId}`;
}

export function hasPendingApproval(threadId: string) {
  return localStorage.getItem(approvalKey(threadId)) === "pending";
}

export function setPendingApproval(threadId: string, pending: boolean) {
  const key = approvalKey(threadId);
  const previous = localStorage.getItem(key) === "pending";
  if (previous === pending) return;

  if (pending) localStorage.setItem(key, "pending");
  else localStorage.removeItem(key);

  window.dispatchEvent(new CustomEvent(APPROVAL_STATUS_EVENT, {
    detail: { threadId, pending },
  }));
}
