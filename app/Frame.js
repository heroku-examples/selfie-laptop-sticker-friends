import React, { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import frames from './frames'

const Frame = () => {
  const { id } = useParams()

  useEffect(() => {
    document.body.classList.add('full')
    return () => {
      document.body.classList.remove('full')
    }
  })

  return (
    <React.Fragment>
      <div className="landian">
        <img src={frames[id].src} />
      </div>
      <nav className="cta">
        <Link to={`/frame/${id}`} className="btn">
          Take a selfie
        </Link>
        <Link to="/" className="text">
          restart
        </Link>
      </nav>
    </React.Fragment>
  )
}

export default Frame
