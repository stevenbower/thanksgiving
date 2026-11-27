import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  // A multiplayer game: the join code is the key. The host's device runs the game itself;
  // this record only lets others find the game. Old games expire via DynamoDB TTL (expiresAt).
  Game: a
    .model({
      code: a.id().required(),
      hostId: a.string().required(),
      hostName: a.string(),
      status: a.string().required(), // lobby | playing | ended
      players: a.integer(),
      expiresAt: a.integer(),
    })
    .identifier(['code'])
    .authorization((allow) => [allow.guest(), allow.authenticated()]),

  // High scores. mode = 'single' | 'multi'; names = "Steve (Jan), Ana (Mama)".
  Score: a
    .model({
      mode: a.string().required(),
      score: a.integer().required(),
      names: a.string().required(),
      level: a.integer(),
      kills: a.integer(),
      players: a.integer(),
    })
    .secondaryIndexes((index) => [index('mode').sortKeys(['score']).queryField('scoresByMode')])
    .authorization((allow) => [allow.guest().to(['create', 'read']), allow.authenticated().to(['create', 'read'])]),

  // Real-time channel: lobby messages, WebRTC signalling, and the relay fallback when two
  // devices can't connect directly. Pass-through (no database): publish -> subscribers of that code.
  // (AppSync custom handlers can't use guest identities, so the channel uses the public API key.)
  Signal: a.customType({
    code: a.string().required(),
    from: a.string().required(),
    to: a.string(),
    kind: a.string().required(),
    data: a.string(),
  }),
  publish: a
    .mutation()
    .arguments({ code: a.string().required(), from: a.string().required(), to: a.string(), kind: a.string().required(), data: a.string() })
    .returns(a.ref('Signal'))
    .handler(a.handler.custom({ entry: './publish.js' }))
    .authorization((allow) => [allow.publicApiKey()]),
  receive: a
    .subscription()
    .for(a.ref('publish'))
    .arguments({ code: a.string().required() })
    .handler(a.handler.custom({ entry: './receive.js' }))
    .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'identityPool',
    apiKeyAuthorizationMode: { expiresInDays: 365 },
  },
});
