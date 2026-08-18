let socketIoInstance = null;

function setSocketIo(instance) {
  socketIoInstance = instance;
}

function getSocketIo() {
  return socketIoInstance;
}

module.exports = { setSocketIo, getSocketIo };
