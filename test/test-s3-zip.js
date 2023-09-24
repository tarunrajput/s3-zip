let s3Zip = require('../s3-zip.js')
const t = require('tap')
const fs = require('fs')
const Stream = require('stream')
const concat = require('concat-stream')
const yauzl = require('yauzl')
const { join } = require('path')

const fileStream = function (file, forceError) {
  const rs = new Stream()
  rs.readable = true
  const fileStream = fs.createReadStream(join(__dirname, file))
  fileStream.pipe(
    concat(function buffersEmit (buffer) {
      if (forceError) {
        console.log('send end to finalize archive')
        rs.emit('end')
      } else {
        rs.emit('data', { data: buffer, path: file })
      }
    })
  )
  fileStream.on('end', function () {
    console.log('end fileStream')
    rs.emit('end')
  })
  return rs
}

const file1 = '/fixtures/file.txt'
const emptyFile = '/fixtures/empty.txt'
// Stub: var fileStream = s3Files.createFileStream(keyStream);
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const s3Stub = fileStream(file1)
s3Zip = proxyquire('../s3-zip.js', {
  's3-files': { createFileStream: sinon.stub().returns(s3Stub) }
})

t.test('test archiveStream and zip file', function (child) {
  const output = fs.createWriteStream(join(__dirname, '/test.zip'))
  const s = fileStream(file1)
  const archive = s3Zip.archiveStream(s).pipe(output)
  archive.on('close', function () {
    console.log('+++++++++++')
    yauzl.open(join(__dirname, '/test.zip'), function (err, zip) {
      if (err) console.log('err', err)
      zip.on('entry', function (entry) {
        // console.log(entry);
        child.same(entry.fileName, 'fixtures/file.txt')
        child.same(entry.compressedSize, 11)
        child.same(entry.uncompressedSize, 20)
      })

      zip.on('close', function () {
        child.end()
      })
    })
  })
  child.type(archive, 'object')
})

t.test('test archive', function (child) {
  const archive = s3Zip.archive(
    { region: 'region', bucket: 'bucket' },
    'folder',
    [file1]
  )
  child.type(archive, 'object')
  child.end()
})

t.test('test archive on empty file', function (child) {
  const output = fs.createWriteStream(join(__dirname, '/test.zip'))
  const s = fileStream(emptyFile)
  const archive = s3Zip.archiveStream(s).pipe(output)
  archive.on('close', function () {
    console.log('+++++++++++')
    yauzl.open(join(__dirname, '/test.zip'), function (err, zip) {
      if (err) console.log('err', err)
      zip.on('entry', function (entry) {
        // console.log(entry);
        child.same(entry.fileName, 'fixtures/empty.txt')
        child.same(entry.compressedSize, 0)
        child.same(entry.uncompressedSize, 0)
      })

      zip.on('close', function () {
        child.end()
      })
    })
  })
  child.type(archive, 'object')
})
