const host = "127.0.0.1";
const defaultPort = 4173;

function getPort() {
  return Number(process.env.PORT || defaultPort);
}

function getServerUrl(port = getPort()) {
  return `http://${host}:${port}`;
}

module.exports = {
  host,
  defaultPort,
  getPort,
  getServerUrl,
  port: getPort(),
  serverUrl: getServerUrl()
};

