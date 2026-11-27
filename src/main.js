// Wires the AWS backend (when deployed) into the plain-JS game via window.TGNet.
// The heavy Amplify code loads in the background; window.TGNetLoad resolves when it's ready
// (or rejects with the reason), so the game can wait for it instead of failing on a slow phone.
const outputs = Object.values(import.meta.glob('../amplify_outputs.json', { eager: true, import: 'default' }))[0];

window.TGNetLoad = (async () => {
  const { setupNet, TGNet } = await import('./net.js');
  let client = null;
  if (outputs) {
    const [{ Amplify }, { generateClient }] = await Promise.all([import('aws-amplify'), import('aws-amplify/data')]);
    Amplify.configure(outputs);
    client = generateClient();
  }
  setupNet(client);
  window.TGNet = TGNet;
  window.dispatchEvent(new Event('tgnet-ready'));
  return TGNet;
})();
window.TGNetLoad.catch(e => { window.TGNetError = (e && e.message) || String(e); console.warn('online features failed to load', e); });
