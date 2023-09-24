let s3Zip = require('../s3-zip.js')
const t = require('tap')
const fs = require('fs')
const Stream = require('stream')
const concat = require('concat-stream')
const yauzl = require('yauzl')
const join = require('path').join
const streamify = require('stream-array')

const fileStreamForFiles = function (files, preserveFolderPath) {
  const rs = new Stream()
  rs.readable = true

  let fileCounter = 0
  streamify(files).on('data', function (file) {
    fileCounter += 1

    const fileStream = fs.createReadStream(join(__dirname, file))
    fileStream.pipe(
      concat(function buffersEmit (buffer) {
        // console.log('buffers concatenated, emit data for ', file);
        const path = preserveFolderPath ? file : file.replace(/^.*[\\/]/, '')
        rs.emit('data', { data: buffer, path })
      })
    )
    fileStream.on('end', function () {
      fileCounter -= 1
      if (fileCounter < 1) {
        // console.log('all files processed, emit end');
        rs.emit('end')
      }
    })
  })
  return rs
}

const file1 = 'a/file.txt'
const file1Alt = 'file.txt'
const file2 = 'b/file.txt'
const file2Alt = 'file-1.txt'
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const s3Stub = fileStreamForFiles(
  ['/fixtures/folder/a/file.txt', '/fixtures/folder/b/file.txt'],
  true
)
s3Zip = proxyquire('../s3-zip.js', {
  's3-files': { createFileStream: sinon.stub().returns(s3Stub) }
})

t.test(
  'test archive with matching alternate zip archive names but unique keys',
  function (child) {
    const outputPath = join(__dirname, '/test-unique.zip')
    const output = fs.createWriteStream(outputPath)

    const archive = s3Zip
      .archive(
        { region: 'region', bucket: 'bucket' },
        '/fixtures/folder/',
        [file1, file2],
        [{ name: file1Alt }, { name: file2Alt }]
      )
      .pipe(output)

    const altFiles = [file1Alt, file2Alt]

    archive.on('close', function () {
      yauzl.open(outputPath, function (err, zip) {
        if (err) console.log('err', err)
        zip.on('entry', function (entry) {
          const i = altFiles.indexOf(entry.fileName)
          if (i > -1) {
            child.same(entry.fileName, altFiles[i])
            altFiles.splice(i, 1)
          } else {
            child.ok(false, 'File not found in alternate file names list.')
          }
        })

        zip.on('close', function () {
          child.end()
        })
      })
    })

    child.type(archive, 'object')
  }
)
