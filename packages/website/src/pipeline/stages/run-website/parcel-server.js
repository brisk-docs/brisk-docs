/* eslint-disable no-restricted-syntax */
const Parcel = require('@parcel/core').default;
const express = require('express');
const path = require('path');

const configPath = require.resolve('@parcel/config-default');
const defaultConfig = {
  // eslint-disable-next-line global-require
  ...require('@parcel/config-default'),
  filePath: configPath,
};

module.exports = async function createParcelServer({ port, staticRoot }) {
  const builtEntryPage = path.resolve(staticRoot, 'index.html');
  const DIST_DIR = path.resolve(staticRoot, '.dist');

  const parcelWatchSubscription = await new Parcel({
    entries: [builtEntryPage],
    defaultConfig,
    killWorkers: false,
    sourceMaps: false,
    targets: {
      main: {
        distDir: DIST_DIR,
        engines: {
          browsers: ['last 1 Chrome version'],
        },
        publicUrl: '/',
      },
    },
  }).watch();

  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.resolve(staticRoot, 'views'));

  app.use(express.static(DIST_DIR));
  app.use('/static', express.static(path.join(staticRoot, 'static')));

  app.get('*', async (_, res) => {
    res.sendFile(builtEntryPage);
  });

  const canonPort = port != null ? port : 3001;

  const server = app.listen(canonPort);

  console.log('website ready on port:', canonPort);

  return {
    async dispose() {
      // `close` is on the returned server object, not on `app`.
      // https://stackoverflow.com/questions/8659011/how-do-i-programmatically-shut-down-an-instance-of-expressjs-for-testing
      server.close();
      await parcelWatchSubscription.unsubscribe();
    },
  };
};
