import { util, extensions } from '@aws-appsync/utils';

// only deliver messages for the game code this subscriber asked for
export function request() {
  return { payload: null };
}
export function response(ctx) {
  extensions.setSubscriptionFilter(util.transform.toSubscriptionFilter({ code: { eq: ctx.args.code } }));
  return null;
}
