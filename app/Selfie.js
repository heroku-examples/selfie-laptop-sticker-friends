import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import qs from 'query-string'
import characters from './characters'
import api from './api'
import config from './config'
import loadingAnimation from './images/loading.svg'

const createCanvas = ({ width, height }) => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

const cropVideoToDataUrl = (video) => {
  const { videoHeight, videoWidth } = video
  const canvas = createCanvas({ width: videoWidth, height: videoHeight })
  const context = canvas.getContext('2d')
  context.drawImage(video, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.5)
}

const Face = ({ height, width, color, ...rest }) => {
  return (
    <svg height={height} width={width} {...rest}>
      <ellipse
        cx={width / 2}
        cy={height / 2}
        rx={width / 2}
        ry={height / 2}
        fill={color}
      />
    </svg>
  )
}

const App = () => {
  const { id } = useParams()
  const character = characters[id]

  // How far to position the face crop circle from the top of the video
  const CROP_TOP = 0.2

  // We read the absolute pixel size of the character's face from the server
  // and then scale up by this factor
  // TODO: this works well for a 640x480 size video but might need to change
  // for mobile or smaller resized browser windows
  const FACE_SCALE = 9

  const [characterData, setCharacterData] = useState({})
  const [error, setError] = useState(null)
  const [videoEl, setVideoEl] = useState(null)
  const [imageUrls, setImageUrls] = useState(null)
  const [loading, setLoading] = useState(null)
  const [videoReady, setVideoReady] = useState(false)
  const [share, setShare] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [requestError, setRequestError] = useState(null)

  const submit = async () => {
    const { videoHeight: height, videoWidth: width } = videoEl
    const dataUrl = loading || cropVideoToDataUrl(videoEl)

    setLoading(dataUrl)
    setError(null)
    setRequestError(null)

    try {
      const data = await sendImages(dataUrl, height, width)
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

  const sendImages = async (dataUrl, height, width) => {

    const data = await (await api('/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: dataUrl,
        character: character.id,
        crop: {
          width: characterData.width * FACE_SCALE,
          height: characterData.height * FACE_SCALE,
          top: height * CROP_TOP,
          left: (width - characterData.width * FACE_SCALE) / 2
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
          character: imageUrls.character
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
        .catch((e) => setError(e.message))
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
    const fetchData = async () => {
      const res = await api(`/character/${character.id}`)
      const data = await res.json()
      setCharacterData(data)
    }
    fetchData()
  }, [character.id])

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
        {loading && <img src={loading} />}
        {videoReady && characterData.fill && (
          <Face
            className="face"
            style={{ top: videoEl.videoHeight * CROP_TOP }}
            width={characterData.width * FACE_SCALE}
            height={characterData.height * FACE_SCALE}
            color={characterData.fill}
          />
        )}
      </div>
      {videoReady && !imageUrls && (
        <>
          <p className="intro">Fill oval with your face. Tap to capture!</p>
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
                  href={`${share.html}`}
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
              <img src={imageUrls.character} />
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
