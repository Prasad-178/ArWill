import ArLocal from 'arlocal';

async function startArLocal() {
  const arLocal = new ArLocal();

  // Start is a Promise, we need to start it inside an async function.
  console.log('Starting ArLocal...');
  await arLocal.start();

}

startArLocal();
