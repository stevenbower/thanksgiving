import { defineAuth } from '@aws-amplify/backend';

// Guests only: players never sign in. Cognito guest (unauthenticated) identities give each
// device an identity so it can create games, post scores and use the real-time channel.
// (An email login is required by the construct but is never used by the game.)
export const auth = defineAuth({
  loginWith: { email: true },
});
