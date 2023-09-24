let s3Zip = require('../s3-zip.js')
const t = require('tap')
const fs = require('fs')
const Stream = require('stream')
const concat = require('concat-stream')
const join = require('path').join
const proxyquire = require('proxyquire')
const sinon = require('sinon')

const fileStream = function (file) {
  const rs = new Stream()
  rs.readable = true
  const fileStream = fs.createReadStream(join(__dirname, file))
  fileStream
    .pipe(concat(
      function buffersEmit (buffer) {
        rs.emit('error', new Error())
      })
    )
  fileStream
    .on('end', function () {
      console.log('end fileStream')
      rs.emit('end')
    })
  return rs
}

t.test('test if error on filestream with archiveStream', function (child) {
  const stream = fileStream('./fixtures/file.txt')
  const files = ['foo.png']
  s3Zip.archiveStream(stream, files)
  child.end()
})

t.test('test if error on filestream with archive', function (child) {
  const stream = fileStream('./fixtures/file.txt')
  s3Zip = proxyquire('../s3-zip.js', {
    's3-files': { createFileStream: sinon.stub().returns(stream) }
  })
  const files = ['foo.png']
  s3Zip.archive({ region: 'region', bucket: 'bucket' }, 'folder', files)
  child.end()
})
