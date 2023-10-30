// Test s3-zip BUT using alternate file names for the same file which is listed multiple times

const s3Zip = require('../s3-zip.js')
const t = require('tap')
const fs = require('fs')
const Stream = require('stream')
const concat = require('concat-stream')
const join = require('path').join
const streamify = require('stream-array')
const tar = require('tar')
const sinon = require('sinon')
const proxyquire = require('proxyquire')

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

const outputFiles = [
  'FILE_1_ALT_1.TXT',
  'FILE_1_ALT_2.TXT'
]
const filesRead = []

t.test('test a tar archive with alternate names for one file listed many times', function (child) {
  const inputFiles = [
    '/fixtures/folder/a/file.txt',
    '/fixtures/folder/a/file.txt'
  ]
  const outputPath = join(__dirname, '/test-same_file_alt_name.tar')
  const output = fs.createWriteStream(outputPath)
  const archive = s3Zip
    .setFormat('tar')
    .archiveStream(fileStreamForFiles(inputFiles, true), inputFiles, outputFiles)
    .pipe(output)

  archive.on('close', function () {
    fs.createReadStream(outputPath)
      .pipe(tar.list())
      .on('entry', function (entry) {
        filesRead.push(entry.path)
      })
      .on('end', function () {
        child.same(filesRead, outputFiles)
        child.end()
      })
  })
})

t.test('test archive with alternate names for one file listed many times', function (child) {
  const inputFiles = [
    '/fixtures/folder/a/file.txt',
    '/fixtures/folder/a/file.txt'
  ]
  const s3Zip = proxyquire('../s3-zip.js', {
    's3-files': { createFileStream: sinon.stub().returns(fileStreamForFiles(inputFiles, true)) }
  })
  const archive = s3Zip
    .archive({ region: 'region', bucket: 'bucket' },
      '',
      inputFiles,
      outputFiles.map(file => {
        return { name: file }
      })
    )

  child.type(archive, 'object')
  child.end()
})
