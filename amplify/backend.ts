import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';

const backend = defineBackend({ auth, data });

// let abandoned games clean themselves up
const tables = backend.data.resources.cfnResources.amplifyDynamoDbTables;
tables['Game'].timeToLiveAttribute = { attributeName: 'expiresAt', enabled: true };
