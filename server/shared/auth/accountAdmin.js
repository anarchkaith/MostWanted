export const ACCOUNT_ADMIN_ID = '343976455400718339';

export function canViewPrivateAccounts(user) {
  return user?.id === ACCOUNT_ADMIN_ID;
}
