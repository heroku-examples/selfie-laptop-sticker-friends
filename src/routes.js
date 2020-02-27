const controllers = require('./controllers')

module.exports = [
  {
    method: 'GET',
    path: '/health',
    config: controllers.health
  },
  {
    method: 'POST',
    path: '/api/submit',
    config: controllers.submit
  },
  {
    method: 'POST',
    path: '/api/save-photo',
    config: controllers.savePhoto
  },
  {
    method: 'POST',
    path: '/api/change-bg',
    config: controllers.changeBackground
  },
  {
    method: 'POST',
    path: '/api/server-app',
    config: controllers.serverApp
  }
]
