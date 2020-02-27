const sharp = require('sharp')
const path = require('path')
const fs = require('fs').promises
const svgson = require('svgson')
const { PNG } = require('pngjs')
const fetch = require('node-fetch')
const _ = require('lodash')
const UUID = require('uuid')
const config = require('getconfig')
const pRetry = require('p-retry')
const { minify: minifyHtml } = require('html-tagged-literals')
const aws = require('./aws')

const generateUploadId = (length = config.upload.keyLength) => {
  // Less ambiguous character set (no o, 0, 1, l, i, etc)
  const c = 'abcdefghjkmnpqrstuvwxyz23456789'
  return _.times(length, () => c.charAt(_.random(c.length - 1))).join('')
}

const readAppImage = (image) =>
  fs.readFile(path.resolve(__dirname, '..', 'app', 'images', image))

const bufToBase64Img = (buf, type = 'png') =>
  `data:image/${type};base64,${buf.toString('base64')}`

const base64ImgToBuf = (base64, type = 'png') =>
  Buffer.from(base64.replace(`data:image/${type};base64,`, ''), 'base64')

const svgToPng = (image) =>
  sharp(image)
    .png()
    .toBuffer()

const svgDimensions = async (image) => {
  const data = await svgson.parse(
    Buffer.isBuffer(image) ? image.toString() : image
  )
  return {
    height: +data.attributes.height,
    width: +data.attributes.width
  }
}

const transformObject = _.curry((transform, obj) =>
  Object.keys(obj).reduce((acc, key) => {
    acc[key] = transform(obj[key])
    return acc
  }, {})
)

const scaleObject = _.curry((scale, obj) =>
  transformObject((v) => v * scale, obj)
)
const intObject = _.curry((toInt, obj) => transformObject(toInt, obj))

const positionObject = (position) => (obj, bg) => {
  const bottom = bg.height - bg.height * position.bottom
  const top = bottom - obj.height
  const right = bg.width - bg.width * position.right
  const left = right - obj.width
  return { top, left }
}

const getPngAlphaBounds = (image) =>
  new Promise((resolve, reject) => {
    new PNG({ filterType: 4 }).parse(image, (err, data) => {
      if (err) return reject(err)

      const getStartEnd = (arr) =>
        arr
          .map((rowOrCol) => rowOrCol.every((isTransparent) => isTransparent))
          .map((isTransparent, index, list) => {
            const prevIsTransparent = list[index - 1]
            if (!isTransparent && prevIsTransparent === true) {
              return index + 1
            } else if (isTransparent && prevIsTransparent === false) {
              return index
            }
            return null
          })
          .filter((v) => v !== null)

      const rows = _.range(0, data.height).map(() => [])
      const columns = _.range(0, data.width).map(() => [])

      for (let y = 0; y < data.height; y++) {
        for (let x = 0; x < data.width; x++) {
          const idx = (data.width * y + x) << 2
          const isTransparent = data.data[idx + 3] === 0
          rows[y].push(isTransparent)
          columns[x].push(isTransparent)
        }
      }

      const [xStart, xEnd] = getStartEnd(columns)
      const [yStart, yEnd] = getStartEnd(rows)

      resolve({
        left: xStart,
        top: yStart,
        right: xEnd,
        bottom: yEnd,
        width: xEnd - xStart,
        height: yEnd - yStart
      })
    })
  })

exports.serverApp = {
  handler: async (req) => {
    // Allow for the serverAppName config value to be a full url for easier
    // testing locally
    const serverAppUrl = new URL(
      '/api/attendee-app',
      config.serverAppName.startsWith('http')
        ? config.serverAppName
        : `https://${config.serverAppName}.herokuapp.com`
    )

    const payload = req.payload
    req.log(['server-app'], { url: serverAppUrl, payload })

    const res = await (await fetch(serverAppUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })).json()

    return res
  }
}

exports.changeBackground = {
  handler: async (req) => {
    req.server.plugins.kafka.changeBackground()
    return { status: 'success' }
  }
}

exports.health = {
  handler: async (req) => {
    return { status: 'ok' }
  }
}

exports.savePhoto = {
  handler: async (req) => {
    const user = req.state.data || {}
    const { image, character } = req.payload

    let uploadId = generateUploadId()

    const upload = async () => {
      const keyAvailable = await aws.keyAvailable(uploadId)

      if (!keyAvailable) {
        throw new Error('Retrying this')
      }

      const [imageUpload, characterUpload] = await Promise.all([
        aws.upload(`${uploadId}.jpg`, base64ImgToBuf(image, 'jpeg')),
        aws.upload(`${uploadId}-c.png`, base64ImgToBuf(character))
      ])

      const htmlUpload = await aws.upload(
        uploadId,
        minifyHtml`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta http-equiv="X-UA-Compatible" content="chrome=1" />
            <title>Test title</title>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <meta name="twitter:card" content="summary_large_image">
            <meta name="twitter:title" content="${config.twitter.card.title}">
            <meta name="twitter:image" content="${imageUpload.url}">
            ${
              config.twitter.card.site
                ? `<meta name="twitter:site" content="${config.twitter.card.site}">`
                : ''
            }
            ${
              config.twitter.card.description
                ? `<meta name="twitter:description" content="${config.twitter.card.description}">`
                : ''
            }
          </head>
          <body>
            <img src=${imageUpload.url} />
          </body>
        </html>
      `
      )

      return {
        imageUpload,
        characterUpload,
        htmlUpload
      }
    }

    const { imageUpload, characterUpload, htmlUpload } = await pRetry(upload, {
      retries: 5,
      onFailedAttempt: (err) => {
        const failedId = uploadId
        uploadId = generateUploadId()
        req.log(['save-files', 'retry', 'warn'], {
          failedId,
          newId: uploadId,
          attemptNumber: err.attemptNumber
        })
      }
    })

    req.log(['save-files'], {
      image: imageUpload,
      character: characterUpload,
      html: htmlUpload
    })

    const res = {
      image: imageUpload.url,
      character: characterUpload.url,
      html: htmlUpload.url
    }

    req.server.plugins.kafka.sendSubmission({
      ...res,
      uploadId,
      user: _.pick(user, 'id')
    })

    return res
  }
}


exports.submit = {
  handler: async (req, h) => {
    const { image, frameId, frameData } = req.payload

    const user = req.state.data || {}
    if (!user.id) user.id = UUID.v4()
    h.state('data', user)

    const scaleSvg = scaleObject(2)

    let frameImageBuffer = await readAppImage(`${frameId}.svg`)
    //First make the frame larger than the video image
    const frameImageDim = await sharp(frameImageBuffer).metadata().then(scaleSvg)
    frameImageBuffer = await sharp(frameImageBuffer)
      .resize(frameImageDim.width, frameImageDim.height)
      .png()
      .toBuffer()
  
    let videoImageBuffer = base64ImgToBuf(image, 'jpeg')
    videoImageBuffer = await sharp(videoImageBuffer)
    .resize({
      width: frameImageDim.width*frameData.shrink,
      fit: 'contain',
      position: 'top'
    })
    .png()
    .toBuffer()
    // .toFile('out.png')

  const stickerImage = await sharp({
    create: {
      width: frameImageDim.width,
      height: frameImageDim.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .png()
    .toBuffer()
    .then((b)=>
      sharp(b)
        .composite([{
          input: videoImageBuffer,
          //  gravity: 'north'
          top: Math.round(frameData.top * frameImageDim.height),
          left: Math.round(frameData.left * frameImageDim.width)
        },{
          input: frameImageBuffer
        }])
        .png()
        .toBuffer()
        // .toFile('out.png')
    )

    const stickerPosition = positionObject({
      bottom: 0.1,
      right: 0.1
    })

    const backgroundImage = await readAppImage('submission-bg.svg')
    const backgroundDims = await svgDimensions(backgroundImage)
    const stickerImageResize = await sharp(stickerImage)
      .resize({
        withoutEnlargement: true,
        height: Math.round(backgroundDims.height/2)
      })
      .png()
      .toBuffer()

    const stickerDims = await sharp(stickerImageResize).metadata()
    const {top:stickerTop, left: stickerLeft} = stickerPosition(stickerDims, backgroundDims)
    const stickerOnBg = await sharp(backgroundImage)
      .composite([
        {
          input: stickerImageResize,
          top: Math.round(stickerTop),
          left: Math.round(stickerLeft)
        }
      ])
      .toFormat('jpeg')
      .toBuffer()
    
      const stickerImageFinal = await sharp(stickerImage)
        .resize({
          width: Math.round(frameImageDim.width/2),
          height: Math.round(frameImageDim.height/2),
          fit: 'contain'
        })
        .png()
        .toBuffer()

        return {
          sticker: bufToBase64Img(stickerImageFinal),
          background: bufToBase64Img(stickerOnBg, 'jpeg')
        }

  }
}