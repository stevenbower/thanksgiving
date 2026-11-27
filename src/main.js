// Wires the AWS backend (when deployed) into the plain-JS game via window.TGNet.
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { setupNet, TGNet } from './net.js';

// amplify_outputs.json only exists once a backend is deployed (CI or `npx ampx sandbox`);
// without it the game still runs single player, and ?net=local still allows multi-tab testing.
const outputs = Object.values(import.meta.glob('../amplify_outputs.json', { eager: true, import: 'default' }))[0];
let client = null;
if (outputs) {
  try {
    Amplify.configure(outputs);
    client = generateClient();
  } catch (e) { console.warn('backend unavailable', e); }
}
setupNet(client);
window.TGNet = TGNet;
window.dispatchEvent(new Event('tgnet-ready'));
