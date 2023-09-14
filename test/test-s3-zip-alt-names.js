// Test s3-zip BUT using alternate file names in the resulting zip archive

let s3Zip = require('../s3-zip.js')
const t = require('tap')
const fs = require('fs')
const Stream = require('stream')
const concat = require('concat-stream')
const yauzl = require('yauzl')
const join = require('path').join
const tar = require('tar')

const fileStream = function (file, forceError) {
  const rs = new Stream()
  rs.readable = true
  const fileStream = fs.createReadStream(join(__dirname, file))
  fileStream
    .pipe(concat(
      function buffersEmit (buffer) {
        if (forceError) {
          console.log('send end to finalize archive')
          rs.emit('end')
        } else {
          rs.emit('data', { data: buffer, path: file })
        }
      })
    )
  fileStream
    .on('end', function () {
      console.log('end fileStream')
      rs.emit('end')
    })
  return rs
}

const file1 = '/fixtures/file.txt'
const file1Alt = 'FILE_ALT.TXT'
const file1DataEntry = { name: file1Alt, mode: parseInt('0600', 8) }
// Stub: var fileStream = s3Files.createFileStream(keyStream);
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const s3Stub = fileStream(file1)
s3Zip = proxyquire('../s3-zip.js', {
  's3-files': { createFileStream: sinon.stub().returns(s3Stub) }
})

t.test('test archiveStream and zip file with alternate file name in zip archive', function (child) {
  const output = fs.createWriteStream(join(__dirname, '/test-alt.zip'))
  const s = fileStream(file1)
  const archive = s3Zip
    .archiveStream(s, [file1], [file1Alt])
    .pipe(output)
  archive.on('close', function () {
    console.log('+++++++++++')
    yauzl.open(join(__dirname, '/test-alt.zip'), function (err, zip) {
      if (err) console.log('err', err)
      zip.on('entry', function (entry) {
        // console.log(entry);
        child.same(entry.fileName, file1Alt)
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

t.test('test archive with alternate zip archive names', function (child) {
  const archive = s3Zip
    .archive({ region: 'region', bucket: 'bucket' },
      'folder',
      [file1],
      [file1Alt]
    )
  child.type(archive, 'object')
  child.end()
})

t.test('test a tar archive with EntryData object', function (child) {
  const outputPath = join(__dirname, '/test-entrydata.tar')
  const output = fs.createWriteStream(outputPath)
  const archive = s3Zip
    .setFormat('tar')
    .archiveStream(fileStream(file1), [file1], [file1DataEntry])
    .pipe(output)

  archive.on('close', function () {
    fs.createReadStream(outputPath)
      .pipe(tar.list())
      .on('entry', function (entry) {
        child.same(entry.path, file1Alt)
        child.same(entry.mode, parseInt('0600', 8))
      })
      .on('end', function () {
        child.end()
      })
  })
})
