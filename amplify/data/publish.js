// pass-through: whatever is published goes straight to subscribers
export function request(ctx) {
  return { payload: ctx.arguments };
}
export const response = (ctx) => ctx.result;
