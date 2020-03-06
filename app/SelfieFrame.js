import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import qs from 'query-string'
import frames from './frames'
import api from './api'
import config from './config'
import loadingAnimation from './images/loading.svg'

const createCanvas = ({ width, height }) => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

const cropVideoToDataUrl = (video, frameCropData) => {
  const canvas = createCanvas({ 
    width: frameCropData.width, 
    height: frameCropData.height })
  const context = canvas.getContext('2d')

  //Cropping the image here in canvas
  context.drawImage(video, 
    frameCropData.relativeX, frameCropData.relativeY, 
    frameCropData.width, frameCropData.height,
    0, 0,
    frameCropData.width, frameCropData.height)

  return canvas.toDataURL('image/jpeg', 0.8)
}

const FrameBox = ({ frameCropData }) => {

  return (
    <svg height={frameCropData.height} 
         width={frameCropData.width}
         style={{
           position: 'absolute',
           top: frameCropData.y,
           left: frameCropData.x,
           opacity: 0.3
         }}>

      <rect id='stuff' width={frameCropData.width} 
            height={frameCropData.height} 
            style={{fill: 'rgb(256,256,256)',
               strokeWidth:3,
               strokeDasharray: '10 5',
               stroke:'rgb(0,0,0)'
               }} />
    </svg>
  )
}

const App = () => {
  const { id } = useParams()
  const frame = frames[id]

  const [error, setError] = useState(null)
  const [videoEl, setVideoEl] = useState(null)
  const [imageUrls, setImageUrls] = useState(null)
  const [loading, setLoading] = useState(null)
  const [videoReady, setVideoReady] = useState(false)
  const [share, setShare] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [requestError, setRequestError] = useState(null)
  const [frameCropData, setFrameCropData] = useState(null);

  
  const submit = async () => {

    const dataUrl = loading || cropVideoToDataUrl(videoEl, frameCropData)
    setLoading(dataUrl)
    setError(null)
    setRequestError(null)

    try {
      const data = await sendImages(dataUrl)
      console.log(data)
      setImageUrls(data)
      setLoading(null)
    } catch (e) {
      setImageUrls(null)
      setError(e.message || e)
      setRequestError({
        type: 'submit'
      })
    }
  }


  const sendImages = async (dataUrl) => {

    const data = await (await api('/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: dataUrl,
        frameId: id,
        frameData: {
          shrink: frame.shrink,
          ratio: frame.ratio,
          left: frame.left,
          top: frame.top
        }
      })
    })).json()

    return data

  }

  const addSelfie = async () => {

    setError(false)
    setShareLoading(true)
    setRequestError(null)

    try {
      const data = await (await api('/save-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: imageUrls.background,
          character: imageUrls.sticker
        })
      })).json()
      setShare(data)
      setShareLoading(false)
    } catch (e) {
      setError(e.message)
      setShare(null)
      setShareLoading(false)
      setRequestError({
        type: 'add-selfie'
      })
    }
  }

  const hasVideo = useCallback((node) => {
    if (node !== null) {

      window.navigator.mediaDevices
        .getUserMedia({
          audio: false,
          video: {
             facingMode: 'user'
          }
        })
        .then((stream) => {
          node.srcObject = stream
          setVideoEl(node)
        })
        .catch((e) => {
          console.log(e)
          setError(e.message)
        })
    }
  }, [])

  useEffect(() => {
    const addFull = imageUrls
    if (addFull) document.body.classList.add('full')
    return () => {
      document.body.classList.remove('full')
    }
  }, [imageUrls])

  
  useEffect(() => {
    if (!videoEl) return
    videoEl.addEventListener('play', () => {
      setFrameCropData(getFrameCropData(frame, videoEl))
    })
  }, [videoEl])

  const FRAME_PADDING = 0.1

  const getFrameCropData = (frame, videoEl) => {
    const vWidth = videoEl.videoWidth
    const vHeight = videoEl.videoHeight
    const isImageTooBig = vWidth > vHeight && frame.ratio > 0.9; // this is mostly for the laptop user
    const wWidth = window.outerWidth
    const pad = FRAME_PADDING * (isImageTooBig ? vHeight : vWidth)
    const width = (isImageTooBig ? vHeight : vWidth) - 2*pad
    const height = width * frame.ratio
    const x = wWidth/2 - width/2
    const y = vHeight/2 - height/2
    const {left: videoElLeft, top: videoElTop} = videoEl.getBoundingClientRect();

    return {
      x,
      y,
      height, 
      width,
      relativeX: x - videoElLeft, //relative to the video
      relativeY: y - videoElTop
    }
  }

  return (
    <>
      {/* {error && <div>{error}</div>} */}
      {requestError && (
        <div className='overlay connection-error-container'>
          <h2>Poor Internet connection:</h2>
          <button onClick={requestError.type === 'submit'? submit : addSelfie}>Retry</button>
          <Link to="/" className="button restart">
            Restart
          </Link>
        </div>
      )}
      <div
        className="selfie-frame"
        style={{
          display: imageUrls ? 'none' : 'block'
        }}
      >
        <video
          ref={hasVideo}
          style={{
            transform: 'rotateY(180deg) translateX(50%)',
            display: loading? 'none' : 'block'
          }}
          autoPlay
          muted
          playsInline
          onLoadedMetadata={() => setVideoReady(true)}
        />
            {frameCropData && !loading && (
              <FrameBox frameCropData={frameCropData} />
            )}
        {loading && <img src={loading} style={{marginTop: frameCropData.y}} />}
      </div>
      {videoReady && !imageUrls && (
        <>
          <p className="intro">Fill the box with your face. Tap to capture!</p>
          <button
            className="btn-capture"
            onClick={loading ? () => {} : submit}
            disabled={loading}
          >
          </button>
          {loading && !requestError && (
            <p className='loading-indication'>Loading... <img src={loadingAnimation} /></p>
          )}
          {!loading && (
            <Link to="/" className="text restart">
              restart
            </Link>
          )}
        </>
      )}
      {imageUrls &&
        (share ? (
          <React.Fragment>
            <div className="share-image">
              <img src={imageUrls.background} />
            </div>
            <nav className="cta">
              <a
                href={`https://twitter.com/intent/tweet?${qs.stringify({
                  ...config.twitter.tweet,
                  url: share.html
                })}`}
                className="btn"
                rel="noopener noreferrer"
                target="_blank"
              >
                Share on Twitter
              </a>
              <div>
                <a
                  className="text"
                  href={`${share.image}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  download
                </a>
                <Link to="/" className="text">
                  restart
                </Link>
              </div>
            </nav>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <div className="landian">
              <img src={imageUrls.sticker} />
            </div>
            <nav className="cta">
              <button
                className="btn"
                disabled={shareLoading}
                onClick={shareLoading ? () => {} : addSelfie}
              >
                {shareLoading ? 'Saving...' : 'Add your selfie'}
              </button>
              {!shareLoading && (
                <button className="text" onClick={() => setImageUrls(null)}>
                  or take another one
                </button>
              )}
            </nav>
          </React.Fragment>
        ))}
    </>
  )
}

export default App
