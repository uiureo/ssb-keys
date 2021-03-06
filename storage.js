var fs         = require('fs')
var mkdirp     = require('mkdirp')
var path       = require('path')
var u          = require('./util')

function isObject (o) {
  return 'object' === typeof o
}

function isFunction (f) {
  return 'function' === typeof f
}

function empty(v) { return !!v }

function toFile (s) {
  if('object' == typeof s && s.path)
    return path.join(s.path, 'secret')
}
module.exports = function (generate) {

  if(!fs || !fs.readFileSync)
    return require('./local-storage')(generate)

  var exports = {}

  //(DE)SERIALIZE KEYS

  function constructKeys(keys, legacy) {
    if(!keys) throw new Error('*must* pass in keys') 

    return [
    '# this is your SECRET name.',
    '# this name gives you magical powers.',
    '# with it you can mark your messages so that your friends can verify',
    '# that they really did come from you.',
    '#',
    '# if any one learns this name, they can use it to destroy your identity',
    '# NEVER show this to anyone!!!',
    '',
    legacy ? keys.private : JSON.stringify(keys, null, 2),
    '',
    '# WARNING! It\'s vital that you DO NOT edit OR share your secret name',
    '# instead, share your public name',
    '# your public name: ' + keys.id
    ].join('\n')
  }

  function reconstructKeys(keyfile) {
    var private = keyfile
      .replace(/\s*\#[^\n]*/g, '')
      .split('\n').filter(empty).join('')

    //if the key is in JSON format, we are good.
    try {
      var keys = JSON.parse(private)
      if(!u.hasSigil(keys.id)) keys.id = '@' + keys.public
      return keys
    } catch (_) { console.error(_.stack) }

    //else, reconstruct legacy curve...

    var curve = u.getTag(private)

    if(curve !== 'k256')
      throw new Error('expected legacy curve (k256) but found:' + curve)

    var fool_browserify = require
    var ecc = fool_browserify('./eccjs')

    return u.keysToJSON(ecc.restore(u.toBuffer(private)), 'k256')
  }

  function toFile (filename) {
    if(isObject(filename))
      return path.join(filename.path, 'secret')
    return filename
  }

  exports.load = function(filename, cb) {
    filename = toFile(filename, 'secret')
    fs.readFile(filename, 'ascii', function(err, privateKeyStr) {
      if (err) return cb(err)
      var keys
      try { keys = reconstructKeys(privateKeyStr) }
      catch (err) { return cb(err) }
      cb(null, keys)
    })
  }

  exports.loadSync = function(filename) {
    filename = toFile(filename, 'secret')
    return reconstructKeys(fs.readFileSync(filename, 'ascii'))
  }

  exports.create = function(filename, curve, legacy, cb) {
    if(isFunction(legacy))
      cb = legacy, legacy = null
    if(isFunction(curve))
      cb = curve, curve = null

    filename = toFile(filename, 'secret')
    var keys = generate(curve)
    var keyfile = constructKeys(keys, legacy)
    mkdirp(path.dirname(filename), function (err) {
      if(err) return cb(err)
      fs.writeFile(filename, keyfile, function(err) {
        if (err) return cb(err)
        cb(null, keys)
      })
    })
  }

  exports.createSync = function(filename, curve, legacy) {
    filename = toFile(filename, 'secret')
    var keys = generate(curve)
    var keyfile = constructKeys(keys, legacy)
    mkdirp.sync(path.dirname(filename))
    fs.writeFileSync(filename, keyfile)
    return keys
  }

  return exports
}



