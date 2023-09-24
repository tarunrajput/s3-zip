let s3Zip = require('../s3-zip.js')
const t = require('tap')
const fs = require('fs')
const Stream = require('stream')
const concat = require('concat-stream')
const join = require('path').join
const streamify = require('stream-array')
const archiverZipEncryptable = require('archiver-zip-encryptable')
const { exec } = require('child_process')

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
const file2 = 'b/file.txt'
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const s3Stub = fileStreamForFiles(
  ['/fixtures/folder/a/file.txt', '/fixtures/folder/b/file.txt'],
  true
)
s3Zip = proxyquire('../s3-zip.js', {
  's3-files': { createFileStream: sinon.stub().returns(s3Stub) }
})

t.test('test archive password protected', async child => {
  const outputPath = join(__dirname, '/test-password-protected.zip')
  const output = fs.createWriteStream(outputPath)

  await s3Zip
    .setRegisterFormatOptions('zip-encryptable', archiverZipEncryptable)
    .setFormat('zip-encryptable')
    .setArchiverOptions({
      zlib: { level: 8 },
      forceLocalTime: true,
      password: 'test'
    })
    .archive({ region: 'region', bucket: 'bucket' }, '/fixtures/folder/', [
      file1,
      file2
    ])
    .pipe(output)
    .on('finish', async () => {
      exec(
        `unzip -P test ${outputPath} -d ${outputPath}/../testUnzipped/`,
        () => {
          if (
            fs.existsSync(
              `${outputPath}/../testUnzipped/fixtures/folder/a/file.txt`
            )
          ) {
            child.ok(true, 'file exist after unzip')
          }
        }
      )
    })
})
